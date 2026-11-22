#!/usr/bin/env node
// 챗봇 서버 시험: 접근 제어(IP/CIDR·접근코드·모드), 호출 상한(분당·일일), Gemini/Claude 라우팅,
// 자동 폴백, 내부 MCP rpc() 도구 호출과 SSE 스트리밍을 저장소 실제 데이터로 확인한다(CI에서도 실행).
//   node mcp/chat.test.mjs
import assert from 'node:assert/strict';
import { exportData } from '../scripts/export-data.mjs';
import { parseIp, ipMatchesList, checkAccess, RateLimiter, kstDateKey } from './src/access.js';
import { classifyComplexity, selectRoute, DEFAULT_GEMINI_MODEL, DEFAULT_CLAUDE_MODEL } from './src/router.js';
import { handleChat, parseSSE, geminiEndpoint } from './src/chat.js';

const data = exportData();
const getData = async () => data;

// SSE 응답 생성 헬퍼 (모의 업스트림용)
function sseResponse(frames, status = 200) {
  const enc = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const f of frames) controller.enqueue(enc.encode(f));
      controller.close();
    },
  });
  return new Response(body, { status, headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } });
}

async function readClientSSE(res) {
  assert.equal(res.status, 200);
  assert.match(res.headers.get('Content-Type') || '', /text\/event-stream/);
  const events = [];
  for await (const ev of parseSSE(res.body)) {
    events.push({ event: ev.event, data: JSON.parse(ev.data) });
  }
  return events;
}

// ── 1. IP / CIDR 대조 시험 ──
assert.ok(parseIp('210.100.12.34')?.version === 4);
assert.ok(parseIp('2001:db8::1')?.version === 6);
assert.equal(parseIp('::ffff:210.100.12.5')?.version, 4, 'IPv4-mapped IPv6는 IPv4 규칙과 호환');
assert.equal(parseIp('999.1.1.1'), null);
assert.equal(parseIp('not-an-ip'), null);

const schoolIps = '210.100.12.34, 10.20.0.0/16\n2001:db8:abcd::/48';
assert.equal(ipMatchesList('210.100.12.34', schoolIps), true);
assert.equal(ipMatchesList('210.100.12.35', schoolIps), false);
assert.equal(ipMatchesList('10.20.99.1', schoolIps), true);
assert.equal(ipMatchesList('10.21.0.1', schoolIps), false);
assert.equal(ipMatchesList('::ffff:10.20.3.4', schoolIps), true);
assert.equal(ipMatchesList('2001:db8:abcd:1234::5', schoolIps), true);
assert.equal(ipMatchesList('2001:db8:9999::1', schoolIps), false);

// ── 2. 접근 제어 모드 시험 (either / ip / code / both / open / 미설정) ──
const reqWith = (ip, headers = {}) => new Request('https://x.test/chat', {
  method: 'POST',
  headers: { 'CF-Connecting-IP': ip, ...headers },
});

const baseAccessEnv = { ALLOWED_IPS: '210.100.12.0/24', ACCESS_CODE: 'swhs-2028', ACCESS_MODE: 'either' };
// either (기본): 학교 IP 자동 통과
assert.deepEqual(
  (({ allowed, authMethod, needsCode }) => ({ allowed, authMethod, needsCode }))(checkAccess(reqWith('210.100.12.77'), baseAccessEnv)),
  { allowed: true, authMethod: 'ip', needsCode: false },
);
// either: 외부 IP + 코드 없음 -> 거부 + needsCode=true
assert.deepEqual(
  (({ allowed, reason, needsCode }) => ({ allowed, reason, needsCode }))(checkAccess(reqWith('1.2.3.4'), baseAccessEnv)),
  { allowed: false, reason: 'CODE_REQUIRED', needsCode: true },
);
// either: 외부 IP + 올바른 X-Access-Code -> 통과
assert.deepEqual(
  (({ allowed, authMethod }) => ({ allowed, authMethod }))(checkAccess(reqWith('1.2.3.4', { 'X-Access-Code': 'swhs-2028' }), baseAccessEnv)),
  { allowed: true, authMethod: 'code' },
);
// either: 외부 IP + Bearer 토큰 -> 통과
assert.equal(checkAccess(reqWith('1.2.3.4', { Authorization: 'Bearer swhs-2028' }), baseAccessEnv).allowed, true);
// either: 외부 IP + 틀린 코드 -> 거부 (INVALID_CODE)
assert.equal(checkAccess(reqWith('1.2.3.4', { 'X-Access-Code': 'wrong' }), baseAccessEnv).reason, 'INVALID_CODE');

// ip 전용 모드
assert.equal(checkAccess(reqWith('210.100.12.1'), { ...baseAccessEnv, ACCESS_MODE: 'ip' }).allowed, true);
assert.equal(checkAccess(reqWith('1.2.3.4', { 'X-Access-Code': 'swhs-2028' }), { ...baseAccessEnv, ACCESS_MODE: 'ip' }).allowed, false);
assert.equal(checkAccess(reqWith('1.2.3.4'), { ...baseAccessEnv, ACCESS_MODE: 'ip' }).needsCode, false);

// code 전용 모드
assert.equal(checkAccess(reqWith('210.100.12.1'), { ...baseAccessEnv, ACCESS_MODE: 'code' }).allowed, false);
assert.equal(checkAccess(reqWith('1.2.3.4', { 'X-Access-Code': 'swhs-2028' }), { ...baseAccessEnv, ACCESS_MODE: 'code' }).allowed, true);

// both 모드
assert.equal(checkAccess(reqWith('210.100.12.1'), { ...baseAccessEnv, ACCESS_MODE: 'both' }).reason, 'CODE_REQUIRED');
assert.equal(checkAccess(reqWith('1.2.3.4', { 'X-Access-Code': 'swhs-2028' }), { ...baseAccessEnv, ACCESS_MODE: 'both' }).reason, 'IP_DENIED');
assert.equal(checkAccess(reqWith('210.100.12.1', { 'X-Access-Code': 'swhs-2028' }), { ...baseAccessEnv, ACCESS_MODE: 'both' }).authMethod, 'both');

// open 모드 및 미설정 시 안전 차단(fail-closed)
assert.equal(checkAccess(reqWith('1.2.3.4'), { ACCESS_MODE: 'open' }).allowed, true);
assert.equal(checkAccess(reqWith('1.2.3.4'), {}).reason, 'NOT_CONFIGURED');

// ── 3. 분당·일일 호출 상한 시험 ──
{
  let now = Date.UTC(2026, 4, 10, 14, 58, 0); // KST 2026-05-10 23:58:00
  const limiter = new RateLimiter(() => now);
  const rlEnv = { RATE_LIMIT_PER_MIN: '2', RATE_LIMIT_PER_DAY_IP: '3', RATE_LIMIT_PER_DAY_TOTAL: '4' };
  assert.equal(kstDateKey(now), '2026-05-10');

  assert.equal((await limiter.consume('1.1.1.1', rlEnv)).ok, true);
  assert.equal((await limiter.consume('1.1.1.1', rlEnv)).ok, true);
  const minBlocked = await limiter.consume('1.1.1.1', rlEnv);
  assert.equal(minBlocked.ok, false);
  assert.equal(minBlocked.scope, 'minute');
  assert.ok(minBlocked.retryAfter >= 1 && minBlocked.retryAfter <= 60);

  // 61초 경과 -> 분당 창 초기화, 3번째 호출 성공 -> 4번째는 일일 IP 상한(3) 초과
  now += 61_000;
  assert.equal((await limiter.consume('1.1.1.1', rlEnv)).ok, true);
  const dayIpBlocked = await limiter.consume('1.1.1.1', rlEnv);
  assert.equal(dayIpBlocked.ok, false);
  assert.equal(dayIpBlocked.scope, 'day_ip');

  // 다른 IP는 1회 더 가능 -> 그다음은 일일 전체 상한(4) 초과
  assert.equal((await limiter.consume('2.2.2.2', rlEnv)).ok, true);
  const dayTotBlocked = await limiter.consume('3.3.3.3', rlEnv);
  assert.equal(dayTotBlocked.ok, false);
  assert.equal(dayTotBlocked.scope, 'day_total');

  // KST 자정 경과 -> 일일 카운터 초기화
  now += 2 * 60_000; // KST 2026-05-11 00:01:01
  assert.equal(kstDateKey(now), '2026-05-11');
  assert.equal((await limiter.consume('1.1.1.1', rlEnv)).ok, true);
}

// ── 4. 라우팅 시험 (자동/빠름/심층 + 단일 키 전환) ──
const bothKeys = { GEMINI_API_KEY: 'test-gemini', ANTHROPIC_API_KEY: 'test-claude' };
assert.equal(classifyComplexity({ text: '아주대 2028 전형 알려줘' }).complexity, 'fast');
assert.equal(classifyComplexity({ text: '경기 교과 수능최저 없는 곳' }).complexity, 'fast');
assert.equal(classifyComplexity({ text: '성균관대·한양대·중앙대 학생부종합 비교표 만들어 줘' }).complexity, 'deep');
assert.equal(classifyComplexity({ text: '고1 학부모 대상 2028 변경사항 안내문 초안 써 줘' }).complexity, 'deep');
assert.equal(classifyComplexity({ text: '교과 2.2등급 학생 상담 준비표 만들어 줘' }).complexity, 'deep');
assert.equal(classifyComplexity({ text: '간단 질문', promptName: 'consult_prep' }).complexity, 'deep');

const rFast = selectRoute({ mode: 'auto', text: '아주대 원문 PDF 알려줘', env: bothKeys });
assert.equal(rFast.provider, 'gemini');
assert.equal(rFast.model, DEFAULT_GEMINI_MODEL);
assert.equal(rFast.fallback, 'claude');

const rDeep = selectRoute({ mode: 'auto', text: '서강대·성균관대·한양대 정시 반영비율 비교해 줘', env: bothKeys });
assert.equal(rDeep.provider, 'claude');
assert.equal(rDeep.model, DEFAULT_CLAUDE_MODEL);
assert.equal(rDeep.fallback, 'gemini');

// 수동 모드
assert.equal(selectRoute({ mode: 'fast', text: '학부모 안내문 초안 작성해 줘', env: bothKeys }).provider, 'gemini');
assert.equal(selectRoute({ mode: 'deep', text: '아주대', env: bothKeys }).provider, 'claude');
// 단일 키 환경 자동 전환
assert.equal(selectRoute({ mode: 'deep', text: '비교표', env: { GEMINI_API_KEY: 'g-only' } }).provider, 'gemini');
assert.equal(selectRoute({ mode: 'fast', text: '조회', env: { ANTHROPIC_API_KEY: 'c-only' } }).provider, 'claude');
assert.equal(selectRoute({ mode: 'auto', text: '조회', env: {} }).ok, false);

// ── 5. /chat/status 엔드포인트 시험 ──
const fullEnv = {
  ...baseAccessEnv,
  ...bothKeys,
  RATE_LIMIT_PER_MIN: '10',
  RATE_LIMIT_PER_DAY_IP: '100',
  RATE_LIMIT_PER_DAY_TOTAL: '500',
};
{
  const opt = await handleChat(new Request('https://x.test/chat/status', { method: 'OPTIONS' }), getData, fullEnv);
  assert.equal(opt.status, 204);
  assert.match(opt.headers.get('Access-Control-Allow-Headers') || '', /X-Access-Code/);

  const badMethod = await handleChat(new Request('https://x.test/chat/status', { method: 'POST' }), getData, fullEnv);
  assert.equal(badMethod.status, 405);

  // 학교 IP 자동 통과 확인
  const stSchool = await (await handleChat(new Request('https://x.test/chat/status', {
    headers: { 'CF-Connecting-IP': '210.100.12.9' },
  }), getData, fullEnv)).json();
  assert.equal(stSchool.authorized, true);
  assert.equal(stSchool.authMethod, 'ip');
  assert.equal(stSchool.needsCode, false);
  assert.equal(stSchool.providers.gemini.available, true);
  assert.equal(stSchool.providers.claude.available, true);
  assert.ok(stSchool.prompts.length >= 2, 'MCP prompts/list를 내부 rpc()로 조회');

  // 외부 IP 코드 미입력 확인
  const stExt = await (await handleChat(new Request('https://x.test/chat/status', {
    headers: { 'CF-Connecting-IP': '8.8.8.8' },
  }), getData, fullEnv)).json();
  assert.equal(stExt.authorized, false);
  assert.equal(stExt.needsCode, true);
}

// ── 6. /chat SSE 스트리밍 + Gemini 도구 호출 (실제 data.json) ──
{
  const limiter = new RateLimiter();
  let geminiRound = 0;
  let capturedToolOutput = null;
  const mockFetch = async (url, init) => {
    assert.match(url, /generativelanguage\.googleapis\.com/);
    const reqBody = JSON.parse(init.body);
    // 도구 목록에 data_info 의 빈 parameters 생략 및 deprecated temperature 미전송 확인
    const dataInfoDecl = reqBody.tools[0].functionDeclarations.find(d => d.name === 'data_info');
    assert.ok(dataInfoDecl && !('parameters' in dataInfoDecl), 'Gemini 빈 parameters 생략');
    assert.equal('temperature' in reqBody.generationConfig, false, 'Gemini 3.x deprecated temperature 미전송');
    geminiRound++;
    if (geminiRound === 1) {
      return sseResponse([
        `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ thought: true, text: '내부 추론은 숨김' }] } }] })}\n\n`,
        `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ functionCall: { id: 'fc-1', name: 'get_university', args: { name: '아주대' } }, thoughtSignature: 'sig-1' }] } }] })}\n\n`,
      ]);
    }
    // 2라운드: 실제 rpc('tools/call') 결과와 id·thoughtSignature가 그대로 전달되었는지 검증
    const prevModelTurn = reqBody.contents[reqBody.contents.length - 2];
    assert.equal(prevModelTurn.parts[0].thoughtSignature, 'sig-1');
    const lastTurn = reqBody.contents[reqBody.contents.length - 1];
    assert.equal(lastTurn.parts[0].functionResponse.id, 'fc-1');
    capturedToolOutput = lastTurn.parts[0].functionResponse.response.result;
    assert.equal(capturedToolOutput.대학, '아주대');
    assert.ok(capturedToolOutput.전형.length > 0);
    return sseResponse([
      `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: '아주대 2028학년도 전형은 ' }] } }] })}\n\n`,
      `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: `총 ${capturedToolOutput.전형.length}개입니다.` }] } }] })}\n\n`,
    ]);
  };

  const res = await handleChat(new Request('https://x.test/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '210.100.12.5' },
    body: JSON.stringify({ mode: 'auto', messages: [{ role: 'user', content: '아주대 2028 전형 알려줘' }] }),
  }), getData, fullEnv, { limiter, fetch: mockFetch });

  const events = await readClientSSE(res);
  assert.equal(events[0].event, 'meta');
  assert.equal(events[0].data.provider, 'gemini');
  assert.ok(events.some(e => e.event === 'tool_call' && e.data.name === 'get_university'));
  assert.ok(events.some(e => e.event === 'tool_result' && e.data.summary.includes('아주대')));
  const fullText = events.filter(e => e.event === 'delta').map(e => e.data.text).join('');
  assert.doesNotMatch(fullText, /내부 추론/, 'thought 파트는 사용자에게 노출되지 않음');
  assert.match(fullText, /아주대 2028학년도 전형은 총 \d+개입니다\./);
  const doneEv = events.find(e => e.event === 'done');
  assert.equal(doneEv.data.provider, 'gemini');
  assert.equal(doneEv.data.fallbackUsed, false);
  assert.equal(doneEv.data.toolCalls, 1);
}

// ── 7. /chat SSE 스트리밍 + Claude 심층 라우팅 + MCP 프롬프트(consult_prep) + 도구 호출 ──
{
  const limiter = new RateLimiter();
  let claudeRound = 0;
  const mockFetch = async (url, init) => {
    assert.equal(url, 'https://api.anthropic.com/v1/messages');
    const reqBody = JSON.parse(init.body);
    assert.equal(reqBody.model, DEFAULT_CLAUDE_MODEL);
    claudeRound++;
    if (claudeRound === 1) {
      assert.match(reqBody.messages[0].content, /경기 교과/, 'prompts/get 으로 확장된 질문 전달');
      return sseResponse([
        `event: content_block_start\ndata: ${JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'toolu_1', name: 'search_admissions', input: {} } })}\n\n`,
        `event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"region":["경기"],' } })}\n\n`,
        `event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '"track":["교과"],"csat_min":"없음"}' } })}\n\n`,
        `event: message_delta\ndata: ${JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'tool_use' } })}\n\n`,
      ]);
    }
    const lastTurn = reqBody.messages[reqBody.messages.length - 1];
    const parsedTool = JSON.parse(lastTurn.content[0].content);
    assert.ok(parsedTool.결과수 > 0 && parsedTool.목록.every(r => r.지역 === '경기' && r.수능최저 === '없음'));
    return sseResponse([
      `event: content_block_start\ndata: ${JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })}\n\n`,
      `event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: `| 대학 | 전형명 |\n|---|---|\n| ${parsedTool.목록[0].대학} | ${parsedTool.목록[0].전형명} |` } })}\n\n`,
      `event: message_delta\ndata: ${JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' } })}\n\n`,
    ]);
  };

  const res = await handleChat(new Request('https://x.test/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '8.8.8.8', 'X-Access-Code': 'swhs-2028' },
    body: JSON.stringify({
      mode: 'auto',
      messages: [],
      prompt: { name: 'consult_prep', arguments: { condition: '경기 교과, 수능최저 없음' } },
    }),
  }), getData, fullEnv, { limiter, fetch: mockFetch });

  const events = await readClientSSE(res);
  assert.equal(events[0].data.provider, 'claude');
  assert.ok(events.some(e => e.event === 'tool_result' && e.data.count > 0));
  const text = events.filter(e => e.event === 'delta').map(e => e.data.text).join('');
  assert.match(text, /\| 대학 \| 전형명 \|/);
  assert.equal(events.find(e => e.event === 'done').data.provider, 'claude');
}

// ── 8. 자동 폴백 시험 (Gemini 오류 -> Claude, Claude 오류 -> Gemini, 둘 다 실패) ──
{
  const limiter = new RateLimiter();
  // 8-a: Gemini 503 -> Claude 폴백
  const res1 = await handleChat(new Request('https://x.test/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '210.100.12.5' },
    body: JSON.stringify({ mode: 'auto', messages: [{ role: 'user', content: '아주대 전형' }] }),
  }), getData, fullEnv, {
    limiter,
    fetch: async (url) => {
      if (url.includes('googleapis')) return new Response('Service Unavailable', { status: 503 });
      return sseResponse([
        `event: content_block_start\ndata: ${JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })}\n\n`,
        `event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '폴백 Claude 응답' } })}\n\n`,
        `event: message_delta\ndata: ${JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' } })}\n\n`,
      ]);
    },
  });
  const ev1 = await readClientSSE(res1);
  assert.ok(ev1.some(e => e.event === 'fallback' && e.data.from === 'gemini' && e.data.to === 'claude'));
  assert.equal(ev1.filter(e => e.event === 'delta').map(e => e.data.text).join(''), '폴백 Claude 응답');
  assert.equal(ev1.find(e => e.event === 'done').data.fallbackUsed, true);

  // 8-b: Claude 529 -> Gemini 폴백
  const res2 = await handleChat(new Request('https://x.test/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '210.100.12.5' },
    body: JSON.stringify({ mode: 'deep', messages: [{ role: 'user', content: '비교해 줘' }] }),
  }), getData, fullEnv, {
    limiter,
    fetch: async (url) => {
      if (url.includes('anthropic')) return new Response('Overloaded', { status: 529 });
      return sseResponse([
        `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: '폴백 Gemini 응답' }] } }] })}\n\n`,
      ]);
    },
  });
  const ev2 = await readClientSSE(res2);
  assert.ok(ev2.some(e => e.event === 'fallback' && e.data.from === 'claude' && e.data.to === 'gemini'));
  assert.equal(ev2.filter(e => e.event === 'delta').map(e => e.data.text).join(''), '폴백 Gemini 응답');
  assert.equal(ev2.find(e => e.event === 'done').data.fallbackUsed, true);

  // 8-c: 둘 다 실패 -> error 이벤트 (1차·2차 오류 모두 표시, 키 노출 없음)
  const res3 = await handleChat(new Request('https://x.test/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '210.100.12.5' },
    body: JSON.stringify({ mode: 'auto', messages: [{ role: 'user', content: '아주대' }] }),
  }), getData, fullEnv, {
    limiter,
    fetch: async () => new Response('key=AIzaSecret123 AQ.Secret456 sk-ant-secret999', { status: 500 }),
  });
  const ev3 = await readClientSSE(res3);
  const errEv = ev3.find(e => e.event === 'error');
  assert.equal(errEv.data.code, 'BOTH_PROVIDERS_FAILED');
  assert.match(errEv.data.message, /1차:.*2차:/);
  assert.doesNotMatch(errEv.data.message, /AIzaSecret|AQ\.Secret|sk-ant-secret/);

  // 8-d: AI Studio 신규 AQ. 키도 기본 generativelanguage.googleapis.com 사용, GEMINI_BASE_URL 지정 시에만 커스텀 엔드포인트 사용
  assert.equal(
    geminiEndpoint('gemini-2.5-flash'),
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse',
  );
  assert.equal(
    geminiEndpoint('gemini-2.5-flash', 'https://aiplatform.googleapis.com/v1/publishers/google/'),
    'https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:streamGenerateContent?alt=sse',
  );
  let capturedUrl = '';
  let capturedSchemaType = '';
  const aqStudioEnv = { ...fullEnv, GEMINI_API_KEY: 'AQ.Ab8RNtestKey' };
  const res4 = await handleChat(new Request('https://x.test/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '210.100.12.5' },
    body: JSON.stringify({ mode: 'fast', messages: [{ role: 'user', content: '아주대 전형' }] }),
  }), getData, aqStudioEnv, {
    limiter,
    fetch: async (url, init) => {
      capturedUrl = url;
      const body = JSON.parse(init.body);
      const decl = body.tools[0].functionDeclarations.find(d => d.name === 'get_university');
      capturedSchemaType = decl.parameters.type;
      return sseResponse([
        `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'AI Studio AQ 응답' }] } }] })}\n\n`,
      ]);
    },
  });
  const ev4 = await readClientSSE(res4);
  assert.match(capturedUrl, /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\//);
  assert.equal(capturedSchemaType, 'OBJECT');
  assert.equal(ev4.filter(e => e.event === 'delta').map(e => e.data.text).join(''), 'AI Studio AQ 응답');
}

// ── 9. 입력 검증 및 접근 코드 무차별 대입 차단 ──
{
  const limiter = new RateLimiter();
  assert.equal((await handleChat(new Request('https://x.test/chat', { method: 'GET' }), getData, fullEnv, { limiter })).status, 405);
  assert.equal((await handleChat(new Request('https://x.test/chat', {
    method: 'POST', headers: { 'CF-Connecting-IP': '210.100.12.5' }, body: '{bad',
  }), getData, fullEnv, { limiter })).status, 400);
  assert.equal((await handleChat(new Request('https://x.test/chat', {
    method: 'POST', headers: { 'CF-Connecting-IP': '210.100.12.5' }, body: JSON.stringify({ messages: [] }),
  }), getData, fullEnv, { limiter })).status, 400);
  assert.equal((await handleChat(new Request('https://x.test/chat', {
    method: 'POST', headers: { 'CF-Connecting-IP': '210.100.12.5' }, body: 'x'.repeat(70000),
  }), getData, fullEnv, { limiter })).status, 413);

  // 코드 3회 실패 후 잠금 확인
  const lockEnv = { ...fullEnv, AUTH_FAIL_MAX: '3' };
  for (let i = 0; i < 3; i++) {
    const r = await handleChat(new Request('https://x.test/chat', {
      method: 'POST', headers: { 'CF-Connecting-IP': '9.9.9.9', 'X-Access-Code': 'nope' }, body: '{}',
    }), getData, lockEnv, { limiter });
    assert.equal(r.status, 401);
  }
  const locked = await handleChat(new Request('https://x.test/chat', {
    method: 'POST', headers: { 'CF-Connecting-IP': '9.9.9.9', 'X-Access-Code': 'nope' }, body: '{}',
  }), getData, lockEnv, { limiter });
  assert.equal(locked.status, 429);
}

// ── 10. GeminiProxy Durable Object (북미 wnam 출구 프록시 및 대상 도메인 제한) ──
{
  const { GeminiProxy, createGeminiFetch } = await import('./src/worker.js');
  const proxy = new GeminiProxy({}, {});

  // 허용되지 않은 도메인 차단 (SSRF 방지)
  const bad = await proxy.fetch(new Request('https://gemini-proxy.internal/', {
    method: 'POST',
    headers: { 'X-Proxy-Target': 'https://evil.example.com/steal' },
  }));
  assert.equal(bad.status, 400);

  // createGeminiFetch가 Gemini 요청을 wnam locationHint DO로 전달하고 Claude 요청은 직접 호출하는지 확인
  let hintUsed = null;
  let forwardedUrl = null;
  let directUrl = null;
  const fakeEnv = {
    GEMINI_PROXY: {
      idFromName: name => `id:${name}`,
      get: (_id, opts) => {
        hintUsed = opts?.locationHint;
        return {
          fetch: (u, init) => proxy.fetch(new Request(u, init), async (target) => {
            forwardedUrl = target;
            return new Response('ok-gemini', { status: 200 });
          }),
        };
      },
    },
  };
  const wrappedFetch = createGeminiFetch(fakeEnv, async (u) => {
    directUrl = u;
    return new Response('ok-claude', { status: 200 });
  });
  const rGem = await wrappedFetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:streamGenerateContent?alt=sse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': 'AQ.test' },
    body: '{}',
  });
  assert.equal(await rGem.text(), 'ok-gemini');
  assert.equal(hintUsed, 'wnam');
  assert.match(forwardedUrl, /^https:\/\/generativelanguage\.googleapis\.com\//);

  const rCla = await wrappedFetch('https://api.anthropic.com/v1/messages', { method: 'POST', body: '{}' });
  assert.equal(await rCla.text(), 'ok-claude');
  assert.equal(directUrl, 'https://api.anthropic.com/v1/messages');
}

console.log('챗봇 서버 시험 통과 (IP/CIDR·접근제어·호출상한·라우팅·자동폴백·SSE·MCP 도구 호출·wnam 프록시 전체 확인)');
