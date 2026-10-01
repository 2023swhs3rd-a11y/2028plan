# 2028 대입전형 시행계획 요약

선정한 65개 대학(일반대학 50 · 교육대학 10 · 과학기술원 5)의 학생부교과, 학생부종합, 논술, 정시 수능위주 전형과 2027 대비 변경사항을 중심으로 작성한 대시보드입니다(대학발표 2028 대입전형 시행계획 참고).

- 보기: `index.html` (단일 파일, 인터넷 연결 없이도 열림)
- 출처: 각 대학이 공개한 2028학년도 대입전형 시행계획 PDF. 외부 사교육 자료는 참고하지 않았습니다.
- 주의: 요약 과정에서 누락이나 오기가 있을 수 있습니다. 지원 전에는 반드시 대학별 시행계획과 모집요강 원문을 확인하세요.

## 파일 구성과 수정 방법

`index.html`은 직접 고치지 않고 아래 원본에서 만들어집니다.

| 경로 | 내용 |
|---|---|
| `data/universities/NN-대학명.json` | 대학별 전형 데이터(번호 순서가 화면 기본 순서) |
| `data/versions.json` | 버전 기록('자료 기준' 탭에 표시) |
| `src/template.html` | 화면(HTML·CSS·JS), 데이터 자리는 `/*@@DATA@@*/` |
| `src/og-card.html` → `og.png` | 링크 공유 미리보기 이미지(1200×630) |
| `scripts/build.mjs` | 데이터 검증 후 `index.html` 생성 |

```sh
node scripts/build.mjs          # 검증 + index.html 생성 (Node.js 18 이상, 설치할 패키지 없음)
node scripts/build.mjs --check  # 검증 + index.html 이 최신인지 확인
```

데이터를 고친 뒤 빌드하고 `data/`와 `index.html`을 함께 커밋합니다. 전형 유형·대학 구분·변경 분류 같은 허용값이 틀리거나 수시+정시 인원 합계가 맞지 않으면 빌드가 실패하고 어느 파일의 어느 항목인지 알려 줍니다.

`main`에 push하면 GitHub Actions가 검증 후 GitHub Pages에 배포합니다. 처음 한 번은 저장소 **Settings → Pages → Source**를 **GitHub Actions**로 지정해야 합니다.

## 작성자

봉일천고등학교 진로진학부장 전중수 (jungsooj@korea.kr)

조언해주신 경기진협 연탄모임 부장님들께 감사드립니다.

## 라이선스

[크리에이티브 커먼즈 저작자표시-비영리 4.0 국제 (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/deed.ko)

- 저작자를 표시하면 자유롭게 공유하고 변경할 수 있습니다.
- 영리 목적으로는 이용할 수 없습니다.
