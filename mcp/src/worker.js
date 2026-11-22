// Cloudflare Workers 진입점: GitHub Pages에 배포된 data.json을 읽어 MCP(/mcp)와 챗봇(/chat, /chat/status) 요청에 답한다.
import { handle } from './mcp.js';
import { handleChat } from './chat.js';

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

const GEMINI_HOST_RE = /^https:\/\/(generativelanguage|aiplatform)\.googleapis\.com\//;

// 한국 트래픽이 Cloudflare 홍콩(HKG) PoP를 경유할 때 Gemini API가 지역 차단(400 FAILED_PRECONDITION)을 반환하는 문제 방지:
// 북미 서부(wnam)에 고정된 Durable Object(무료 플랜 SQLite 지원)를 통해 Gemini API를 호출한다.
export class GeminiProxy {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request, fetchImpl = globalThis.fetch) {
    const targetUrl = request.headers.get('X-Proxy-Target') || '';
    if (!GEMINI_HOST_RE.test(targetUrl)) {
      return new Response('Invalid proxy target', { status: 400 });
    }
    const headers = new Headers();
    headers.set('Content-Type', request.headers.get('Content-Type') || 'application/json');
    const apiKey = request.headers.get('x-goog-api-key');
    if (apiKey) headers.set('x-goog-api-key', apiKey);
    return fetchImpl(targetUrl, {
      method: request.method || 'POST',
      headers,
      body: request.body,
    });
  }
}

export function createGeminiFetch(env, fallbackFetch = globalThis.fetch) {
  if (!env?.GEMINI_PROXY) return fallbackFetch;
  return (url, init = {}) => {
    const u = String(url);
    if (GEMINI_HOST_RE.test(u)) {
      const id = env.GEMINI_PROXY.idFromName('us-west-1');
      const stub = env.GEMINI_PROXY.get(id, { locationHint: 'wnam' });
      const headers = new Headers(init.headers || {});
      headers.set('X-Proxy-Target', u);
      return stub.fetch('https://gemini-proxy.internal/', {
        method: init.method || 'POST',
        headers,
        body: init.body,
      });
    }
    return fallbackFetch(url, init);
  };
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const getData = () => loadData(env);
    if (pathname === '/chat' || pathname === '/chat/status') {
      return handleChat(request, getData, env, { fetch: createGeminiFetch(env) });
    }
    return handle(request, getData);
  },
};
