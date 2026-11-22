// 챗봇 접근 제어(IP/CIDR · ACCESS_CODE · either/ip/code/both/open) 및 호출 상한(분당 · 일일 IP · 일일 전체).
// 런타임 의존성 없음(Cloudflare Workers · Node.js 공용).

const enc = new TextEncoder();

export function safeEqual(a, b) {
  const ab = enc.encode(String(a ?? ''));
  const bb = enc.encode(String(b ?? ''));
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) diff |= (ab[i] || 0) ^ (bb[i] || 0);
  return diff === 0;
}

// ── IP / CIDR 파싱 및 대조 ──
export function parseIPv4(str) {
  const parts = str.split('.');
  if (parts.length !== 4) return null;
  let val = 0n;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    if (p.length > 1 && p.startsWith('0')) return null;
    const n = Number(p);
    if (n < 0 || n > 255) return null;
    val = (val << 8n) | BigInt(n);
  }
  return val;
}

export function parseIPv6(str) {
  let s = str.toLowerCase();
  const zone = s.indexOf('%');
  if (zone !== -1) s = s.slice(0, zone);
  if (!s) return null;

  // IPv4-embedded 꼬리(예: ::ffff:210.100.12.34)를 16비트 2그룹으로 치환
  const lastColon = s.lastIndexOf(':');
  if (lastColon !== -1 && s.slice(lastColon + 1).includes('.')) {
    const v4 = parseIPv4(s.slice(lastColon + 1));
    if (v4 === null) return null;
    const hi = Number((v4 >> 16n) & 0xffffn).toString(16);
    const lo = Number(v4 & 0xffffn).toString(16);
    s = `${s.slice(0, lastColon + 1)}${hi}:${lo}`;
  }

  const dbl = s.split('::');
  if (dbl.length > 2) return null;

  let groups;
  if (dbl.length === 2) {
    const left = dbl[0] ? dbl[0].split(':') : [];
    const right = dbl[1] ? dbl[1].split(':') : [];
    const missing = 8 - (left.length + right.length);
    if (missing < 1) return null;
    groups = [...left, ...Array(missing).fill('0'), ...right];
  } else {
    groups = s.split(':');
    if (groups.length !== 8) return null;
  }

  let val = 0n;
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    val = (val << 16n) | BigInt(parseInt(g, 16));
  }
  return val;
}

export function parseIp(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.trim();
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
  const v4 = parseIPv4(s);
  if (v4 !== null) return { version: 4, value: v4 };
  const v6 = parseIPv6(s);
  if (v6 !== null) {
    // ::ffff:0:0/96 (IPv4-mapped IPv6) 는 IPv4 규칙과도 매칭되도록 변환
    if ((v6 >> 32n) === 0xffffn) return { version: 4, value: v6 & 0xffffffffn };
    return { version: 6, value: v6 };
  }
  return null;
}

export function parseCidrList(raw) {
  if (!raw || typeof raw !== 'string') return [];
  const rules = [];
  for (const token of raw.split(/[\s,;]+/)) {
    const t = token.trim();
    if (!t || t.startsWith('#')) continue;
    const slash = t.indexOf('/');
    const ipPart = slash === -1 ? t : t.slice(0, slash);
    const ip = parseIp(ipPart);
    if (!ip) continue;
    const bits = ip.version === 4 ? 32 : 128;
    let prefix = bits;
    if (slash !== -1) {
      const pStr = t.slice(slash + 1);
      if (!/^\d{1,3}$/.test(pStr)) continue;
      prefix = Number(pStr);
      if (prefix < 0 || prefix > bits) continue;
    }
    const mask = prefix === 0 ? 0n : (((1n << BigInt(bits)) - 1n) ^ ((1n << BigInt(bits - prefix)) - 1n));
    rules.push({ version: ip.version, network: ip.value & mask, mask, prefix });
  }
  return rules;
}

export function ipMatchesList(clientIp, rawList) {
  const ip = parseIp(clientIp);
  if (!ip) return false;
  const rules = parseCidrList(rawList);
  return rules.some(r => r.version === ip.version && (ip.value & r.mask) === r.network);
}

export function getClientIp(request) {
  const cf = request.headers.get('CF-Connecting-IP');
  if (cf && cf.trim()) return cf.trim();
  const xff = request.headers.get('X-Forwarded-For');
  if (xff && xff.trim()) return xff.split(',')[0].trim();
  return '127.0.0.1';
}

export function getAccessCode(request) {
  const hdr = request.headers.get('X-Access-Code');
  if (hdr && hdr.trim()) return hdr.trim();
  const auth = request.headers.get('Authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

const MODES = new Set(['either', 'ip', 'code', 'both', 'open']);

export function checkAccess(request, env = {}) {
  const rawMode = String(env.ACCESS_MODE || 'either').trim().toLowerCase();
  const accessMode = MODES.has(rawMode) ? rawMode : 'either';
  const rules = parseCidrList(env.ALLOWED_IPS || '');
  const ipConfigured = rules.length > 0;
  const expectedCode = String(env.ACCESS_CODE || '').trim();
  const codeConfigured = expectedCode.length > 0;

  const clientIp = getClientIp(request);
  const providedCode = getAccessCode(request);
  const ipAllowed = ipConfigured && ipMatchesList(clientIp, env.ALLOWED_IPS);
  const codeProvided = providedCode.length > 0;
  const codeValid = codeConfigured && codeProvided && safeEqual(providedCode, expectedCode);

  const base = { accessMode, ipConfigured, codeConfigured, ipAllowed, codeProvided, clientIp };

  if (accessMode === 'open') {
    return { ...base, allowed: true, authMethod: 'open', needsCode: false, reason: null, message: null };
  }

  if (!ipConfigured && !codeConfigured) {
    return {
      ...base,
      allowed: false,
      authMethod: null,
      needsCode: false,
      reason: 'NOT_CONFIGURED',
      message: '서버에 접근 제어(ALLOWED_IPS 또는 ACCESS_CODE)가 설정되지 않았습니다. 관리자에게 문의하세요.',
    };
  }

  if (accessMode === 'either') {
    if (ipAllowed) return { ...base, allowed: true, authMethod: 'ip', needsCode: false, reason: null, message: null };
    if (codeValid) return { ...base, allowed: true, authMethod: 'code', needsCode: false, reason: null, message: null };
    if (codeConfigured) {
      return {
        ...base,
        allowed: false,
        authMethod: null,
        needsCode: true,
        reason: codeProvided ? 'INVALID_CODE' : 'CODE_REQUIRED',
        message: codeProvided ? '접근 코드가 올바르지 않습니다.' : '외부 네트워크에서는 접근 코드를 입력해야 합니다.',
      };
    }
    return {
      ...base,
      allowed: false,
      authMethod: null,
      needsCode: false,
      reason: 'IP_DENIED',
      message: '허용된 네트워크(학교 IP)에서만 이용할 수 있습니다.',
    };
  }

  if (accessMode === 'ip') {
    if (ipAllowed) return { ...base, allowed: true, authMethod: 'ip', needsCode: false, reason: null, message: null };
    return {
      ...base,
      allowed: false,
      authMethod: null,
      needsCode: false,
      reason: 'IP_DENIED',
      message: '허용된 네트워크(학교 IP)에서만 이용할 수 있습니다.',
    };
  }

  if (accessMode === 'code') {
    if (codeValid) return { ...base, allowed: true, authMethod: 'code', needsCode: false, reason: null, message: null };
    return {
      ...base,
      allowed: false,
      authMethod: null,
      needsCode: codeConfigured,
      reason: !codeConfigured ? 'NOT_CONFIGURED' : (codeProvided ? 'INVALID_CODE' : 'CODE_REQUIRED'),
      message: !codeConfigured
        ? '접근 코드가 서버에 설정되지 않았습니다.'
        : (codeProvided ? '접근 코드가 올바르지 않습니다.' : '접근 코드를 입력해 주세요.'),
    };
  }

  // accessMode === 'both'
  if (ipAllowed && codeValid) {
    return { ...base, allowed: true, authMethod: 'both', needsCode: false, reason: null, message: null };
  }
  if (!ipAllowed) {
    return {
      ...base,
      allowed: false,
      authMethod: null,
      needsCode: false,
      reason: 'IP_DENIED',
      message: '허용된 네트워크(학교 IP)에서만 이용할 수 있습니다.',
    };
  }
  return {
    ...base,
    allowed: false,
    authMethod: null,
    needsCode: codeConfigured,
    reason: codeProvided ? 'INVALID_CODE' : 'CODE_REQUIRED',
    message: codeProvided ? '접근 코드가 올바르지 않습니다.' : '학교 IP 확인 완료. 접근 코드를 함께 입력해 주세요.',
  };
}

// ── 분당 · 일일 호출 상한 (KST 자정 초기화) ──
const positiveInt = (v, fallback) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export function kstDateKey(nowMs) {
  return new Date(nowMs + 9 * 3600_000).toISOString().slice(0, 10);
}

export function secondsUntilKstMidnight(nowMs) {
  const kstMs = nowMs + 9 * 3600_000;
  const dayMs = 24 * 3600_000;
  const rem = dayMs - (kstMs % dayMs);
  return Math.max(1, Math.ceil(rem / 1000));
}

export class RateLimiter {
  constructor(nowFn = () => Date.now()) {
    this.nowFn = nowFn;
    this.minuteBuckets = new Map();
    this.dayIpCounts = new Map();
    this.dayTotalCounts = new Map();
    this.authFailBuckets = new Map();
  }

  getConfig(env = {}) {
    return {
      perMin: positiveInt(env.RATE_LIMIT_PER_MIN, 10),
      perDayIp: positiveInt(env.RATE_LIMIT_PER_DAY_IP, 100),
      perDayTotal: positiveInt(env.RATE_LIMIT_PER_DAY_TOTAL, 500),
      authFailMax: positiveInt(env.AUTH_FAIL_MAX, 10),
    };
  }

  _prune(now, day) {
    if (this.minuteBuckets.size > 500) {
      for (const [k, ts] of this.minuteBuckets) {
        const kept = ts.filter(t => now - t < 60_000);
        if (kept.length) this.minuteBuckets.set(k, kept);
        else this.minuteBuckets.delete(k);
      }
    }
    for (const k of this.dayIpCounts.keys()) {
      if (!k.startsWith(day + ':')) this.dayIpCounts.delete(k);
    }
    for (const k of this.dayTotalCounts.keys()) {
      if (k !== day) this.dayTotalCounts.delete(k);
    }
    if (this.authFailBuckets.size > 500) {
      for (const [k, ts] of this.authFailBuckets) {
        const kept = ts.filter(t => now - t < 600_000);
        if (kept.length) this.authFailBuckets.set(k, kept);
        else this.authFailBuckets.delete(k);
      }
    }
  }

  async _readCounts(clientKey, env, now, day) {
    const recent = (this.minuteBuckets.get(clientKey) || []).filter(t => now - t < 60_000);
    this.minuteBuckets.set(clientKey, recent);

    const ipKey = `${day}:${clientKey}`;
    let dayIp = this.dayIpCounts.get(ipKey) || 0;
    let dayTotal = this.dayTotalCounts.get(day) || 0;

    // 선택적 KV 바인딩(CHAT_KV)이 있으면 워커 인스턴스 간 일일 합산에도 반영
    if (env.CHAT_KV && typeof env.CHAT_KV.get === 'function') {
      try {
        const [kvIp, kvTot] = await Promise.all([
          env.CHAT_KV.get(`rl:ip:${ipKey}`),
          env.CHAT_KV.get(`rl:tot:${day}`),
        ]);
        dayIp = Math.max(dayIp, Number.parseInt(kvIp || '0', 10) || 0);
        dayTotal = Math.max(dayTotal, Number.parseInt(kvTot || '0', 10) || 0);
      } catch {
        // KV 일시 오류 시 메모리 카운터로 계속 진행
      }
    }
    return { recent, dayIp, dayTotal };
  }

  async peek(clientKey, env = {}) {
    const now = this.nowFn();
    const day = kstDateKey(now);
    const cfg = this.getConfig(env);
    const { recent, dayIp, dayTotal } = await this._readCounts(clientKey, env, now, day);
    return {
      perMin: cfg.perMin,
      perDayIp: cfg.perDayIp,
      perDayTotal: cfg.perDayTotal,
      remainingMin: Math.max(0, cfg.perMin - recent.length),
      remainingDayIp: Math.max(0, cfg.perDayIp - dayIp),
      remainingDayTotal: Math.max(0, cfg.perDayTotal - dayTotal),
      day,
    };
  }

  async consume(clientKey, env = {}) {
    const now = this.nowFn();
    const day = kstDateKey(now);
    this._prune(now, day);
    const cfg = this.getConfig(env);
    const { recent, dayIp, dayTotal } = await this._readCounts(clientKey, env, now, day);

    if (recent.length >= cfg.perMin) {
      const oldest = recent[0];
      const retryAfter = Math.max(1, Math.ceil((60_000 - (now - oldest)) / 1000));
      return {
        ok: false,
        scope: 'minute',
        retryAfter,
        message: `분당 호출 상한(${cfg.perMin}회)에 도달했습니다. ${retryAfter}초 후 다시 시도해 주세요.`,
        limits: {
          perMin: cfg.perMin,
          perDayIp: cfg.perDayIp,
          perDayTotal: cfg.perDayTotal,
          remainingMin: 0,
          remainingDayIp: Math.max(0, cfg.perDayIp - dayIp),
          remainingDayTotal: Math.max(0, cfg.perDayTotal - dayTotal),
          day,
        },
      };
    }

    if (dayIp >= cfg.perDayIp) {
      const retryAfter = secondsUntilKstMidnight(now);
      return {
        ok: false,
        scope: 'day_ip',
        retryAfter,
        message: `일일 개인 호출 상한(${cfg.perDayIp}회)에 도달했습니다. 자정(KST) 이후 다시 이용해 주세요.`,
        limits: {
          perMin: cfg.perMin,
          perDayIp: cfg.perDayIp,
          perDayTotal: cfg.perDayTotal,
          remainingMin: Math.max(0, cfg.perMin - recent.length),
          remainingDayIp: 0,
          remainingDayTotal: Math.max(0, cfg.perDayTotal - dayTotal),
          day,
        },
      };
    }

    if (dayTotal >= cfg.perDayTotal) {
      const retryAfter = secondsUntilKstMidnight(now);
      return {
        ok: false,
        scope: 'day_total',
        retryAfter,
        message: `오늘 전체 호출 상한(${cfg.perDayTotal}회)에 도달했습니다. 자정(KST) 이후 다시 이용해 주세요.`,
        limits: {
          perMin: cfg.perMin,
          perDayIp: cfg.perDayIp,
          perDayTotal: cfg.perDayTotal,
          remainingMin: Math.max(0, cfg.perMin - recent.length),
          remainingDayIp: Math.max(0, cfg.perDayIp - dayIp),
          remainingDayTotal: 0,
          day,
        },
      };
    }

    recent.push(now);
    this.minuteBuckets.set(clientKey, recent);
    const nextIp = dayIp + 1;
    const nextTot = dayTotal + 1;
    const ipKey = `${day}:${clientKey}`;
    this.dayIpCounts.set(ipKey, nextIp);
    this.dayTotalCounts.set(day, nextTot);

    if (env.CHAT_KV && typeof env.CHAT_KV.put === 'function') {
      const ttl = secondsUntilKstMidnight(now) + 3600;
      Promise.allSettled([
        env.CHAT_KV.put(`rl:ip:${ipKey}`, String(nextIp), { expirationTtl: ttl }),
        env.CHAT_KV.put(`rl:tot:${day}`, String(nextTot), { expirationTtl: ttl }),
      ]).catch(() => {});
    }

    return {
      ok: true,
      limits: {
        perMin: cfg.perMin,
        perDayIp: cfg.perDayIp,
        perDayTotal: cfg.perDayTotal,
        remainingMin: Math.max(0, cfg.perMin - recent.length),
        remainingDayIp: Math.max(0, cfg.perDayIp - nextIp),
        remainingDayTotal: Math.max(0, cfg.perDayTotal - nextTot),
        day,
      },
    };
  }

  checkAuthFail(clientIp, env = {}) {
    const now = this.nowFn();
    const cfg = this.getConfig(env);
    const list = (this.authFailBuckets.get(clientIp) || []).filter(t => now - t < 600_000);
    this.authFailBuckets.set(clientIp, list);
    if (list.length >= cfg.authFailMax) {
      const retryAfter = Math.max(1, Math.ceil((600_000 - (now - list[0])) / 1000));
      return { blocked: true, retryAfter };
    }
    return { blocked: false, retryAfter: 0 };
  }

  recordAuthFail(clientIp) {
    const now = this.nowFn();
    const list = (this.authFailBuckets.get(clientIp) || []).filter(t => now - t < 600_000);
    list.push(now);
    this.authFailBuckets.set(clientIp, list);
  }
}
