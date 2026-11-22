"""수능최저(min_text) 문구 → 구조화 규칙 초안.

입력: 2028plan 저장소 data/universities/*.json
출력: 규칙 리스트(dict). 자동 분해 결과이며, 수작업 보정은 OVERRIDES(build.py)에서 한다.
"""
import re

TAM_SEP = '통합사회·통합과학 각각 별도 영역'
TAM_TOP1 = '통합사회·통합과학 중 상위 1'
TAM_AVG = '통합사회·통합과학 평균'
TAM_SCI = '통합과학만'
TAM_NONE = ''

def split_top(s, seps):
    """괄호 밖의 구분자로만 나눈다."""
    out, depth, cur, i = [], 0, '', 0
    while i < len(s):
        c = s[i]
        if c in '([':
            depth += 1
        elif c in ')]':
            depth -= 1
        hit = next((sp for sp in seps if depth == 0 and s.startswith(sp, i)), None)
        if hit:
            out.append(cur.strip()); cur = ''; i += len(hit); continue
        cur += c; i += 1
    out.append(cur.strip())
    return [x for x in out if x]

AREA_RE = re.compile(r'(한·)?국·(?:수·영|영·수|수)(?:·[^\s·(]+)*(?:\([^)]*\))?(?: 또는 과탐\([^)]*\))?')

def parse_areas(seg):
    """대상 영역과 탐구 방식. 못 찾으면 None."""
    m = AREA_RE.search(seg)
    if not m:
        if re.search(r'국·영·수|국·수·영', seg):
            pass
        return None
    a = m.group(0)
    areas = []
    if a.startswith('한·'):
        areas.append('한국사')
    areas += ['국', '수']
    if '영' in a.split('(')[0]:
        areas.append('영')
    tam = TAM_NONE
    head = a.split('(')[0]
    paren = a[len(head):]
    if re.search(r'사탐[·/]과탐|사·과$|사·과(?!\s*[중상평])', head) and '평균' not in a and '상위' not in a:
        if '사탐/과탐' in head and '상위' not in a:
            tam = '사탐/과탐(방식 원문 확인)'
            areas.append('탐')
        else:
            areas += ['통사', '통과']; tam = TAM_SEP
    elif re.search(r'과탐|통합과학|탐\(과학\)|탐\(통합과학\)', a) and not re.search(r'통합사회|사/과|사·과|사회|사 또는', a):
        areas.append('통과'); tam = TAM_SCI
    elif re.search(r'탐|통합사회|통사|사/과|사 또는 과', a):
        areas.append('탐')
        if '평균' in a:
            tam = TAM_AVG
        elif '통사/통과' in a and not paren:
            tam = '통사/통과(방식 원문 확인)'
        elif paren or '상위' in a or '1과목' in a:
            tam = TAM_TOP1
        else:
            tam = '탐구 방식 미기재'
    return {'areas': areas, 'tam': tam}

def parse_crit(seg):
    """반영 개수, 기준 유형, 기준값."""
    m = re.search(r'1등급 (\d)개 이상', seg)
    if m:
        return int(m.group(1)), '각', 1
    m = re.search(r'(\d)개(?: 영역)?(?: 등급)?(?:\([^)]*\))? (?:영역 등급 )?합 (\d+)', seg)
    if m:
        return int(m.group(1)), '합', int(m.group(2))
    m = re.search(r'(\d)개(?:\([^)]*\))? 각 (\d)', seg)
    if m:
        return int(m.group(1)), '각', int(m.group(2))
    m = re.search(r'(\d)개 (\d)등급', seg) or re.search(r'(\d)개 (\d)(?:\D|$)', seg)
    if m:
        return int(m.group(1)), '각', int(m.group(2))
    m = re.search(r'합 (\d+)', seg)
    if m:
        return None, '합', int(m.group(1))
    return None, None, None

def parse_req(seg):
    if re.search(r'국·수 모두 포함', seg): return '국·수 모두'
    if re.search(r'국·수 중 1개', seg): return '국·수 중 1개 이상'
    if '수학 포함' in seg: return '수'
    if '탐구 필수 포함' in seg: return '탐'
    if '국어 포함' in seg: return '국'
    return ''

def parse_hist(seg):
    m = re.search(r'한국사 (\d)', seg)
    if m: return m.group(1)
    if re.search(r'한국사 응시', seg): return '응시 필수'
    if '한국사 미활용' in seg: return '미활용'
    return ''

LABEL_RE = re.compile(r'^(.*?)(?::\s*|\s+(?=(?:한·)?국·|\d개|1등급|한국사|영어))')

def parse_text(text):
    """min_text 한 줄 → 규칙 목록. 각 규칙: label, areas, tam, n, kind, val, req, hist, eng, raw."""
    t = text.strip()
    hist_g = parse_hist(t)
    eng = ''
    m = re.search(r'영어 (\d)(?!개)', t)
    if m and '영어 대체' not in t:
        eng = m.group(1)
    rules = []
    prev = None
    for seg in split_top(t, [' / ', '; ']):
        # 괄호 속 예외를 떼어 낸다: "(약학 3개 합 5, 의학 ...)"
        base = seg
        excs = []
        for pm in re.finditer(r'\(([^()]*(?:\([^()]*\)[^()]*)*)\)', seg):
            inner = pm.group(1)
            if re.search(r'\d개|각 \d|합 \d|미적용', inner) and not re.match(r'^(사|과|통|상위|1|2|평균)', inner):
                excs.append(inner)
                base = base.replace(pm.group(0), '')
        base = base.strip().rstrip(',')
        lm = LABEL_RE.match(base)
        label = ''
        body = base
        if lm and not re.match(r'^(한·)?국·', base):
            label = lm.group(1).strip()
            body = base[lm.end():] if base[lm.end()-1] == ':' or ':' in lm.group(0) else base[len(lm.group(1)):].strip()
        r = mk(label or '기본', body, prev, seg)
        if r: rules.append(r); prev = r
        for ex in excs:
            for part in split_top(ex, [', ']):
                plm = LABEL_RE.match(part)
                pl = plm.group(1).strip() if plm else part
                pb = part[len(pl):].strip(' :')
                er = mk(pl, pb, r or prev, part)
                if er: rules.append(er)
    for r in rules:
        if not r['hist']: r['hist'] = hist_g
        if not r['eng']: r['eng'] = eng
    return rules

def mk(label, body, parent, raw):
    ar = parse_areas(body)
    n, kind, val = parse_crit(body)
    if kind is None and not ar:
        if re.search(r'미적용|없음|미활용', body):
            return {'label': label, 'areas': [], 'tam': '', 'n': None, 'kind': '미적용', 'val': None,
                    'req': '', 'hist': '', 'eng': '', 'raw': raw}
        return None
    inherited = False
    if not ar and parent:
        ar = {'areas': parent['areas'], 'tam': parent['tam']}; inherited = True
    if ar and ('탐구 2과목 평균' in body or '탐(2평균)' in body or '탐구 사/과 평균' in body):
        ar = {'areas': [a for a in ar['areas'] if a not in ('통사', '통과')] + (['탐'] if '탐' not in ar['areas'] else []), 'tam': TAM_AVG}
    if n is None and kind == '합' and ar:
        if '4개' in body: n = 4
    return {'label': label, 'areas': ar['areas'] if ar else [], 'tam': ar['tam'] if ar else '',
            'n': n, 'kind': kind, 'val': val, 'req': parse_req(body), 'hist': parse_hist(body),
            'eng': '', 'raw': raw, 'inherited': inherited}
