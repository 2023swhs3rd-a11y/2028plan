#!/usr/bin/env node
// Google Fonts 글꼴을 fonts/ 에 내려받아 같은 주소에서 내보낸다(방문자 IP가 Google로 가지 않게).
//   node scripts/fetch-fonts.mjs   → fonts/fonts.css, fonts/*.woff2, fonts/OFL-*.txt 를 새로 만든다
// Google이 나눠 둔 unicode-range 조각을 그대로 옮기므로, 브라우저는 화면에 나온 글자의 조각만 받는다.
// 글꼴 종류·굵기를 바꾸면 아래 CSS2 주소를 고친 뒤 다시 실행한다.
import { writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'fonts');
const CSS2 = 'https://fonts.googleapis.com/css2?family=Gothic+A1:wght@500;700;900&family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'; // woff2 를 받으려면 최신 브라우저로 요청해야 한다
const LICENSES = { 'Gothic A1': 'gothica1', 'IBM Plex Sans KR': 'ibmplexsanskr', 'IBM Plex Mono': 'ibmplexmono' };

const get = async (url, opt) => { const r = await fetch(url, opt); if (!r.ok) throw new Error(`${url} HTTP ${r.status}`); return r };
const css = await (await get(CSS2, { headers: { 'User-Agent': UA } })).text();
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) rmSync(join(OUT, f));

const jobs = [], seen = {};
const out = css.replace(/@font-face\s*{[^}]*}/g, block => {
  const fam = block.match(/font-family:\s*'([^']+)'/)[1], w = block.match(/font-weight:\s*(\d+)/)[1];
  const key = fam.toLowerCase().replace(/\s+/g, '-') + '-' + w, n = seen[key] = (seen[key] || 0) + 1;
  const file = `${key}-${String(n).padStart(3, '0')}.woff2`;
  return block.replace(/url\((https:[^)]+)\)/, (_, url) => { jobs.push([url, file]); return `url(${file})` });
});
for (let i = 0; i < jobs.length; i += 16) // 16개씩 나눠 받는다
  await Promise.all(jobs.slice(i, i + 16).map(async ([url, file]) => writeFileSync(join(OUT, file), Buffer.from(await (await get(url)).arrayBuffer()))));
const min = out.replace(/\/\*[^*]*\*\//g, '').replace(/\s*([{};:,])\s*/g, '$1').replace(/;}/g, '}').trim();
writeFileSync(join(OUT, 'fonts.css'), `/* scripts/fetch-fonts.mjs 가 만든 파일. 직접 고치지 말 것. 글꼴: SIL Open Font License 1.1 (OFL-*.txt) */\n${min.replace(/}/g, '}\n')}`);
for (const [fam, dir] of Object.entries(LICENSES))
  writeFileSync(join(OUT, `OFL-${dir}.txt`), `${fam}\n\n` + await (await get(`https://raw.githubusercontent.com/google/fonts/main/ofl/${dir}/OFL.txt`)).text());
console.log(`fonts/ 에 글꼴 조각 ${jobs.length}개와 fonts.css 생성`);
