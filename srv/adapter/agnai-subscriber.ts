import { sanitiseAndTrim } from '/common/requests/util'
import { ModelAdapter } from './type'
import { AppLog } from '../middleware'
import { requestFullCompletion, toChatCompletionPayload } from './chat-completion'
import { decryptText } from '../db/util'
import { streamGenerator } from './stream'
import { getTokenCounter } from '../tokenize'
import { registerAdapter } from './register'
import { getStoppingStrings } from './prompt'

export const handleAgnaiSubscriber: ModelAdapter = async function* (opts) {
  const { members, prompt, log, gen, guest, kind } = opts

  // Get settings from registered adapter config
  const adapterConfig = gen.registered?.['agnai-subscriber']
  const apiUrl = adapterConfig?.thirdPartyUrl
  const rawApiKey = adapterConfig?.thirdPartyKey
  let model = adapterConfig?.thirdPartyModel || ''
  
  log.debug({ 
    adapterConfig, 
    apiUrl, 
    rawApiKey: rawApiKey ? '[REDACTED]' : 'null',
    model,
    registeredKeys: gen.registered ? Object.keys(gen.registered) : 'null'
  }, 'Agnaistic Subscriber adapter config debug')

  if (!apiUrl || !rawApiKey) {
    yield { error: `Agnaistic Subscriber API request failed: URL and API key are required. Check your settings.` }
    return
  }

  const baseUrl = apiUrl.replace(/\/+$/, '') // Remove trailing slashes
  const maxResponseLength = gen.maxTokens ?? 400

  // Use exact defaults from working Agnaistic preset
  const body: any = {
    messages: await toChatCompletionPayload(
      opts,
      getTokenCounter('openai', 'gpt-3.5-turbo'),
      maxResponseLength
    ),
    stream: (gen.streamResponse && kind !== 'summary') ?? false,
    temperature: gen.temp ?? 1.15,  // Agnaistic recommended setting
    max_tokens: maxResponseLength,   // Working preset: 400
    top_p: gen.topP ?? 1,           // Working preset default
    stop: getStoppingStrings(opts),
    presence_penalty: gen.presencePenalty ?? 0,  // Working preset default
    frequency_penalty: gen.frequencyPenalty ?? 0, // Working preset default
  }

  // Add ALL parameters that SillyTavern sends (matching their exact format)
  // Use safer access to potentially undefined properties
  const extendedGen = gen as any
  
  if (extendedGen.max_completion_tokens !== undefined) {
    body.max_completion_tokens = extendedGen.max_completion_tokens
  }
  
  if (extendedGen.logit_bias !== undefined) {
    body.logit_bias = extendedGen.logit_bias
  }
  
  if (extendedGen.seed !== undefined) {
    body.seed = extendedGen.seed
  }
  
  if (extendedGen.n !== undefined) {
    body.n = extendedGen.n
  }
  
  // Add logprobs support (like SillyTavern)
  if (extendedGen.logprobs !== undefined && extendedGen.logprobs > 0) {
    body.logprobs = true
    body.top_logprobs = extendedGen.logprobs
  }
  
  // Add tools support (like SillyTavern)
  if (extendedGen.tools && Array.isArray(extendedGen.tools) && extendedGen.tools.length > 0) {
    body.tools = extendedGen.tools
    body.tool_choice = extendedGen.tool_choice
  }
  
  // Add reasoning effort (like SillyTavern)
  if (extendedGen.reasoning_effort !== undefined) {
    body.reasoning_effort = extendedGen.reasoning_effort
  }
  
  // Add user parameter (like SillyTavern does for OpenAI)
  if (extendedGen.user !== undefined) {
    body.user = extendedGen.user
  }

  // Add additional parameters that might improve response quality
  // UI settings always take precedence over defaults, use exact working preset values
  if (gen.topK !== undefined) {
    body.top_k = gen.topK
  } else {
    // Working preset uses 0 (disabled)
    body.top_k = 0
  }
  
  if (gen.topA !== undefined && gen.topA !== 0) {
    body.top_a = gen.topA
  }
  
  if (gen.repetitionPenalty !== undefined) {
    body.repetition_penalty = gen.repetitionPenalty
  } else {
    // Working preset uses 1.0 (disabled)
    body.repetition_penalty = 1.0
  }
  
  if (gen.tailFreeSampling !== undefined && gen.tailFreeSampling !== 1) {
    body.tail_free_sampling = gen.tailFreeSampling
  } else {
    // Working preset uses 1.0 (disabled)
    body.tail_free_sampling = 1.0
  }
  
  if (gen.typicalP !== undefined && gen.typicalP !== 1) {
    body.typical_p = gen.typicalP
  }
  
  if (gen.minP !== undefined) {
    body.min_p = gen.minP
  } else {
    // Working preset uses 0.07
    body.min_p = 0.07
  }

  // Add model parameter - if it's a UUID (preset ID), use it directly
  // This matches exactly how SillyTavern sends preset IDs
  if (model && model.trim()) {
    body.model = model.trim()
  }

  yield { prompt: body.messages }

  // Handle API key - decrypt if not guest and if it's actually encrypted
  let apiKey = rawApiKey
  if (!guest && apiKey) {
    try {
      // Only try to decrypt if the key appears to be encrypted (contains the encryption prefix)
      if (apiKey.includes('::')) {
        apiKey = decryptText(apiKey)
      }
      // If no encryption prefix, use the key as-is (plain text)
    } catch (ex) {
      // If decryption fails, treat as plain text
      log.debug({ err: ex }, 'Failed to decrypt API key, using as plain text')
    }
  }

  // Standard headers for OpenAI-compatible API
  const headers: any = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'User-Agent': 'Agnaistic/1.0',
  }

  // Ensure the URL ends with the correct endpoint
  let url = baseUrl.replace(/\/+$/, '') // Remove trailing slashes first
  
  if (url.endsWith('/v1/chat/completions')) {
    // URL already complete
    url = url
  } else if (url.endsWith('/v1')) {
    // Base URL ends with /v1, just add /chat/completions
    url = `${url}/chat/completions`
  } else {
    // Base URL doesn't include /v1, add the full path
    url = `${url}/v1/chat/completions`
  }

  log.debug(body, 'Agnaistic Subscriber API payload')
  log.debug({ 
    url, 
    hasApiKey: !!apiKey, 
    apiKeyLength: apiKey?.length,
    model: body.model,
    hasModelParam: 'model' in body 
  }, 'Agnaistic Subscriber API request details')

  const iter = body.stream
    ? streamGenerator({
        userId: opts.user._id,
        url,
        headers,
        body,
        service: 'Agnaistic Subscriber',
        log: opts.log,
        signal: opts.signal,
      })
    : requestFullCompletion({
        userId: opts.user._id,
        url,
        headers,
        body,
        service: 'Agnaistic Subscriber',
        log: opts.log,
        signal: opts.signal,
      })

  let accumulated = ''
  let response: any

  while (true) {
    let generated = await iter.next()

    if (generated.done) {
      response = generated.value
      break
    }

    if ('error' in generated.value) {
      yield { error: generated.value.error }
      return
    }

    if ('token' in generated.value) {
      accumulated += generated.value.token
      
      // Progressive character name stripping to prevent flashing during streaming
      let displayText = accumulated.trimStart()
      const charNamePrefix = `${opts.replyAs.name}:`
      
      // If we're still building up the character name prefix, don't show anything yet
      if (displayText.length > 0 && displayText.length <= charNamePrefix.length && charNamePrefix.startsWith(displayText)) {
        // We're still building up the character name, don't display anything
        continue
      }
      
      // If accumulated text starts with the character name, remove it
      if (displayText.startsWith(charNamePrefix)) {
        displayText = displayText.slice(charNamePrefix.length).trimStart()
      }
      
      // Only yield if we have actual content to show
      if (displayText.length > 0) {
        yield { partial: sanitiseAndTrim(displayText, prompt, opts.replyAs, opts.characters, members) }
      }
    }
  }

  try {
    let text = getCompletionContent(response, log)
    if (text instanceof Error) {
      yield { error: `Agnaistic Subscriber API returned an error: ${text.message}` }
      return
    }

    if (!text?.length) {
      log.error({ body: response }, 'Agnaistic Subscriber API request failed: Empty response')
      yield { error: `Agnaistic Subscriber API request failed: Received empty response. Try again.` }
      return
    }

    yield sanitiseAndTrim(text, prompt, opts.replyAs, opts.characters, members)
  } catch (ex: any) {
    log.error({ err: ex }, 'Agnaistic Subscriber API failed to parse')
    yield { error: `Agnaistic Subscriber API request failed: ${ex.message}` }
    return
  }
}

function getCompletionContent(response: any, log: AppLog): string | Error {
  if (!response) return new Error('Empty response')
  
  if (response.error) {
    return new Error(response.error.message || 'Unknown error')
  }

  const choice = response.choices?.[0]
  if (!choice) {
    return new Error('No choices in response')
  }

  // Handle chat completion format
  if (choice.message?.content) {
    return choice.message.content
  }

  // Handle completion format (fallback)
  if (choice.text) {
    return choice.text
  }

  return new Error('No content found in response')
}

// Register the adapter
registerAdapter('agnai-subscriber', handleAgnaiSubscriber, {
  label: 'Agnaistic Subscriber API',
  settings: [
    {
      field: 'thirdPartyUrl',
      label: 'API Base URL',
      helperText: 'The base URL for your API endpoint (e.g., https://api.agnai.chat/v1)',
      secret: false,
      setting: { type: 'text', placeholder: 'https://api.agnai.chat/v1' },
      preset: true,
      advanced: false,
    },
    {
      field: 'thirdPartyKey',
      label: 'API Key',
      helperText: 'Your API key for authentication',
      secret: true,
      setting: { type: 'text', placeholder: 'Enter your API key' },
      preset: true,
      advanced: false,
    },
    {
      field: 'thirdPartyModel',
      label: 'Model/Preset ID (Optional)',
      helperText: 'Optional: Specific model or preset ID. Leave empty to use API default.',
      secret: false,
      setting: { type: 'text', placeholder: 'Leave empty for default' },
      preset: true,
      advanced: true,
    },
    {
      field: 'maxContextLength',
      label: 'Max Context Length',
      helperText: 'Maximum context length for the model',
      secret: false,
      setting: { type: 'text', placeholder: '4096' },
      preset: true,
      advanced: true,
    },
  ],
  options: [
    'temp',
    'maxTokens',
    'maxContextLength',
    'thirdPartyUrl',
    'thirdPartyKey',
    'thirdPartyModel',
    'topP',
    'topK',
    'topA',
    'minP',
    'repetitionPenalty',
    'repetitionPenaltyRange',
    'repetitionPenaltySlope',
    'tailFreeSampling',
    'typicalP',
    'frequencyPenalty',
    'presencePenalty',
    'streamResponse',
    'systemPrompt',
    'gaslight',
    'ultimeJailbreak',
    'stopSequences',
  ],
  isChat: true,
  canStream: true,
}) 