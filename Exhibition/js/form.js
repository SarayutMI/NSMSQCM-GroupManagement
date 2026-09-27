// Entry point of index.html: loads rooms / activities / staff from the Sheet, wires the buttons.
// Load order: config.js, api.js, form-render.js, form-calc.js, form.js.

const CONFIG_CACHE_KEY = "exhibition.config.v1";

const setStatus = (msg) => ($("sheetStatus").textContent = msg);

// ---------- form data ----------

function collectFormData() {
  const data = {};
  document.querySelectorAll(".sheet input[id], .sheet select[id], .sheet textarea[id], #thaiDate").forEach((el) => {
    data[el.id] = el.value !== undefined ? el.value : el.textContent;
  });
  return data;
}

function restoreFormData(data) {
  Object.keys(data).forEach((id) => {
    const el = $(id);
    if (!el || el.readOnly || !el.matches("input, select, textarea") || data[id] === "") return;
    if (el.tagName === "SELECT" && ![...el.options].some((o) => o.value === data[id])) {
      el.appendChild(new Option(data[id], data[id]));
    }
    el.value = data[id];
  });
}

async function saveToSheet() {
  setStatus("กำลังบันทึก...");
  try {
    await postForm(collectFormData());
    setStatus("บันทึกลง Sheet แล้ว ✓");
  } catch (err) {
    setStatus("บันทึกไม่สำเร็จ: " + err.message);
  }
}

// ---------- config (rooms / activities / staff) ----------

const roomSignature = (rooms) => rooms.map((r) => [r.key, r.label, r.rounds].join(":")).join("|");

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_CACHE_KEY));
  } catch (e) {
    return null;
  }
}

function writeCache(cfg) {
  try {
    localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(cfg));
  } catch (e) {
    /* private mode / quota: the cache is only a nicety */
  }
}

/** Returns false when cfg isn't what Code.gs' config action returns (e.g. old deployment). */
function applyConfig(cfg) {
  if (!cfg || !Array.isArray(cfg.rooms) || !Array.isArray(cfg.staff)) return false;

  const typed = collectFormData();
  if (roomSignature(cfg.rooms) !== roomSignature(formRooms)) renderRooms(cfg.rooms);
  else formRooms = cfg.rooms;
  fillStaff(cfg.staff);
  fillActivities(cfg.rooms);
  restoreFormData(typed); // rooms may have been rebuilt mid-shift: put back what was typed
  recalcAll();
  return true;
}

async function loadConfig() {
  const hadCache = formRooms.length > 0;
  setStatus("กำลังโหลดรายชื่อจาก Sheet...");
  try {
    const cfg = await fetchConfig();
    if (!applyConfig(cfg)) throw new Error("ข้อมูลไม่ตรงรูปแบบ (Deploy Code.gs เวอร์ชันใหม่แล้วหรือยัง)");
    writeCache(cfg);
    setStatus("");
  } catch (err) {
    setStatus("โหลดรายชื่อจาก Sheet ไม่ได้: " + err.message + (hadCache ? " (ใช้รายการที่เก็บไว้ล่าสุด)" : ""));
    if (!hadCache) {
      $("rooms").innerHTML = '<p class="block-label">โหลดห้อง / กิจกรรมไม่สำเร็จ <button type="button" class="btn btn-secondary" id="retryBtn">ลองใหม่</button></p>';
      $("retryBtn").addEventListener("click", loadConfig);
    }
  }
}

// ---------- boot ----------

function updateThaiDate() {
  const val = $("visitDate").value;
  if (!val) { $("thaiDate").textContent = ""; return; }
  const d = new Date(val);
  $("thaiDate").textContent = `${TH_DAYS[d.getDay()]} ที่ ${d.getDate()} ${TH_MONTHS[d.getMonth()]} พ.ศ. ${d.getFullYear() + 543}`;
}

function todayStr_() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function bindEvents() {
  // any numeric edit (typed, or +/- button) recalculates everything
  document.querySelector(".sheet").addEventListener("input", (e) => {
    if (e.target.matches("[data-calc]")) recalcAll();
  });
  $("saveBtn").addEventListener("click", saveToSheet);
  $("visitDate").addEventListener("change", updateThaiDate);
}

window.addEventListener("DOMContentLoaded", () => {
  renderExhibitRows();
  addCounterButtons(document.querySelector(".sheet"));
  bindEvents();

  // ตั้งวันที่เป็นวันนี้ให้อัตโนมัติ (ถ้ามีร่างที่เคยกรอกค้างไว้ในเครื่อง จะถูกทับด้วยวันที่ในร่างอีกที)
  $("visitDate").value = todayStr_();
  updateThaiDate();

  // draw straight from the last good copy so the kiosk isn't blank while the Sheet answers
  const cached = readCache();
  if (cached) applyConfig(cached);
  updateThaiDate();
  recalcAll();
  loadConfig();
});
