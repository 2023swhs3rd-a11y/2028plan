// 대시보드 '오류 제보'를 관리자 전용 스프레드시트에 쌓는 Google Apps Script(웹 앱).
// 설치: 시트 '2028 대시보드 오류 제보' › 확장 프로그램 › Apps Script 에 이 파일 내용을 붙여 넣고
//       배포 › 새 배포 › 유형 '웹 앱', 실행 사용자 '나', 액세스 권한 '모든 사용자' 로 배포한다.
//       나온 웹 앱 주소(…/exec)를 src/template.html 의 REPORT_URL 에 적는다.
// 시트는 공유하지 않으므로 내용은 소유자(관리자)만 본다. 웹 앱은 행 추가만 하고 시트를 읽어 주지 않는다.
const SHEET_ID = '1YGT5mThhpphGaPuGSDZ-poJnaBb3-Cps3Hy-MmL94i8';
const NOTIFY = true;        // 새 제보가 오면 소유자에게 알림 메일
const PER_MINUTE = 20;      // 분당 접수 상한(도배 방지)

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (_) { return out('bad'); }
  if (d.hp) return out('ok'); // 사람에게 보이지 않는 칸이 채워졌으면 자동 입력으로 보고 버림
  const cache = CacheService.getScriptCache(), n = +(cache.get('n') || 0);
  if (n >= PER_MINUTE) return out('busy');
  cache.put('n', String(n + 1), 60);
  // 수식으로 해석되지 않게(=,+,-,@ 로 시작하면 ' 를 붙임) 하고 길이를 자른다
  const t = (s, max) => String(s == null ? '' : s).slice(0, max).replace(/^[=+\-@]/, "'$&");
  const row = [new Date(), t(d.u, 60), t(d.r, 200), t(d.m, 2000), t(d.v, 20), t(d.url, 500)];
  if (!row[3]) return out('bad');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { SpreadsheetApp.openById(SHEET_ID).getSheets()[0].appendRow(row); } finally { lock.releaseLock(); }
  if (NOTIFY) MailApp.sendEmail(Session.getEffectiveUser().getEmail(), `[2028 대시보드 오류 제보] ${row[1] || '전체'} ${row[2]}`,
    `${row[3]}\n\n버전 v${row[4]} · ${row[5]}\n시트: https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`);
  return out('ok');
}
function doGet() { return out('2028 대시보드 오류 제보 접수 주소입니다.'); }
const out = s => ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.TEXT);
