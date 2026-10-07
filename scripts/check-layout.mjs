// 화면 점검: 390px·1440px, 라이트·다크에서 콘솔 오류, 가로 스크롤, 표 칸·카드 밖으로 넘치는 글자를 찾는다.
// 사용: node scripts/check-layout.mjs  (전역 설치된 playwright 필요, 문제가 있으면 목록을 출력하고 종료 코드 1)
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); }
catch { ({ chromium } = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright')); }

const URL = 'file://' + join(ROOT, 'index.html');
const problems = [];

// 칸(td·th)이나 카드(.jc·.uc 등) 안의 요소가 그 경계를 넘는지
const scan = () => {
  const out = [];
  const boxes = document.querySelectorAll('td, th, .jc dd, .kv dd');
  boxes.forEach(box => {
    if (!box.offsetParent) return;
    const br = box.getBoundingClientRect();
    if (!br.width) return;
    box.querySelectorAll('*').forEach(e => {
      const er = e.getBoundingClientRect();
      if (!er.width || getComputedStyle(e).position === 'absolute') return;
      const over = Math.max(er.right - br.right, br.left - er.left);
      if (over > 1) out.push(`${(box.closest('tr,.jc')?.innerText || '').split('\n')[0].slice(0, 24)} | ${e.className || e.tagName} | ${(e.innerText || '').slice(0, 40)} | +${Math.round(over)}px`);
    });
  });
  if (document.documentElement.scrollWidth > innerWidth + 1) out.push(`가로 스크롤 ${document.documentElement.scrollWidth}px > ${innerWidth}px`);
  return out;
};

const b = await chromium.launch();
for (const [w, scheme] of [[1440, 'light'], [1440, 'dark'], [390, 'light'], [390, 'dark']]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 }, colorScheme: scheme });
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.evaluate(() => { try { localStorage.clear(); } catch {} }); await p.reload(); await p.waitForTimeout(600);
  const tag = `${w} ${scheme}`;
  for (const v of ['univ', 'track', 'quota', 'change', 'about']) {
    await p.click(`[data-v="${v}"]`); await p.waitForTimeout(300);
    if (v === 'track') {
      for (const t of await p.$$eval('#ttabs button:not([disabled])', bs => bs.map(x => x.dataset.t))) {
        await p.click(`#ttabs button[data-t="${t}"]`); await p.waitForTimeout(300);
        (await p.evaluate(scan)).forEach(x => problems.push(`${tag} 전형별 비교·${t}: ${x}`));
      }
    } else (await p.evaluate(scan)).forEach(x => problems.push(`${tag} ${v}: ${x}`));
  }
  // 대학 상세는 라이트 모드에서 폭별로 한 번씩 전부 확인
  if (scheme === 'light') {
    for (const u of await p.evaluate(() => U.map(x => x.u))) {
      await p.evaluate(u => openU(u, 'none'), u); await p.waitForTimeout(60);
      (await p.evaluate(scan)).forEach(x => problems.push(`${tag} 대학 상세·${u}: ${x}`));
    }
  }
  errs.forEach(e => problems.push(`${tag} 콘솔 오류: ${e}`));
  await p.close();
}
await b.close();
if (problems.length) { console.log([...new Set(problems)].join('\n')); console.log(`문제 ${new Set(problems).size}건`); process.exit(1); }
console.log('화면 점검 통과 (390·1440, 라이트·다크, 대학 상세 포함)');
