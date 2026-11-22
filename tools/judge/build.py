"""충족 판정용 데이터: 수능최저 문구 → 구조화 규칙, 지원자격 → 태그.

python3 tools/judge/build.py              → data/judge.json (화면의 '충족 판정'이 읽음)
python3 tools/judge/build.py --xlsx DIR   → 위와 함께 DIR 에 검수용 xlsx·csv (openpyxl 필요)

자동 분해(parse_min.py) + 수작업 보정(이 파일의 OV·ETC, ov_v010.py).
대학 파일의 min_text·elig_text·reg 등이 바뀌면 다시 돌린다(빌드가 src 해시로 확인).
"""
import csv, hashlib, json, os, re, sys
from collections import Counter
from parse_min import parse_text, TAM_SEP, TAM_TOP1, TAM_AVG, TAM_SCI
from ov_v010 import OV2, ETC2, CAU_NOTE

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[sys.argv.index('--xlsx') + 1] if '--xlsx' in sys.argv else None


def src_hash(r):
    """판정에 쓰는 원본 칸의 지문. scripts/build.mjs 의 judgeSrc 와 같아야 한다."""
    t = '\n'.join(str(r.get(k) or '') for k in ('min_flag', 'min_text', 'elig', 'elig_text', 'recommend', 'reg'))
    return hashlib.sha1(t.encode('utf-8')).hexdigest()[:10]


def compact(d):
    return {k: v for k, v in d.items() if v not in ('', None, [], {})}
CHECK, RECHECK, AUTO = '원문 확인 필요', '예외 확인 권장', '자동 분해'

def R(label, areas, tam, n, kind, val, req='', hist='', eng='', etc=''):
    return dict(label=label, areas=[a for a in areas.split(',') if a], tam=tam, n=n, kind=kind,
                val=val, req=req, hist=hist, eng=eng, etc=etc)

def NA(label):
    return R(label, '', '', None, '미적용', None)

KSU = '국,수,영,탐'
SEP5 = '국,수,영,통사,통과'
SCI4 = '국,수,영,통과'

# (대학, 전형명) → 수작업 보정. rules가 있으면 자동 분해를 대체한다.
OV = {
    ('차의과학대', '학생부교과(CHA학생부교과전형)'): dict(rules=[R('약학과', SCI4, TAM_SCI, 3, '합', 6, '수'), NA('미래융합')]),
    ('차의과학대', '학생부교과(지역균형선발전형)'): dict(rules=[R('약학과', SCI4, TAM_SCI, 3, '합', 6, '수'), NA('간호·미래융합')]),
    ('차의과학대', '학생부종합(CHA세대인재면접전형)'): dict(rules=[R('약학과', SCI4, TAM_SCI, 3, '합', 6, '수'), NA('간호·미래융합')]),
    ('을지대', '학교장추천'): dict(status=CHECK, reason='캠퍼스·학과별 기준이 6갈래로 나뉨', rules=[
        R('의정부 간호', KSU, TAM_TOP1, 2, '합', 8), R('의정부 임상병리', KSU, TAM_TOP1, 1, '각', 4), NA('의정부 자유전공'),
        R('성남 간호', KSU, TAM_TOP1, 2, '합', 8), R('성남 보건과학(안경광학·의료경영 제외)', KSU, TAM_TOP1, 1, '각', 4),
        NA('성남 첨단·자연·인문사회, 안경광학·의료경영')]),
    ('단국대', '지역메디바이오인재(천안)'): dict(status=CHECK, reason='약학에도 수학 포함 조건이 붙는지 문구상 불명확', rules=[
        R('의·치', SCI4, TAM_SCI, 3, '합', 4, '수'), R('약학', SCI4, TAM_SCI, 3, '합', 5, '수(확인 필요)')]),
    ('단국대', 'DKU인재(면접형)'): dict(status=CHECK, reason='약학에도 수학 포함 조건이 붙는지 문구상 불명확', rules=[
        NA('죽전'), R('천안 의·치', SCI4, TAM_SCI, 3, '합', 4, '수'), R('천안 약학', SCI4, TAM_SCI, 3, '합', 5, '수(확인 필요)'),
        NA('천안 그 외')]),
    ('중앙대', '모두의 논술'): dict(rules=[
        R('서울', SEP5, TAM_SEP, 3, '합', 6, hist='4'), R('서울 약학', SEP5, TAM_SEP, 4, '합', 5, hist='4'),
        R('서울 의학', KSU, TAM_AVG, 4, '합', 5, hist='4'), NA('다빈치')]),
    ('이화여대', '미래인재전형(서류형)'): dict(rules=[
        R('기본', KSU, TAM_TOP1, 3, '합', 7), R('의예', KSU, TAM_TOP1, 4, '합', 5), R('약학', KSU, TAM_TOP1, 4, '합', 6),
        R('스크랜튼', KSU, TAM_TOP1, 3, '합', 5), R('국제', KSU, TAM_TOP1, 3, '합', 7, '국', eng='2')]),
    ('가톨릭대', '학교장추천전형'): dict(status=CHECK, reason='한국사 4가 의예에만 붙는지 약학에도 붙는지 원문 확인', rules=[
        R('약학', SCI4, TAM_SCI, 3, '합', 5, hist='(확인 필요)'), R('의예', SCI4, TAM_SCI, 3, '합', 4, hist='4'), NA('그 외 모집단위')]),
    ('가톨릭대', '논술전형'): dict(status=CHECK, reason='한국사 4 적용 범위, 간호 탐구 방식(통사/통과 중 1 또는 각각) 원문 확인', rules=[
        R('약학', SCI4, TAM_SCI, 3, '합', 5, hist='(확인 필요)'), R('의예', SCI4, TAM_SCI, 3, '합', 4, hist='4'),
        R('간호', KSU, '통사/통과(방식 원문 확인)', 3, '합', 7), NA('그 외 모집단위')]),
    ('가천대', '학생부우수자'): dict(status=CHECK, reason='한의예·약학 대상 영역(사탐 포함 여부)이 문구에 없음', rules=[
        R('기본', SEP5, TAM_SEP, 2, '합', 6), R('바이오로직스', SEP5, TAM_SEP, 2, '합', 5),
        R('의예', SCI4, TAM_SCI, 3, '각', 1), R('한의예', SEP5, TAM_SEP, 2, '각', 1, etc='대상 영역 확인 필요'),
        R('약학', SEP5, TAM_SEP, 3, '합', 5, etc='대상 영역 확인 필요')]),
    ('가천대', '논술'): dict(status=CHECK, reason='"국 또는 수 반영 시 1등급 상향" 계산 방식, 의예·한의예·약학 대상 영역 원문 확인', rules=[
        R('기본', SEP5, TAM_SEP, 2, '합', 6, etc='국 또는 수 반영 시 1등급 상향'), R('바이오로직스', SEP5, TAM_SEP, 2, '합', 5),
        R('의예', SEP5, TAM_SEP, 3, '각', 1, etc='대상 영역 확인 필요'), R('한의예', SEP5, TAM_SEP, 2, '각', 1, etc='대상 영역 확인 필요'),
        R('약학', SEP5, TAM_SEP, 3, '합', 5, etc='대상 영역 확인 필요')]),
    ('가천대', '가천의약학'): dict(status=CHECK, reason='약학 대상 영역(과탐만인지) 문구상 불명확', rules=[
        R('의예', SCI4, TAM_SCI, 3, '각', 1), R('약학', SCI4, TAM_SCI, 3, '합', 5, etc='대상 영역 확인 필요')]),
    ('연세대', '학생부교과전형[추천형]'): dict(rules=[
        R('인문', '국,수,통사,통과', TAM_SEP, 2, '합', 4, '국·수 중 1개 이상', '4', '3', '통합계열은 인문·자연 중 하나 충족'),
        R('자연', '국,수,통사,통과', TAM_SEP, 2, '합', 5, '수', '4', '3', '통합계열은 인문·자연 중 하나 충족'),
        R('의·치·약', '국,수,통사,통과', TAM_SEP, 2, '각', 1, '수', '4', '3')]),
    ('연세대', '학생부종합전형[종합인재형]'): dict(status=CHECK, reason='국제계열 한국사 기준, 미적용 모집단위 범위 원문 확인', rules=[
        R('인문', '국,수,통사,통과', TAM_SEP, 2, '합', 4, '국·수 중 1개 이상', '4', '3', '통합계열은 인문·자연 중 하나 충족'),
        R('자연', '국,수,통사,통과', TAM_SEP, 2, '합', 5, '수', '4', '3', '통합계열은 인문·자연 중 하나 충족'),
        R('의·치·약', '국,수,통사,통과', TAM_SEP, 2, '각', 1, '수', '4', '3'),
        R('국제(아시아학·HASS·ISE)', '국,수,통사,통과', TAM_SEP, 2, '합', 5, '국·수 중 1개 이상', '(확인 필요)', '2'),
        NA('언더우드학부')]),
    ('연세대', '논술전형'): dict(status=CHECK, reason='약학에도 "국·수 모두 포함"이 붙는지 문구상 불명확', rules=[
        R('기본', '국,수,통사,통과', TAM_SEP, 3, '합', 6, '국·수 모두', '4', '3'),
        R('약학', '국,수,통사,통과', TAM_SEP, 3, '합', 5, '국·수 모두(확인 필요)', '4', '3')]),
    ('숙명여대', '논술우수자전형'): dict(rules=[R('기본', KSU, TAM_TOP1, 2, '합', 5), R('약학부', KSU, TAM_TOP1, 3, '합', 4, '수')]),
    ('숙명여대', '지역균형선발전형'): dict(rules=[R('약학부', KSU, TAM_TOP1, 3, '합', 5, '수'), NA('그 외 모집단위')]),
    ('경기대', '교과성적우수자전형'): dict(status=CHECK, reason='영어 등급 보정 규칙이 있음', rules=[
        R('기본', KSU, TAM_TOP1, 2, '합', 7, hist='6', etc='영어 1·2등급은 1등급으로 처리')]),
    ('건국대', 'KU지역균형'): dict(rules=[R('기본', '한국사,국,수,영,탐', TAM_TOP1, 3, '합', 8), R('수의예', '한국사,국,수,영,탐', TAM_AVG, 3, '합', 4)]),
    ('건국대', 'KU논술'): dict(rules=[R('기본', '한국사,국,수,영,탐', TAM_TOP1, 3, '합', 8), R('수의예', '한국사,국,수,영,탐', TAM_AVG, 3, '합', 4)]),
    ('인하대', '인하미래인재(면접형)'): dict(rules=[R('의예과', KSU, TAM_AVG, 3, '합', 4), NA('그 외 모집단위')]),
    ('인하대', '논술(논술우수자)'): dict(rules=[R('인문·자연', KSU, TAM_TOP1, 2, '합', 6), R('의예', KSU, TAM_AVG, 3, '합', 3)]),
    ('경인교대', '수능(일반학생전형)'): dict(rules=[R('기본', '', '', None, '한국사만', None, hist='4')]),
    ('서울교대', '일반전형'): dict(rules=[R('기본', '', '', None, '영어·한국사만', None, hist='4', eng='3')]),
    ('용인대', '교과성적우수자특별전형'): dict(rules=[R('기본', '국,수,영', '', 2, '합', 8), R('경찰행정학과', '국,수,영', '', 3, '합', 9)]),
    ('고려대', '학교추천전형'): dict(rules=[R('의학과', KSU, TAM_TOP1, 4, '합', 5, hist='4'), NA('그 외 모집단위')]),
    ('한양대ERICA', '학생부종합(서류형)'): dict(rules=[R('기본', KSU, TAM_TOP1, 2, '합', 7), R('약학', KSU, TAM_TOP1, 3, '합', 6), NA('디자인계열')]),
}
# v0.10.16: 단국대 천안 행은 '단국대(천안)'으로 옮겨 갔다(ov_v010.py). 죽전 DKU인재(면접형)는 최저 없음.
for _k in [('단국대', '지역메디바이오인재(천안)'), ('단국대', 'DKU인재(면접형)')]:
    OV.pop(_k, None)
# 중앙대 모두의 논술: 조건부 등급 통합 문구(PR #63)
for _x in OV[('중앙대', '모두의 논술')]['rules']:
    if _x['kind'] != '미적용':
        _x['etc'] = CAU_NOTE
OV.update(OV2)

# 규칙은 자동 분해를 쓰되 기타 조건·검수 상태만 덧붙이는 행
ETC = {
    ('아주대', '학생부교과(고교추천전형)'): '탐구 2과목만으로 충족 불가',
    ('아주대', '학생부종합(ACE전형 서류형)'): '탐구 2과목만으로 충족 불가',
    ('덕성여대', '고교추천전형'): '글로벌융합: 제2외국어/한문으로 영어 대체 가능',
    ('덕성여대', '논술전형'): '글로벌융합: 제2외국어/한문으로 영어 대체 가능',
    ('한성대', '교과우수'): '제2외국어/한문으로 탐구 대체 가능',
}
ETC.update(ETC2)
ETC_CHECK = {  # 기타 조건이 판정에 영향을 주는 행
    ('덕성여대', '고교추천전형'), ('덕성여대', '논술전형'), ('한성대', '교과우수'),
}
VOC_TAM = '탐구에 직업탐구 포함 표기(2028 수능 과목 체계와 원문 대조)'


def rules_for(u, r):
    key = (u, r['name'])
    ov = OV.get((u, r['track'], r['name'])) or OV.get(key, {})
    if 'rules' in ov:
        rules = [dict(x, raw='(수작업 보정)') for x in ov['rules']]
    else:
        rules = parse_text(r.get('min_text', ''))
        for x in rules:
            x.setdefault('etc', '')
            if x['kind'] == '미적용':
                x['hist'] = x['eng'] = ''
            x['label'] = re.sub(r'(과|부)?만$', lambda m: m.group(1) or '', x['label']).strip() or '기본'
    if key in ETC:
        for x in rules:
            if x['kind'] != '미적용':
                x['etc'] = '; '.join(filter(None, [x['etc'], ETC[key]]))
    if '/직' in (r.get('min_text') or '') or '직업 상위' in (r.get('min_text') or ''):
        for x in rules:
            x['etc'] = '; '.join(filter(None, [x['etc'], VOC_TAM]))
    if r['min_flag'] == '일부' and not any(x['kind'] == '미적용' for x in rules):
        rules.append(dict(NA('그 외 모집단위'), raw='(최저 "일부" 표시에서 추가)'))
    return rules, ov


def judge_status(u, r, rules, ov):
    if ov.get('status'):
        return ov['status'], ov['reason']
    why = []
    for x in rules:
        if x['kind'] in ('합', '각') and (not x['areas'] or x['n'] is None or x['val'] is None):
            why.append(f"{x['label']}: 개수·기준 분해 불완전")
        if '미기재' in x['tam'] or '원문 확인' in x['tam']:
            why.append(f"탐구 반영 방식 불명확({x['tam']})")
        if re.search(r'\s등$|·.*등$', x['label']):
            why.append('예외 모집단위 목록이 "등"으로 끝남')
    if (u, r['name']) in ETC_CHECK:
        why.append('대체 응시 규칙이 있음')
    if not rules and r['min_flag'] != '없음':
        why.append('문구 분해 실패')
    if why:
        return CHECK, ', '.join(dict.fromkeys(why))
    soft = []
    applied = [x for x in rules if x['kind'] != '미적용']
    if len(rules) > 1:
        soft.append(f'모집단위·계열별 기준 {len(rules)}갈래')
    if any(x['tam'] == TAM_AVG for x in applied):
        soft.append('탐구 2과목 평균의 소수점 처리(절사 여부) 원문 확인')
    if any(x['etc'] for x in applied):
        soft.append('기타 조건 있음')
    if soft:
        return RECHECK, ', '.join(soft)
    return AUTO, ''


# ---------- 지원자격 ----------
SCHOOL_KW = ['특성화', '마이스터', '예고', '예술', '체고', '체육', '예체', '영재', '과학고', '자사고', '외고', '국제고',
             '방통', '방송통신', '각종학교', '학력인정', '대안', '평생교육', '외국고', '국외고', '해외고', '고등기술', '특수학교', '예·체']
REGIONS = ['경기 의정부·남양주·이천·포천권', '인천 서북·중부권', '의정부·남양주·이천·포천', '충청권', '강원', '부산', '울산', '경남', '경북',
           '대구', '대전', '세종', '충남', '충북', '광주', '전남', '전북']


def clauses(t):
    return [c.strip() for c in re.split(r'[,;.()]|\s/\s', t) if c.strip()]


def elig_tags(u, r):
    t = r['elig_text']
    e = r['elig']
    rec = r['recommend']
    tags = {}
    tags['재학생 한정'] = 'Y' if e == '재학생' else ''
    tags['졸업생 전용'] = 'Y' if e == '졸업생 전용' else ''
    if e == '졸업연도 제한':
        m = re.search(r'(\d{4})(?:년|\.)?\s*(?:\d{1,2}월\s*)?(?:이후|이전)(?:[^,;.·]|·(?=\d))*', t) or re.search(r'\d{4}·\d{4}·\d{4}년[^,]*', t)
        tags['졸업연도 제한'] = m.group(0).strip() if m else 'Y(원문 확인)'
    else:
        tags['졸업연도 제한'] = ''
    tags['추천 필요'] = '' if rec == '없음' else rec
    if not tags['추천 필요'] and re.search(r'목회자 추천|사제 추천|교구장', t):
        tags['추천 필요'] = '기타 추천(종교, 일부 모집단위)'
    found = []
    only = re.search(r'(일반(?:고)?·[^,(]*?고)(?=만| 이수| 재학생| 3학년|\()', t)
    span = only.span() if only else (0, 0)
    if True:
        for kw in SCHOOL_KW:
            for m in re.finditer(r'(?<![국해과])' + kw + r'(?!선발)', t):
                if span[0] <= m.start() < span[1]:
                    continue
                win = re.split(r'[;.()]', t[m.start():])[0]
                if re.search(r'불가|제외|미포함', win) and not re.search(r'포함', win.split('불가')[0].split('제외')[0].replace('미포함', '')):
                    if kw not in found:
                        found.append(kw)
                    break
    if '비인가' in t:
        found.append('비인가')
    parts = [only.group(1) + '만'] if only else []
    if found:
        parts.append('불가: ' + '·'.join(found))
    if '정규고' in t and not parts:
        parts.append('정규고만(각종학교 등 제외)')
    tags['고교 유형 제한'] = ' / '.join(parts)
    tags['검정고시 불가'] = 'Y' if re.search(r'(?<!외국 )검정고시[^,;()]*?(불가|제외)', t) else ''
    # 지역 요건은 대시보드의 reg(지역 고교 이수 요건 한 줄 요약)를 그대로 쓴다(v0.10.x부터).
    tags['지역인재 요건'] = r.get('reg', '')
    misc = []
    if '여자' in t: misc.append('여학생만')
    if re.search(r'학폭', t): misc.append('학폭 기재 시 제한')
    if re.search(r'(\d|[2-6]개) ?학기|학기 이상', t): misc.append('이수 학기 요건')
    if re.search(r'수능[^,]*응시|응시영역|응시 조건|응시조건|반영영역', t + ' ' + (r.get('min_text') or '')) and r['track'] != '정시':
        misc.append('수능 응시 요건')
    if re.search(r'침례|세례|(?<!출)신자|목회자', t): misc.append('종교 요건(일부 모집단위)')
    if '군인사법' in t: misc.append('군 결격사유 없음')
    if '영재선발위원회' in t: misc.append('과학영재 조기입학 허용')
    if '조기졸업' in t and re.search(r'조기졸업[^,]*(불가|제외)', t): misc.append('조기졸업 불가')
    tags['기타 요건'] = ', '.join(misc)
    if e == '확인 불가':
        st, why = CHECK, '원문에 지원자격 미기재'
    elif r.get('reg') == '미기재':
        st, why = CHECK, '지역 요건 원문 미기재'
    elif ' / ' in t:
        st, why = CHECK, '모집단위·계열별로 자격이 다름'
    elif tags['졸업연도 제한'] == 'Y(원문 확인)':
        st, why = CHECK, '졸업연도 문구 분해 실패'
    else:
        st, why = AUTO, ''
    return tags, st, why


def fmt_rule(x):
    if x['kind'] == '미적용':
        return '미적용'
    if x['kind'] in ('한국사만', '영어·한국사만'):
        return ', '.join(filter(None, [f"영어 {x['eng']}" if x['eng'] else '', f"한국사 {x['hist']}" if x['hist'] else '']))
    s = f"{'·'.join(x['areas'])} 중 {x['n']}개 {x['kind']} {x['val']}"
    if x['req']: s += f" (필수 {x['req']})"
    if x['tam']: s += f" [탐구: {x['tam']}]"
    if x['eng']: s += f", 영어 {x['eng']}"
    if x['hist']: s += f", 한국사 {x['hist']}"
    if x['etc']: s += f"; {x['etc']}"
    return s


def main():
    D = os.path.join(REPO, 'data/universities')
    rule_rows, sel_rows, elig_rows, js, jo = [], [], [], [], {}
    for f in sorted(os.listdir(D)):
        d = json.load(open(os.path.join(D, f)))
        for r in d['rows']:
            u = d['u']
            base = [u, d['rg'], r['track'], r['name'], r.get('quota'), r.get('pg')]
            if r['min_flag'] == '없음' and (u, r['name']) not in OV and (u, r['track'], r['name']) not in OV:
                rules, st, why = [], AUTO, ''
            else:
                rules, ov = rules_for(u, r)
                st, why = judge_status(u, r, rules, ov)
            for i, x in enumerate(rules, 1):
                rule_rows.append(base + [i, x['label'], ','.join(x['areas']), x['tam'], x['n'], x['kind'], x['val'],
                                         x['req'], x['hist'], x['eng'], x['etc'], st, r.get('min_text', '')])
            main_rule = next((x for x in rules if x['label'] in ('기본', '서울', '인문', '인문·자연')), None) or \
                next((x for x in rules if x['kind'] != '미적용'), None)
            others = [x for x in rules if x is not main_rule]
            m = main_rule or {}
            sel_rows.append(base + [r['min_flag'] if rules or r['min_flag'] != '없음' else '없음',
                                    m.get('label', ''), ','.join(m.get('areas', [])), m.get('n'), m.get('kind', ''), m.get('val'),
                                    m.get('req', ''), m.get('tam', ''), m.get('hist', ''), m.get('eng', ''), m.get('etc', ''),
                                    ' / '.join(f"{x['label']}: {fmt_rule(x)}" for x in others), len(rules), st, why,
                                    r.get('min_text', '') or ('없음' if r['min_flag'] == '없음' else '')])
            tags, est, ewhy = elig_tags(u, r)
            elig_rows.append(base + [tags[k] for k in ELIG_COLS] + [est, ewhy, r['elig'], r['elig_text'], r['recommend']])
            jo[f"{u}|{r['track']}|{r['name']}"] = compact(dict(
                src=src_hash(r), ms=st if rules else '', mr=why, es=est, er=ewhy,
                m=[compact({k: x[k] for k in ('label', 'areas', 'tam', 'n', 'kind', 'val', 'req', 'hist', 'eng', 'etc')}) for x in rules],
                e=compact(tags)))
            js.append(dict(u=u, rg=d['rg'], track=r['track'], name=r['name'], quota=r.get('quota'), pg=r.get('pg'),
                           min_flag=r['min_flag'], min_status=st, min_reason=why,
                           min_rules=[{k: x[k] for k in ('label', 'areas', 'tam', 'n', 'kind', 'val', 'req', 'hist', 'eng', 'etc')} for x in rules],
                           elig=tags, elig_status=est, elig_reason=ewhy))
    V = json.load(open(os.path.join(REPO, 'data/versions.json')))
    with open(os.path.join(REPO, 'data/judge.json'), 'w', encoding='utf-8') as fp:
        fp.write('{"v": %s, "rows": {\n' % json.dumps(V[-1]['v']))
        fp.write(',\n'.join(json.dumps(k, ensure_ascii=False) + ': ' + json.dumps(v, ensure_ascii=False, separators=(',', ':')) for k, v in jo.items()))
        fp.write('\n}}\n')
    if OUT:
        write(rule_rows, sel_rows, elig_rows, js)
    c = Counter(x[-3] for x in sel_rows if x[6] != '없음')
    print('전형', len(sel_rows), '최저 있음/일부', sum(1 for x in sel_rows if x[6] != '없음'), '규칙', len(rule_rows), dict(c))
    print('지원자격', dict(Counter(x[6 + len(ELIG_COLS)] for x in elig_rows)))


BASE_H = ['대학', '지역', '구분', '전형명', '인원', '원문 쪽']
ELIG_COLS = ['재학생 한정', '졸업생 전용', '졸업연도 제한', '추천 필요', '고교 유형 제한', '검정고시 불가', '지역인재 요건', '기타 요건']
RULE_H = BASE_H + ['규칙 번호', '적용 대상', '대상 영역', '탐구 방식', '반영 개수', '기준 유형', '기준값', '필수 영역', '한국사 기준',
                   '영어 별도 기준', '기타 조건', '검수 상태', '원문 문구(대시보드)']
SEL_H = BASE_H + ['최저', '기본 기준 적용 대상', '대상 영역', '반영 개수', '기준 유형', '합·각 기준', '필수 영역', '탐구 방식', '한국사 기준',
                  '영어 별도 기준', '기타 조건', '모집단위 예외', '규칙 수', '검수 상태', '검수 사유', '원문 문구(대시보드)']
ELIG_H = BASE_H + ELIG_COLS + ['검수 상태', '검수 사유', '자격 분류(대시보드)', '지원자격 원문 요약', '추천(대시보드)']

GUIDE = [
    ['2028 수능최저·지원자격 구조화 초안 (1단계)'],
    [''],
    ['출처', '대시보드 저장소 2023swhs3rd-a11y/2028plan data/ (v0.10.16, 2026-11-18). 95개 대학(캠퍼스 분리 항목 포함 103개 파일) 604개 전형.'],
    ['수능 과목 전제', '2028 수능 탐구는 통합사회·통합과학. "사탐"=통합사회, "과탐"=통합과학으로 읽었다.'],
    [''],
    ['시트', '내용'],
    ['검수 목록', '"원문 확인 필요" 행만 모은 목록. 여기부터 보시면 됩니다.'],
    ['수능최저_전형별', '전형 1행. 기본 기준을 열로 나누고, 나머지 모집단위 기준은 "모집단위 예외"에 문장으로 둔다. 검수용.'],
    ['수능최저_규칙', '규칙 1행(전형 × 적용 대상). 2단계 판정 로직이 읽는 형태.'],
    ['지원자격', '전형 1행. 태그가 비어 있으면 해당 없음.'],
    [''],
    ['열', '값'],
    ['대상 영역', '국, 수, 영, 탐(통사·통과 중 탐구 방식대로 1개 값), 통사·통과(각각 별도 영역), 한국사(건국대처럼 한국사가 풀에 들어갈 때)'],
    ['탐구 방식', f'{TAM_TOP1} / {TAM_AVG} / {TAM_SEP} / {TAM_SCI} / 미기재·원문 확인'],
    ['기준 유형', '합: N개 등급 합 ≤ 기준값, 각: N개가 각각 ≤ 기준값, 미적용, 한국사만, 영어·한국사만'],
    ['필수 영역', '고른 N개에 반드시 들어가야 하는 영역 (수 / 국·수 모두 / 국·수 중 1개 이상 / 탐 / 국)'],
    ['한국사 기준', '숫자=그 등급 이내, 응시 필수, 미활용, 빈칸=문구에 없음'],
    [''],
    ['검수 상태', '의미'],
    [AUTO, '단일 기준이라 문구 그대로 분해됨'],
    [RECHECK, '분해는 됐지만 모집단위·계열별 기준이 여러 개이거나 탐구 평균의 소수점 처리가 있어 원문 대조 권장'],
    [CHECK, '문구만으로는 판정 규칙을 확정할 수 없음. 검수 사유와 원문 쪽을 보고 선생님 확인 필요'],
]


def write(rule_rows, sel_rows, elig_rows, js):
    for name, h, rows in [('min_rules.csv', RULE_H, rule_rows), ('min_by_admission.csv', SEL_H, sel_rows),
                          ('eligibility_tags.csv', ELIG_H, elig_rows)]:
        with open(os.path.join(OUT, name), 'w', newline='', encoding='utf-8-sig') as fp:
            w = csv.writer(fp); w.writerow(h); w.writerows(rows)
    with open(os.path.join(OUT, 'admissions_structured.json'), 'w', encoding='utf-8') as fp:
        json.dump(js, fp, ensure_ascii=False, indent=1)
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment
    from openpyxl.utils import get_column_letter
    wb = Workbook()
    ws = wb.active; ws.title = '안내'
    for row in GUIDE: ws.append(row)
    ws['A1'].font = Font(bold=True, size=13)
    ws.column_dimensions['A'].width = 18; ws.column_dimensions['B'].width = 110
    fills = {CHECK: PatternFill('solid', fgColor='FCE4D6'), RECHECK: PatternFill('solid', fgColor='FFF2CC')}
    widths = {'전형명': 30, '원문 문구(대시보드)': 60, '모집단위 예외': 60, '지원자격 원문 요약': 60, '검수 사유': 36,
              '대상 영역': 16, '탐구 방식': 22, '기타 조건': 28, '적용 대상': 20, '고교 유형 제한': 24, '기타 요건': 28}
    for title, h, rows in [('수능최저_전형별', SEL_H, sel_rows), ('수능최저_규칙', RULE_H, rule_rows), ('지원자격', ELIG_H, elig_rows)]:
        ws = wb.create_sheet(title)
        ws.append(h)
        si = h.index('검수 상태')
        for r in rows:
            ws.append(r)
            f = fills.get(r[si])
            if f:
                ws.cell(ws.max_row, si + 1).fill = f
        for i, name in enumerate(h, 1):
            ws.cell(1, i).font = Font(bold=True)
            ws.column_dimensions[get_column_letter(i)].width = widths.get(name, 11)
        ws.freeze_panes = 'E2'
        ws.auto_filter.ref = ws.dimensions
        for row in ws.iter_rows(min_row=2):
            for c in row:
                c.alignment = Alignment(vertical='top', wrap_text=h[c.column - 1] in widths and widths[h[c.column - 1]] >= 28)
    ws = wb.create_sheet('검수 목록', 1)
    ws.append(['구분', '대학', '전형명', '원문 쪽', '검수 상태', '검수 사유', '원문 문구(대시보드)'])
    for r in sel_rows:
        if r[SEL_H.index('검수 상태')] == CHECK:
            ws.append(['수능최저', r[0], r[3], r[5], CHECK, r[SEL_H.index('검수 사유')], r[-1]])
    for r in elig_rows:
        if r[ELIG_H.index('검수 상태')] == CHECK:
            ws.append(['지원자격', r[0], r[3], r[5], CHECK, r[ELIG_H.index('검수 사유')], r[ELIG_H.index('지원자격 원문 요약')]])
    for i, w in enumerate([10, 12, 30, 8, 14, 50, 70], 1):
        ws.column_dimensions[get_column_letter(i)].width = w
        ws.cell(1, i).font = Font(bold=True)
    for row in ws.iter_rows(min_row=2):
        row[5].alignment = row[6].alignment = Alignment(wrap_text=True, vertical='top')
    ws.freeze_panes = 'A2'
    wb.save(os.path.join(OUT, '수능최저_지원자격_초안.xlsx'))


if __name__ == '__main__':
    main()
