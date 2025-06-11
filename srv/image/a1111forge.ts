import needle from 'needle';
import { ImageAdapter, ImageRequestOpts } from './types';
import { SD_SAMPLER } from '../../common/image';
import { A1111ForgeApiSettings, ImageSettings } from '../../common/types/image-schema'; // Updated import for A1111ForgeApiSettings
import { logger } from '../middleware';
import { wait } from '../db/util'

// Default settings specific to A1111Forge if any, or rely on user-set ones.
const defaultA1111ForgeSettings: A1111ForgeApiSettings = {
  type: 'a1111forge',
  sampler: SD_SAMPLER['DPM++ 2M'], // Default sampler
  url: 'http://localhost:7861', // Common default A1111 Forge URL
};

/**
 * Detects whether the supplied URL is pointing to a RunPod serverless endpoint.
 * A RunPod endpoint usually looks like:
 *   https://api.runpod.ai/v2/<ENDPOINT_ID>/run     (async)
 *   https://api.runpod.ai/v2/<ENDPOINT_ID>/runsync (sync)
 */
function isRunpodUrl(url: string) {
  return /api\.runpod\.ai\/v2\//.test(url)
}

/** Helper to extract endpoint base (without trailing /run or /runsync) */
function getRunpodBase(url: string) {
  return url.replace(/\/(run|runsync)$/i, '')
}

/** Poll RunPod status endpoint until job completes or fails */
async function pollRunpodStatus(baseUrl: string, jobId: string, headers: Record<string, string>, log: any, timeoutMs = 120000): Promise<any> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    await wait(2000) // 2s between polls
    const statusUrl = `${baseUrl}/status/${jobId}`
    const res = await needle('get', statusUrl, { headers, json: true, rejectUnauthorized: false })
    if (res.statusCode !== 200) {
      log.warn({ statusUrl, statusCode: res.statusCode }, '[RunPod] Non-200 status while polling')
      continue
    }

    const statusBody = res.body as any
    if (statusBody?.status === 'COMPLETED' && statusBody?.output) {
      return statusBody.output
    }
    if (statusBody?.status === 'FAILED' || statusBody?.status === 'CANCELED') {
      throw new Error(`RunPod job failed with status ${statusBody.status}`)
    }
  }
  throw new Error('RunPod job timed out whilst waiting for completion')
}

/** Attempts to locate a base64 image string somewhere in the arbitrary output payload returned by RunPod */
function extractBase64Image(output: any): string | undefined {
  if (!output) return
  if (typeof output === 'string') {
    // If string contains "data:image" treat as base64; otherwise if it looks like http(s) URL, skip (handled separately)
    if (/^data:image\//.test(output) || /^[A-Za-z0-9+/]+=*$/.test(output)) {
      return output
    }
    return undefined
  }
  if (Array.isArray(output)) {
    for (const item of output) {
      const img = extractBase64Image(item)
      if (img) return img
    }
  }
  if (typeof output === 'object') {
    // common key names
    for (const key of ['image', 'images', 'img', 'image_base64', 'data']) {
      if (output[key]) {
        const img = extractBase64Image(output[key])
        if (img) return img
      }
    }
  }
}

/** Extract a direct image URL if present */
function extractImageUrl(output: any): string | undefined {
  if (!output) return
  if (typeof output === 'string' && /^https?:\/\//.test(output)) {
    return output
  }
  if (Array.isArray(output)) {
    for (const item of output) {
      const url = extractImageUrl(item)
      if (url) return url
    }
  }
  if (typeof output === 'object') {
    for (const key of ['url', 'image_url', 'imageUri', 'link']) {
      if (output[key]) {
        const url = extractImageUrl(output[key])
        if (url) return url
      }
    }
  }
}

// SDRequest can be reused if the payload is identical or very similar
// If A1111Forge has a different payload structure, define A1111ForgeRequestPayload accordingly.
interface A1111ForgeRequestPayload {
  prompt: string;
  negative_prompt?: string;
  sampler_name?: string;
  steps?: number;
  cfg_scale?: number;
  width?: number;
  height?: number;
  seed?: number;
  subseed?: number;
  subseed_strength?: number;
  override_settings?: {
    sd_model_checkpoint?: string;
    // Potentially other A1111 specific override_settings
  };
  // Add other A1111 specific parameters here
}

function getA1111ForgePayload(
  opts: ImageRequestOpts,
): A1111ForgeRequestPayload {
  const settings = opts.settings as ImageSettings; // Cast to full ImageSettings
  const a1111Settings = settings?.a1111forge;

  // opts.params.sampler is expected to be a display name if it comes from similar UI elements
  // a1111Settings.sampler is a display name (from UI settings)
  // defaultA1111ForgeSettings.sampler is an API key (e.g., 'k_dpmpp_2m')

  let finalSamplerName: string | undefined
  const uiSamplerDisplayName = opts.params?.sampler ?? a1111Settings?.sampler

  if (uiSamplerDisplayName) {
    finalSamplerName = uiSamplerDisplayName // Use display name directly (e.g., "DPM++ 2M Karras")
  } else if (a1111Settings?.sampler) {
    finalSamplerName = a1111Settings.sampler
  } else {
    finalSamplerName = defaultA1111ForgeSettings.sampler
  }

  const payload: A1111ForgeRequestPayload = {
    prompt: opts.prompt,
    negative_prompt: opts.negative,
    sampler_name: finalSamplerName,
    steps: opts.settings?.steps || opts.params?.steps || 20,
    cfg_scale: opts.settings?.cfg || opts.params?.cfg_scale || 7,
    width: opts.settings?.width || opts.params?.width || 1024,
    height: opts.settings?.height || opts.params?.height || 1024,
    seed: opts.settings?.seed || opts.params?.seed || -1,
    subseed: a1111Settings?.subseed || opts.params?.seed || -1,
    subseed_strength: a1111Settings?.subseed_strength || 0,
  };

  if (opts.model) {
    payload.override_settings = {
      sd_model_checkpoint: opts.model,
    };
  }

  logger.debug({ payload }, '[A1111Forge] Payload generated');
  return payload;
}

export const handleA1111ForgeImage: ImageAdapter = async (opts, log, guestId) => {
  const settings = opts.settings as ImageSettings;
  const a1111ForgeUrl = settings?.a1111forge?.url || defaultA1111ForgeSettings.url;

  if (!a1111ForgeUrl) {
    throw new Error('A1111 Forge URL is not configured.');
  }

  const payload = getA1111ForgePayload(opts);
  let imageBase64: string | undefined
  let outputPayload: any = undefined

  // Determine whether this is a standard A1111 Forge instance or a RunPod Serverless endpoint
  if (isRunpodUrl(a1111ForgeUrl)) {
    // Map UI name -> enum variant accepted by RunPod worker
    const SAMPLER_DISPLAY_TO_VARIANT: Record<string, string> = {
      'Euler a': 'EulerA',
      'Euler': 'Euler',
      'LMS': 'Lms',
      'Huen': 'Heun',
      'DPM2': 'Dpm2',
      'DPM2 A': 'Dpm2A',
      'DPM++ 2S a': 'DpmPP2SA',
      'DPM++ 2M': 'DpmPP2M',
      'DPM++ SDE': 'DpmPPSDE',
      'DPM Fast': 'DpmFast',
      'DPM Adaptive': 'DpmAdaptive',
      'LMS Karras': 'LmsKarras',
      'DPM2 Karras': 'Dpm2Karras',
      'DPM2 a Karras': 'Dpm2AKarras',
      'DPM++ 2S a Karras': 'DpmPP2SAKarras',
      'DPM++ 2M Karras': 'DpmPP2MKarras',
      'DPM++ SDE Karras': 'DpmPPSDEKarras',
      'DDIM': 'Ddim',
      'PLMS': 'Plms',
    }

    const apiKey = process.env.RUNPOD_API_KEY
    if (!apiKey) {
      throw new Error('RUNPOD_API_KEY environment variable not set.')
    }

    const runpodUrl = a1111ForgeUrl.replace(/\/$/, '') // keep as-is, expected to end with /run or /runsync
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      authorization: apiKey,
    }

    const runpodPayload: any = { ...payload }
    // Replace sampler_name with sampler variant, if mapping exists
    if (runpodPayload.sampler_name) {
      const variant = SAMPLER_DISPLAY_TO_VARIANT[runpodPayload.sampler_name]
      if (variant) {
        runpodPayload.sampler = variant
      }
    }
    delete runpodPayload.sampler_name

    log.info({ runpodUrl, runpodPayload }, '[RunPod] Submitting job')

    // Wrap payload inside { input: { ... } } per RunPod spec
    const initialResp = await needle('post', runpodUrl, { input: runpodPayload }, {
      json: true,
      headers,
      rejectUnauthorized: false,
      timeout: 120000,
    })

    // If using /runsync, the output arrives immediately
    if (/\/runsync$/i.test(runpodUrl)) {
      if (initialResp.statusCode !== 200) {
        throw new Error(`RunPod /runsync failed: ${initialResp.statusCode} - ${initialResp.body?.error || 'Unknown error'}`)
      }

      const output = initialResp.body?.output ?? initialResp.body
      outputPayload = output
      imageBase64 = extractBase64Image(output)
    } else {
      // Async /run flow: poll status until completion
      if (initialResp.statusCode !== 200 || !initialResp.body?.id) {
        throw new Error(`RunPod /run failed: ${initialResp.statusCode} - ${initialResp.body?.error || 'Unknown error'}`)
      }

      const jobId: string = initialResp.body.id
      const base = getRunpodBase(runpodUrl)
      log.info({ jobId }, '[RunPod] Job submitted, waiting for completion')
      const output = await pollRunpodStatus(base, jobId, headers, log)
      outputPayload = output
      imageBase64 = extractBase64Image(output)
    }
  } else {
    // ------------------- Local / Self-hosted A1111 Forge Flow -------------------
    const url = `${a1111ForgeUrl.replace(/\/$/, '')}/sdapi/v1/txt2img`
    log.info({ url, payload }, '[A1111Forge] Sending request')

    const response = await needle('post', url, payload, {
      json: true,
      rejectUnauthorized: false,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 120000,
    })

    if (response.statusCode !== 200 || !response.body || !response.body.images) {
      log.error({ body: response.body, statusCode: response.statusCode }, '[A1111Forge] API request failed')
      throw new Error(`A1111 Forge API request failed: ${response.statusCode} - ${response.body?.error || 'Unknown error'}`)
    }

    outputPayload = response.body
    imageBase64 = response.body.images[0]
  }

  if (!imageBase64) {
    // Attempt to find a direct URL and fetch the image bytes
    const imageUrl = extractImageUrl(imageBase64 ?? payload) || extractImageUrl(outputPayload)
    if (!imageUrl) {
      throw new Error('Image base64 data not found in response.')
    }

    log.info({ imageUrl }, '[A1111Forge] Fetching image from URL')
    const imgResp = await needle('get', imageUrl, { encoding: null, rejectUnauthorized: false })
    if (imgResp.statusCode !== 200 || !imgResp.body) {
      throw new Error(`Failed to download image from URL: ${imgResp.statusCode}`)
    }
    return {
      content: imgResp.body,
      ext: 'png',
    }
  }

  // Remove possible data URI prefix
  const cleanBase64 = imageBase64.replace(/^data:image\/[^;]+;base64,/, '')

  return {
    content: Buffer.from(cleanBase64, 'base64'),
    ext: 'png',
  }
}; 