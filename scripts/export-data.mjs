#!/usr/bin/env node
// data/ 의 대학별 JSON을 하나로 묶은 data.json 을 만든다(MCP 서버가 읽는 공개 데이터).
//   node scripts/export-data.mjs [출력 경로]   기본값: _site/data.json
// 화면용 이력(h, hu)은 빼고, 번호 순서(화면 기본 순서)대로 담는다.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function exportData() {
  const dir = join(ROOT, 'data/universities');
  const files = readdirSync(dir).filter(f => /^\d+-.+\.json$/.test(f)).sort();
  const strip = r => { const { h, ...rest } = r; return rest };
  const universities = files.map(f => {
    const { hu, ...u } = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    return { ...u, rows: u.rows.map(strip), ...(u.rur ? { rur: u.rur.map(strip) } : {}) };
  });
  const versions = JSON.parse(readFileSync(join(ROOT, 'data/versions.json'), 'utf8'));
  const last = versions[versions.length - 1];
  return {
    meta: {
      title: '2028학년도 대입전형 시행계획 요약',
      version: last.v,
      updated: last.t + ' KST',
      dashboard: 'https://2023swhs3rd-a11y.github.io/2028plan/',
      source: '각 대학이 공개한 2028학년도 대입전형 시행계획 PDF(fid = Google Drive 파일 ID, pg = 원문 쪽수)',
      license: 'CC BY-NC 4.0 (봉일천고등학교 진로진학부)',
      universities: new Set(universities.map(u => u.parent || u.u)).size, // 캠퍼스 분리 항목(parent)은 본교와 한 곳으로 셈
      entries: universities.length,
    },
    universities,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] || join(ROOT, '_site/data.json');
  mkdirSync(dirname(out), { recursive: true });
  const data = exportData();
  writeFileSync(out, JSON.stringify(data));
  console.log(`${out} 생성 (대학 ${data.meta.universities}곳 · 항목 ${data.meta.entries} · v${data.meta.version})`);
}
