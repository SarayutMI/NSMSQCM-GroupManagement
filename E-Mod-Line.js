/* Manual LINE reports: preview saved data, then explicitly send both messages. */
(function () {
  const get = id => document.getElementById(id);
  const dialog = get('lineReportDialog');
  const authKey = 'exhibition.dashboard.auth:' + WEBAPP_URL;
  let preview = null, busy = false, reportDate = '';
  function auth() {
    try { return JSON.parse(localStorage.getItem(authKey) || 'null'); } catch (err) { return null; }
  }
  function status(message) { get('lineReportStatus').textContent = message; }
  function setBusy(value) {
    busy = value;
    ['lineReportClose', 'lineReportRefresh', 'lineLoginBtn'].forEach(id => { get(id).disabled = value; });
    get('lineReportSend').disabled = value || !preview || !preview.configured;
  }
  function showLogin() {
    preview = null;
    get('lineLoginForm').classList.remove('hidden');
    get('lineReportPreviews').classList.add('hidden');
    get('lineReportSend').disabled = true;
    status('กรุณาเข้าสู่ระบบ Dashboard ก่อนส่งรายงาน');
    get('lineLoginUser').focus();
  }
  async function request(action, extra) {
    const session = auth();
    if (!session || !session.token) throw new Error('unauthorized');
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action: action, date: reportDate, token: session.token }, extra)),
    });
    const result = await response.json();
    if (!response.ok || result.error) throw new Error(result.error || 'เชื่อมต่อ E-MOD ไม่สำเร็จ');
    return result;
  }
  function handleError(err) {
    if (err.message === 'unauthorized') {
      try { localStorage.removeItem(authKey); } catch (e) { /* storage blocked */ }
      showLogin();
    } else { status(err.message); }
  }
  async function loadPreview() {
    if (busy) return;
    preview = null;
    setBusy(true);
    get('lineReportPreviews').classList.add('hidden');
    status('กำลังเตรียมข้อความจากข้อมูลที่บันทึกแล้ว...');
    try {
      const result = await request('linePreview');
      if (!Array.isArray(result.messages) || result.messages.length !== 2 || !result.fingerprint) {
        throw new Error('ข้อมูลพรีวิวไม่ถูกต้อง กรุณาอัปเดต E-Mod-CodeGs.gs และเพิ่ม E-Mod-Line.gs');
      }
      preview = result;
      get('lineLoginForm').classList.add('hidden');
      get('lineReportPreviews').classList.remove('hidden');
      get('lineReportSummary').value = result.messages[0].text;
      get('lineReportNarrative').value = result.messages[1].text;
      get('lineReportTarget').textContent = 'ปลายทาง: ' + result.targetName;
      status(result.configured ? 'ตรวจข้อความแล้วกดส่งได้เลย' : 'พรีวิวพร้อมแล้ว แต่ยังไม่ได้ตั้ง LINE token / กลุ่มปลายทางใน Apps Script');
    } catch (err) { handleError(err); }
    finally { setBusy(false); }
  }
  get('lineReportBtn').addEventListener('click', () => {
    if (!state.id || JSON.stringify(serializeReport()) !== lastPopulatedReport) {
      setStatus('กรุณาบันทึกข้อมูลล่าสุดก่อนเตรียมรายงาน LINE', 'warn');
      return;
    }
    reportDate = get('f_date').value;
    preview = null;
    if (window.NsmPopup) NsmPopup.hide();
    dialog.showModal();
    loadPreview();
  });
  get('lineReportClose').addEventListener('click', () => { if (!busy) dialog.close(); });
  dialog.addEventListener('cancel', e => { if (busy) e.preventDefault(); });
  get('lineReportRefresh').addEventListener('click', loadPreview);
  get('lineLoginForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    status('กำลังตรวจชื่อผู้ใช้และ PIN...');
    try {
      const result = await loginDashboard(get('lineLoginUser').value.trim(), get('lineLoginPin').value);
      if (!result.token) throw new Error(result.error || 'เข้าสู่ระบบไม่สำเร็จ');
      localStorage.setItem(authKey, JSON.stringify({ token: result.token, user: result.user }));
      get('lineLoginPin').value = '';
      setBusy(false);
      await loadPreview();
    } catch (err) { handleError(err); }
    finally { setBusy(false); }
  });
  get('lineReportSend').addEventListener('click', async () => {
    if (busy || !preview || !preview.configured) return;
    setBusy(true);
    status('กำลังส่งรายงานทั้งสองแบบเข้า LINE...');
    try {
      const result = await request('lineSend', { fingerprint: preview.fingerprint });
      if (!result.ok) throw new Error('ไม่สามารถยืนยันผลการส่งได้');
      preview = null;
      status(result.alreadySent ? 'ข้อความชุดนี้ส่งแล้ว ระบบไม่ได้ส่งซ้ำ' : 'LINE รับคำขอส่งรายงานทั้งสองแบบแล้ว');
    } catch (err) {
      preview = null; // A changed report needs a fresh preview before another send.
      handleError(err);
    } finally { setBusy(false); }
  });
})();
