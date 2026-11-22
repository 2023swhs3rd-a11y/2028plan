/*
 * 2028 지원 자격·수능최저 판정 로직 (2단계)
 *
 * 입력: 학생 정보 1건 + 전형 데이터(data.json의 rows)
 * 출력: 전형마다 { status: '충족' | '미충족' | '확인 필요', reasons, notes, elig, min }
 *
 * 원칙: 애매하면 충족·미충족으로 억지로 정하지 않는다.
 *  - 원문 해석이 갈리는 지점(필수 영역·한국사 적용 범위·탐구 방식·대상 영역·절사 여부·대체 응시 등)은
 *    가능한 해석을 모두 적용해 보고, 결과가 같을 때만 확정한다. 갈리면 '확인 필요'.
 *  - 입력하지 않은 등급은 가장 좋은 경우(1)와 가장 나쁜 경우(9)를 모두 넣어 보고, 갈리면 '확인 필요'.
 *
 * 브라우저(<script src="judge.js">, window.Judge)와 Node(require) 양쪽에서 쓴다. 외부 의존성 없음.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Judge = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const OK = '충족', NO = '미충족', CHECK = '확인 필요';
  const AREAS = ['국', '수', '영', '통사', '통과', '한국사'];
  const NAME = { 국: '국어', 수: '수학', 영: '영어', 통사: '통합사회', 통과: '통합과학', 탐: '탐구', 한국사: '한국사' };
  const REQ_NAME = { 수: '수학', 국: '국어', 탐: '탐구', '국·수 모두': '국어·수학 모두', '국·수 중 1개 이상': '국어·수학 중 1개 이상', '수·탐 모두': '수학·탐구 모두' };
  const TAM_TOP1 = '통합사회·통합과학 중 상위 1', TAM_AVG = '통합사회·통합과학 평균',
    TAM_SEP = '통합사회·통합과학 각각 별도 영역', TAM_SCI = '통합과학만';

  /* 학생 입력 예시
   * {
   *   status: '재학' | '졸업' | '검정고시',
   *   gradYear: 2028,                 // 졸업(예정) 연도. 재학생은 2028, 검정고시는 합격 연도
   *   schoolType: '일반고',            // SCHOOL_TYPES 중 하나
   *   region: '서울',                  // 출신 고교 시·도
   *   recommend: true,                 // 학교장 추천 가능 여부 (모르면 null)
   *   gender: null,                    // '여' | '남' | null (여대 판정용, 선택)
   *   grades: { 국: 2, 수: 3, 영: 2, 통사: 3, 통과: 2, 한국사: 3 }  // 9등급, 모르는 영역은 null
   * }
   */
  const SCHOOL_TYPES = ['일반고', '자율고', '자사고', '과학고', '외고', '국제고', '예술고', '체육고', '마이스터고',
    '특성화고', '영재학교', '방송통신고', '외국고', '검정고시', '기타(각종학교·대안·학력인정 등)'];
  // 학교 유형 → 원문 태그에서 이 학교를 가리키는 낱말들
  const SCHOOL_KEYS = {
    일반고: ['일반'], 자율고: ['자율'], 자사고: ['자율', '자사고'],
    과학고: ['특목', '과학고'], 외고: ['특목', '외고'], 국제고: ['특목', '국제고'],
    예술고: ['특목', '예술', '예고', '예체', '예·체'], 체육고: ['특목', '체육', '체고', '예체', '예·체'],
    마이스터고: ['특목', '마이스터'], 특성화고: ['특성화'], 영재학교: ['영재'], 방송통신고: ['방통', '방송통신'],
    외국고: ['외국고', '국외고', '해외고'], 검정고시: ['검정고시'],
    '기타(각종학교·대안·학력인정 등)': ['각종학교', '대안', '학력인정', '평생교육', '비인가', '고등기술', '특수학교'],
  };
  const REGIONS = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

  // ---------------------------------------------------------------- 공통
  const worst = (a, b) => (a === NO || b === NO ? NO : a === CHECK || b === CHECK ? CHECK : OK);
  const fold = (outcomes) => (outcomes.every(Boolean) ? OK : outcomes.some(Boolean) ? CHECK : NO);
  function cartesian(lists) {
    return lists.reduce((acc, l) => acc.flatMap(a => l.map(x => a.concat([x]))), [[]]);
  }
  function combos(arr, n) {
    if (n === 0) return [[]];
    if (arr.length < n) return [];
    const [h, ...t] = arr;
    return combos(t, n - 1).map(c => [h].concat(c)).concat(combos(t, n));
  }

  // ---------------------------------------------------------------- 수능최저
  // 규칙 하나를 '확정된 해석' 여러 개로 펼친다. 각 해석은 { areas, tam, n, kind, val, req, hist, eng, engMap, why }.
  function variants(rule) {
    const base = Object.assign({}, rule, { engMap: null });
    const forks = [];
    // 필수 영역에 "(확인 필요)"가 붙어 있으면 붙는 경우/안 붙는 경우
    if (/확인/.test(rule.req || '')) {
      const req = rule.req.replace(/\(확인 필요\)/, '').trim();
      forks.push([{ req, why: `${REQ_NAME[req] || req} 포함 조건 적용` }, { req: '', why: `${REQ_NAME[req] || req} 포함 조건 미적용` }]);
    }
    // 한국사 기준 적용 범위가 불명확: 같은 전형의 다른 단위에 적힌 4등급을 적용/미적용
    if (/확인/.test(rule.hist || '')) forks.push([{ hist: '4', why: '한국사 4 적용' }, { hist: '', why: '한국사 미적용' }]);
    // 탐구 방식이 불명확
    if (/미기재|원문 확인/.test(rule.tam || '')) {
      forks.push([{ tam: TAM_TOP1, why: '탐구 상위 1과목' }, { tam: TAM_AVG, why: '탐구 2과목 평균' }]);
    }
    // 대상 영역이 불명확(사탐 포함 여부)
    if (/대상 영역 확인/.test(rule.etc || '')) {
      const sci = rule.areas.filter(a => a !== '통사' && a !== '탐').concat(rule.areas.includes('통과') ? [] : ['통과']);
      forks.push([{ why: '대상 영역 문구대로' }, { areas: sci, tam: TAM_SCI, why: '탐구는 통합과학만' }]);
    }
    // 가천대: "국 또는 수 반영 시 1등급 상향"
    if (/1등급 상향/.test(rule.etc || '')) {
      forks.push([{ why: '기준 그대로' }, { val: rule.val + 1, why: '국·수 포함 시 기준 1 완화로 해석' }, { val: rule.val - 1, why: '국·수 포함 시 기준 1 강화로 해석' }]);
    }
    // 대체 응시(제2외국어·한문) — 입력에 없는 성적이므로, 대체 없이 못 맞출 때만 확인 필요가 된다
    if (/대체 가능/.test(rule.etc || '')) forks.push([{ why: '대체 응시 없음' }, { substitute: true, why: '제2외국어/한문으로 대체' }]);
    // 경기대: 영어 1·2등급은 1등급으로 처리 (확정 규칙)
    if (/영어 1·2등급은 1등급/.test(rule.etc || '')) base.engMap = g => (g != null && g <= 2 ? 1 : g);
    // 금오공대: 수학 등급 1 상향 (확정 규칙)
    if (/수학 등급 1 상향/.test(rule.etc || '')) base.mathUp = 1;
    // 중앙대: 영어 2등급 누적 비율 등에 따라 1·2등급 통합(수능 뒤에야 알 수 있음)
    if (/1·2등급 통합\(조건부\)/.test(rule.etc || '')) forks.push([{ why: '1·2등급 통합 없음' }, { merge12: true, why: '영어·과탐 1·2등급 통합 적용' }]);
    // 탐구 2과목 평균: 원문에 처리 방식이 있으면 그대로, 없으면 절사 여부에 따라 달라질 수 있다
    const tams = new Set([rule.tam].concat(forks.flat().map(f => f.tam).filter(Boolean)));
    if (/절사/.test(rule.etc || '')) base.trunc = true;
    else if (/반올림/.test(rule.etc || '')) base.round = true;
    else if (tams.has(TAM_AVG)) forks.push([{ trunc: false, why: '평균 그대로' }, { trunc: true, why: '평균 소수점 절사' }]);
    return cartesian(forks).map(fs => fs.reduce((v, f) => Object.assign(v, f, { why: (v.why ? v.why + ', ' : '') + f.why }),
      Object.assign({}, base, { why: '' })));
  }

  // 한 해석 × 한 등급 세트 → 충족 여부와 설명
  function evalRule(v, g) {
    if (v.kind === '미적용') return { pass: true, text: '수능최저 없음' };
    if (v.merge12 || v.mathUp) {
      g = Object.assign({}, g);
      if (v.merge12) { if (g.영 === 2) g.영 = 1; if (g.통과 === 2) g.통과 = 1; }
      if (v.mathUp && g.수 != null) g.수 = Math.max(1, g.수 - v.mathUp);
    }
    const eng = v.engMap ? v.engMap(g.영) : g.영;
    const fails = [];
    if (v.hist && /^\d$/.test(v.hist) && !(g.한국사 != null && g.한국사 <= +v.hist)) fails.push(`한국사 ${v.hist}등급 이내 미달`);
    if (v.hist === '응시 필수' && g.한국사 == null) fails.push('한국사 응시 필요');
    if (v.eng && !(eng != null && eng <= +v.eng)) fails.push(`영어 ${v.eng}등급 이내 미달`);
    if (v.kind === '한국사만' || v.kind === '영어·한국사만') return { pass: !fails.length, text: fails.join(', ') || '충족' };

    // 고를 수 있는 영역 풀
    const pool = [];
    for (const a of v.areas) {
      if (a === '탐') {
        const s = g.통사, c = g.통과;
        if (v.substitute) { pool.push({ a, g: 1 }); continue; }
        if (v.tam === TAM_AVG) {
          if (s == null || c == null) continue;
          const avg = (s + c) / 2;
          pool.push({ a, g: v.trunc ? Math.floor(avg) : v.round ? Math.round(avg) : avg });
        } else {
          const vals = [s, c].filter(x => x != null);
          if (vals.length) pool.push({ a, g: Math.min(...vals) });
        }
      } else if (a === '영') {
        if (eng != null) pool.push({ a, g: v.substitute ? 1 : eng });
      } else if (g[a] != null) pool.push({ a, g: g[a] });
    }
    const has = (c, x) => c.some(p => p.a === x);
    const reqOk = c => {
      switch (v.req) {
        case '수': return has(c, '수');
        case '국': return has(c, '국');
        case '탐': return has(c, '탐');
        case '국·수 모두': return has(c, '국') && has(c, '수');
        case '국·수 중 1개 이상': return has(c, '국') || has(c, '수');
        case '수·탐 모두': return has(c, '수') && (has(c, '탐') || has(c, '통과') || has(c, '통사'));
        default: return true;
      }
    };
    const cs = combos(pool, v.n).filter(reqOk);
    let best = null;
    for (const c of cs) {
      const score = v.kind === '합' ? c.reduce((s, p) => s + p.g, 0) : Math.max(...c.map(p => p.g));
      if (!best || score < best.score) best = { c, score };
    }
    const label = `${v.n}개 ${v.kind} ${v.val}`;
    if (!best) {
      fails.push(v.req ? `${REQ_NAME[v.req] || v.req} 포함 조건 미달` : `반영 가능한 영역이 ${v.n}개 미만`);
      return { pass: false, text: fails.join(', ') };
    }
    const combo = best.c.map(p => `${NAME[p.a]} ${Number.isInteger(p.g) ? p.g : p.g.toFixed(1)}`).join(' + ');
    if (best.score > v.val) {
      // 필수 영역 때문에 떨어졌는지 구분
      const free = combos(pool, v.n);
      const freeBest = free.length ? Math.min(...free.map(c => v.kind === '합' ? c.reduce((s, p) => s + p.g, 0) : Math.max(...c.map(p => p.g)))) : Infinity;
      if (v.req && freeBest <= v.val) fails.push(`${REQ_NAME[v.req] || v.req} 포함 조건 미달`);
      else fails.push(`${label} 미달(최선 ${combo}${v.kind === '합' ? ' = ' + (+best.score.toFixed(1)) : ''})`);
    }
    return { pass: !fails.length, text: fails.length ? fails.join(', ') : `${label} 충족(${combo})` };
  }

  function judgeRule(rule, grades) {
    const vs = variants(rule);
    // 입력하지 않은 등급은 1과 9를 모두 넣어 본다
    const missing = AREAS.filter(a => grades[a] == null);
    const gsets = missing.length ? [Object.assign({}, grades, ...missing.map(a => ({ [a]: 1 }))), Object.assign({}, grades, ...missing.map(a => ({ [a]: 9 })))] : [grades];
    const perV = vs.map(v => ({ v, out: gsets.map(g => evalRule(v, g)) }));
    const status = fold(perV.flatMap(x => x.out.map(r => r.pass)));
    let detail;
    if (status === CHECK) {
      const why = [];
      if (perV.some(x => new Set(x.out.map(r => r.pass)).size > 1)) why.push(`미입력 등급(${missing.map(a => NAME[a]).join('·')})에 따라 달라짐`);
      for (const i of gsets.keys()) {
        const p = perV.filter(x => x.out[i].pass), f = perV.filter(x => !x.out[i].pass);
        if (p.length && f.length) {
          why.push(`원문 해석에 따라 달라짐(충족: ${p[0].v.why || '문구대로'} / 미충족: ${f[0].v.why || '문구대로'} → ${f[0].out[i].text})`);
          break;
        }
      }
      detail = why.join('; ');
    } else {
      // 대표 설명: 가장 엄격한 해석 기준
      detail = perV[0].out[gsets.length - 1].text;
    }
    return { label: rule.label, status, detail };
  }

  function judgeMin(row, grades) {
    const rules = row.min_rules || [];
    if (!rules.length) return { status: OK, reasons: [], units: [], text: '수능최저 없음' };
    const units = rules.map(r => judgeRule(r, grades));
    const ok = units.filter(u => u.status === OK), chk = units.filter(u => u.status === CHECK), no = units.filter(u => u.status === NO);
    const fmt = u => (units.length > 1 && u.label !== '기본' ? `${u.label}: ` : '') + u.detail;
    let status, reasons = [], notes = [];
    if (ok.length) {
      status = OK;
      if (no.length || chk.length) notes.push('일부 모집단위만 충족: ' + no.concat(chk).map(u => `${u.label} ${u.status}`).join(', '));
    } else if (chk.length) {
      status = CHECK; reasons = chk.map(fmt);
    } else {
      status = NO; reasons = no.map(fmt);
    }
    // 원문 확인 필요로 표시된 전형인데 해석과 무관하게 확정된 경우에도 사유는 남겨 둔다
    if (row.min_status === '원문 확인 필요' && status !== CHECK) notes.push(`원문 검수 전(${row.min_reason}), 이 학생은 해석과 무관하게 결과 동일`);
    return { status, reasons, notes, units };
  }

  // ---------------------------------------------------------------- 지원 자격
  const REGION_ALIAS = { 충청: ['대전', '세종', '충남', '충북'], 호남: ['전북', '전남', '광주'], 부울경: ['부산', '울산', '경남'] };
  // reg 문구 → 허용 시·도 집합과 '시·도보다 좁은 지정 지역' 여부
  function regionSpec(reg) {
    // '○○ 중학교 + △△ 고교'면 고교 쪽 지역으로 거르고, 고교 쪽에 시·도가 없으면(진료권·광역권) 앞쪽 지역을 쓴다
    const pick = text => {
      const set = new Set();
      for (const [k, v] of Object.entries(REGION_ALIAS)) if (text.includes(k)) v.forEach(x => set.add(x));
      for (const x of REGIONS) if (text.includes(x)) set.add(x);
      if (!set.size && /전주권|군산권|익산권|정읍권|남원권/.test(text)) set.add('전북');
      return set;
    };
    const hs = reg.includes('+') ? pick(reg.split('+').pop()) : new Set();
    const set = hs.size ? hs : pick(reg);
    // 진료권·특정 시군만 허용(광역권 선택지가 함께 있으면 시·도 전체로 본다)
    const narrow = !/광역/.test(reg) && /진료권|전주권|군산권|익산권|정읍권|남원권|청주|충주|제천|의정부|서북|지정 지역/.test(reg);
    return { set, narrow, doctor: /^지역의사/.test(reg) };
  }
  // 졸업연도 문구 → 허용되는 졸업 연도 범위 [min, max]. 졸업은 매년 2월로 본다.
  function gradRange(text) {
    let min = -Infinity, max = Infinity, parsed = false;
    let m;
    if ((m = text.match(/(\d{4})년\s*(\d{1,2})월\s*이후\s*(?:국내고\s*)?입학/))) { min = Math.max(min, +m[1] + (+m[2] > 3 ? 4 : 3)); parsed = true; }
    else if ((m = text.match(/(\d{4})년\s*이후\s*(?:국내\s*)?(?:고교|고등학교)?\s*입학/))) { min = Math.max(min, +m[1] + 3); parsed = true; }
    if ((m = text.match(/(\d{4})·(\d{4})·(\d{4})년\s*졸업/))) { min = +m[1]; max = +m[3]; parsed = true; }
    const re = /(\d{4})(?:년|\.)\s*(?:(\d{1,2})월\s*)?(이후|이전)(\(2월 포함\))?\s*([^,;]*)/g;
    while ((m = re.exec(text))) {
      const y = +m[1], mo = m[2] ? +m[2] : null, dir = m[3], tail = m[5];
      if (/입학/.test(tail)) continue;
      if (dir === '이후') { min = Math.max(min, mo && mo > 2 ? y + 1 : y); parsed = true; }
      else if (/불가/.test(tail)) { min = Math.max(min, y + 1); parsed = true; }
      else if (/졸업/.test(tail)) { max = Math.min(max, mo && mo < 2 ? y - 1 : y); parsed = true; }
    }
    return parsed ? { min, max } : null;
  }

  function judgeElig(row, st) {
    const t = row.elig || {};
    const fails = [], checks = [], notes = [];
    const isGED = st.status === '검정고시' || st.schoolType === '검정고시';
    const enrolled = st.status === '재학';
    const school = isGED ? '검정고시' : st.schoolType;

    if (row.elig_status === '원문 확인 필요') checks.push(`지원자격 ${row.elig_reason}`);
    if (t['재학생 한정'] && !enrolled) fails.push('재학생(2028년 2월 졸업예정자)만 지원 가능');
    if (t['졸업생 전용'] && enrolled) fails.push('졸업생만 지원 가능');
    if (t['졸업연도 제한']) {
      const r = gradRange(row.elig_text);
      const gy = enrolled ? 2028 : st.gradYear;
      if (!r) checks.push(`졸업연도 제한 문구 확인(${t['졸업연도 제한']})`);
      else if (gy == null) checks.push('졸업 연도 미입력');
      else if (gy < r.min || gy > r.max) fails.push(`졸업연도 제한(${t['졸업연도 제한']})`);
      else if (isGED) checks.push('검정고시 합격 연도를 졸업 연도로 보는지 원문 확인');
    }
    if (t['검정고시 불가'] && isGED) fails.push('검정고시 출신 지원 불가');
    const rec = t['추천 필요'] || '';
    if (/^학교장추천/.test(rec)) {
      if (isGED) fails.push('학교장 추천 필요(검정고시 출신은 추천 불가)');
      else if (st.recommend === false) fails.push(`학교장 추천 필요(${rec.replace(/^학교장추천/, '').replace(/[()]/g, '') || '인원 미기재'})`);
      else if (st.recommend == null) checks.push('학교장 추천 가능 여부 미입력');
      else notes.push(`학교장 추천 ${rec.replace(/^학교장추천/, '')}`);
    } else if (/교육감추천/.test(rec)) checks.push(`${rec} 필요`);
    else if (/^기타 추천/.test(rec)) {
      if (/일부 모집단위/.test(rec)) notes.push(rec); else checks.push(`${rec} 필요`);
    }
    // 고교 유형
    const typ = t['고교 유형 제한'] || '';
    if (typ && school) {
      const keys = SCHOOL_KEYS[school] || [];
      const only = (typ.match(/^([^/]*?)만(?: \/|$)/) || [])[1];
      const banned = (typ.match(/불가: (.*)$/) || [])[1];
      if (/^정규고만/.test(typ)) {
        if (['방송통신고', '기타(각종학교·대안·학력인정 등)'].includes(school)) checks.push('정규 고교 여부 확인(각종학교 등 제외)');
      } else if (only) {
        const allowed = only.split('·').map(s => s.replace(/고$/, ''));
        if (!keys.some(k => allowed.some(a => k.replace(/고$/, '') === a || k.startsWith(a)))) fails.push(`고교 유형 제한(${only}만)`);
      }
      if (banned && keys.some(k => banned.split('·').some(b => b === k || b.startsWith(k) || k.startsWith(b)))) fails.push(`${school} 지원 불가`);
    }
    // 지역인재: 대시보드 reg 요약(예: '충청권(대전·세종·충남·충북) 고교 전 과정 이수', '지역의사: 호남권 중학교 + 전주권 고교 이수·거주')
    const reg = t['지역인재 요건'] || '';
    if (reg) {
      const r = regionSpec(reg);
      const label = reg.replace(/^지역의사:\s*/, '');
      if (!r.set.size) checks.push(`지역 요건 원문 확인(${label})`);
      else if (!st.region) checks.push('출신 고교 지역 미입력');
      else if (!r.set.has(st.region)) fails.push(`지역 요건(${[...r.set].join('·')} 고교 출신만)`);
      else if (r.narrow) checks.push(`지정 지역 고교인지 확인(${label})`);
      else notes.push(`지역 요건: ${label}`);
      if (/교육감 추천/.test(reg)) checks.push('교육감 추천 필요');
      if (r.doctor) notes.push('복무형 지역의사(의무 복무)');
    }
    // 기타
    const misc = t['기타 요건'] || '';
    // 성별은 입력받지 않을 수 있다(화면은 묻지 않음): 그때는 메모로만 남긴다
    if (/여학생만/.test(misc)) { if (st.gender === '남') fails.push('여학생만 지원 가능'); else if (st.gender !== '여') notes.push('여학생만 지원 가능'); }
    for (const k of ['학폭 기재 시 제한', '이수 학기 요건', '수능 응시 요건', '조기졸업 불가', '종교 요건(일부 모집단위)', '군 결격사유 없음'])
      if (misc.includes(k)) notes.push(k);
    const status = fails.length ? NO : checks.length ? CHECK : OK;
    return { status, reasons: fails.length ? fails : checks, notes };
  }

  // ---------------------------------------------------------------- 종합
  function judgeRow(row, st) {
    const grades = Object.assign({ 국: null, 수: null, 영: null, 통사: null, 통과: null, 한국사: null }, st.grades || {});
    const elig = judgeElig(row, st);
    const min = judgeMin(row, grades);
    const status = worst(elig.status, min.status);
    const reasons = [].concat(elig.status === OK ? [] : elig.reasons, min.status === OK ? [] : min.reasons);
    // 미충족이면 미충족 사유만 앞에 둔다
    const ordered = status === NO
      ? [].concat(elig.status === NO ? elig.reasons : [], min.status === NO ? min.reasons : [])
      : reasons;
    return { status, reasons: ordered, notes: [].concat(elig.notes, min.notes), elig, min };
  }

  function judgeAll(rows, st) {
    return rows.map(row => Object.assign({ row }, judgeRow(row, st)));
  }

  // 화면 필터(판정과 별개)
  function filterRows(rows, f) {
    f = f || {};
    return rows.filter(r =>
      (!f.tracks || !f.tracks.length || f.tracks.includes(r.track)) &&
      (!f.regions || !f.regions.length || f.regions.includes(r.rg)) &&
      (!f.groups || !f.groups.length || f.groups.includes(r.g)) &&
      (!f.noInterview || r.interview !== '있음') &&
      (f.maxInterviewRatio == null || r.interview !== '있음' || (parseInt(r.interview_ratio, 10) || 0) <= f.maxInterviewRatio) &&
      (!f.noMin || r.min_flag === '없음') &&
      (!f.guns || !f.guns.length || r.track !== '정시' || f.guns.some(x => (r.gun || '').includes(x))) &&
      (!f.changedOnly || !!r.change));
  }

  return { judgeRow, judgeAll, judgeMin, judgeElig, filterRows, gradRange, regionSpec, SCHOOL_TYPES, REGIONS, OK, NO, CHECK };
});
