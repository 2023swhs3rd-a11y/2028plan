// node tools/judge/test.cjs — 판정 로직(src/judge.js) 점검용 사례. data/universities + data/judge.json 을 화면과 같은 방식으로 합쳐 쓴다
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
// src/judge.js 는 화면에 그대로 넣는 스크립트라(저장소가 ESM) module 객체를 넘겨 읽는다
const J = (() => { const m = { exports: {} }; new Function('module', fs.readFileSync(path.join(ROOT, 'src/judge.js'), 'utf8'))(m); return m.exports; })();
const JD = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/judge.json'), 'utf8'));
const fill = x => Object.assign({ areas: [], tam: '', req: '', hist: '', eng: '', etc: '' }, x);
const rows = [];
for (const f of fs.readdirSync(path.join(ROOT, 'data/universities')).filter(f => f.endsWith('.json')).sort()) {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/universities', f), 'utf8'));
  for (const r of d.rows) {
    const j = JD.rows[`${d.u}|${r.track}|${r.name}`] || {};
    rows.push(Object.assign({}, r, { u: d.u, g: d.g, rg: d.rg, min_rules: (j.m || []).map(fill), min_status: j.ms || '', min_reason: j.mr || '',
      elig: j.e || {}, elig_status: j.es || '', elig_reason: j.er || '' }));
  }
}
const meta = { count: rows.length };
// 같은 대학에 이름이 같은 전형이 둘 이상이면 name을 '전형구분:전형명'으로 적는다(예: '종합:지역인재전형')
const find = (u, name) => { const [tk, nm] = name.includes(':') ? name.split(':') : [null, name]; const r = rows.find(x => x.u === u && x.name === nm && (!tk || x.track === tk)); if (!r) throw new Error('없음: ' + u + ' ' + name); return r; };
let pass = 0, fail = 0;
function expect(desc, st, u, name, want, unit) {
  const res = J.judgeRow(find(u, name), st);
  const got = unit ? (res.min.units.find(x => x.label === unit) || {}).status : res.status;
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${desc}: ${u} ${name}${unit ? ' [' + unit + ']' : ''} → ${got}${ok ? '' : ' (기대 ' + want + ')'}`);
  if (!ok || process.argv.includes('-v')) console.log('      ', JSON.stringify({ reasons: res.reasons, notes: res.notes, units: res.min.units }));
}
const base = { status: '재학', gradYear: 2028, schoolType: '일반고', region: '서울', recommend: true, gender: null,
  grades: { 국: 2, 수: 3, 영: 2, 통사: 3, 통과: 2, 한국사: 3 } };
const S = o => Object.assign({}, base, o, { grades: Object.assign({}, base.grades, (o || {}).grades) });

expect('3개 각 3 충족', S(), '서강대', '학생부교과(지역균형)', '충족');
expect('4개 합 9 충족', S(), '고려대', '학업우수전형', '충족');
expect('의학과 4합5는 미충족', S(), '고려대', '학업우수전형', '미충족', '의학과');
expect('연세 인문 2합4·영3·한4', S(), '연세대', '학생부교과전형[추천형]', '충족');
expect('한양 자연 수학 포함 각 3', S(), '한양대', '학생부교과(추천형)', '충족');
expect('졸업생은 재학생 한정 불가', S({ status: '졸업', gradYear: 2026 }), '서강대', '학생부교과(지역균형)', '미충족');
expect('추천 불가', S({ recommend: false }), '서강대', '학생부교과(지역균형)', '미충족');
expect('추천 미입력', S({ recommend: null }), '서강대', '학생부교과(지역균형)', '확인 필요');
const math5 = { grades: { 국: 1, 수: 5, 영: 1, 통사: 1, 통과: 1, 한국사: 1 } };
expect('수학 포함 조건 미달', S(Object.assign({ region: '충남' }, math5)), '단국대(천안)', '지역의료인재(진료권)(천안)', '미충족');
expect('지역인재 지역 밖', S(), '단국대(천안)', '지역의료인재(광역권)(천안)', '미충족');
const amb = { grades: { 국: 1, 수: 4, 영: 1, 통사: 3, 통과: 2, 한국사: 1 } };
expect('약학 수학 포함 여부가 갈림', S(Object.assign({ region: '충남' }, amb)), '단국대(천안)', '지역메디바이오인재(천안)', '확인 필요');
expect('미입력 등급이 있어도 확정', S({ grades: { 국: 1, 수: 2, 영: 2, 통사: null, 통과: null } }), '서강대', '학생부종합(일반Ⅱ)', '충족');
expect('미입력 등급이 결과를 가름', S({ grades: { 국: 3, 수: 3, 영: null, 통사: null, 통과: null } }), '서강대', '학생부종합(일반Ⅱ)', '확인 필요');
const trunc = { grades: { 국: 1, 수: 2, 영: 3, 통사: 2, 통과: 1, 한국사: 1 } };
expect('탐구 평균 절사 여부가 갈림', S(trunc), '한양대', '논술', '확인 필요', '의예');
expect('기본 기준 충족이면 전형은 충족', S(trunc), '한양대', '논술', '충족');
expect('영어 2등급을 1등급으로 보정해 2합7 충족', S({ grades: { 국: 6, 수: 6, 영: 2, 통사: 6, 통과: 6, 한국사: 5 } }), '경기대', '교과성적우수자전형', '충족');
expect('영어 3등급은 보정 없음', S({ grades: { 국: 6, 수: 6, 영: 3, 통사: 6, 통과: 6, 한국사: 5 } }), '경기대', '교과성적우수자전형', '미충족');
expect('여대 남학생', S({ gender: '남' }), '덕성여대', '논술전형', '미충족');
expect('성별 미입력이면 여대도 판정은 그대로(메모만)', S(), '덕성여대', '논술전형', '충족');
expect('검정고시 불가', S({ status: '검정고시', schoolType: '검정고시', gradYear: 2027 }), '수원대', '교과우수전형', '미충족');
expect('특성화고 불가', S({ schoolType: '특성화고' }), '서강대', '학생부교과(지역균형)', '미충족');
expect('과학고 불가', S({ schoolType: '과학고' }), '서울대', '지역균형전형', '미충족');
expect('과학고 허용 목록', S({ schoolType: '과학고' }), '한경국립대', '학생부교과(지역균형선발)', '충족');
expect('특성화고는 허용 목록 밖', S({ schoolType: '특성화고' }), '한경국립대', '학생부교과(지역균형선발)', '미충족');
expect('졸업연도 2026 이후', S({ status: '졸업', gradYear: 2020 }), '인천대', '학생부교과(교과성적우수자전형)', '미충족');
expect('졸업생 전용 2027 이전', S({ status: '졸업', gradYear: 2027 }), '국민대', '교과우수자Ⅱ(학교장추천)', '충족');
expect('졸업생 전용 2028 재학생', S(), '국민대', '교과우수자Ⅱ(학교장추천)', '미충족');
expect('지역의사 지정 진료권', S({ region: '경기', grades: { 국: 1, 수: 1, 영: 2, 통사: 1, 통과: 1, 한국사: 1 } }), '아주대', '학생부종합(지역의사선발전형)', '확인 필요');
expect('최저 없음 전형', S({ grades: { 국: 9, 수: 9, 영: 9, 통사: 9, 통과: 9, 한국사: 9 } }), '서울대', '일반전형', '충족');
expect('원문 미기재 자격', S(), '을지대(대전)', '지역의료인재(특별형)(대전)', '확인 필요');
expect('한국사만', S({ grades: { 한국사: 5 } }), '경인교대', '수능(일반학생전형)', '미충족');

// ---- v0.10.16 데이터(95개 대학)에서 더한 사례 ----
const G = (국, 수, 영, 통사, 통과, 한국사) => ({ grades: { 국, 수, 영, 통사, 통과, 한국사 } });
expect('수학 1등급 상향으로 2합9 충족', S(Object.assign({ region: '경북' }, G(6, 5, 5, 6, 6, 4))), '국립금오공대', '학생부교과전형', '충족', '공학·자율전공학부');
expect('상향 없는 인문사회는 미충족', S(Object.assign({ region: '경북' }, G(6, 5, 5, 6, 6, 4))), '국립금오공대', '학생부교과전형', '미충족', '인문사회');
expect('중앙대 영어 2 조건부 통합이 결과를 가름', S(G(2, 4, 2, 6, 6, 3)), '중앙대', '지역균형', '확인 필요', '서울');
expect('수학·탐구 모두 포함 3합5', S(Object.assign({ region: '광주' }, G(1, 2, 1, 3, 4, 2))), '전남대', '학생부교과(지역인재)', '미충족', '의과대학');
expect('수학·탐구 모두 포함 3합5 충족', S(Object.assign({ region: '광주' }, G(5, 2, 1, 2, 2, 2))), '전남대', '학생부교과(지역인재)', '충족', '의과대학');
expect('해사대학은 국어 미반영', S(Object.assign({ region: '부산' }, G(1, 5, 5, 5, 5, 3))), '국립한국해양대', '교과성적우수자전형', '미충족', '해사대학');
expect('해사대학 탐구 평균 절사 확정', S(Object.assign({ region: '부산' }, G(9, 4, 4, 5, 6, 3))), '국립한국해양대', '교과성적우수자전형', '충족', '해사대학');
expect('동국대(WISE) 절사로 간호 2합7 충족', S(Object.assign({ region: '경북' }, G(9, 3, 9, 4, 5, 3))), '동국대(WISE)', '학교생활우수자', '충족', '간호');
expect('경북대 지역의사 반올림 4.5→5', S(Object.assign({ region: '대구' }, G(1, 1, 9, 4, 5, 3))), '경북대', '지역의사선발전형', '미충족');
expect('이름 같은 전형 구분(종합 지역인재)', S(Object.assign({ region: '대구' }, G(9, 9, 9, 9, 9, 3))), '경북대', '종합:지역인재전형', '충족');
expect('이름 같은 전형 구분(교과 지역인재)', S(Object.assign({ region: '대구' }, G(9, 9, 9, 9, 9, 3))), '경북대', '교과:지역인재전형', '충족');
expect('충청권 지역인재에 서울 학생', S(), '충북대', '학생부교과(지역인재전형)', '미충족');
expect('충청권 지역인재에 세종 학생', S({ region: '세종' }), '충북대', '학생부교과(지역인재전형)', '충족');
expect('지역의사 전주권: 전북이면 지정 지역 확인', S(Object.assign({ region: '전북' }, G(1, 1, 1, 1, 1, 1))), '전북대', '지역의사선발전형-전주권(전주)', '확인 필요');
expect('지역의사 전주권: 전남이면 미충족', S(Object.assign({ region: '전남' }, G(1, 1, 1, 1, 1, 1))), '전북대', '지역의사선발전형-전주권(전주)', '미충족');
expect('지역의사 광역권은 시·도로 판정', S(Object.assign({ region: '전남' }, G(1, 1, 1, 1, 1, 1))), '전북대', '지역의사선발전형-광역권(전주)', '충족');
expect('연세대(미래) 의예 2개 1등급 + 영2·한4', S(Object.assign({ region: '강원' }, G(1, 1, 3, 1, 1, 1))), '연세대(미래)', '교과우수자(일반형)전형', '미충족', '의예');
expect('부산대 의예 탐구 평균', S(Object.assign({ region: '부산' }, G(1, 1, 3, 3, 3, 2))), '부산대', '학생부교과(교과지역전형)', '미충족', '의예');

expect('2025년 이후 고교 입학자: 2028 졸업 가능', S({ region: '충남', grades: { 국: 3, 수: 3, 영: 3, 통사: 3, 통과: 3, 한국사: 3 } }), '국립공주대', '학생부교과(자율전공전형)', '충족');
expect('2025년 이후 고교 입학자: 2027 졸업생 불가', S({ status: '졸업', gradYear: 2027, region: '충남' }), '국립공주대', '학생부교과(자율전공전형)', '미충족');
console.log(`\n${pass} ok, ${fail} fail`);
console.log('\n졸업연도 범위 해석:');
for (const r of rows.filter(r => r.elig['졸업연도 제한'] || r.elig['졸업생 전용']))
  console.log(' ', r.u, r.name, JSON.stringify(J.gradRange(r.elig_text)), '|', r.elig['졸업연도 제한'] || '졸업생 전용');
const tally = {};
for (const x of J.judgeAll(rows, base)) tally[x.status] = (tally[x.status] || 0) + 1;
console.log('\n예시 학생(재학·일반고·서울·추천 가능·국2 수3 영2 통사3 통과2 한3) 전체', meta.count, '개 전형:', tally);
process.exitCode = fail ? 1 : 0;
