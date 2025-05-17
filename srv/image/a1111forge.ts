import needle from 'needle';
import { ImageAdapter, ImageRequestOpts } from './types';
import { SD_SAMPLER, SD_SAMPLER_REV } from '../../common/image';
import { A1111ForgeApiSettings, ImageSettings } from '../../common/types/image-schema'; // Updated import for A1111ForgeApiSettings
import { logger } from '../middleware';
import { AppSchema } from '/common/types/schema';
import { fixImagePrompt } from '/common/image-prompt';

// Default settings specific to A1111Forge if any, or rely on user-set ones.
const defaultA1111ForgeSettings: A1111ForgeApiSettings = {
  type: 'a1111forge',
  sampler: SD_SAMPLER['DPM++ 2M'], // Default sampler
  url: 'http://localhost:7861', // Common default A1111 Forge URL
};

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

  let finalSamplerName: string;
  const uiSamplerDisplayName = opts.params?.sampler ?? a1111Settings?.sampler;

  if (uiSamplerDisplayName) {
    // Look up the API key from the display name
    finalSamplerName = SD_SAMPLER[uiSamplerDisplayName as keyof typeof SD_SAMPLER];
    if (!finalSamplerName) {
      logger.warn(`[A1111Forge] Unknown sampler display name: ${uiSamplerDisplayName}. Falling back to default or settings-defined API key.`);
      // Fallback to API key from settings if display name lookup fails, or default
      finalSamplerName = a1111Settings?.sampler && !(a1111Settings.sampler in SD_SAMPLER_REV)
        ? a1111Settings.sampler
        : defaultA1111ForgeSettings.sampler;
    }
  } else {
    // If no UI sampler, use the one from settings (which should be an API key) or default
    finalSamplerName = a1111Settings?.sampler && !(a1111Settings.sampler in SD_SAMPLER_REV)
      ? a1111Settings.sampler
      : defaultA1111ForgeSettings.sampler;
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
  const url = `${a1111ForgeUrl.replace(/\/$/, '')}/sdapi/v1/txt2img`;

  log.info({ url, payload }, '[A1111Forge] Sending request');

  const response = await needle('post', url, payload, {
    json: true,
    rejectUnauthorized: false, // Consider if this is appropriate for your security model
    headers: {
      'Content-Type': 'application/json',
      // Add any necessary authentication headers for A1111 Forge if required
      // e.g., 'Authorization': 'Bearer your_api_key' or basic auth
    },
    timeout: 120000, // 2 minutes, adjust as needed
  });

  if (response.statusCode !== 200 || !response.body || !response.body.images) {
    log.error({ body: response.body, statusCode: response.statusCode }, '[A1111Forge] API request failed');
    throw new Error(
      `A1111 Forge API request failed: ${response.statusCode} - ${response.body?.error || 'Unknown error'}`
    );
  }

  const imageBase64 = response.body.images[0];
  if (!imageBase64) {
    throw new Error('A1111 Forge API returned no image data.');
  }

  return {
    content: Buffer.from(imageBase64, 'base64'),
    ext: 'png',
  };
}; 