#!/usr/bin/env node
// GitHub 릴리스 본문을 만든다: CHANGELOG.md 에서 해당 버전 절을 꺼내고 대시보드·데이터 안내를 붙인다.
//   node scripts/release-notes.mjs [버전]   기본값: data/versions.json 의 마지막 버전
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const V = JSON.parse(readFileSync(join(ROOT, 'data/versions.json'), 'utf8'));
const ver = (process.argv[2] || V[V.length - 1].v).replace(/^v/, '');
const lines = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8').split('\n');
const start = lines.findIndex(l => l.startsWith(`## v${ver} `));
if (start < 0) {
  console.error(`CHANGELOG.md 에 v${ver} 절이 없습니다.`);
  process.exit(1);
}
let end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
if (end < 0) end = lines.length;
const body = lines.slice(start + 1, end).join('\n').trim();
console.log([body, '',
  '---', '',
  '- 대시보드: https://2023swhs3rd-a11y.github.io/2028plan/',
  '- 첨부한 `data.json`은 이 버전의 전체 데이터입니다(MCP 서버가 읽는 파일과 같음).',
  '- 출처는 각 대학이 공개한 2028학년도 대입전형 시행계획이며, 최종 확인은 대학 모집요강으로 하세요.',
  '- 라이선스: CC BY-NC 4.0 (봉일천고등학교 진로진학부)',
].join('\n'));
