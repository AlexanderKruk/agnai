import needle from 'needle'

const DEEPL_API_KEY = process.env.DEEPL_API_KEY
// Use the correct endpoint for free API keys
const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate'

/**
 * Translate text to English using DeepL if sourceLang is Russian. Otherwise, return the text as is.
 * @param text The text to translate
 * @param sourceLang The source language code (e.g., 'ru', 'en')
 * @returns The translated text (or original if no translation needed)
 */
export async function translateToEnglishIfNeeded(text: string, sourceLang: string): Promise<string> {
  if (sourceLang === 'en') {
    return text
  }
  if (sourceLang !== 'ru') {
    return text // Only support Russian for now
  }
  if (!DEEPL_API_KEY) {
    console.error('DEEPL_API_KEY is not set')
    return text
  }
  try {
    const response = await needle('post', DEEPL_API_URL, {
      text: [text],
      source_lang: 'RU',
      target_lang: 'EN',
    }, {
      headers: {
        'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      json: true,
    })
    if (response.statusCode && response.statusCode >= 400) {
      console.error('DeepL API error:', response.statusCode, response.body)
      return text
    }
    if (response.body && response.body.translations && response.body.translations[0] && response.body.translations[0].text) {
      return response.body.translations[0].text
    }
    return text
  } catch (err) {
    console.error('DeepL translation error:', err)
    return text
  }
} 