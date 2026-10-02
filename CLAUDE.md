# 2028 대입전형 시행계획 요약 대시보드

GitHub Pages로 배포하는 정적 단일 파일 대시보드. 빌드 도구·패키지 의존성 없음(Node.js 내장 모듈만).

## 구조
- `index.html`·`CHANGELOG.md`는 생성물이다. 직접 고치지 말고 `data/`·`src/template.html`을 고친 뒤 `node scripts/build.mjs`로 다시 만들고 함께 커밋한다.
- `data/universities/NN-대학명.json`: 대학 1곳 = 파일 1개. 파일명의 대학명은 `u` 값과 같아야 하고, 번호 순서가 화면 기본 순서다.
- `data/versions.json`: 버전 기록 원본. 화면에는 당분간 표시하지 않고 빌드가 `CHANGELOG.md`로 만든다(대학별 `hu`의 수정 항목 포함). 데이터 내용을 고치면 새 버전 항목(`v`, `t`는 KST `YYYY-MM-DD HH:MM`, `note`)을 끝에 추가한다.
- 허용값 목록(전형 `TR`, 대학 구분 `GR`, 변경 분류 `CATS`)은 `src/template.html`의 상수가 원본이고, 빌드 스크립트가 거기서 읽어 검증한다.
- 값을 고칠 때 이전 값은 전형의 `h`(`{v, f, o}`), 대학 단위 변경은 `hu`에 남긴다. 화면이 이를 점선 밑줄과 이전 값 툴팁으로 보여 준다.

## 데이터 원칙
- 출처는 각 대학이 공개한 2028학년도 대입전형 시행계획 PDF뿐이다(`fid` = Google Drive 파일 ID, `pg` = 원문 쪽수). 사교육 자료는 쓰지 않는다.
- 대상은 정원 내 학생부교과·학생부종합·논술·정시 수능위주. 고른기회·특기자·재외국민·정원 외는 `notes`에 적는다.
- 원문에 없거나 판독할 수 없는 값은 추측하지 말고 미기재로 두고 `notes`에 사유를 적는다.

## 확인
- `node scripts/build.mjs --check`: 데이터 검증 + `index.html`·`CHANGELOG.md` 최신 여부(CI와 동일).
- 화면 변경 후에는 Playwright로 390px(모바일)·1440px, 라이트·다크 모드에서 콘솔 오류와 가로 스크롤이 없는지 확인한다.
- `og.png`는 `src/og-card.html`을 1200×630으로 캡처한 것이다. 대학 수 등 문구가 바뀌면 함께 갱신한다.
- 대학을 추가·삭제하면 대학 수가 적힌 곳(`src/template.html` 머리글·메타 태그, `src/og-card.html`, README 첫 문단과 수록 대학 목록)을 함께 고친다.
