// 아이폰·아이패드 브라우저로 앱 주소를 열었을 때만 '홈 화면에 추가' 방법을 알려 주는 안내 띠.
// (아이폰은 '앱 설치' 안내가 자동으로 뜨지 않는다.) 홈 화면 아이콘으로 열었거나 닫기를 누른 뒤에는 보이지 않는다.
(function () {
  try {
    var n = navigator, key = 'a2hs-hint:' + location.pathname;
    var ios = /iPhone|iPad|iPod/.test(n.userAgent) || (n.platform === 'MacIntel' && n.maxTouchPoints > 1);
    if (!ios || n.standalone || matchMedia('(display-mode: standalone)').matches || localStorage.getItem(key)) return;
    var d = document.createElement('div');
    d.setAttribute('role', 'note');
    d.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:1000;display:flex;gap:10px;align-items:center;padding:12px 14px;border-radius:12px;background:#1d2430;color:#fff;font-size:14px;line-height:1.45;box-shadow:0 6px 24px rgba(0,0,0,.3)';
    var s = document.createElement('span');
    s.style.flex = '1';
    s.textContent = "앱처럼 쓰려면 공유 버튼을 누른 뒤 '홈 화면에 추가'를 선택하세요.";
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = '닫기';
    b.style.cssText = 'flex:none;border:1px solid rgba(255,255,255,.5);background:transparent;color:#fff;border-radius:8px;padding:8px 12px;font:inherit;min-height:40px;cursor:pointer';
    b.onclick = function () { d.remove(); try { localStorage.setItem(key, '1'); } catch (e) {} };
    d.appendChild(s); d.appendChild(b); document.body.appendChild(d);
  } catch (e) {}
})();
