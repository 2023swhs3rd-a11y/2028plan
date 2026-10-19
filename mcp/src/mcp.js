// 2028 대입전형 시행계획 MCP 서버의 본체: JSON-RPC 처리와 도구·프롬프트.
// 런타임 의존성 없음. Cloudflare Workers(src/worker.js)와 Node 시험(test.mjs)이 함께 쓴다.
// 규격: Model Context Protocol, Streamable HTTP 전송의 상태 없는(stateless) JSON 응답 방식.

export const SERVER = { name: '2028-admissions', title: '2028 대입전형 시행계획 요약', version: '1.1.0' };
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];

const INSTRUCTIONS = `2028학년도 대입전형 시행계획 요약 데이터(대학 약 95곳, 정원 내 학생부교과·학생부종합·논술·정시 수능위주 전형과 농어촌 전형)를 검색하는 서버입니다.
- 출처는 각 대학이 공개한 2028학년도 대입전형 시행계획 PDF뿐입니다. 답할 때 도구 결과의 '원문'(PDF 링크와 쪽수)을 함께 제시하세요.
- 시행계획은 모집요강이 아닙니다. 최종 확인은 대학 모집요강으로 하라고 안내하세요.
- 입시 결과(합격선·경쟁률)는 없습니다. 합격 가능성을 추측하지 마세요.
- 값이 '미기재'이면 원문에 없거나 판독할 수 없는 것입니다. 추측으로 채우지 마세요.
- 고른기회·특기자·재외국민·정원 외 전형은 대학 상세의 비고(notes)에만 있습니다.
- 라이선스: CC BY-NC 4.0 (봉일천고등학교 진로진학부). 대시보드: https://2023swhs3rd-a11y.github.io/2028plan/`;

const TRACKS = ['교과', '종합', '논술', '정시'];
const GROUPS = ['일반', '지방국립', '교대', '과기원'];
const REGIONS = ['서울', '경기', '인천', '강원', '대전', '세종', '충북', '충남', '대구', '경북', '부산', '울산', '경남', '광주', '전북', '전남', '제주'];
const CATS = ['수능최저', '반영비율·방법', '전형 신설·개편', '모집인원', '지원자격', '면접', '수능 반영', '논술 출제', '학폭 반영', '실기', '기타'];
const GNAME = { 일반: '일반대학', 지방국립: '지방국립대학', 교대: '교육대학', 과기원: '과학기술원' };

// 대시보드의 '제외' 필터와 같은 규칙
const MED = /^(의예|의학|치의예|치의학|한의예|한의학|약학|제약학|수의예|수의학|간호학?)(과|부)?$/;
const isMed = r => !!r.dept && r.dept.split('·').every(d => MED.test(d.trim()));
const isReg = r => !!r.reg;
// elig 는 졸업 연도 기준 구분이다(지역 요건은 reg)
const GRAD = { '제한 없음': '가능', 재학생: '불가(재학생만)', '졸업연도 제한': '일부(졸업연도 제한)', '졸업생 전용': '졸업생만', '확인 불가': '확인 불가' };

const norm = s => String(s ?? '').replace(/\s+/g, '').toLowerCase();
const has = (hay, needle) => norm(hay).includes(norm(needle));
const pdf = (u, r) => `https://drive.google.com/file/d/${(r && r.fid) || u.fid}/view`;
const src = (u, r) => ({ 'PDF': pdf(u, r), '파일': (r && r.ft) || u.ft, '쪽': r ? r.pg ?? null : null });
const minOf = r => r.min_flag === '없음' ? '없음' : r.min_s || r.min_text || r.min_flag || '미기재';
const clean = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));

function findUniv(data, name) {
  const n = norm(name);
  const U = data.universities;
  return U.find(u => norm(u.u) === n) || U.find(u => norm(u.u).includes(n) || n.includes(norm(u.u)));
}

// 전형 행 요약(목록용)
function brief(u, r) {
  return clean({
    대학: u.u, 지역: u.rg, 구분: GNAME[u.g] || u.g, 캠퍼스: r.campus,
    전형: r.track, 전형명: r.name, 모집단위: r.dept, 모집인원: r.quota ?? '미기재',
    전형방법: r.method, 선발구조: r.structure, '1단계': r.stage1,
    수능최저: minOf(r), 면접: r.interview === '있음' ? `있음${r.interview_ratio ? ` ${r.interview_ratio}` : ''}` : r.interview,
    추천: r.recommend, 졸업생지원: GRAD[r.elig] || r.elig, 지역요건: r.reg, 군: r.gun, 원문: src(u, r),
  });
}

// 전형 행 상세(대학 상세용): 전형 종류별 핵심 필드
function detail(u, r) {
  const extra = {
    교과: { 평가방식: r.stage_desc, 반영과목: r.subjects, 반영과목요약: r.sb && r.sb.d, 등급환산: r.grade_scale, 출결: r.attendance, 서류: r.doc_ratio },
    종합: { 유형: r.type, 면접유형: r.interview_type },
    논술: { 논술비율: r.essay_ratio, 논술외: r.other, 출제형태: r.essay_type },
    정시: { 군: r.gun, 반영영역: r.areas, 활용지표: r.index, 반영영역수: r.n_areas, 학생부: r.gyogwa === '미반영' ? '미반영' : [r.gyogwa, r.gyogwa_ratio].filter(Boolean).join(' '), 출결: r.attendance },
  }[r.track] || {};
  return clean({ ...brief(u, r), 수능최저원문: r.min_text, 지원자격상세: r.elig_text, ...extra, '2028변경': r.change, 비고: r.note });
}

function rurRow(u, r) {
  return clean({
    대학: u.u, 지역: u.rg, 캠퍼스: r.campus, 전형: r.track, 전형명: r.name, 대상: r.aud === '포함' ? `포함(${r.aud_with || '여러 대상'})` : r.aud,
    정원: r.cap === '외' ? '정원 외' : r.cap === '내' ? '정원 내' : r.cap, 자격: r.rq, 자격상세: r.rq_text, 모집인원: r.quota ?? (r.track === '정시' ? '수시 이월분' : '미기재'),
    전형방법: r.method, 수능최저: minOf(r), 이월: r.carry, 군: r.gun, 원문: src(u, r),
  });
}

const page = (list, limit) => {
  const n = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);
  return { 결과수: list.length, ...(list.length > n ? { 안내: `앞의 ${n}개만 보냅니다. 조건을 좁히거나 limit을 늘리세요(최대 100).` } : {}), 목록: list.slice(0, n) };
};
const arr = v => (v == null ? [] : Array.isArray(v) ? v : [v]).filter(x => x !== '' && x != null);
const r1 = x => Math.round(x * 10) / 10;
// 5등급제 평균 등급을 환산표(gv.grade: 1~5등급 점수)에 그대로 대입: 정수 등급 사이는 선형 보간
const gradeScore = (g, x) => { const i = Math.min(Math.floor(x) - 1, 3), t = x - 1 - i; return g[i] + (g[i + 1] - g[i]) * t };
// 정시 반영 비율(wt) 한 계열을 %로: 고정 비율(국·수·영·사·과·탐)과 우수순 택일(rk)을 모두 더한 값이 100
const WK = { k: '국어', m: '수학', e: '영어', s: '사탐', c: '과탐', t: '탐구' };
function wtShare(w) {
  const total = Object.keys(WK).reduce((n, k) => n + (w[k] || 0), 0) + (w.rk || []).reduce((n, g) => n + g.v.reduce((a, b) => a + b, 0), 0);
  const pct = Object.fromEntries(Object.entries(WK).filter(([k]) => w[k]).map(([k, n]) => [n, r1(w[k] / total * 100)]));
  const inq = r1(((w.s || 0) + (w.c || 0) + (w.t || 0)) / total * 100);
  return { pct, inq, rk: (w.rk || []).map(g => `${g.p} ${g.v.map(v => r1(v / total * 100)).join('·')}%`) };
}

// ── 도구 ──
export const TOOLS = [
  {
    name: 'search_admissions',
    title: '전형 검색',
    description: '조건에 맞는 2028 정원 내 전형(교과·종합·논술·정시)을 찾습니다. 지역·대학 구분·전형 종류·수능최저·면접·학교장추천·졸업생 지원 가능·정시 군·키워드로 거를 수 있고, 여러 대학을 지정하면 비교표로 쓸 수 있습니다. 결과마다 원문 PDF 링크와 쪽수가 붙습니다.',
    inputSchema: {
      type: 'object',
      properties: {
        universities: { type: 'array', items: { type: 'string' }, description: '대학명(일부만 써도 됨). 여러 개면 그 대학들만' },
        region: { type: 'array', items: { type: 'string', enum: REGIONS }, description: '대학 소재 지역' },
        group: { type: 'array', items: { type: 'string', enum: GROUPS }, description: '대학 구분' },
        track: { type: 'array', items: { type: 'string', enum: TRACKS }, description: '전형 종류(정시 = 정시 수능위주)' },
        csat_min: { type: 'string', enum: ['있음', '없음'], description: "수능최저: '있음'은 일부 모집단위 적용 포함" },
        interview: { type: 'string', enum: ['있음', '없음'] },
        school_recommendation: { type: 'boolean', description: 'true: 학교장추천 필요 전형만, false: 추천 없는 전형만' },
        graduates_allowed: { type: 'boolean', description: 'true: 졸업생도 지원 가능한 전형만(재학생 전용 제외)' },
        gun: { type: 'array', items: { type: 'string', enum: ['가', '나', '다'] }, description: '정시 군' },
        keyword: { type: 'string', description: '전형명·모집단위·전형방법·지원자격·지역 요건·비고에서 찾을 말(예: 면접, 교과우수, 지역균형, 충청권)' },
        exclude_medical_only: { type: 'boolean', description: '의·치·한·약·수의·간호 학과만 모집하는 전형 제외' },
        exclude_regional_talent: { type: 'boolean', description: '지역 고교 이수 요건이 있는 지역인재·지역의사 전형 제외(지역균형은 남김)' },
        limit: { type: 'integer', minimum: 1, maximum: 100, description: '최대 결과 수(기본 30)' },
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run(data, a) {
      const us = arr(a.universities).map(n => findUniv(data, n)).filter(Boolean);
      const out = [];
      for (const u of us.length ? us : data.universities) {
        if (arr(a.region).length && !arr(a.region).includes(u.rg)) continue;
        if (arr(a.group).length && !arr(a.group).includes(u.g)) continue;
        for (const r of u.rows) {
          if (arr(a.track).length && !arr(a.track).includes(r.track)) continue;
          if (a.csat_min === '있음' && r.min_flag === '없음') continue;
          if (a.csat_min === '없음' && r.min_flag !== '없음') continue;
          if (a.interview && r.interview !== a.interview) continue;
          if (a.school_recommendation === true && !/추천/.test(r.recommend || '')) continue;
          if (a.school_recommendation === false && /추천/.test(r.recommend || '')) continue;
          if (a.graduates_allowed === true && r.elig === '재학생') continue;
          if (arr(a.gun).length && !arr(a.gun).includes(r.gun)) continue;
          if (a.exclude_medical_only && isMed(r)) continue;
          if (a.exclude_regional_talent && isReg(r)) continue;
          if (a.keyword && ![r.name, r.dept, r.method, r.elig_text, r.reg, r.note, r.min_text].some(x => has(x, a.keyword))) continue;
          out.push(brief(u, r));
        }
      }
      const missing = arr(a.universities).filter(n => !findUniv(data, n));
      return { ...(missing.length ? { 찾지못한대학: missing } : {}), ...page(out, a.limit) };
    },
  },
  {
    name: 'get_university',
    title: '대학 상세',
    description: '한 대학의 2028 정원 내 전형 전체(전형방법·수능최저·지원자격·반영 과목·정시 반영 영역 등), 모집인원 합계, 2028 주요 변경, 비고(제외 전형·정원 외), 원문 PDF를 돌려줍니다.',
    inputSchema: { type: 'object', properties: { name: { type: 'string', description: '대학명(예: 아주대, 한양대ERICA)' } }, required: ['name'] },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run(data, a) {
      const u = findUniv(data, a.name);
      if (!u) return { 오류: `'${a.name}' 대학을 찾지 못했습니다.`, 수록대학: data.universities.map(x => x.u) };
      return clean({
        대학: u.u, 지역: u.rg, 구분: GNAME[u.g] || u.g,
        모집인원: u.tot && { 수시정원내: u.tot.susi_in, 정시정원내: u.tot.jeongsi_in, 합계: u.tot.total_in },
        원문: u.ft, 원문PDF: pdf(u),
        '2028주요변경': (u.ch || []).map(c => `${c.t} [${(c.c || []).join(', ')}]`),
        전형: u.rows.map(r => detail(u, r)),
        농어촌: u.rur ? `${u.rur.length}개 전형(find_rural 도구로 조회)${u.rur_note ? ' · ' + u.rur_note : ''}` : '수집 전',
        비고: u.notes,
      });
    },
  },
  {
    name: 'list_changes',
    title: '2028 변경사항',
    description: '대학별 2028학년도 주요 변경(전년 대비)을 분류별로 찾습니다. 분류: ' + CATS.join(', '),
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'array', items: { type: 'string', enum: CATS }, description: '변경 분류' },
        universities: { type: 'array', items: { type: 'string' } },
        region: { type: 'array', items: { type: 'string', enum: REGIONS } },
        keyword: { type: 'string', description: '변경 내용에서 찾을 말(예: 폐지, 신설, 완화)' },
        limit: { type: 'integer', minimum: 1, maximum: 100 },
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run(data, a) {
      const us = arr(a.universities).map(n => findUniv(data, n)).filter(Boolean);
      const out = [];
      for (const u of us.length ? us : data.universities) {
        if (arr(a.region).length && !arr(a.region).includes(u.rg)) continue;
        for (const c of u.ch || []) {
          if (arr(a.category).length && !(c.c || []).some(x => arr(a.category).includes(x))) continue;
          if (a.keyword && !has(c.t, a.keyword)) continue;
          out.push({ 대학: u.u, 지역: u.rg, 변경: c.t, 분류: c.c, 원문PDF: pdf(u) });
        }
      }
      return page(out, a.limit || 50);
    },
  },
  {
    name: 'find_rural',
    title: '농어촌 전형',
    description: '농어촌 자격이 지원자격에 명시된 전형(전용, 또는 기회균형·고른기회처럼 여러 대상 중 하나로 포함)을 찾습니다. 정원 내·외, 6년/12년 자격, 수시 미충원 이월 여부가 함께 나옵니다.',
    inputSchema: {
      type: 'object',
      properties: {
        universities: { type: 'array', items: { type: 'string' } },
        region: { type: 'array', items: { type: 'string', enum: REGIONS } },
        track: { type: 'array', items: { type: 'string', enum: TRACKS } },
        audience: { type: 'string', enum: ['전용', '포함'], description: '전용: 농어촌만 대상, 포함: 여러 대상 중 하나' },
        quota_type: { type: 'string', enum: ['외', '내'], description: '정원 외/내' },
        qualification: { type: 'string', enum: ['6년', '12년'], description: '이 자격으로 지원 가능한 전형만' },
        limit: { type: 'integer', minimum: 1, maximum: 100 },
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run(data, a) {
      const us = arr(a.universities).map(n => findUniv(data, n)).filter(Boolean);
      const out = [], none = [];
      for (const u of us.length ? us : data.universities) {
        if (arr(a.region).length && !arr(a.region).includes(u.rg)) continue;
        if (!u.rur) { none.push(u.u); continue }
        for (const r of u.rur) {
          if (arr(a.track).length && !arr(a.track).includes(r.track)) continue;
          if (a.audience && r.aud !== a.audience) continue;
          if (a.quota_type && r.cap !== a.quota_type) continue;
          if (a.qualification && !(r.rq || '').includes(a.qualification)) continue;
          out.push(rurRow(u, r));
        }
      }
      return { ...(none.length ? { 농어촌수집전: none } : {}), ...page(out, a.limit) };
    },
  },
  {
    name: 'convert_grade',
    title: '내 등급 환산',
    description: '5등급제 교과 평균 등급(예: 2.3)을 대학별 학생부교과 전형의 석차등급 환산표에 넣어 등급점수, 1등급 대비 비율·감점을 비교합니다. 성취도(A~E) 점수를 따로 더하는 대학은 그 사실만 표시합니다. 환산표가 공개된 전형만 나오며, 과목별 단위수·학년 가중치·반영 과목 선택은 반영하지 않은 단순 계산입니다. 합격 가능성 판단에 쓰지 마세요.',
    inputSchema: {
      type: 'object',
      properties: {
        grade: { type: 'number', minimum: 1, maximum: 5, description: '5등급제 교과 평균 등급(1~5, 소수 가능)' },
        universities: { type: 'array', items: { type: 'string' } },
        region: { type: 'array', items: { type: 'string', enum: REGIONS } },
        group: { type: 'array', items: { type: 'string', enum: GROUPS } },
        exclude_regional_talent: { type: 'boolean', description: '지역인재·지역의사 전형 제외' },
        limit: { type: 'integer', minimum: 1, maximum: 100 },
      },
      required: ['grade'],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run(data, a) {
      const x = Number(a.grade);
      if (!(x >= 1 && x <= 5)) return { 오류: 'grade 는 1~5 사이 숫자여야 합니다(5등급제 평균 등급).' };
      const us = arr(a.universities).map(n => findUniv(data, n)).filter(Boolean);
      const out = [];
      for (const u of us.length ? us : data.universities) {
        if (arr(a.region).length && !arr(a.region).includes(u.rg)) continue;
        if (arr(a.group).length && !arr(a.group).includes(u.g)) continue;
        for (const r of u.rows) {
          const g = r.gv && r.gv.grade;
          if (r.track !== '교과' || !Array.isArray(g) || g.length !== 5) continue;
          if (a.exclude_regional_talent && isReg(r)) continue;
          const sc = gradeScore(g, x);
          out.push(clean({
            대학: u.u, 지역: u.rg, 캠퍼스: r.campus, 전형명: r.name, 모집단위: r.dept, 지역요건: r.reg,
            등급점수: r1(sc), '1등급점수': g[0], '1등급대비': `${r1(sc / g[0] * 100)}%`, '1등급대비감점': r1(g[0] - sc),
            '1→2등급차': r1(g[0] - g[1]), 환산표: g.join('/'), 성취도점수: r.gv.ach ? `별도 합산(A~E ${Object.values(r.gv.ach).join('/')})` : undefined,
            교과만점: r.gv.max, 환산표설명: r.gv.note, 반영과목: r.sb && r.sb.d, 수능최저: minOf(r), 원문: src(u, r), _p: sc / g[0],
          }));
        }
      }
      out.sort((p, q) => q._p - p._p);
      out.forEach(o => delete o._p);
      return { 입력등급: x, 계산: '평균 등급을 1~5등급 환산표에 선형 보간으로 대입한 석차등급 점수(성취도 점수·단위수·학년 가중치·과목 선택 미반영)', ...page(out, a.limit) };
    },
  },
  {
    name: 'search_csat_weights',
    title: '정시 반영 비율 검색',
    description: '정시 수능위주 전형을 영역별 반영 비율(%)로 찾습니다. 예: 수학 35% 이상, 탐구 25% 이상, 영어는 감점·가산 방식. 계열(인문·자연 등)이 나뉜 전형은 계열별로 나옵니다. 우수순 택일 비율은 따로 표시되고 최소 비율 조건에는 고정 비율만 씁니다.',
    inputSchema: {
      type: 'object',
      properties: {
        korean_min: { type: 'number', description: '국어 최소 %' },
        math_min: { type: 'number', description: '수학 최소 %' },
        inquiry_min: { type: 'number', description: '탐구(사·과 합) 최소 %' },
        english: { type: 'string', enum: ['비율 반영', '우수순 택일', '감점', '가산', '최저'], description: '영어 반영 방식' },
        track_group: { type: 'string', description: '계열 이름에 들어갈 말(예: 자연, 인문, 의예)' },
        universities: { type: 'array', items: { type: 'string' } },
        region: { type: 'array', items: { type: 'string', enum: REGIONS } },
        gun: { type: 'array', items: { type: 'string', enum: ['가', '나', '다'] } },
        limit: { type: 'integer', minimum: 1, maximum: 100 },
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run(data, a) {
      const us = arr(a.universities).map(n => findUniv(data, n)).filter(Boolean);
      const out = [], nowt = [];
      for (const u of us.length ? us : data.universities) {
        if (arr(a.region).length && !arr(a.region).includes(u.rg)) continue;
        for (const r of u.rows) {
          if (r.track !== '정시') continue;
          if (arr(a.gun).length && !arr(a.gun).some(x => (r.gun || '').includes(x))) continue;
          if (!r.wt) { nowt.push(`${u.u} ${r.name}`); continue }
          for (const w of r.wt) {
            if (a.track_group && !has(w.g, a.track_group)) continue;
            const { pct, inq, rk } = wtShare(w);
            if (a.korean_min && !((pct.국어 || 0) >= a.korean_min)) continue;
            if (a.math_min && !((pct.수학 || 0) >= a.math_min)) continue;
            if (a.inquiry_min && !(inq >= a.inquiry_min)) continue;
            const en = w.en || (w.e ? '비율 반영' : (w.rk || []).some(g => /영/.test(g.p)) ? '우수순 택일' : '미기재');
            if (a.english && en !== a.english) continue;
            out.push(clean({ 대학: u.u, 지역: u.rg, 캠퍼스: r.campus, 전형명: r.name, 군: r.gun, 계열: w.g, 모집인원: r.quota, 비율: pct, 탐구합: inq, 우수순택일: rk.length ? rk.join(', ') : undefined, 영어: en, 비고: w.n, 반영영역원문: r.areas, 원문: src(u, r) }));
          }
        }
      }
      return { ...page(out, a.limit), ...(nowt.length ? { 비율자료없음: `정시 ${nowt.length}개 전형은 반영 비율 자료가 없어 빠졌습니다(수능 미반영·표준점수 배율만 공개 등).` } : {}) };
    },
  },
  {
    name: 'get_source',
    title: '원문 찾기',
    description: '전형의 근거가 되는 원문 PDF 링크와 쪽수를 돌려줍니다. 쪽수는 PDF 뷰어의 쪽 번호 기준입니다(인쇄된 쪽 번호와 다를 수 있음).',
    inputSchema: {
      type: 'object',
      properties: { university: { type: 'string' }, admission: { type: 'string', description: '전형명 일부(비우면 대학의 원문 PDF 목록)' } },
      required: ['university'],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run(data, a) {
      const u = findUniv(data, a.university);
      if (!u) return { 오류: `'${a.university}' 대학을 찾지 못했습니다.` };
      const rows = [...u.rows, ...(u.rur || [])].filter(r => !a.admission || has(r.name, a.admission));
      const files = [[u.fid, u.ft], ...u.rows.filter(r => r.fid && r.fid !== u.fid).map(r => [r.fid, r.ft])]
        .filter((x, i, L) => L.findIndex(y => y[0] === x[0]) === i).map(([f, t]) => ({ 파일: t, PDF: `https://drive.google.com/file/d/${f}/view` }));
      return { 대학: u.u, 원문파일: files, 전형: rows.map(r => clean({ 전형명: r.name, 캠퍼스: r.campus, ...src(u, r) })) };
    },
  },
  {
    name: 'data_info',
    title: '데이터 안내',
    description: '데이터 버전·갱신 시각·출처·라이선스와 수록 대학 목록(지역·구분)을 돌려줍니다. 수록 범위를 묻거나 대학 이름을 확인할 때 씁니다.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run(data) {
      return { ...data.meta, 수록대학: data.universities.map(u => ({ 대학: u.u, 지역: u.rg, 구분: GNAME[u.g] || u.g })) };
    },
  },
];

// ── 프롬프트(메뉴에서 고르는 질문 서식) ──
export const PROMPTS = [
  {
    name: 'consult_prep',
    title: '상담 준비표',
    description: '학생 조건(익명)에 맞는 지원 가능 전형 후보표를 만듭니다.',
    arguments: [
      { name: 'condition', description: '학생 조건(예: 교과 위주, 수능 2개 합 7 가능, 수도권, 면접 부담)', required: true },
      { name: 'tracks', description: '볼 전형 종류(예: 교과, 종합)', required: false },
    ],
    text: a => `다음 조건의 학생을 위한 2028학년도 수시·정시 지원 후보표를 만들어 주세요. 학생 개인정보는 없습니다.
조건: ${a.condition}${a.tracks ? `\n볼 전형: ${a.tracks}` : ''}
search_admissions 도구로 조건에 맞는 전형을 찾고, 대학·전형명·모집인원·전형방법·수능최저·면접·원문 쪽을 표로 정리하세요. 수능최저 기준별로 묶고, 입시 결과는 없으니 합격 가능성은 판단하지 말고 확인할 점만 적어 주세요.`,
  },
  {
    name: 'change_notice',
    title: '2028 변경사항 안내문',
    description: '학부모·학생용 2028 대입 변경사항 안내문 초안을 만듭니다.',
    arguments: [
      { name: 'audience', description: '읽을 사람(예: 고1 학부모)', required: true },
      { name: 'focus', description: '다룰 범위(예: 경기 지역 대학, 수능최저, 서울 주요 대학)', required: false },
    ],
    text: a => `${a.audience}에게 보낼 2028학년도 대입전형 변경사항 안내문 초안을 써 주세요.${a.focus ? ` 범위: ${a.focus}.` : ''}
list_changes 도구로 변경사항을 찾아 분류(수능최저·모집인원·면접·반영비율 등)별로 쉬운 말로 정리하고, 대학별 예시를 2~3개씩 드세요. 끝에 '시행계획 기준이며 최종 내용은 각 대학 모집요강으로 확인' 문구를 넣으세요.`,
  },
];

// ── JSON-RPC ──
const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

export async function rpc(msg, getData) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return fail(msg && msg.id, -32600, 'Invalid Request');
  const { id, method, params = {} } = msg;
  if (id === undefined) return null; // 알림(notifications/*): 응답 없음
  switch (method) {
    case 'initialize': {
      const v = PROTOCOLS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOLS[0];
      return ok(id, { protocolVersion: v, capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } }, serverInfo: SERVER, instructions: INSTRUCTIONS });
    }
    case 'ping': return ok(id, {});
    case 'tools/list':
      return ok(id, { tools: TOOLS.map(({ run, ...t }) => t) });
    case 'tools/call': {
      const t = TOOLS.find(x => x.name === params.name);
      if (!t) return fail(id, -32602, `Unknown tool: ${params.name}`);
      try {
        const res = t.run(await getData(), params.arguments || {});
        return ok(id, { content: [{ type: 'text', text: JSON.stringify(res) }], isError: !!res.오류 });
      } catch (e) {
        return ok(id, { content: [{ type: 'text', text: `데이터를 불러오지 못했습니다: ${e.message}` }], isError: true });
      }
    }
    case 'prompts/list':
      return ok(id, { prompts: PROMPTS.map(({ text, ...p }) => p) });
    case 'prompts/get': {
      const p = PROMPTS.find(x => x.name === params.name);
      if (!p) return fail(id, -32602, `Unknown prompt: ${params.name}`);
      const a = params.arguments || {};
      const miss = p.arguments.filter(x => x.required && !a[x.name]).map(x => x.name);
      if (miss.length) return fail(id, -32602, `Missing arguments: ${miss.join(', ')}`);
      return ok(id, { description: p.description, messages: [{ role: 'user', content: { type: 'text', text: p.text(a) } }] });
    }
    default: return fail(id, -32601, `Method not found: ${method}`);
  }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Authorization',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS } });

const info = url => new Response(`${SERVER.title} MCP 서버 (v${SERVER.version})\n\n이 주소는 Claude 같은 AI 도구가 쓰는 주소라 브라우저에서는 이 안내만 보입니다.\nClaude 설정 › 커넥터 › 사용자 지정 커넥터 추가에 아래 주소를 넣으세요.\n${url.origin}/mcp\n\n대시보드: https://2023swhs3rd-a11y.github.io/2028plan/\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS } });

// HTTP 요청 처리: POST /mcp 가 MCP 엔드포인트. GET / 은 사람이 보는 안내.
export async function handle(request, getData) {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (url.pathname === '/' && request.method === 'GET') return info(url);
  if (url.pathname !== '/mcp') return new Response('Not Found', { status: 404, headers: CORS });
  // 상태 없는 서버라 서버→클라이언트 SSE 스트림과 세션 종료는 지원하지 않는다(규격상 405).
  // 브라우저로 주소를 연 사람에게는 오류 대신 안내를 보여 준다(MCP 클라이언트는 text/html 을 요청하지 않음).
  if (request.method === 'GET' && (request.headers.get('Accept') || '').includes('text/html')) return info(url);
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST', ...CORS } });
  let body;
  try { body = await request.json() } catch { return json(fail(null, -32700, 'Parse error'), 400) }
  if (Array.isArray(body)) {
    const res = (await Promise.all(body.map(m => rpc(m, getData)))).filter(Boolean);
    return res.length ? json(res) : new Response(null, { status: 202, headers: CORS });
  }
  const res = await rpc(body, getData);
  return res ? json(res) : new Response(null, { status: 202, headers: CORS });
}
