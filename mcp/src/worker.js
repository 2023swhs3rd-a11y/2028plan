// Cloudflare Workers 진입점: GitHub Pages에 배포된 data.json을 읽어 MCP 요청에 답한다.
import { handle } from './mcp.js';

const DEFAULT_DATA_URL = 'https://2023swhs3rd-a11y.github.io/2028plan/data.json';
const TTL = 10 * 60 * 1000; // 데이터 캐시 10분: 저장소 반영 후 길어야 10분 안에 새 데이터가 나간다
let cache = { at: 0, data: null };

async function loadData(env) {
  if (cache.data && Date.now() - cache.at < TTL) return cache.data;
  const res = await fetch(env.DATA_URL || DEFAULT_DATA_URL, { cf: { cacheTtl: 600 } });
  if (!res.ok) {
    if (cache.data) return cache.data; // 일시 오류면 직전 데이터로 답한다
    throw new Error(`data.json HTTP ${res.status}`);
  }
  cache = { at: Date.now(), data: await res.json() };
  return cache.data;
}

export default {
  fetch: (request, env) => handle(request, () => loadData(env)),
};
