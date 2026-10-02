// Talks to the Apps Script Web App in Code.gs. Needs config.js.

// Apps Script GET has no CORS headers, so reads go through JSONP.
function jsonp(params, timeoutMs) {
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
    const script = document.createElement("script");
    const done = () => {
      clearTimeout(timer);
      delete window[cb];
      script.remove();
    };
    const timer = setTimeout(() => {
      done();
      reject(new Error("Sheet ไม่ตอบสนอง"));
    }, timeoutMs || 20000);
    window[cb] = (data) => {
      done();
      resolve(data);
    };
    script.onerror = () => {
      done();
      reject(new Error("โหลดข้อมูลไม่สำเร็จ (ตรวจการ Deploy ของ Code.gs)"));
    };
    const qs = new URLSearchParams(Object.assign({}, params, { callback: cb }));
    script.src = WEBAPP_URL + "?" + qs;
    document.body.appendChild(script);
  });
}

/** Rooms (with their activities) + staff for the form dropdowns. */
// fresh = ข้าม cache ของ server (ปุ่มโหลด/รีเฟรช) — ปกติ server ตอบจาก cache ได้เร็วกว่ามาก
function fetchConfig(fresh) {
  return jsonp(Object.assign({ action: "config" }, fresh ? { fresh: 1 } : {}));
}

/** The form saved for one date: {data: {field id: value} | null, count, savedAt}. */
function fetchDay(date, fresh) {
  return jsonp(Object.assign({ action: "getByDate", date: date }, fresh ? { fresh: 1 } : {}));
}

/** Rooms, daily totals, sessions, staff and E-Mod revenue for the dashboard. Needs a login token. */
function fetchDashboard(token, fresh) {
  return jsonp(Object.assign({ action: "dashboard", token: token || "" }, fresh ? { fresh: 1 } : {}), 30000);
}

/** Login พร้อมบอกสถานะในการ์ด login (ใช้ทั้ง Exhibition Dashboard และ E-Mod Dashboard)
    ระบบของ Google ใช้เวลาตรวจ PIN 3-8 วินาที — ผู้ใช้ต้องเห็นว่ากำลังทำงานอยู่ ไม่ใช่ค้าง */
async function loginWithProgress(username, pin) {
  const btn = $("login-btn"), prog = $("login-progress"), inputs = [$("login-user"), $("login-pin")];
  const label = btn.textContent;
  const t0 = Date.now();
  const step = (msg) => {
    if (prog) prog.innerHTML = `<span class="login-spin"></span>${esc(msg)} <small>${Math.floor((Date.now() - t0) / 1000)} วิ</small>`;
  };
  const stepMsg = () => {
    const s = (Date.now() - t0) / 1000;
    return s < 1.5 ? "กำลังเชื่อมต่อระบบ..." : s < 7 ? "กำลังตรวจสอบชื่อผู้ใช้และ PIN..." : "ยังทำงานอยู่ ระบบของ Google อาจใช้เวลาสักครู่...";
  };
  btn.disabled = true;
  btn.textContent = "กำลังเข้าสู่ระบบ...";
  inputs.forEach((el) => (el.readOnly = true));
  $("login-error").textContent = "";
  step(stepMsg());
  const timer = setInterval(() => step(stepMsg()), 500);
  try {
    const res = await loginDashboard(username, pin);
    if (!res.token) throw new Error(res.error || "เข้าสู่ระบบไม่สำเร็จ");
    if (prog) prog.innerHTML = `✓ เข้าสู่ระบบสำเร็จ กำลังโหลดข้อมูล...`;
    return res;
  } catch (err) {
    if (prog) prog.textContent = "";
    throw new Error(err.message === "Failed to fetch" ? "เชื่อมต่อระบบไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่" : err.message);
  } finally {
    clearInterval(timer);
    btn.disabled = false;
    btn.textContent = label;
    inputs.forEach((el) => (el.readOnly = false));
  }
}

/** Dashboard login. POST so the PIN never sits in a URL; resolves {token, user} or {error}. */
async function loginDashboard(username, pin) {
  const res = await fetch(WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "login", username: username, pin: pin }),
  });
  return res.json();
}

/** POST is fire-and-forget (no-cors): the response is opaque, no throw = sent. */
function postForm(data) {
  return fetch(WEBAPP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(data),
  });
}
