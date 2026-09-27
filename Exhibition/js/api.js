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

/** Rooms, daily totals, sessions and staff for the dashboard. */
function fetchDashboard() {
  return jsonp({ action: "dashboard" }, 30000);
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
