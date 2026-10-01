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

/** Empties every field the user fills in (totals are recalculated, the date stays). */
function clearForm() {
  document.querySelectorAll(".sheet input[id], .sheet select[id], .sheet textarea[id]").forEach((el) => {
    if (el.id === "visitDate" || el.readOnly) return;
    el.value = "";
  });
}

// true once something is typed after the last load / save, so a date change can't silently drop it
let dirty = false;
let shownDate = "";

/** Loads what was saved for the chosen date (if anything) into the form. */
async function loadDay(date) {
  if (!date) return;
  const seq = ++loadDay.seq;
  setStatus("กำลังโหลดข้อมูลวันที่เลือกจาก Sheet...");
  try {
    const res = await fetchDay(date);
    if (seq !== loadDay.seq) return; // a newer date was picked meanwhile
    if (res.error) throw new Error(res.error);
    clearForm();
    if (res.data) {
      restoreFormData(res.data);
      setStatus(
        `โหลดข้อมูลที่บันทึกไว้แล้ว (บันทึกล่าสุด ${res.savedAt || "-"}) แก้ไขแล้วกดบันทึกเพื่ออัปเดต` +
          (res.count > 1 ? ` · ⚠ วันที่นี้มี ${res.count} แถวใน Sheet ระบบจะแก้แถวล่าสุด` : ""),
      );
    } else {
      setStatus("ยังไม่มีข้อมูลของวันที่นี้ใน Sheet");
    }
    recalcAll();
    dirty = false;
    shownDate = date;
  } catch (err) {
    if (seq === loadDay.seq) setStatus("โหลดข้อมูลวันที่นี้ไม่ได้: " + err.message);
  }
}
loadDay.seq = 0;

function onDateChange() {
  const date = $("visitDate").value;
  if (dirty && shownDate && date !== shownDate && !confirm("ข้อมูลที่กรอกไว้ยังไม่ได้บันทึก ต้องการเปลี่ยนวันที่และโหลดข้อมูลวันใหม่หรือไม่?")) {
    $("visitDate").value = shownDate;
    updateThaiDate();
    return;
  }
  updateThaiDate();
  loadDay(date);
}

async function saveToSheet() {
  setStatus("กำลังบันทึก...");
  try {
    await postForm(collectFormData());
    dirty = false;
    shownDate = $("visitDate").value;
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
    if (e.target.id !== "visitDate") dirty = true;
    if (e.target.matches("[data-calc]")) recalcAll();
  });
  document.querySelector(".sheet").addEventListener("change", (e) => {
    if (e.target.matches("select")) dirty = true;
  });
  $("saveBtn").addEventListener("click", saveToSheet);
  $("visitDate").addEventListener("change", onDateChange);
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
  // rooms first (their fields must exist), then whatever was already saved for today
  loadConfig().then(() => loadDay($("visitDate").value));
});
