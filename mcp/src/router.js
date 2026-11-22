// 질문 성격·복잡도에 따른 Gemini(빠른 조회) ↔ Claude(복합 비교·상담 준비표·안내문 작성) 자동 라우팅.
// 수동 모드(auto / fast / deep)와 한쪽 API 키 미설정·오류 시 폴백 대상 결정을 함께 처리한다.

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export const DEFAULT_GEMINI_FALLBACKS = ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite'];
export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-5';

export function getGeminiCandidates(primaryModel, env = {}) {
  const custom = String(env.GEMINI_FALLBACK_MODELS || '').trim();
  const extras = custom
    ? custom.split(/[\s,]+/).filter(Boolean)
    : DEFAULT_GEMINI_FALLBACKS;
  return [...new Set([primaryModel, ...extras].filter(Boolean))];
}

export function getProviders(env = {}) {
  return {
    gemini: {
      available: Boolean(env.GEMINI_API_KEY && String(env.GEMINI_API_KEY).trim()),
      model: String(env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim() || DEFAULT_GEMINI_MODEL,
    },
    claude: {
      available: Boolean(env.ANTHROPIC_API_KEY && String(env.ANTHROPIC_API_KEY).trim()),
      model: String(env.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL).trim() || DEFAULT_CLAUDE_MODEL,
    },
  };
}

const CONSULT_RE = /상담\s*준비표|후보표|상담\s*자료|상담용|지원\s*전략|지원\s*조합|포트폴리오|6장|수시\s*카드|전략을?\s*(짜|세워|제안|추천)|맞춤\s*추천/;
const DRAFT_RE = /안내문|가정통신문|초안|공지문?|학부모\s*(안내|설명|자료|용)|설명회|발표\s*자료|보도자료|홍보문/;
const COMPARE_RE = /비교해|비교표|비교\s*(정리|분석|해)|차이점?|장단점|유리한?\s*(곳|대학|전형)|불리한?|대비\s*분석|종합적으로|심층|표로\s*비교|어디가\s*(유리|나을까|좋을까)/;
const GROUP_SLANG_RE = /서연고|서성한|중경외시|건동홍|국숭세단|광명상가|인아홍|지거국|교대\s*전체|과기원\s*전체/;
const UNIV_MENTION_RE = /[가-힣A-Za-z]{2,8}(?:대학교|여대|교대|과기대|과기원|대)(?![학표비교])/g;
const DIMENSIONS = [/수능\s*최저|최저\s*학력/, /면접/, /환산|등급/, /반영\s*비율|가중치/, /변경|달라진|바뀐/, /농어촌/, /교과/, /종합/, /논술/, /정시/, /추천|지균/, /졸업생|재수|N수/i];

export function classifyComplexity({ text = '', promptName = null } = {}) {
  const q = String(text || '').trim();

  if (promptName === 'consult_prep') return { complexity: 'deep', reason: '상담 준비표 작성' };
  if (promptName === 'change_notice') return { complexity: 'deep', reason: '2028 변경 안내문 작성' };

  if (CONSULT_RE.test(q)) return { complexity: 'deep', reason: '상담 준비표·지원 전략' };
  if (DRAFT_RE.test(q)) return { complexity: 'deep', reason: '안내문·문서 초안 작성' };
  if (COMPARE_RE.test(q)) return { complexity: 'deep', reason: '복합 비교·분석' };

  const univMatches = new Set((q.match(UNIV_MENTION_RE) || []).map(s => s.replace(/학교$/, '')));
  if (GROUP_SLANG_RE.test(q) || univMatches.size >= 3) {
    return { complexity: 'deep', reason: '다수 대학 비교·정리' };
  }
  if (univMatches.size >= 2 && /표|정리|추천|분석|어디|차이|변경/.test(q)) {
    return { complexity: 'deep', reason: '복수 대학 비교·정리' };
  }

  const dimCount = DIMENSIONS.reduce((n, re) => n + (re.test(q) ? 1 : 0), 0);
  if (q.length >= 110 || (q.length >= 70 && dimCount >= 3)) {
    return { complexity: 'deep', reason: '복합 조건 질의' };
  }

  return { complexity: 'fast', reason: '빠른 조회' };
}

export function selectRoute({ mode = 'auto', text = '', promptName = null, env = {} } = {}) {
  const m = ['auto', 'fast', 'deep'].includes(mode) ? mode : 'auto';
  const providers = getProviders(env);

  if (!providers.gemini.available && !providers.claude.available) {
    return {
      ok: false,
      error: 'AI API 키(GEMINI_API_KEY 또는 ANTHROPIC_API_KEY)가 설정되지 않았습니다.',
      providers,
    };
  }

  let preferred;
  let reason;
  let complexity;
  if (m === 'fast') {
    preferred = 'gemini';
    complexity = 'fast';
    reason = '수동 선택(빠름)';
  } else if (m === 'deep') {
    preferred = 'claude';
    complexity = 'deep';
    reason = '수동 선택(심층)';
  } else {
    const c = classifyComplexity({ text, promptName });
    complexity = c.complexity;
    preferred = complexity === 'deep' ? 'claude' : 'gemini';
    reason = c.reason;
  }

  const other = preferred === 'gemini' ? 'claude' : 'gemini';
  if (providers[preferred].available) {
    return {
      ok: true,
      mode: m,
      complexity,
      provider: preferred,
      model: providers[preferred].model,
      fallback: providers[other].available ? other : null,
      fallbackModel: providers[other].available ? providers[other].model : null,
      reason,
      providers,
    };
  }

  // 선호 모델의 키가 없으면 사용 가능한 다른 모델로 자동 전환
  return {
    ok: true,
    mode: m,
    complexity,
    provider: other,
    model: providers[other].model,
    fallback: null,
    fallbackModel: null,
    reason: `${reason} (사용 가능 모델로 자동 전환)`,
    providers,
  };
}
