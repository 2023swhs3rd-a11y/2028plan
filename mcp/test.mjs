#!/usr/bin/env node
// MCP 서버 시험: 저장소 data/ 로 data.json 을 만들어 HTTP 요청 단위로 도구·프롬프트를 확인한다(CI에서도 실행).
//   node mcp/test.mjs
import assert from 'node:assert/strict';
import { exportData } from '../scripts/export-data.mjs';
import { handle, TOOLS, PROMPTS } from './src/mcp.js';

const data = exportData();
const getData = async () => data;
let id = 0;
const post = async (body, headers = {}) => handle(new Request('https://x.test/mcp', {
  method: 'POST', body: JSON.stringify(body),
  headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
}), getData);
const call = async (method, params) => (await (await post({ jsonrpc: '2.0', id: ++id, method, params })).json());
const tool = async (name, args) => {
  const r = await call('tools/call', { name, arguments: args });
  assert.ok(r.result, `${name}: ${JSON.stringify(r.error)}`);
  return { out: JSON.parse(r.result.content[0].text), isError: r.result.isError };
};

// 연결
const init = await call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
assert.equal(init.result.protocolVersion, '2025-06-18');
assert.ok(init.result.capabilities.tools && init.result.instructions);
assert.equal((await call('initialize', { protocolVersion: '1999-01-01' })).result.protocolVersion, '2025-06-18');
assert.equal((await post({ jsonrpc: '2.0', method: 'notifications/initialized' })).status, 202);
assert.deepEqual((await call('ping')).result, {});
assert.equal((await call('nope')).error.code, -32601);
assert.equal((await handle(new Request('https://x.test/mcp'), getData)).status, 405);
assert.equal((await handle(new Request('https://x.test/'), getData)).status, 200);
assert.equal((await handle(new Request('https://x.test/mcp', { method: 'POST', body: '{' }), getData)).status, 400);

// 목록
const tl = (await call('tools/list')).result.tools;
assert.equal(tl.length, 6);
for (const t of tl) assert.ok(t.name && t.description && t.inputSchema?.type === 'object' && !('run' in t), t.name);
assert.equal((await call('prompts/list')).result.prompts.length, PROMPTS.length);

// 전형 검색
const all = await tool('search_admissions', { limit: 100 });
const rows = data.universities.reduce((n, u) => n + u.rows.length, 0);
assert.equal(all.out.결과수, rows);
assert.equal(all.out.목록.length, 100);
const s = await tool('search_admissions', { region: ['경기'], track: ['교과'], csat_min: '없음', interview: '없음' });
assert.ok(s.out.결과수 > 0);
for (const r of s.out.목록) { assert.equal(r.지역, '경기'); assert.equal(r.전형, '교과'); assert.equal(r.수능최저, '없음'); assert.ok(r.원문.PDF.startsWith('https://drive.google.com/')) }
const cmp = await tool('search_admissions', { universities: ['성균관대', '한양대', '중앙', '없는대학'], track: ['종합'] });
assert.deepEqual([...new Set(cmp.out.목록.map(r => r.대학))].sort(), ['성균관대', '중앙대', '한양대']);
assert.deepEqual(cmp.out.찾지못한대학, ['없는대학']);
const med = (await tool('search_admissions', { track: ['교과'], limit: 100 })).out.결과수;
const noMed = (await tool('search_admissions', { track: ['교과'], exclude_medical_only: true, exclude_regional_talent: true, limit: 100 })).out.결과수;
assert.ok(noMed < med);
const gr = await tool('search_admissions', { graduates_allowed: true, school_recommendation: true, limit: 100 });
for (const r of gr.out.목록) { assert.notEqual(r.지원자격, '재학생'); assert.match(r.추천, /추천/) }
const g = await tool('search_admissions', { track: ['정시'], gun: ['가'], region: ['서울'] });
for (const r of g.out.목록) assert.equal(r.군, '가');

// 대학 상세·원문·변경·농어촌·안내
const u = await tool('get_university', { name: '아주대' });
assert.equal(u.out.대학, '아주대');
assert.ok(u.out.전형.length > 0 && u.out['2028주요변경'].length > 0);
assert.ok((await tool('get_university', { name: '없는대학' })).isError);
const src = await tool('get_source', { university: '강원대' });
assert.ok(src.out.원문파일.length >= 2, '강원대는 캠퍼스별 PDF');
const ch = await tool('list_changes', { category: ['수능최저'], region: ['서울'] });
assert.ok(ch.out.결과수 > 0);
for (const c of ch.out.목록) assert.ok(c.분류.includes('수능최저'));
const rur = await tool('find_rural', { audience: '전용', quota_type: '외', qualification: '12년' });
assert.ok(rur.out.결과수 > 0);
for (const r of rur.out.목록) { assert.equal(r.대상, '전용'); assert.equal(r.정원, '정원 외'); assert.match(r.자격, /12년/) }
const info = await tool('data_info', {});
assert.equal(info.out.수록대학.length, data.universities.length);

// 프롬프트
const p = await call('prompts/get', { name: 'consult_prep', arguments: { condition: '교과 위주, 수능 2개 합 7' } });
assert.match(p.result.messages[0].content.text, /2개 합 7/);
assert.equal((await call('prompts/get', { name: 'consult_prep', arguments: {} })).error.code, -32602);

// 응답 크기: 기본 검색 결과가 대화에 부담되지 않는지
assert.ok(JSON.stringify(all.out).length < 120000);
console.log(`MCP 시험 통과 (도구 ${TOOLS.length}개 · 프롬프트 ${PROMPTS.length}개 · 대학 ${data.universities.length}곳 · 전형 ${rows}개)`);
