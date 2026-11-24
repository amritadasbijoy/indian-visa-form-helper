// One way to ask the AI service chosen in Settings for a JSON answer: Anthropic (Claude, via the official
// SDK) or any OpenAI-compatible chat API. Used by the passport scan and the hotel finder.
import Anthropic from './anthropic/sdk.js';

const DEFAULT_CLAUDE_MODEL = 'claude-opus-5-5';
// Live web search is only on the Claude side; this tool version runs on Claude Opus 5.5 (not Haiku).
const WEB_SEARCH = { claude: { type: 'web_search_20260209', name: 'web_search', max_uses: 5 }, haiku: { type: 'web_search_20250305', name: 'web_search', max_uses: 5 } };

/**
 * settings: the extension settings (aiProvider, aiKey/aiModel or oaBaseUrl/oaModel/oaKey).
 * request: { system, text, images: [{ mediaType, data }], schema, name, webSearch }.
 * Returns { data, searched } where `searched` says whether live web search was used.
 */
export async function aiJson(settings, request) {
  if (settings.aiProvider === 'helper') return { data: await helperJson(settings, request), searched: false };
  return settings.aiProvider === 'openai'
    ? { data: await openAICompatibleJson(settings, request), searched: false }
    : claudeJson(settings, request);
}

// Helper AI: the owner's server relays the request to River with the owner's key; the user only has a personal
// access code (invite only, monthly limit). Same request shape as any OpenAI-compatible server.
export const HELPER_AI_URL = 'https://ivh.techistbd.com/api/ai';
async function helperJson({ helperCode }, request) {
  if (!helperCode) throw new Error('no-helper-code');
  try {
    return await openAICompatibleJson({ oaBaseUrl: HELPER_AI_URL, oaModel: 'helper', oaKey: helperCode }, request);
  } catch (e) {
    const map = { 'bad-api-key': 'helper-bad-code', 'rate-limited': 'helper-limit' };
    if (map[e.message]) throw new Error(map[e.message]);
    if (/^api-error 50[23]/.test(e.message)) throw new Error('helper-off');
    throw e;
  }
}

// What the Helper AI server knows about an access code: { name, used, limit, month, enabled }.
export async function helperStatus(code) {
  let res;
  try {
    res = await fetch(HELPER_AI_URL + '/me', { headers: { Authorization: `Bearer ${code}` }, cache: 'no-store' });
  } catch {
    throw new Error('offline');
  }
  if (res.status === 401 || res.status === 403) throw new Error('helper-bad-code');
  if (res.status === 429) throw new Error('rate-limited');
  if (!res.ok) throw new Error(`api-error ${res.status}`);
  return res.json();
}

async function claudeJson({ aiKey, aiModel }, { system, text, images = [], schema, webSearch }) {
  const model = aiModel || DEFAULT_CLAUDE_MODEL;
  if (!aiKey) throw new Error('no-api-key');
  const client = new Anthropic({ apiKey: aiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
  // Claude Opus 5.5 can re-route a request its safety classifiers decline; Haiku has no server-side fallback.
  const fallback = model === 'claude-opus-5-5' ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {};
  const content = [
    ...images.map(img => ({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } })),
    { type: 'text', text: webSearch ? `${text}\n\nReply with only a JSON object matching this JSON schema:\n${JSON.stringify(schema)}` : text },
  ];
  const messages = [{ role: 'user', content }];
  // Web search results carry citations, which can't be combined with the strict JSON format: then the prompt asks for JSON.
  const params = {
    model,
    max_tokens: 16000,
    ...fallback,
    system,
    output_config: webSearch ? { effort: 'medium' } : { effort: 'medium', format: { type: 'json_schema', schema } },
    ...(webSearch ? { tools: [model.includes('haiku') ? WEB_SEARCH.haiku : WEB_SEARCH.claude] } : {}),
  };

  let response;
  try {
    // A long search can pause; resending the conversation resumes it (no extra "continue" message).
    for (let turn = 0; turn < 4; turn++) {
      response = await client.beta.messages.create({ ...params, messages });
      if (response.stop_reason !== 'pause_turn') break;
      messages.splice(1, messages.length - 1, { role: 'assistant', content: response.content });
    }
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new Error('bad-api-key');
    if (error instanceof Anthropic.RateLimitError) throw new Error('rate-limited');
    if (error instanceof Anthropic.APIConnectionError) throw new Error('offline');
    if (error instanceof Anthropic.APIError) throw new Error(`api-error ${error.status}: ${error.message}`);
    throw error;
  }
  if (response.stop_reason === 'refusal') throw new Error('refused');
  if (response.stop_reason === 'max_tokens' || response.stop_reason === 'pause_turn') throw new Error('incomplete');
  const texts = response.content.filter(b => b.type === 'text').map(b => b.text);
  const searched = response.content.some(b => b.type === 'server_tool_use');
  // With search the answer is the last text block (earlier ones narrate the search).
  return { data: webSearch ? parseJsonText(texts.join('\n')) : JSON.parse(texts.join('')), searched };
}

// "https://api.openai.com/v1" or a full ".../chat/completions" URL both work.
export const chatCompletionsUrl = base => {
  const b = (base || '').trim().replace(/\/+$/, '');
  return /\/chat\/completions$/.test(b) ? b : b + '/chat/completions';
};

// The models an OpenAI-compatible server offers (GET {base}/models), for the Settings picker.
export async function listOpenAIModels(baseUrl, key) {
  const url = chatCompletionsUrl(baseUrl).replace(/\/chat\/completions$/, '/models');
  let res;
  try {
    res = await fetch(url, { headers: key ? { Authorization: `Bearer ${key}` } : {} });
  } catch {
    throw new Error('offline');
  }
  if (res.status === 401 || res.status === 403) throw new Error('bad-api-key');
  if (!res.ok) throw new Error(`api-error ${res.status}`);
  const body = await res.json();
  return (body.data || body.models || []).map(m => m.id || m.name).filter(Boolean).sort();
}

// OpenAI-compatible servers differ in what they accept: try a strict JSON schema first, then plain
// JSON mode, then no response format at all (the prompt still asks for JSON).
export async function openAICompatibleJson({ oaBaseUrl, oaModel, oaKey }, { system, text, images = [], schema, name = 'answer' }) {
  if (!oaBaseUrl || !oaModel) throw new Error('no-openai-config');
  const url = chatCompletionsUrl(oaBaseUrl);
  const userContent = [
    { type: 'text', text: `${text} Reply with only a JSON object matching this JSON schema:\n${JSON.stringify(schema)}` },
    ...images.map(img => ({ type: 'image_url', image_url: { url: `data:${img.mediaType};base64,${img.data}` } })),
  ];
  const formats = [
    { type: 'json_schema', json_schema: { name, strict: true, schema } },
    { type: 'json_object' },
    null,
  ];
  let lastError = '';
  for (const format of formats) {
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(oaKey ? { Authorization: `Bearer ${oaKey}` } : {}) },
        body: JSON.stringify({
          model: oaModel,
          messages: [{ role: 'system', content: system }, { role: 'user', content: userContent }],
          // Reasoning models (e.g. River's) spend part of this budget thinking before the JSON answer.
          max_tokens: 16000,
          // River's Nemotron thinks for 25–50 s first unless told not to; a passport scan does not need it.
          ...(/nemotron/i.test(oaModel) ? { reasoning_effort: 'none' } : {}),
          ...(format ? { response_format: format } : {}),
        }),
      });
    } catch {
      throw new Error('offline'); // network failure, wrong URL, or the site permission was not granted
    }
    if (res.status === 401 || res.status === 403) throw new Error('bad-api-key');
    if (res.status === 429) throw new Error('rate-limited');
    const body = await res.json().catch(() => ({}));
    if (res.status === 400 || res.status === 422) {
      lastError = body?.error?.message || `HTTP ${res.status}`;
      // Only a complaint about the response format is worth retrying with a simpler one.
      if (/response_format|json_schema|json_object|schema|structured/i.test(lastError)) continue;
      throw new Error(`api-error ${res.status}: ${lastError}`);
    }
    if (!res.ok) throw new Error(`api-error ${res.status}: ${body?.error?.message || res.statusText}`);
    const choice = body.choices?.[0];
    if (choice?.message?.refusal) throw new Error('refused');
    if (choice?.finish_reason === 'length') throw new Error('incomplete');
    return parseJsonText(choice?.message?.content);
  }
  throw new Error(`api-error 400: ${lastError}`);
}

// Accepts plain JSON, JSON in a ``` fence, or JSON surrounded by sentences (the last object wins).
export function parseJsonText(content) {
  const text = Array.isArray(content) ? content.map(p => p.text || '').join('') : content || '';
  const fences = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map(m => m[1]);
  const candidate = fences.length ? fences[fences.length - 1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    throw new Error('incomplete');
  }
}
