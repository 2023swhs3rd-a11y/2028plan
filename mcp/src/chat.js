// 챗봇 HTTP 엔드포인트(/chat, /chat/status):
// - 내부에서 mcp.js의 rpc()를 직접 호출해 도구 목록·프롬프트·실행을 공유한다(런타임 의존성 없음).
// - 질문 성격·복잡도에 따라 Gemini(빠른 조회)와 Claude(복합 비교·작성)를 자동 라우팅하고 오류 시 자동 폴백한다.
// - SSE(Server-Sent Events) 스트리밍으로 도구 호출 현황과 답변 텍스트를 실시간 전달한다.

import { rpc, SERVER } from './mcp.js';
import { checkAccess, getClientIp, getAccessCode, RateLimiter } from './access.js';
import { getProviders, selectRoute, getGeminiCandidates } from './router.js';

const MAX_BODY = 64 * 1024;
const MAX_MESSAGES = 20;
const MAX_MSG_CHARS = 4000;
const MAX_TOOL_ROUNDS = 6;
const MAX_TOOL_RESULT_CHARS = 40_000;
const UPSTREAM_TIMEOUT_MS = 45_000;

const defaultLimiter = new RateLimiter();

function corsHeaders(request, env = {}) {
  const allowed = String(env.ALLOWED_ORIGINS || '').trim();
  let origin = '*';
  if (allowed) {
    const reqOrigin = request.headers.get('Origin') || '';
    const list = allowed.split(/[\s,]+/).filter(Boolean);
    origin = list.includes(reqOrigin) ? reqOrigin : list[0];
  }
  const h = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, X-Access-Code, Authorization',
    'Access-Control-Max-Age': '86400',
  };
  if (origin !== '*') h.Vary = 'Origin';
  return h;
}

function jsonRes(body, status, request, env, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request, env), ...extra },
  });
}

// ── MCP rpc() 내부 호출 래퍼 ──
async function mcpRpc(method, params, getData) {
  const res = await rpc({ jsonrpc: '2.0', id: `${method}-${Date.now()}`, method, params }, getData);
  if (res?.error) throw new Error(res.error.message || `MCP ${method} 오류`);
  return res?.result;
}

function buildSystemPrompt(instructions) {
  return `${instructions}

[챗봇 응답 규칙]
- 항상 제공된 도구를 호출해 2028 대입전형 시행계획 데이터에서 직접 확인한 사실만 답하세요. 수치·수능최저·모집인원·반영비율을 기억이나 추측으로 지어내지 마세요.
- 비교 질문이나 다수 전형 정리에는 마크다운 표(| 열1 | 열2 |)를 적극 활용하세요.
- 도구 결과에 원문 PDF 링크와 쪽수가 있으면 답변에 [원문 PDF (N쪽)](URL) 형태로 클릭 가능한 출처를 함께 제시하세요.
- 시행계획 기준 자료이며 입시 결과(합격선·경쟁률)는 없음을 전제로, 합격 가능성을 단정하지 말고 최종 확인은 각 대학 모집요강을 참고하라고 안내하세요.
- 한국어로 간결하고 명확하게 답하세요.`;
}

// ── Gemini 스키마 정리 (OpenAPI 3.0 부분집합만 유지, 빈 object parameters 생략) ──
function sanitizeGeminiSchema(schema) {
  if (!schema || typeof schema !== 'object') return undefined;
  const out = {};
  if (schema.type) out.type = String(schema.type).toUpperCase();
  if (schema.description) out.description = schema.description;
  if (Array.isArray(schema.enum)) out.enum = schema.enum;
  if (schema.items) out.items = sanitizeGeminiSchema(schema.items);
  if (schema.properties && typeof schema.properties === 'object') {
    const props = {};
    for (const [k, v] of Object.entries(schema.properties)) {
      props[k] = sanitizeGeminiSchema(v);
    }
    if (Object.keys(props).length > 0) out.properties = props;
  }
  if (Array.isArray(schema.required) && schema.required.length > 0) out.required = schema.required;
  return out;
}

function toGeminiTools(mcpTools) {
  return [{
    functionDeclarations: mcpTools.map(t => {
      const decl = { name: t.name, description: t.description };
      const params = sanitizeGeminiSchema(t.inputSchema);
      if (params && params.properties && Object.keys(params.properties).length > 0) {
        decl.parameters = params;
      }
      return decl;
    }),
  }];
}

function toClaudeTools(mcpTools) {
  return mcpTools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
}

function summarizeToolResult(name, rawText, isError) {
  if (isError) return { summary: '조회 오류', count: null };
  try {
    const d = JSON.parse(rawText);
    if (name === 'search_admissions') return { summary: `전형 ${d.결과수 ?? 0}건 조회`, count: d.결과수 ?? 0 };
    if (name === 'get_university') return { summary: d.대학 ? `${d.대학} (${(d.전형 || []).length}개 전형)` : '대학 상세 조회', count: (d.전형 || []).length };
    if (name === 'list_changes') return { summary: `변경사항 ${d.결과수 ?? 0}건`, count: d.결과수 ?? 0 };
    if (name === 'find_rural') return { summary: `농어촌 전형 ${d.결과수 ?? 0}건`, count: d.결과수 ?? 0 };
    if (name === 'convert_grade') return { summary: `${d.입력등급}등급 환산 (${d.결과수 ?? 0}개 전형)`, count: d.결과수 ?? 0 };
    if (name === 'search_csat_weights') return { summary: `정시 비율 ${d.결과수 ?? 0}건`, count: d.결과수 ?? 0 };
    if (name === 'get_source') return { summary: d.대학 ? `${d.대학} 원문 PDF` : '원문 조회', count: (d.원문파일 || []).length };
    if (name === 'data_info') return { summary: `수록 대학 ${d.universities ?? (d.수록대학 || []).length}곳`, count: d.universities ?? null };
    return { summary: '조회 완료', count: d.결과수 ?? null };
  } catch {
    return { summary: '조회 완료', count: null };
  }
}

// ── SSE 스트림 파서 (Gemini · Claude 업스트림 공용) ──
export async function* parseSSE(body) {
  if (!body) return;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let sep;
      while ((sep = buf.indexOf('\n\n')) !== -1) {
        const block = buf.slice(0, sep);
        buf = buf.slice(sep + 2);
        const parsed = parseSseBlock(block);
        if (parsed) yield parsed;
      }
    }
    buf += decoder.decode().replace(/\r\n/g, '\n');
    if (buf.trim()) {
      const parsed = parseSseBlock(buf);
      if (parsed) yield parsed;
    }
  } finally {
    try { reader.releaseLock(); } catch {}
  }
}

function parseSseBlock(block) {
  let event = 'message';
  const dataLines = [];
  for (const line of block.split('\n')) {
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }
  if (!dataLines.length) return null;
  const data = dataLines.join('\n');
  if (data === '[DONE]') return null;
  return { event, data };
}

function combineSignals(reqSignal, timeoutMs) {
  const timeout = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(timeoutMs)
    : null;
  if (reqSignal && timeout && typeof AbortSignal.any === 'function') {
    return AbortSignal.any([reqSignal, timeout]);
  }
  return reqSignal || timeout || undefined;
}

function sanitizeErrorMessage(err) {
  const raw = String(err?.message || err || '알 수 없는 오류');
  return raw.replace(/(key=|AIza|AQ\.|sk-ant-)[^\s&"']+/gi, '[REDACTED]').slice(0, 400);
}

const DEFAULT_GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export function geminiEndpoint(model, baseUrl = '') {
  const base = String(baseUrl || DEFAULT_GEMINI_BASE).trim().replace(/\/+$/, '');
  const m = encodeURIComponent(model);
  return `${base}/models/${m}:streamGenerateContent?alt=sse`;
}

// ── 도구 실행 공통 헬퍼 ──
async function executeToolCall({ id, name, args, toolTitleMap, getData, emit }) {
  const title = toolTitleMap.get(name) || name;
  emit('tool_call', { id, name, title, arguments: args || {} });
  let text = '';
  let isError = false;
  try {
    const res = await mcpRpc('tools/call', { name, arguments: args || {} }, getData);
    text = res?.content?.[0]?.text || '';
    isError = Boolean(res?.isError);
  } catch (e) {
    text = JSON.stringify({ 오류: e.message || '도구 실행 실패' });
    isError = true;
  }
  const { summary, count } = summarizeToolResult(name, text, isError);
  emit('tool_result', { id, name, title, summary, count, isError });
  if (text.length > MAX_TOOL_RESULT_CHARS) {
    text = text.slice(0, MAX_TOOL_RESULT_CHARS) + '\n...(응답이 길어 일부 생략됨)';
  }
  return { text, isError };
}

const TRANSIENT_GEMINI_RE = /HTTP (429|503)|high demand|overloaded|UNAVAILABLE|RESOURCE_EXHAUSTED/i;
const CASCADE_GEMINI_RE = /HTTP (404|429|503)|high demand|overloaded|UNAVAILABLE|RESOURCE_EXHAUSTED/i;
const sleep = ms => (ms > 0 ? new Promise(r => setTimeout(r, ms)) : Promise.resolve());

// ── Gemini 스트리밍 + 다중 도구 호출 루프 (AI Studio AIza·AQ. 키 기본 지원, GEMINI_BASE_URL 지정 시 Vertex AI 등 사용) ──
async function runGemini({ model, apiKey, baseUrl, systemPrompt, mcpTools, toolTitleMap, messages, getData, emit, fetchImpl, signal, retryDelayMs = 600 }) {
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const tools = toGeminiTools(mcpTools);
  let totalToolCalls = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const url = geminiEndpoint(model, baseUrl);
    let modelParts;
    let functionCalls;

    for (let attempt = 0; attempt < 2; attempt++) {
      let emittedTextThisAttempt = false;
      try {
        const res = await fetchImpl(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents,
            tools,
            generationConfig: { maxOutputTokens: 4096 },
          }),
          signal: combineSignals(signal, UPSTREAM_TIMEOUT_MS),
        });

        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          throw new Error(`Gemini HTTP ${res.status}${errBody ? `: ${errBody.slice(0, 320)}` : ''}`);
        }

        modelParts = [];
        functionCalls = [];
        let textBuf = '';
        const flushText = () => {
          if (textBuf) { modelParts.push({ text: textBuf }); textBuf = ''; }
        };

        for await (const ev of parseSSE(res.body)) {
          let chunk;
          try { chunk = JSON.parse(ev.data); } catch { continue; }
          if (chunk.error) throw new Error(`Gemini 오류: ${chunk.error.message || chunk.error.code || 'unknown'}`);
          const parts = chunk.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.functionCall) {
              flushText();
              modelParts.push(part);
              functionCalls.push(part.functionCall);
            } else if (typeof part.text === 'string' && !part.thought) {
              if (part.thoughtSignature) {
                flushText();
                modelParts.push(part);
              } else {
                textBuf += part.text;
              }
              emittedTextThisAttempt = true;
              emit('delta', { text: part.text });
            } else if (part.thought && part.thoughtSignature) {
              flushText();
              modelParts.push(part);
            }
          }
        }
        flushText();
        break;
      } catch (e) {
        if (attempt === 0 && !emittedTextThisAttempt && !signal?.aborted && TRANSIENT_GEMINI_RE.test(String(e?.message || ''))) {
          await sleep(retryDelayMs);
          continue;
        }
        throw e;
      }
    }

    if (!functionCalls.length) {
      return { toolCalls: totalToolCalls };
    }

    contents.push({ role: 'model', parts: modelParts });

    const responseParts = [];
    for (let i = 0; i < functionCalls.length; i++) {
      const fc = functionCalls[i];
      totalToolCalls++;
      const callId = fc.id || `g-${round}-${i}`;
      const { text, isError } = await executeToolCall({
        id: callId,
        name: fc.name,
        args: fc.args || {},
        toolTitleMap,
        getData,
        emit,
      });
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = { text }; }
      responseParts.push({
        functionResponse: {
          ...(fc.id ? { id: fc.id } : {}),
          name: fc.name,
          response: isError ? { error: parsed } : { result: parsed },
        },
      });
    }
    contents.push({ role: 'user', parts: responseParts });
  }

  return { toolCalls: totalToolCalls };
}

// ── Claude 스트리밍 + 다중 도구 호출 루프 ──
async function runClaude({ model, apiKey, systemPrompt, mcpTools, toolTitleMap, messages, getData, emit, fetchImpl, signal }) {
  const apiMessages = messages.map(m => ({ role: m.role, content: m.content }));
  const tools = toClaudeTools(mcpTools);
  let totalToolCalls = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        temperature: 0.2,
        stream: true,
        system: systemPrompt,
        tools,
        messages: apiMessages,
      }),
      signal: combineSignals(signal, UPSTREAM_TIMEOUT_MS),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Claude HTTP ${res.status}${errBody ? `: ${errBody.slice(0, 140)}` : ''}`);
    }

    const blocks = [];
    let stopReason = null;

    for await (const ev of parseSSE(res.body)) {
      let data;
      try { data = JSON.parse(ev.data); } catch { continue; }
      const type = data.type || ev.event;
      if (type === 'error') {
        throw new Error(`Claude 스트림 오류: ${data.error?.message || 'unknown'}`);
      }
      if (type === 'content_block_start') {
        const b = data.content_block;
        if (b?.type === 'text') {
          blocks[data.index] = { type: 'text', text: b.text || '' };
          if (b.text) emit('delta', { text: b.text });
        } else if (b?.type === 'tool_use') {
          blocks[data.index] = { type: 'tool_use', id: b.id, name: b.name, inputJson: '', input: b.input || {} };
        }
      } else if (type === 'content_block_delta') {
        const b = blocks[data.index];
        const d = data.delta;
        if (!b || !d) continue;
        if (d.type === 'text_delta' && d.text) {
          b.text += d.text;
          emit('delta', { text: d.text });
        } else if (d.type === 'input_json_delta' && d.partial_json) {
          b.inputJson += d.partial_json;
        }
      } else if (type === 'message_delta') {
        if (data.delta?.stop_reason) stopReason = data.delta.stop_reason;
      }
    }

    const toolUses = [];
    const assistantContent = [];
    for (const b of blocks.filter(Boolean)) {
      if (b.type === 'text' && b.text) {
        assistantContent.push({ type: 'text', text: b.text });
      } else if (b.type === 'tool_use') {
        let input = b.input || {};
        if (b.inputJson) {
          try { input = JSON.parse(b.inputJson); } catch { input = {}; }
        }
        const tu = { type: 'tool_use', id: b.id, name: b.name, input };
        assistantContent.push(tu);
        toolUses.push(tu);
      }
    }

    if (!toolUses.length && stopReason !== 'tool_use') {
      return { toolCalls: totalToolCalls };
    }

    apiMessages.push({ role: 'assistant', content: assistantContent });
    const toolResults = [];
    for (const tu of toolUses) {
      totalToolCalls++;
      const { text, isError } = await executeToolCall({
        id: tu.id,
        name: tu.name,
        args: tu.input,
        toolTitleMap,
        getData,
        emit,
      });
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: text,
        is_error: isError,
      });
    }
    apiMessages.push({ role: 'user', content: toolResults });
  }

  return { toolCalls: totalToolCalls };
}

// ── 요청 검증 ──
function normalizeMessages(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return { error: 'messages 배열이 비어 있습니다.' };
  const trimmed = raw.slice(-MAX_MESSAGES);
  const out = [];
  for (const m of trimmed) {
    if (!m || !['user', 'assistant'].includes(m.role)) return { error: "메시지 role은 'user' 또는 'assistant'여야 합니다." };
    const text = String(m.content ?? '').trim();
    if (!text) continue;
    if (text.length > MAX_MSG_CHARS) return { error: `메시지는 ${MAX_MSG_CHARS}자 이하로 입력해 주세요.` };
    out.push({ role: m.role, content: text });
  }
  if (!out.length || out[out.length - 1].role !== 'user') {
    return { error: '마지막 메시지는 사용자 질문이어야 합니다.' };
  }
  return { messages: out };
}

// ── GET /chat/status ──
async function handleStatus(request, getData, env, limiter) {
  const clientIp = getClientIp(request);
  if (getAccessCode(request)) {
    const failCheck = limiter.checkAuthFail(clientIp, env);
    if (failCheck.blocked) {
      return jsonRes(
        { ok: false, authorized: false, error: '접근 코드 입력 실패가 너무 많습니다. 잠시 후 다시 시도해 주세요.', code: 'AUTH_LOCKED', needsCode: true },
        429,
        request,
        env,
        { 'Retry-After': String(failCheck.retryAfter) },
      );
    }
  }
  const access = checkAccess(request, env);
  if (!access.allowed && access.reason === 'INVALID_CODE') {
    limiter.recordAuthFail(clientIp);
  }

  const providers = getProviders(env);
  const limits = await limiter.peek(access.clientIp, env);
  let prompts = [];
  try {
    const pr = await mcpRpc('prompts/list', {}, getData);
    prompts = pr?.prompts || [];
  } catch {
    // 프롬프트 목록 실패 시 빈 배열 유지
  }

  return jsonRes({
    ok: true,
    authorized: access.allowed,
    authMethod: access.authMethod,
    accessMode: access.accessMode,
    needsCode: access.needsCode,
    reason: access.reason,
    message: access.message,
    ipAllowed: access.ipAllowed,
    ipConfigured: access.ipConfigured,
    codeConfigured: access.codeConfigured,
    configured: providers.gemini.available || providers.claude.available,
    providers,
    limits,
    prompts,
    version: SERVER.version,
  }, 200, request, env);
}

// ── POST /chat (SSE 스트리밍) ──
async function handlePostChat(request, getData, env, limiter, fetchImpl, retryDelayMs = 1200) {
  const clientIp = getClientIp(request);
  if (getAccessCode(request)) {
    const failCheck = limiter.checkAuthFail(clientIp, env);
    if (failCheck.blocked) {
      return jsonRes(
        { error: '접근 코드 입력 실패가 너무 많습니다. 잠시 후 다시 시도해 주세요.', code: 'AUTH_LOCKED', needsCode: true },
        429,
        request,
        env,
        { 'Retry-After': String(failCheck.retryAfter) },
      );
    }
  }
  const access = checkAccess(request, env);
  if (!access.allowed) {
    if (access.reason === 'INVALID_CODE') {
      limiter.recordAuthFail(clientIp);
    }
    const status = access.reason === 'NOT_CONFIGURED' ? 503 : (access.needsCode ? 401 : 403);
    return jsonRes(
      { error: access.message, code: access.reason, needsCode: access.needsCode },
      status,
      request,
      env,
    );
  }

  if (+(request.headers.get('Content-Length') || 0) > MAX_BODY) {
    return jsonRes({ error: '요청 크기가 너무 큽니다.', code: 'BODY_TOO_LARGE' }, 413, request, env);
  }
  const rawText = await request.text();
  if (rawText.length > MAX_BODY) {
    return jsonRes({ error: '요청 크기가 너무 큽니다.', code: 'BODY_TOO_LARGE' }, 413, request, env);
  }

  let body;
  try { body = JSON.parse(rawText); } catch {
    return jsonRes({ error: 'JSON 형식이 올바르지 않습니다.', code: 'INVALID_JSON' }, 400, request, env);
  }

  // MCP 프롬프트 서식(consult_prep, change_notice)이 지정되면 rpc('prompts/get')로 확장
  let promptName = null;
  let incomingMessages = Array.isArray(body.messages) ? [...body.messages] : [];
  if (body.prompt && typeof body.prompt === 'object' && body.prompt.name) {
    promptName = String(body.prompt.name);
    try {
      const pr = await mcpRpc('prompts/get', { name: promptName, arguments: body.prompt.arguments || {} }, getData);
      const text = pr?.messages?.[0]?.content?.text;
      if (text) incomingMessages.push({ role: 'user', content: text });
    } catch (e) {
      return jsonRes({ error: `프롬프트 서식 오류: ${e.message}`, code: 'INVALID_PROMPT' }, 400, request, env);
    }
  }

  const parsedMsgs = normalizeMessages(incomingMessages);
  if (parsedMsgs.error) {
    return jsonRes({ error: parsedMsgs.error, code: 'INVALID_MESSAGES' }, 400, request, env);
  }

  const lastUserText = parsedMsgs.messages[parsedMsgs.messages.length - 1].content;
  const route = selectRoute({
    mode: body.mode || 'auto',
    text: lastUserText,
    promptName,
    env,
  });
  if (!route.ok) {
    return jsonRes({ error: route.error, code: 'NO_AI_PROVIDER' }, 503, request, env);
  }

  // 호출 상한 적용
  const rl = await limiter.consume(access.clientIp, env);
  if (!rl.ok) {
    return jsonRes(
      { error: rl.message, code: 'RATE_LIMITED', scope: rl.scope, limits: rl.limits },
      429,
      request,
      env,
      { 'Retry-After': String(rl.retryAfter) },
    );
  }

  // MCP 서버에서 instructions와 도구 목록을 직접 가져온다
  const [initRes, toolsRes] = await Promise.all([
    mcpRpc('initialize', { protocolVersion: '2025-06-18' }, getData),
    mcpRpc('tools/list', {}, getData),
  ]);
  const systemPrompt = buildSystemPrompt(initRes.instructions);
  const mcpTools = toolsRes.tools;
  const toolTitleMap = new Map(mcpTools.map(t => [t.name, t.title || t.name]));

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event, data) => {
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // 클라이언트가 연결을 닫은 경우 무시
        }
      };

      const runOne = async (providerName, modelName) => {
        if (providerName === 'gemini') {
          const candidates = getGeminiCandidates(modelName, env);
          let lastErr;
          for (let idx = 0; idx < candidates.length; idx++) {
            const m = candidates[idx];
            if (idx > 0) {
              emit('meta', {
                provider: 'gemini',
                model: m,
                mode: route.mode,
                complexity: route.complexity,
                reason: `${route.reason} (과부하로 ${m} 자동 전환)`,
                fallbackAvailable: Boolean(route.fallback),
                limits: rl.limits,
              });
            }
            try {
              const r = await runGemini({
                model: m,
                apiKey: String(env.GEMINI_API_KEY).trim(),
                baseUrl: env.GEMINI_BASE_URL,
                systemPrompt,
                mcpTools,
                toolTitleMap,
                messages: parsedMsgs.messages,
                getData,
                emit,
                fetchImpl,
                signal: request.signal,
                retryDelayMs,
              });
              return { ...r, model: m };
            } catch (e) {
              lastErr = e;
              if (request.signal?.aborted || idx === candidates.length - 1 || !CASCADE_GEMINI_RE.test(String(e?.message || ''))) {
                throw e;
              }
            }
          }
          throw lastErr;
        }
        const r = await runClaude({
          model: modelName,
          apiKey: String(env.ANTHROPIC_API_KEY).trim(),
          systemPrompt,
          mcpTools,
          toolTitleMap,
          messages: parsedMsgs.messages,
          getData,
          emit,
          fetchImpl,
          signal: request.signal,
        });
        return { ...r, model: modelName };
      };

      emit('meta', {
        provider: route.provider,
        model: route.model,
        mode: route.mode,
        complexity: route.complexity,
        reason: route.reason,
        fallbackAvailable: Boolean(route.fallback),
        limits: rl.limits,
      });

      let usedProvider = route.provider;
      let usedModel = route.model;
      let fallbackUsed = false;

      try {
        const res = await runOne(route.provider, route.model);
        emit('done', {
          provider: usedProvider,
          model: res.model || usedModel,
          fallbackUsed,
          toolCalls: res.toolCalls,
          limits: rl.limits,
        });
      } catch (primaryErr) {
        if (request.signal?.aborted) {
          controller.close();
          return;
        }
        const errMsg = sanitizeErrorMessage(primaryErr);
        if (route.fallback && route.fallbackModel) {
          emit('fallback', {
            from: route.provider,
            to: route.fallback,
            model: route.fallbackModel,
            reason: errMsg,
          });
          usedProvider = route.fallback;
          usedModel = route.fallbackModel;
          fallbackUsed = true;
          try {
            const res = await runOne(route.fallback, route.fallbackModel);
            emit('done', {
              provider: usedProvider,
              model: res.model || usedModel,
              fallbackUsed,
              toolCalls: res.toolCalls,
              limits: rl.limits,
            });
          } catch (fallbackErr) {
            emit('error', {
              code: 'BOTH_PROVIDERS_FAILED',
              message: `두 AI 모델 모두 응답하지 못했습니다. (1차: ${errMsg} / 2차: ${sanitizeErrorMessage(fallbackErr)})`,
            });
          }
        } else {
          emit('error', {
            code: 'PROVIDER_FAILED',
            message: `AI 응답 생성 중 오류가 발생했습니다. (${errMsg})`,
          });
        }
      } finally {
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      ...corsHeaders(request, env),
    },
  });
}

// ── 외부 진입점: /chat 및 /chat/status 처리 ──
export async function handleChat(request, getData, env = {}, opts = {}) {
  const url = new URL(request.url);
  const limiter = opts.limiter || defaultLimiter;
  const fetchImpl = opts.fetch || globalThis.fetch;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }
  if (url.pathname === '/chat/status') {
    if (request.method !== 'GET') {
      return jsonRes({ error: 'Method Not Allowed' }, 405, request, env, { Allow: 'GET, OPTIONS' });
    }
    return handleStatus(request, getData, env, limiter);
  }
  if (url.pathname === '/chat') {
    if (request.method !== 'POST') {
      return jsonRes({ error: 'Method Not Allowed' }, 405, request, env, { Allow: 'POST, OPTIONS' });
    }
    return handlePostChat(request, getData, env, limiter, fetchImpl, opts.retryDelayMs ?? 600);
  }
  return null;
}
