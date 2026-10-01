#!/usr/bin/env node
// data/ 의 JSON을 검증한 뒤 src/template.html 에 넣어 단일 파일 index.html 을 만든다.
//   node scripts/build.mjs           → index.html 생성
//   node scripts/build.mjs --check   → 검증 + index.html 이 최신인지 확인(CI용, 파일은 쓰지 않음)
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const P = (...p) => join(ROOT, ...p);
const errors = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);

const template = readFileSync(P('src/template.html'), 'utf8');
if (template.split('/*@@DATA@@*/').length !== 2) throw new Error('src/template.html 에 /*@@DATA@@*/ 자리표시자가 정확히 1개 있어야 합니다');

// 허용값은 화면 코드와 같은 목록을 쓰도록 템플릿에서 읽는다
const listFrom = name => {
  const m = template.match(new RegExp(`const ${name}=\\[([^\\]]*)\\]`));
  if (!m) throw new Error(`템플릿에서 ${name} 목록을 찾지 못했습니다`);
  return m[1].split(',').map(s => s.trim().replace(/^'|'$/g, ''));
};
const TR = listFrom('TR'), GR = listFrom('GR'), CATS = listFrom('CATS');
const ENUM = {
  sq: ['high', 'medium', 'low'],
  structure: ['일괄', '단계형'],
  min_flag: ['있음', '일부', '없음'],
  interview: ['있음', '없음'],
  elig: ['제한 없음', '재학생', '졸업연도 제한', '졸업생 전용', '확인 불가'],
};
const isStr = v => typeof v === 'string' && v.trim() !== '';
const isInt = v => Number.isInteger(v) && v >= 0;

function checkUniv(u, file) {
  for (const k of ['u', 'g', 'rg', 'fid', 'ft']) if (!isStr(u[k])) err(file, `'${k}' 는 빈 문자열이 아니어야 합니다`);
  if (!GR.includes(u.g)) err(file, `g='${u.g}' 는 ${GR.join('/')} 중 하나여야 합니다`);
  if (!ENUM.sq.includes(u.sq)) err(file, `sq='${u.sq}' 는 ${ENUM.sq.join('/')} 중 하나여야 합니다`);
  const t = u.tot || {};
  const tv = [t.susi_in, t.jeongsi_in, t.total_in];
  if (!(tv.every(v => v === null) || tv.every(isInt))) err(file, 'tot 의 susi_in·jeongsi_in·total_in 은 모두 0 이상 정수이거나 모두 null 이어야 합니다');
  else if (tv.every(isInt) && t.susi_in + t.jeongsi_in !== t.total_in) err(file, `tot: 수시 ${t.susi_in} + 정시 ${t.jeongsi_in} ≠ 합계 ${t.total_in}`);
  if (!Array.isArray(u.ch)) err(file, 'ch 는 배열이어야 합니다');
  else u.ch.forEach((c, i) => {
    if (!isStr(c.t)) err(file, `ch[${i}].t 가 비어 있습니다`);
    if (!Array.isArray(c.c) || !c.c.length) err(file, `ch[${i}].c 에 분류가 1개 이상 있어야 합니다`);
    else c.c.filter(k => !CATS.includes(k)).forEach(k => err(file, `ch[${i}] 분류 '${k}' 는 ${CATS.join('/')} 중 하나여야 합니다`));
  });
  if (u.chNA !== (Array.isArray(u.ch) && u.ch.length === 0)) err(file, 'chNA 는 변경사항(ch)이 비었을 때만 true 여야 합니다');
  if (!Array.isArray(u.notes) || !u.notes.every(isStr)) err(file, 'notes 는 문자열 배열이어야 합니다');
  if (!Array.isArray(u.hu)) err(file, 'hu 는 배열이어야 합니다');
  if (!Array.isArray(u.rows) || !u.rows.length) { err(file, 'rows 에 전형이 1개 이상 있어야 합니다'); return }
  const seen = new Set();
  u.rows.forEach((r, i) => {
    const w = `${file} rows[${i}] ${r.name ?? ''}`;
    if (!isStr(r.name)) err(w, 'name 이 비어 있습니다');
    if (!TR.includes(r.track)) err(w, `track='${r.track}' 는 ${TR.join('/')} 중 하나여야 합니다`);
    const key = r.track + '|' + r.name;
    if (seen.has(key)) err(w, '같은 대학 안에 track·name 이 같은 전형이 중복됩니다(비교 기능 키 충돌)');
    seen.add(key);
    if (!isInt(r.quota)) err(w, `quota=${JSON.stringify(r.quota)} 는 0 이상 정수여야 합니다`);
    if (!isStr(r.method)) err(w, 'method 가 비어 있습니다');
    for (const k of ['structure', 'min_flag', 'interview', 'elig'])
      if (!ENUM[k].includes(r[k])) err(w, `${k}='${r[k]}' 는 ${ENUM[k].join('/')} 중 하나여야 합니다`);
    if (r.min_flag !== '없음' && !isStr(r.min_text)) err(w, '수능최저가 있으면 min_text 가 필요합니다');
    if (!isStr(r.recommend)) err(w, 'recommend 가 비어 있습니다');
    if (r.pg != null && !(Number.isInteger(r.pg) && r.pg > 0)) err(w, `pg=${JSON.stringify(r.pg)} 는 양의 정수 또는 null 이어야 합니다`);
    if (r.stage != null && !(Number.isInteger(r.stage) && r.stage >= 0 && r.stage <= 6)) err(w, `stage=${JSON.stringify(r.stage)} 는 0~6 이어야 합니다`);
    if (r.h != null && !Array.isArray(r.h)) err(w, 'h 는 배열이어야 합니다');
  });
}

// 대학 파일: data/universities/NN-대학명.json, 파일명 순서 = 화면 기본 순서
const UDIR = P('data/universities');
const files = readdirSync(UDIR).filter(f => f.endsWith('.json')).sort();
const U = [], names = new Map();
for (const f of files) {
  const where = 'data/universities/' + f;
  let u;
  try { u = JSON.parse(readFileSync(join(UDIR, f), 'utf8')) } catch (e) { err(where, 'JSON 문법 오류 - ' + e.message); continue }
  const m = f.match(/^\d+-(.+)\.json$/);
  if (!m) err(where, "파일명은 '번호-대학명.json' 형식이어야 합니다");
  else if (m[1] !== u.u) err(where, `파일명의 대학명 '${m[1]}' 과 u='${u.u}' 가 다릅니다`);
  if (names.has(u.u)) err(where, `대학명 '${u.u}' 가 ${names.get(u.u)} 와 중복됩니다`);
  names.set(u.u, where);
  checkUniv(u, where);
  U.push(u);
}

let V = [];
try { V = JSON.parse(readFileSync(P('data/versions.json'), 'utf8')) } catch (e) { err('data/versions.json', 'JSON 문법 오류 - ' + e.message) }
if (!Array.isArray(V) || !V.length) err('data/versions.json', '버전 기록이 1개 이상 있어야 합니다');
else V.forEach((v, i) => {
  if (!/^\d+(\.\d+)+$/.test(v.v)) err('data/versions.json', `[${i}] v='${v.v}' 형식 오류(예: 0.9)`);
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(v.t)) err('data/versions.json', `[${i}] t='${v.t}' 형식 오류(예: 2026-10-01 09:00)`);
  if (!isStr(v.note)) err('data/versions.json', `[${i}] note 가 비어 있습니다`);
  if (V.findIndex(x => x.v === v.v) !== i) err('data/versions.json', `버전 ${v.v} 가 중복됩니다`);
});

const json = JSON.stringify({ U, V });
if (/<\/script|<!--/i.test(json)) err('data', "데이터에 '</script' 또는 '<!--' 문자열이 있으면 페이지가 깨집니다");

if (errors.length) {
  console.error(`데이터 검증 실패 ${errors.length}건:\n` + errors.map(e => '  - ' + e).join('\n'));
  process.exit(1);
}

// 파비콘: src/icons 의 SVG·PNG를 data URI로 넣어 단일 파일에서도 아이콘이 보이게 함
const html = template.replace('/*@@DATA@@*/', () => json)
  .replace(/@@ICON:([\w.-]+)@@/g, (_, f) => `data:image/${f.endsWith('.svg') ? 'svg+xml' : 'png'};base64,` + readFileSync(P('src/icons', f)).toString('base64'));
const rows = U.reduce((a, u) => a + u.rows.length, 0);
const summary = `대학 ${U.length}곳 · 전형 ${rows}개 · v${V[V.length - 1].v}`;
if (CHECK) {
  const cur = existsSync(P('index.html')) ? readFileSync(P('index.html'), 'utf8') : '';
  if (cur !== html) {
    console.error('index.html 이 data/·src/ 와 다릅니다. node scripts/build.mjs 를 실행한 뒤 index.html 도 커밋하세요.');
    process.exit(1);
  }
  console.log(`검증 통과, index.html 최신 (${summary})`);
} else {
  writeFileSync(P('index.html'), html);
  console.log(`index.html 생성 (${summary}, ${(Buffer.byteLength(html) / 1024).toFixed(0)}KB)`);
}
