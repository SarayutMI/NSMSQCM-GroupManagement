/* =========================================================
   nav-drawer.js — เมนูแฮมเบอร์เกอร์แบบลิ้นชักเลื่อน ใช้ร่วมกันทุกหน้าทุกระบบ
   ฝังตัวเองแบบ self-contained (สไตล์/มาร์กอัปในไฟล์นี้ไฟล์เดียว) ไม่พึ่ง CSS ของหน้านั้นๆ
   เพื่อไม่ให้ชนกับดีไซน์เดิมของแต่ละระบบ (booking, E-Mod, Exhibition มีธีมคนละแบบ)

   วิธีใช้: ก่อน <script src="nav-drawer.js"> ให้ตั้ง
     <script>window.NSM_NAV_BASE = '';</script>      สำหรับหน้าที่อยู่ราก repo
     <script>window.NSM_NAV_BASE = '../';</script>    สำหรับหน้าที่อยู่ลึกลงไป 1 ชั้น (เช่น Exhibition/)
   แล้วค่อย <script src="{BASE}nav-drawer.js"></script>
   ========================================================= */
(function () {
  var BASE = window.NSM_NAV_BASE || '';

  var LINKS = [
    { href: BASE + 'index.html', icon: '🏠', label: 'หน้าแรก', match: [''] },
    { href: BASE + 'booking.html', icon: '📅', label: 'ระบบจองห้องกิจกรรม', match: ['booking.html'] },
    { href: BASE + 'E-Mod.html', icon: '📋', label: 'E-Mod รายงานประจำวัน', match: ['e-mod.html'] },
    { href: BASE + 'Exhibition/index.html', icon: '🖼️', label: 'Exhibition · แบบบันทึกผู้เข้าชม', match: ['exhibition/index.html'] },
    { href: BASE + 'Exhibition/dashboard.html', icon: '📊', label: 'Exhibition · Dashboard', match: ['exhibition/dashboard.html'] },
    { href: BASE + 'Stock_InnovationSpace/index.html', icon: '📦', label: 'Stock · Innovation Space', match: ['stock_innovationspace/index.html'] }
  ];

  var css = '\n' +
    '.nsmnav-btn{position:fixed;bottom:22px;right:22px;z-index:99998;width:50px;height:50px;border:none;border-radius:50%;' +
    'background:#1E3A5F;box-shadow:0 8px 22px rgba(10,25,50,.45);cursor:pointer;display:flex;align-items:center;justify-content:center;' +
    'padding:0;transition:transform .2s ease,background .2s ease;}\n' +
    '.nsmnav-btn:hover{background:#2A66C4;transform:translateY(-1px);}\n' +
    '.nsmnav-btn span{display:block;width:20px;height:2px;background:#fff;border-radius:2px;position:relative;transition:transform .25s ease,opacity .25s ease;}\n' +
    '.nsmnav-btn span::before,.nsmnav-btn span::after{content:"";position:absolute;left:0;width:20px;height:2px;background:#fff;border-radius:2px;transition:transform .25s ease,opacity .25s ease,top .25s ease;}\n' +
    '.nsmnav-btn span::before{top:-6px;}\n' +
    '.nsmnav-btn span::after{top:6px;}\n' +
    '.nsmnav-btn.is-open span{background:transparent;}\n' +
    '.nsmnav-btn.is-open span::before{top:0;transform:rotate(45deg);}\n' +
    '.nsmnav-btn.is-open span::after{top:0;transform:rotate(-45deg);}\n' +
    '.nsmnav-backdrop{position:fixed;inset:0;background:rgba(8,16,32,.5);z-index:99996;opacity:0;pointer-events:none;transition:opacity .25s ease;}\n' +
    '.nsmnav-backdrop.is-open{opacity:1;pointer-events:auto;}\n' +
    '.nsmnav-drawer{position:fixed;top:0;right:0;height:100%;width:290px;max-width:84vw;z-index:99997;' +
    'background:linear-gradient(165deg,#1E3A5F 0%,#16345C 55%,#0E2340 100%);color:#fff;box-shadow:-8px 0 30px rgba(0,0,0,.35);' +
    'transform:translateX(104%);transition:transform .32s cubic-bezier(.22,1,.36,1);' +
    'display:flex;flex-direction:column;font-family:Sarabun,"Noto Sans Thai",Inter,sans-serif;}\n' +
    '.nsmnav-drawer.is-open{transform:translateX(0);}\n' +
    '.nsmnav-head{padding:22px 20px 16px;border-bottom:1px solid rgba(255,255,255,.14);}\n' +
    '.nsmnav-head b{font-size:15px;font-weight:700;display:block;}\n' +
    '.nsmnav-head small{font-size:11.5px;color:#B9C7E4;}\n' +
    '.nsmnav-list{list-style:none;margin:0;padding:10px 12px;overflow-y:auto;flex:1;}\n' +
    '.nsmnav-list a{display:flex;align-items:center;gap:11px;padding:12px 12px;border-radius:12px;color:#EAF0FC;' +
    'text-decoration:none;font-size:13.8px;font-weight:600;transition:background .18s ease,transform .18s ease;}\n' +
    '.nsmnav-list a:hover{background:rgba(255,255,255,.1);transform:translateX(3px);}\n' +
    '.nsmnav-list a.is-active{background:rgba(255,255,255,.16);box-shadow:inset 3px 0 0 #6FA8FF;}\n' +
    '.nsmnav-list a .ic{font-size:17px;width:22px;text-align:center;flex-shrink:0;}\n' +
    '.nsmnav-foot{padding:14px 20px 18px;font-size:10.5px;color:#8FA3CB;border-top:1px solid rgba(255,255,255,.1);}\n' +
    '@media print{.nsmnav-btn,.nsmnav-drawer,.nsmnav-backdrop{display:none !important;}}\n';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var btn = document.createElement('button');
  btn.className = 'nsmnav-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'เมนู');
  btn.innerHTML = '<span></span>';

  var backdrop = document.createElement('div');
  backdrop.className = 'nsmnav-backdrop';

  var path = (location.pathname.split('/').pop() || '').toLowerCase();
  var currentKey = path === '' || path === 'index.html' ? '' : path;
  // หน้าในโฟลเดอร์ย่อย ให้ match ด้วย "โฟลเดอร์/xxx.html" (index.html ของโฟลเดอร์ไม่ใช่หน้าแรกของ portal)
  ['exhibition', 'stock_innovationspace'].forEach(function (dir) {
    if (location.pathname.toLowerCase().indexOf('/' + dir + '/') !== -1) {
      currentKey = dir + '/' + (path || 'index.html');
    }
  });

  var linksHtml = LINKS.map(function (l) {
    var active = l.match.indexOf(currentKey) !== -1;
    return '<li><a href="' + l.href + '"' + (active ? ' class="is-active"' : '') + '>' +
      '<span class="ic">' + l.icon + '</span>' + l.label + '</a></li>';
  }).join('');

  var drawer = document.createElement('nav');
  drawer.className = 'nsmnav-drawer';
  drawer.innerHTML =
    '<div class="nsmnav-head"><b>NSM Science Square</b><small>เชียงใหม่ · เมนูระบบทั้งหมด</small></div>' +
    '<ul class="nsmnav-list">' + linksHtml + '</ul>' +
    '<div class="nsmnav-foot">องค์การพิพิธภัณฑ์วิทยาศาสตร์แห่งชาติ</div>';

  function openNav() {
    btn.classList.add('is-open');
    drawer.classList.add('is-open');
    backdrop.classList.add('is-open');
  }
  function closeNav() {
    btn.classList.remove('is-open');
    drawer.classList.remove('is-open');
    backdrop.classList.remove('is-open');
  }
  btn.addEventListener('click', function () {
    if (drawer.classList.contains('is-open')) closeNav(); else openNav();
  });
  backdrop.addEventListener('click', closeNav);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeNav();
  });

  function mount() {
    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);
    document.body.appendChild(btn);
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
