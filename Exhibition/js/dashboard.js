// Dashboard: controls, render loop, data load. Entry point of dashboard.html.
// Load order: config.js, api.js, dashboard-core.js, dashboard-views.js, dashboard.js.

function renderRoomTabs() {
  $("room-tabs").innerHTML =
    '<button class="tab" data-room="all">ทั้งหมด</button>' +
    ROOMS.map((r) => `<button class="tab" data-room="${esc(r.key)}">${esc(r.label)}</button>`).join("");
}

function renderControls() {
  document.querySelectorAll("#view-tabs .tab").forEach((t) => t.classList.toggle("active", t.dataset.view === state.view));
  document.querySelectorAll("#gran-tabs .tab").forEach((t) => t.classList.toggle("active", t.dataset.gran === state.gran));
  document.querySelectorAll("#role-tabs .tab").forEach((t) => t.classList.toggle("active", t.dataset.role === state.role));
  document.querySelectorAll("#room-tabs .tab").forEach((t) => t.classList.toggle("active", t.dataset.room === state.room));
  const noFilters = state.view === "visitors" || state.view === "finance";
  $("role-ctl").hidden = noFilters;
  $("room-ctl").hidden = noFilters;

  const sel = $("period");
  const g = state.gran;
  sel.disabled = g === "all";
  if (g === "all") {
    sel.innerHTML = `<option>${bucketLabel("all", "all")}</option>`;
    return;
  }
  const keys = [...new Set(allDates().map((d) => bucketKey(d, g)))];
  const cur = periodKey();
  if (!keys.includes(cur)) keys.push(cur);
  keys.sort().reverse();
  sel.innerHTML = keys.map((k) => `<option value="${esc(k)}"${k === cur ? " selected" : ""}>${esc(bucketLabel(k, g))}</option>`).join("");
}

function render() {
  renderControls();
  document.querySelectorAll(".view").forEach((v) => (v.hidden = v.id !== "view-" + state.view));
  if (state.view === "visitors") renderVisitors();
  else if (state.view === "staff") renderStaff();
  else if (state.view === "finance") renderFinance();
  else renderActivities();
}

function bindControls() {
  // one delegated handler per tab strip: read the data-* attribute, store it, re-render
  const onPick = (containerId, attr, key) =>
    $(containerId).addEventListener("click", (e) => {
      const b = e.target.closest(`[data-${attr}]`);
      if (!b) return;
      state[key] = b.dataset[attr];
      render();
    });
  onPick("view-tabs", "view", "view");
  onPick("gran-tabs", "gran", "gran");
  onPick("role-tabs", "role", "role");
  onPick("room-tabs", "room", "room");
  onPick("v-mode", "vmode", "vmode");

  $("period").addEventListener("change", (e) => {
    const d = latestDateIn(e.target.value, state.gran);
    if (d) state.anchor = d;
    render();
  });
  $("view-staff").addEventListener("click", (e) => {
    if (e.target.closest("[data-close-person]")) {
      state.person = null;
      render();
      return;
    }
    const row = e.target.closest("[data-person]");
    if (!row) return;
    state.person = state.person === row.dataset.person ? null : row.dataset.person;
    render();
    if (state.person) $("s-person-card").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

// ---------- login (token from Code.gs, kept in this browser until it expires or logout) ----------
const TOKEN_KEY = "exhibition.dashboard.auth";

function readAuth() {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) || "null");
  } catch (err) {
    return null;
  }
}
function writeAuth(auth) {
  try {
    if (auth) localStorage.setItem(TOKEN_KEY, JSON.stringify(auth));
    else localStorage.removeItem(TOKEN_KEY);
  } catch (err) {
    // storage blocked: the token then only lives in memory for this page
  }
  currentAuth = auth;
}
let currentAuth = readAuth();

function showLogin(msg) {
  $("login").hidden = false;
  $("user-box").hidden = true;
  $("login-error").textContent = msg || "";
  $("login-pin").value = "";
  ($("login-user").value ? $("login-pin") : $("login-user")).focus();
}

function bindLogin() {
  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if ($("login-btn").disabled) return; // กดซ้ำระหว่างรอ
    try {
      const res = await loginWithProgress($("login-user").value.trim(), $("login-pin").value.trim());
      writeAuth({ token: res.token, user: res.user });
      $("login").hidden = true;
      $("login-progress").textContent = "";
      loadData();
    } catch (err) {
      $("login-error").textContent = err.message;
      $("login-pin").value = "";
      $("login-pin").focus();
    }
  });
  $("logout-btn").addEventListener("click", () => {
    writeAuth(null);
    writeDashCache(null);
    dashLoaded = false;
    DAILY = SESSIONS = STAFF = FINANCE = [];
    showLogin();
  });
}

// ข้อมูล Dashboard รอบล่าสุดเก็บไว้ในเครื่อง (ต่อผู้ใช้): เปิดหน้าแล้วเห็นทันที แล้วค่อยอัปเดตจาก Sheet เบื้องหลัง
const DASH_CACHE_KEY = "exhibition.dashboard.data";
function readDashCache() {
  try {
    const c = JSON.parse(localStorage.getItem(DASH_CACHE_KEY) || "null");
    return c && currentAuth && c.user === currentAuth.user ? c : null;
  } catch (e) {
    return null;
  }
}
function writeDashCache(data) {
  try {
    if (data) localStorage.setItem(DASH_CACHE_KEY, JSON.stringify({ user: currentAuth.user, at: Date.now(), data: data }));
    else localStorage.removeItem(DASH_CACHE_KEY);
  } catch (e) {
    /* storage เต็ม/ถูกปิด: ข้ามไป */
  }
}
let dashLoaded = false;

function applyDashboard(data) {
  $("user-name").textContent = "👤 " + (currentAuth.user || "");
  $("user-box").hidden = false;
  ROOMS = data.rooms;
  DAILY = data.daily || [];
  SESSIONS = data.sessions || [];
  STAFF = data.staff || [];
  FINANCE = data.finance || [];
  if (state.room !== "all" && !ROOMS.some((r) => r.key === state.room)) state.room = "all";
  renderRoomTabs();
  // คงช่วงเวลาที่กำลังดูอยู่ไว้ ถ้าอัปเดตเบื้องหลังระหว่างใช้งาน
  if (!dashLoaded || !state.anchor) {
    const dates = allDates();
    state.anchor = dates.length ? dates[dates.length - 1] : new Date().toISOString().slice(0, 10);
  }
  render();
  dashLoaded = true;
}

async function loadData(fresh) {
  if (!currentAuth || !currentAuth.token) {
    showLogin();
    return;
  }
  if (!dashLoaded) {
    const cached = readDashCache();
    if (cached && cached.data) applyDashboard(cached.data);
  }
  // มีข้อมูลแสดงอยู่แล้ว: อัปเดตเงียบๆ (ข้อความมุมขวาบน ไม่บังจอ)
  if (dashLoaded) setStatus("กำลังอัปเดตข้อมูล...", "none");
  else setStatus("กำลังโหลดข้อมูล...");
  try {
    const data = await fetchDashboard(currentAuth.token, fresh);
    if (data.error === "unauthorized") {
      writeAuth(null);
      writeDashCache(null);
      setStatus("");
      showLogin("หมดเวลาเข้าระบบ กรุณาเข้าสู่ระบบใหม่");
      return;
    }
    if (data.error) throw new Error(data.error);
    if (!Array.isArray(data.rooms)) throw new Error("ข้อมูลไม่ตรงรูปแบบ (Deploy Code.gs เวอร์ชันใหม่แล้วหรือยัง)");
    const first = !dashLoaded;
    applyDashboard(data);
    writeDashCache(data);
    setStatus("อัปเดตล่าสุด " + new Date().toLocaleTimeString("th-TH"), first ? "success" : "none");
  } catch (err) {
    setStatus(err.message + (dashLoaded ? " (กำลังแสดงข้อมูลล่าสุดที่เก็บไว้ในเครื่อง)" : ""), "error");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  bindControls();
  bindLogin();
  // คลิกข้อความ "อัปเดตล่าสุด" มุมขวาบน = ดึงข้อมูลใหม่จาก Sheet จริง (ข้าม cache)
  $("status").title = "คลิกเพื่อดึงข้อมูลล่าสุดจาก Sheet";
  $("status").style.cursor = "pointer";
  $("status").addEventListener("click", () => loadData(true));
  loadData();
});
