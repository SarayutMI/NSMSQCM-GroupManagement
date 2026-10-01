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
function fetchConfig() {
  return jsonp({ action: "config" });
}

/** The form saved for one date: {data: {field id: value} | null, count, savedAt}. */
function fetchDay(date) {
  return jsonp({ action: "getByDate", date: date });
}

/** Rooms, daily totals, sessions, staff and E-Mod revenue for the dashboard. Needs a login token. */
function fetchDashboard(token) {
  return jsonp({ action: "dashboard", token: token || "" }, 30000);
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
