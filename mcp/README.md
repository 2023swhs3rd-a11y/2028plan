# 2028 대입전형 MCP 서버

진학지도 선생님이 Claude(또는 MCP를 지원하는 다른 AI 도구)에서 대시보드 데이터를 바로 검색할 수 있게 하는 원격 MCP 서버입니다. 로그인 없이 공개 데이터만 읽고, 아무것도 저장하지 않습니다.

- 운영 주소: `https://admissions-2028-mcp.jjbic.workers.dev/mcp` (Cloudflare Workers, `main`에 push하면 자동 배포)
- 규격: [Model Context Protocol](https://modelcontextprotocol.io) Streamable HTTP 전송, 상태 없는(stateless) JSON 응답(프로토콜 2025-06-18·2025-03-26·2024-11-05)
- 데이터: GitHub Pages에 함께 배포되는 `data.json`(`scripts/export-data.mjs`가 `data/universities/*.json`을 묶어 만듦). 서버는 10분마다 새로 읽으므로, 저장소에서 데이터를 고쳐 배포하면 따로 서버를 다시 배포할 필요가 없습니다.
- 런타임 의존성 없음: `src/mcp.js`(JSON-RPC·도구), `src/worker.js`(Cloudflare Workers 진입점)

## 도구

| 도구 | 하는 일 |
|---|---|
| `search_admissions` 전형 검색 | 지역·대학 구분·전형 종류·수능최저·면접·학교장추천·졸업생 지원·정시 군·키워드로 전형 찾기. 대학 여러 곳을 지정하면 비교표 |
| `get_university` 대학 상세 | 한 대학의 전형 전체(반영 과목·정시 반영 영역 포함), 모집인원 합계, 2028 주요 변경, 비고 |
| `list_changes` 2028 변경사항 | 수능최저·모집인원·면접 등 분류별 변경 목록 |
| `find_rural` 농어촌 전형 | 농어촌 전용·포함 전형, 정원 내·외, 6년/12년 자격, 이월 |
| `convert_grade` 내 등급 환산 | 5등급제 평균 등급을 교과전형 석차등급 환산표에 넣어 등급점수·1등급 대비 감점 비교(성취도·단위수 미반영 단순 계산) |
| `search_csat_weights` 정시 반영 비율 검색 | 국어·수학·탐구 최소 %, 영어 반영 방식, 계열로 정시 전형 찾기 |
| `get_source` 원문 찾기 | 전형별 원문 PDF 링크와 쪽수 |
| `data_info` 데이터 안내 | 버전·갱신 시각·출처·라이선스·수록 대학 목록 |

프롬프트(메뉴에서 고르는 질문 서식): `consult_prep` 상담 준비표, `change_notice` 2028 변경사항 안내문.

모든 결과에 원문 PDF 링크와 쪽수가 붙고, 서버 안내문(instructions)에서 Claude에게 원문 근거 제시·모집요강 확인 안내·합격 가능성 추측 금지를 요청합니다.

## 선생님 설치 안내 (나눠 드릴 문구)

> 1. claude.ai(또는 Claude 앱) › 설정 › 커넥터 › **사용자 지정 커넥터 추가**
> 2. 이름: `2028 대입전형`, 주소: `https://admissions-2028-mcp.jjbic.workers.dev/mcp` → 추가(로그인 없음)
> 3. 새 대화의 도구 메뉴에서 커넥터를 켜고 질문합니다. 예) "경기 소재 대학 교과전형 중 수능최저와 면접이 없는 곳을 표로"
>
> 시행계획 기준 자료이며 입시 결과는 없습니다. 최종 내용은 각 대학 모집요강으로 확인하세요. 학생 이름·성적표 같은 개인정보는 넣지 마세요.

사용자 지정 커넥터 메뉴와 개수 제한은 Claude 요금제에 따라 다릅니다. Team·Enterprise 계정은 관리자가 조직 커넥터로 한 번 등록하면 구성원은 켜기만 하면 됩니다.

## 시험

```sh
node mcp/test.mjs   # 저장소 data/ 로 data.json 을 만들어 모든 도구·프롬프트·HTTP 응답을 확인(CI에서도 실행)
```
