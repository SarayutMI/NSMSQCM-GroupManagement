/* =========================================================
   Popup card แจ้งสถานะกลางจอ — ใช้ร่วมกันทั้ง E-Mod และ Exhibition (ฟอร์ม + Dashboard)
   NsmPopup.show(ข้อความ, ชนิด?)  ชนิด: 'loading' | 'success' | 'info' | 'warn' | 'error' | 'none'
     - loading: มีวงหมุน + พื้นหลังทึบกันกดซ้ำ ค้างไว้จนกว่าจะมีข้อความถัดไป
     - success / info: ปิดเองอัตโนมัติ
     - warn / error: ค้างไว้จนกดปุ่ม "ตกลง" (หรือกดที่พื้นหลัง)
     - ไม่ระบุชนิด: เดาจากข้อความ ("กำลัง..." = loading, "ไม่สำเร็จ/ไม่ได้" = error ฯลฯ)
     - ข้อความว่าง หรือชนิด 'none' = ปิด popup
   ========================================================= */
(function () {
  var AUTO_HIDE = { success: 1600, info: 2400 };
  var ICON = { success: '✓', info: 'ℹ', warn: '!', error: '✕' };
  var root, card, icon, text, okBtn, timer;

  var css = '' +
    '.nsm-pop{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;padding:16px;pointer-events:none;opacity:0;transition:opacity .15s ease;font-family:inherit}' +
    '.nsm-pop.show{opacity:1}' +
    '.nsm-pop.block{pointer-events:auto;background:rgba(15,23,42,.35)}' +
    '.nsm-pop-card{pointer-events:auto;width:100%;max-width:360px;background:#fff;border-radius:16px;padding:22px 20px 18px;box-shadow:0 18px 50px rgba(15,23,42,.28);text-align:center;transform:scale(.96);transition:transform .15s ease}' +
    '.nsm-pop.show .nsm-pop-card{transform:scale(1)}' +
    '.nsm-pop-icon{width:46px;height:46px;margin:0 auto 10px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#fff}' +
    '.nsm-pop-text{font-size:15px;line-height:1.5;color:#1e293b;word-break:break-word}' +
    '.nsm-pop-ok{margin-top:14px;min-width:110px;padding:9px 16px;border:none;border-radius:10px;background:#1E3A5F;color:#fff;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer}' +
    '.nsm-pop[data-type=loading] .nsm-pop-icon{background:none;border:4px solid #dbeafe;border-top-color:#2563eb;animation:nsm-spin .8s linear infinite}' +
    '.nsm-pop[data-type=success] .nsm-pop-icon{background:#16a34a}' +
    '.nsm-pop[data-type=info] .nsm-pop-icon{background:#2563eb}' +
    '.nsm-pop[data-type=warn] .nsm-pop-icon{background:#f59e0b}' +
    '.nsm-pop[data-type=error] .nsm-pop-icon{background:#dc2626}' +
    '@keyframes nsm-spin{to{transform:rotate(360deg)}}' +
    '@media print{.nsm-pop{display:none!important}}';

  function build() {
    if (root) return;
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    root = document.createElement('div');
    root.className = 'nsm-pop';
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    root.hidden = true;
    root.innerHTML = '<div class="nsm-pop-card"><div class="nsm-pop-icon"></div><div class="nsm-pop-text"></div>' +
      '<button type="button" class="nsm-pop-ok">ตกลง</button></div>';
    document.body.appendChild(root);
    card = root.querySelector('.nsm-pop-card');
    icon = root.querySelector('.nsm-pop-icon');
    text = root.querySelector('.nsm-pop-text');
    okBtn = root.querySelector('.nsm-pop-ok');
    okBtn.addEventListener('click', hide);
    root.addEventListener('click', function (e) {
      var t = root.dataset.type;
      if (e.target === root && (t === 'warn' || t === 'error')) hide();
    });
  }

  function guess(msg) {
    if (/^กำลัง|\.\.\.\s*$/.test(msg)) return 'loading';
    if (/ไม่สำเร็จ|ไม่ได้|ไม่ถูกต้อง|ผิดพลาด|error/i.test(msg)) return 'error';
    if (/^กรุณา|⚠/.test(msg)) return 'warn';
    if (/^ยังไม่มี/.test(msg)) return 'info';
    return 'success';
  }

  function hide() {
    clearTimeout(timer);
    if (!root || root.hidden) return;
    root.classList.remove('show');
    timer = setTimeout(function () { root.hidden = true; }, 160);
  }

  function show(msg, type) {
    msg = String(msg == null ? '' : msg).trim();
    if (!msg || type === 'none') { hide(); return; }
    if (!document.body) return; // ยังไม่พร้อม (ไม่น่าเกิด เพราะเรียกหลังโหลดหน้า)
    build();
    type = type || guess(msg);
    clearTimeout(timer);
    root.dataset.type = type;
    root.classList.toggle('block', type !== 'success' && type !== 'info');
    icon.textContent = type === 'loading' ? '' : ICON[type] || '';
    text.textContent = msg;
    okBtn.hidden = type !== 'warn' && type !== 'error';
    root.hidden = false;
    requestAnimationFrame(function () { root.classList.add('show'); });
    if (!okBtn.hidden) okBtn.focus({ preventScroll: true });
    if (AUTO_HIDE[type]) timer = setTimeout(hide, AUTO_HIDE[type]);
  }

  window.NsmPopup = { show: show, hide: hide };
})();
