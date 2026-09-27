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
  $("role-ctl").hidden = state.view === "visitors";
  $("room-ctl").hidden = state.view === "visitors";

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

async function loadData() {
  setStatus("กำลังโหลดข้อมูล...");
  try {
    const data = await fetchDashboard();
    if (!Array.isArray(data.rooms)) throw new Error("ข้อมูลไม่ตรงรูปแบบ (Deploy Code.gs เวอร์ชันใหม่แล้วหรือยัง)");
    ROOMS = data.rooms;
    DAILY = data.daily || [];
    SESSIONS = data.sessions || [];
    STAFF = data.staff || [];
    if (state.room !== "all" && !ROOMS.some((r) => r.key === state.room)) state.room = "all";
    renderRoomTabs();
    const dates = allDates();
    state.anchor = dates.length ? dates[dates.length - 1] : new Date().toISOString().slice(0, 10);
    render();
    setStatus("อัปเดตล่าสุด " + new Date().toLocaleTimeString("th-TH"));
  } catch (err) {
    setStatus(err.message);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  bindControls();
  loadData();
});
