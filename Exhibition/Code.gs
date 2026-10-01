/**
 * Google Apps Script backend for แบบบันทึกจำนวนผู้เข้าชมกิจกรรม.
 *
 * ใช้ Spreadsheet เดียวกับระบบ Group Management (จองห้อง) และดึงรายชื่ออ้างอิงจากชีตอ้างอิงชุดเดียวกัน
 * ⚠ ต้องเป็นโปรเจกต์ Apps Script แยกจาก Code.gs ของ Group Management (doGet/doPost ชนกันถ้าอยู่รวม)
 *
 * Setup:
 * 1. script.google.com > New project, paste this whole file in as Code.gs.
 * 2. Set DATA_SPREADSHEET_ID below to the Group Management spreadsheet ID
 *    (from its URL: https://docs.google.com/spreadsheets/d/<ID>/edit).
 * 3. Run setupSheets() once from the editor (creates the tabs below, asks for permission,
 *    including UrlFetchApp for the reference CSVs).
 * 4. Deploy > New deployment > type "Web app".
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the /exec URL into WEBAPP_URL in js/config.js.
 * 6. After editing this file: Deploy > Manage deployments > Edit > New version
 *    (the /exec URL stays the same).
 *
 * Reference lists (shared with Group Management, published CSV — edit them there):
 *   Staff_Name              Staff_Name | Role   -> every name is เจ้าหน้าที่
 *   Volunteer_Name          Volunteer_Name      -> every name is อาสา
 *   Innovation_activity     TH | ENG            -> activities of room "innovation"
 *   InspireLab_activity     TH | ENG            -> activities of room "inspire"
 *
 * Tabs this script owns in the Group Management spreadsheet:
 *   Exhibition_Rooms        รหัส | ชื่อห้อง | จำนวนรอบ | สี | สถานะ
 *   Exhibition_Volunteers   ชื่อ | สถานะ         -> extra อาสา (names already in Staff_Name / Volunteer_Name are skipped)
 *   Exhibition_Activities   ห้อง | ชื่อกิจกรรม | สถานะ  -> only rooms without a reference list
 *   Exhibition_Data         one row per saved form (written by doPost)
 *   Dashboard_Users         username | PIN ใหม่ | salt | pinHash | สถานะ | เข้าระบบล่าสุด
 *
 * Dashboard login (user + PIN):
 *   Add a user by typing a username and a PIN in "PIN ใหม่". The next login (or running
 *   hashPendingPins() from the editor) replaces it with salt + SHA-256 hash and clears the PIN.
 *   To reset a PIN, type a new one in "PIN ใหม่" again. Set สถานะ to "ระงับ" to block a user.
 *   The dashboard data (action=dashboard) needs a valid token; the form (config, getByDate, save) does not.
 *
 * Exhibition_Data keeps one row per visitDate: saving a date that already has a row overwrites
 * that row, so a past day can be loaded back into the form (action=getByDate), fixed and saved.
 *
 * Finance tab of the dashboard reads the "EMod" tab (written by E-Mod-CodeGs.gs) of the same spreadsheet.
 *
 * Add a room / volunteer / activity by adding a row. Set สถานะ to "ซ่อน" to remove it from
 * the form dropdowns while keeping it for past dashboard data.
 * Rooms: รหัส is a short English id (a-z, 0-9) that prefixes the form fields of that room
 * (e.g. inspire_staff_1). Never change it once the room has data; ชื่อห้อง can be renamed
 * (then update the ห้อง column of that room's rows in Activities to the new name).
 * Don't rename a person/activity that already has history: Data stores the name as text.
 */

// Group Management spreadsheet ID. Blank = the spreadsheet this script is bound to.
const DATA_SPREADSHEET_ID = "";

// ชีตอ้างอิงชุดเดียวกับ CONFIG ใน script.js ของ Group Management (Publish to web เป็น CSV)
const REF_STAFF_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQHwC49QdSskveBiTSa9BZLxSMEvW6wa_XUEhFQQP5jStHI-EVPGdIjG3Goo_-iNiXKJkmYevzcC2kl/pub?gid=1863604525&single=true&output=csv";
const REF_VOLUNTEER_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQHwC49QdSskveBiTSa9BZLxSMEvW6wa_XUEhFQQP5jStHI-EVPGdIjG3Goo_-iNiXKJkmYevzcC2kl/pub?gid=320745201&single=true&output=csv";
// room code -> reference activity list. Rooms not listed here use the Exhibition_Activities tab.
const REF_ACTIVITY_CSV_URLS = {
  innovation:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQHwC49QdSskveBiTSa9BZLxSMEvW6wa_XUEhFQQP5jStHI-EVPGdIjG3Goo_-iNiXKJkmYevzcC2kl/pub?gid=116326658&single=true&output=csv",
  inspire:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQHwC49QdSskveBiTSa9BZLxSMEvW6wa_XUEhFQQP5jStHI-EVPGdIjG3Goo_-iNiXKJkmYevzcC2kl/pub?gid=1497609226&single=true&output=csv",
};
const REF_CACHE_SECONDS = 300;

const SHEET_NAME = "Exhibition_Data";

const ROLE_VOLUNTEER = "อาสา";
const ROLE_STAFF = "เจ้าหน้าที่";
const STATUS_ACTIVE = "ใช้งาน";
const STATUS_HIDDEN = "ซ่อน";
const USER_SUSPENDED = "ระงับ";
const LIST_ROWS = 500; // rows that get dropdown validation

// ต้องตรงกับ js/form-render.js (WALKIN_ROWS, GROUP_ROWS) และ js/form-calc.js (EXTERNAL_IDS)
// ใช้แค่สร้างหัวคอลัมน์ของแท็บ Data ล่วงหน้าตอน setupSheets() เท่านั้น — ถ้าไม่ตรงเป๊ะ doPost()
// ก็ยังเพิ่มคอลัมน์ที่ขาดให้เองอัตโนมัติอยู่ดี (ดู "append any new field" ด้านล่าง) ไม่มีอะไรพัง
const WALKIN_ROWS = 3;
const GROUP_ROWS = 11;
const EXTERNAL_KEYS = ["walkrally", "miniplay", "other1", "other2"];

const DEFAULT_ROUNDS = 7;
const MAX_ROUNDS = 30; // rounds per room; also the upper bound when reading old rows
const COUNT_SUFFIXES = ["child_th", "adult_th", "child_intl", "adult_intl"];
const PALETTE = ["#1baf7a", "#eda100", "#d6457a", "#20a4c9", "#8a5cd6", "#e06c3c"];
// Would collide with fixed field ids of the form (group_child_1, pos_child_th, ...).
const RESERVED_ROOM_KEYS = ["walkin", "group", "exhibition", "external", "summary", "pos", "activity", "notes"];

// Rows saved before rooms moved into the Sheet used these activity field names.
const LEGACY_ACTIVITY_PREFIX = {
  inspire: "inspirelab_activity_",
  innovation: "innovationspace_activity_",
};

// Fixed (non-room) numeric fields summed for the dashboard. Room totals are added per room.
const BASE_NUMERIC_FIELDS = [
  "walkin_grand_total",
  "walkin_child_th_total",
  "walkin_adult_th_total",
  "walkin_child_intl_total",
  "walkin_adult_intl_total",
  "group_grand_total",
  "group_child_grand_total",
  "group_adult_grand_total",
  "exhibition_grand_total",
  "exhibition_total_child",
  "exhibition_total_adult",
  "external_child", // derived in withDerived_()
  "external_adult", // derived in withDerived_()
  "external_rooms_total",
  "summary_activity_total",
  "summary_AllDay_participants",
  "pos_child_th",
  "pos_adult_th",
  "pos_child_intl",
  "pos_adult_intl",
];

// ---------- seed data (only used when a tab is first created) ----------

const DEFAULT_ROOMS = [
  ["inspire", "Inspire Lab", DEFAULT_ROUNDS, "#1baf7a", STATUS_ACTIVE],
  ["innovation", "Innovation Space", DEFAULT_ROUNDS, "#eda100", STATUS_ACTIVE],
];

// ---------- tabs ----------

const TABS = {
  rooms: {
    name: "Exhibition_Rooms",
    header: ["รหัส", "ชื่อห้อง", "จำนวนรอบ", "สี", "สถานะ"],
    seed: () => DEFAULT_ROOMS,
    validations: () => [{ col: 5, rule: listRule_([STATUS_ACTIVE, STATUS_HIDDEN]) }],
  },
  volunteers: {
    name: "Exhibition_Volunteers",
    header: ["ชื่อ", "สถานะ"],
    seed: () => [],
    validations: () => [{ col: 2, rule: listRule_([STATUS_ACTIVE, STATUS_HIDDEN]) }],
  },
  activities: {
    name: "Exhibition_Activities",
    header: ["ห้อง", "ชื่อกิจกรรม", "สถานะ"],
    seed: () => [],
    validations: () => [
      {
        col: 1,
        // follows renames / new rooms in the Rooms tab
        rule: SpreadsheetApp.newDataValidation()
          .requireValueInRange(getTab_("rooms").getRange("B2:B"), true)
          .setAllowInvalid(false)
          .build(),
      },
      { col: 3, rule: listRule_([STATUS_ACTIVE, STATUS_HIDDEN]) },
    ],
  },
  users: {
    name: "Dashboard_Users",
    header: ["username", "PIN ใหม่", "salt", "pinHash", "สถานะ", "เข้าระบบล่าสุด"],
    seed: () => [],
    validations: () => [{ col: 5, rule: listRule_([STATUS_ACTIVE, USER_SUSPENDED]) }],
  },
};

function listRule_(values) {
  return SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(false)
    .build();
}

function applyValidations_(key, sheet) {
  TABS[key].validations().forEach((v) => {
    sheet.getRange(2, v.col, LIST_ROWS, 1).setDataValidation(v.rule);
  });
  // keep PINs as text so a leading 0 is not dropped (0123 -> 123)
  if (key === "users") sheet.getRange(2, 2, LIST_ROWS, 1).setNumberFormat("@");
}

let ssCache_ = null; // one openById per request

function ss_() {
  if (ssCache_) return ssCache_;
  const ss = DATA_SPREADSHEET_ID
    ? SpreadsheetApp.openById(DATA_SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("ยังไม่ได้ตั้ง DATA_SPREADSHEET_ID (สคริปต์นี้ไม่ได้ผูกกับ Spreadsheet)");
  ssCache_ = ss;
  return ss;
}

function getTab_(key) {
  const def = TABS[key];
  const ss = ss_();
  let sheet = ss.getSheetByName(def.name);
  if (sheet) return sheet;

  sheet = ss.insertSheet(def.name);
  sheet.getRange(1, 1, 1, def.header.length).setValues([def.header]).setFontWeight("bold");
  sheet.setFrozenRows(1);
  const seed = def.seed();
  if (seed.length) sheet.getRange(2, 1, seed.length, def.header.length).setValues(seed);
  applyValidations_(key, sheet);
  sheet.autoResizeColumns(1, def.header.length);
  return sheet;
}

/** ลำดับคอลัมน์ที่แท็บ Data ควรมี คำนวณจากห้อง/รอบจริงในแท็บ Rooms ตอนนั้น
 *  (ไม่รวม "timestamp" — ใส่ต่อท้ายเองตอนเขียนหัวตาราง) */
function dataHeader_() {
  const fields = ["visitDate", "thaiDate"];

  for (let i = 1; i <= WALKIN_ROWS; i++) {
    COUNT_SUFFIXES.forEach((c) => fields.push(`walkin_${c}_${i}`));
  }
  COUNT_SUFFIXES.forEach((c) => fields.push(`walkin_${c}_total`));
  fields.push("walkin_child_grand_total", "walkin_adult_grand_total", "walkin_grand_total");

  for (let i = 1; i <= GROUP_ROWS; i++) {
    fields.push(`group_school_${i}`, `group_child_${i}`, `group_adult_${i}`);
  }
  fields.push("group_child_total", "group_adult_total", "group_child_grand_total", "group_adult_grand_total", "group_grand_total");

  fields.push("exhibition_total_child", "exhibition_total_adult", "exhibition_grand_total");

  readRooms_().forEach((room) => {
    for (let i = 1; i <= room.rounds; i++) {
      fields.push(`${room.key}_activity_${i}`, `${room.key}_staff_${i}`);
      COUNT_SUFFIXES.forEach((c) => fields.push(`${room.key}_${c}_${i}`));
      fields.push(`${room.key}_school_${i}`);
    }
    COUNT_SUFFIXES.forEach((c) => fields.push(`${room.key}_${c}_total`));
    fields.push(`${room.key}_child_total`, `${room.key}_adult_total`, `${room.key}_rooms_total`);
  });

  EXTERNAL_KEYS.forEach((k) => fields.push(`activity_${k}_child`, `activity_${k}_adult`));
  fields.push("external_rooms_total", "pos_child_th", "pos_adult_th", "pos_child_intl", "pos_adult_intl");
  fields.push("summary_activity_total", "summary_AllDay_participants");
  fields.push("notes");
  return fields;
}

/** สร้างแท็บ Data พร้อมหัวคอลัมน์ทันทีถ้ายังไม่มี (ไม่ต้องรอฟอร์มบันทึกครั้งแรกก่อน)
 *  แท็บมีอยู่แล้วแต่ว่างเปล่า (เช่นมีคนลบทุกแถวทิ้ง) ก็เขียนหัวคอลัมน์ให้ใหม่เหมือนกัน */
function getSheet_() {
  const ss = ss_();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (sheet && sheet.getLastRow() > 0) return sheet;

  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  const header = ["timestamp"].concat(dataHeader_());
  sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight("bold");
  sheet.setFrozenRows(1);
  return sheet;
}

/** Run once from the editor: creates every tab (Exhibition_Rooms/Volunteers/Activities/Data) พร้อมหัวตาราง
 *  ครบ และ (re)applies the dropdowns — ไม่ต้องรอให้มีคนบันทึกฟอร์มก่อนแท็บถึงจะโผล่ */
function setupSheets() {
  getTab_("rooms"); // Activities' room dropdown points at it; ต้องมาก่อน getSheet_() ที่อ่านห้องจากแท็บนี้
  getSheet_();
  Object.keys(TABS).forEach((key) => applyValidations_(key, getTab_(key)));
  hashPendingPins();
}

// ---------- read the config tabs ----------

/** Rows below the header whose column `nameCol` is not blank. */
function readRows_(sheet, cols, nameCol) {
  if (sheet.getLastRow() < 2) return [];
  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, cols)
    .getValues()
    .filter((r) => String(r[nameCol]).trim() !== "");
}

const isActive_ = (v) => String(v).trim() !== STATUS_HIDDEN;

/** All rooms in sheet order, hidden ones included (their history still needs a label). */
function readRooms_() {
  const seen = {};
  const rooms = [];
  readRows_(getTab_("rooms"), 5, 0).forEach((r) => {
    const key = String(r[0]).trim().toLowerCase();
    const label = String(r[1]).trim();
    if (!/^[a-z][a-z0-9]*$/.test(key) || RESERVED_ROOM_KEYS.indexOf(key) !== -1) return;
    if (!label || seen[key]) return;
    seen[key] = true;
    const rounds = Math.round(Number(r[2]));
    const color = String(r[3]).trim();
    rooms.push({
      key: key,
      label: label,
      rounds: rounds >= 1 ? Math.min(rounds, MAX_ROUNDS) : DEFAULT_ROUNDS,
      color: /^#[0-9a-f]{6}$/i.test(color) ? color : PALETTE[rooms.length % PALETTE.length],
      active: isActive_(r[4]),
    });
  });
  return rooms;
}

/** Data rows (header skipped) of a published reference CSV, cached for REF_CACHE_SECONDS. */
function readRefCsv_(url) {
  const cache = CacheService.getScriptCache();
  let text = cache.get(url);
  if (text === null) {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return [];
    text = res.getContentText("UTF-8");
    try {
      cache.put(url, text, REF_CACHE_SECONDS);
    } catch (err) {
      // over the 100KB cache limit: just skip caching
    }
  }
  return Utilities.parseCsv(text)
    .slice(1)
    .filter((r) => clean_(r[0]) !== "");
}

/** Staff_Name (reference) = เจ้าหน้าที่, then Volunteer_Name (reference) and Exhibition_Volunteers = อาสา. */
function readStaff_() {
  const seen = {};
  const staff = [];
  readRefCsv_(REF_STAFF_CSV_URL).forEach((r) => {
    const name = clean_(r[0]);
    if (seen[name]) return;
    seen[name] = true;
    staff.push({ name: name, role: ROLE_STAFF, active: true });
  });
  readRefCsv_(REF_VOLUNTEER_CSV_URL).forEach((r) => {
    const name = clean_(r[0]);
    if (seen[name]) return;
    seen[name] = true;
    staff.push({ name: name, role: ROLE_VOLUNTEER, active: true });
  });
  readRows_(getTab_("volunteers"), 2, 0).forEach((r) => {
    const name = clean_(r[0]);
    if (seen[name]) return;
    seen[name] = true;
    staff.push({ name: name, role: ROLE_VOLUNTEER, active: isActive_(r[1]) });
  });
  return staff;
}

function readActivities_(rooms) {
  const keyByRoom = {};
  rooms.forEach((room) => {
    keyByRoom[room.key] = room.key;
    keyByRoom[room.label] = room.key; // ห้อง column may hold the name or the code
  });
  const local = readRows_(getTab_("activities"), 3, 1)
    .map((r) => ({
      room: keyByRoom[String(r[0]).trim()],
      name: String(r[1]).trim(),
      active: isActive_(r[2]),
    }))
    .filter((a) => a.room && !REF_ACTIVITY_CSV_URLS[a.room]);

  const ref = [];
  rooms.forEach((room) => {
    const url = REF_ACTIVITY_CSV_URLS[room.key];
    if (!url) return;
    readRefCsv_(url).forEach((r) => ref.push({ room: room.key, name: clean_(r[0]), active: true }));
  });
  return ref.concat(local);
}

// ---------- POST: save a form ----------

// Form field ids look like walkin_child_th_1 / inspire_staff_3; anything else is not a column.
const FIELD_KEY_RE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ error: "invalid JSON body" });
  }
  if (data && data.action === "login") {
    try {
      return json_(login_(data.username, data.pin));
    } catch (err) {
      return json_({ error: err.message });
    }
  }
  const keys = Object.keys(data).filter((k) => k !== "timestamp" && FIELD_KEY_RE.test(k));

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = getSheet_();

    let header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    // append any new field the form started sending that isn't a column yet (e.g. a new room)
    const missing = keys.filter((k) => header.indexOf(k) === -1);
    if (missing.length) {
      sheet.getRange(1, header.length + 1, 1, missing.length).setValues([missing]).setFontWeight("bold");
      header = header.concat(missing);
    }

    // one row per visitDate: saving a day that already has a row overwrites it (the latest one)
    const target = findDayRow_(sheet, header, data.visitDate);
    const existing = target === -1 ? [] : sheet.getRange(target, 1, 1, header.length).getValues()[0];
    const row = header.map((key, i) => {
      if (key === "timestamp") return new Date();
      if (data[key] !== undefined) return data[key];
      return existing[i] !== undefined ? existing[i] : ""; // e.g. a room hidden since: keep its old numbers
    });
    if (target === -1) sheet.appendRow(row);
    else sheet.getRange(target, 1, 1, row.length).setValues([row]);
  } finally {
    lock.releaseLock();
  }

  return json_({ ok: true });
}

/** Sheet row number of the latest Data row saved for `date` (YYYY-MM-DD), or -1. */
function findDayRow_(sheet, header, date) {
  const want = toDateString_({ visitDate: date });
  const col = header.indexOf("visitDate");
  if (!want || col === -1 || sheet.getLastRow() < 2) return -1;
  const values = sheet.getRange(2, col + 1, sheet.getLastRow() - 1, 1).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    if (toDateString_({ visitDate: values[i][0] }) === want) return i + 2;
  }
  return -1;
}

// ---------- GET ----------

/** The saved form of one day, as {field id: text} for the form to fill back in. */
function readDay_(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return { error: "วันที่ไม่ถูกต้อง" };
  const { header, rows } = readAllRows_();
  const col = header.indexOf("visitDate");
  const matches = col === -1 ? [] : rows.filter((r) => toDateString_({ visitDate: r[col] }) === date);
  if (!matches.length) return { data: null, count: 0 };

  const row = matches[matches.length - 1];
  const tz = ss_().getSpreadsheetTimeZone();
  const data = {};
  let savedAt = "";
  header.forEach((key, i) => {
    if (!key) return;
    let v = row[i];
    if (key === "timestamp") {
      savedAt = v instanceof Date ? Utilities.formatDate(v, tz, "yyyy-MM-dd HH:mm") : String(v);
      return;
    }
    if (key === "visitDate") v = date;
    else if (v instanceof Date) v = Utilities.formatDate(v, tz, "yyyy-MM-dd");
    data[key] = v === null || v === undefined ? "" : String(v);
  });
  return { data: data, count: matches.length, savedAt: savedAt };
}

function readAllRows_() {
  const sheet = getSheet_();
  if (sheet.getLastRow() < 2) return { header: [], rows: [] };
  const values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  const header = values.shift();
  return { header, rows: values };
}

function rowToRecord_(header, row) {
  const rec = {};
  header.forEach((key, i) => {
    rec[key] = row[i];
  });
  return rec;
}

function toDateString_(record) {
  // visitDate comes from <input type="date"> as "YYYY-MM-DD" string, but the
  // Sheet may also store it as a real Date if Sheets auto-converted it.
  // Format in the spreadsheet's timezone (the one Sheets used to convert it) so the day never shifts.
  // Also accepts text typed straight into the Sheet: 2026-9-30, 30/9/2026, 30/09/2569 (พ.ศ.).
  const v = record.visitDate;
  if (!v) return null;
  const pad = (n) => String(n).padStart(2, "0");
  const ce = (y) => (y > 2400 ? y - 543 : y); // พ.ศ. -> ค.ศ.
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    const out = Utilities.formatDate(v, ss_().getSpreadsheetTimeZone(), "yyyy-MM-dd");
    const y = Number(out.slice(0, 4));
    return y > 2400 ? ce(y) + out.slice(4) : out;
  }
  const t = String(v).trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${ce(+m[1])}-${pad(m[2])}-${pad(m[3])}`;
  m = t.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (m) return `${ce(+m[3])}-${pad(m[2])}-${pad(m[1])}`;
  const d = new Date(t);
  if (isNaN(d.getTime())) return null;
  return Utilities.formatDate(d, ss_().getSpreadsheetTimeZone(), "yyyy-MM-dd");
}

function emptyTotals_(fields) {
  const t = {};
  fields.forEach((f) => (t[f] = 0));
  t.records = 0;
  return t;
}

function addTotals_(target, record, fields) {
  fields.forEach((f) => {
    target[f] += Number(record[f]) || 0;
  });
  target.records += 1;
}

// Old form data has a zero-width space inside "The Skin ​ดูแลแคร์ผิว"; strip it so names match.
function clean_(v) {
  return String(v || "").replace(/​/g, "").trim();
}

/** One entry per (room, round row) that has an activity, a staff or a headcount. */
function extractSessions_(record, date, rooms, roleByName) {
  const sessions = [];
  rooms.forEach((room) => {
    const legacy = LEGACY_ACTIVITY_PREFIX[room.key];
    for (let i = 1; i <= MAX_ROUNDS; i++) {
      const activity = clean_(record[room.key + "_activity_" + i] || (legacy ? record[legacy + i] : ""));
      const staff = clean_(record[room.key + "_staff_" + i]);
      const byCat = {};
      COUNT_SUFFIXES.forEach((s) => (byCat[s] = Number(record[room.key + "_" + s + "_" + i]) || 0));
      const count = COUNT_SUFFIXES.reduce((sum, s) => sum + byCat[s], 0);
      if (!activity && !staff && !count) continue;
      sessions.push(
        Object.assign(
          {
            date: date,
            room: room.key,
            activity: activity,
            staff: staff,
            role: staff ? roleByName[staff] || "" : "",
            count: count,
          },
          byCat,
        ),
      );
    }
  });
  return sessions;
}

function buildDashboard_() {
  const { header, rows } = readAllRows_();
  const rooms = readRooms_();
  const staff = readStaff_();
  const fields = BASE_NUMERIC_FIELDS.concat(
    ...rooms.map((room) => [room.key + "_rooms_total"].concat(COUNT_SUFFIXES.map((c) => `${room.key}_${c}_total`))),
  );

  const roleByName = {};
  staff.forEach((s) => {
    if (!(s.name in roleByName)) roleByName[s.name] = s.role;
  });

  const daily = {};
  const sessions = [];

  rows
    .map((row) => withDerived_(rowToRecord_(header, row), rooms))
    .forEach((record) => {
      const date = toDateString_(record);
      if (!date) return;
      if (!daily[date]) daily[date] = emptyTotals_(fields);
      addTotals_(daily[date], record, fields);
      extractSessions_(record, date, rooms, roleByName).forEach((s) => sessions.push(s));
    });

  return {
    rooms: rooms.map((r) => ({ key: r.key, label: r.label, color: r.color, active: r.active })),
    daily: Object.keys(daily)
      .sort()
      .map((date) => Object.assign({ date: date }, daily[date])),
    sessions: sessions,
    staff: staff,
    finance: readFinance_(),
  };
}

/** Fields the dashboard needs that the form does not save directly (or old rows lack). */
function withDerived_(record, rooms) {
  record.external_child = EXTERNAL_KEYS.reduce((a, k) => a + (Number(record[`activity_${k}_child`]) || 0), 0);
  record.external_adult = EXTERNAL_KEYS.reduce((a, k) => a + (Number(record[`activity_${k}_adult`]) || 0), 0);
  // room totals per category, from the round rows (old rows have no hidden *_total inputs)
  rooms.forEach((room) => {
    COUNT_SUFFIXES.forEach((c) => {
      let sum = 0;
      for (let i = 1; i <= MAX_ROUNDS; i++) sum += Number(record[`${room.key}_${c}_${i}`]) || 0;
      record[`${room.key}_${c}_total`] = sum;
    });
  });
  return record;
}

/** Revenue of every E-Mod report: [{date, revenue: {channel: {section: amount}}}]. */
function readFinance_() {
  const sheet = ss_().getSheetByName("EMod");
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const header = values.shift();
  const dateCol = header.indexOf("date");
  const revCol = header.indexOf("revenueJson");
  if (dateCol === -1 || revCol === -1) return [];
  const tz = ss_().getSpreadsheetTimeZone();
  const out = [];
  values.forEach((row) => {
    const v = row[dateCol];
    const date = v instanceof Date ? Utilities.formatDate(v, tz, "yyyy-MM-dd") : String(v).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    let revenue = null;
    try {
      revenue = JSON.parse(row[revCol] || "null");
    } catch (err) {
      revenue = null;
    }
    if (revenue && typeof revenue === "object") out.push({ date: date, revenue: revenue });
  });
  return out;
}

/** Lists for the form: only active entries. */
function buildConfig_() {
  const rooms = readRooms_().filter((r) => r.active);
  const activities = readActivities_(rooms).filter((a) => a.active);
  return {
    rooms: rooms.map((room) => ({
      key: room.key,
      label: room.label,
      rounds: room.rounds,
      color: room.color,
      activities: activities.filter((a) => a.room === room.key).map((a) => a.name),
    })),
    staff: readStaff_()
      .filter((s) => s.active)
      .map((s) => ({ name: s.name, role: s.role })),
  };
}

function json_(obj, callback) {
  const body = JSON.stringify(obj);
  return callback
    ? ContentService.createTextOutput(`${callback}(${body})`).setMimeType(ContentService.MimeType.JAVASCRIPT)
    : ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  const callback = /^[A-Za-z_$][\w$.]{0,63}$/.test(params.callback || "") ? params.callback : null;
  try {
    if (params.action === "config") return json_(buildConfig_(), callback);
    if (params.action === "getByDate") return json_(readDay_(params.date), callback);
    if (!verifyToken_(params.token)) return json_({ error: "unauthorized" }, callback);
    return json_(buildDashboard_(), callback);
  } catch (err) {
    return json_({ error: err.message }, callback);
  }
}

// ---------- dashboard login ----------

const PIN_HASH_ROUNDS = 1000;
const TOKEN_HOURS = 12;
const LOGIN_MAX_FAILS = 5; // per username, then locked for LOGIN_LOCK_SECONDS
const LOGIN_LOCK_SECONDS = 900;

function hex_(bytes) {
  return bytes.map((b) => ((b + 256) % 256).toString(16).padStart(2, "0")).join("");
}

function pinHash_(salt, pin) {
  let h = salt + ":" + pin;
  for (let i = 0; i < PIN_HASH_ROUNDS; i++) {
    h = hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h, Utilities.Charset.UTF_8));
  }
  return h;
}

/** Run from the editor (or automatically on login): hash every PIN typed in "PIN ใหม่", then clear it. */
function hashPendingPins() {
  const sheet = getTab_("users");
  if (sheet.getLastRow() < 2) return;
  const range = sheet.getRange(2, 2, sheet.getLastRow() - 1, 3); // PIN ใหม่ | salt | pinHash
  const rows = range.getValues();
  let changed = false;
  rows.forEach((r) => {
    const pin = String(r[0]).trim();
    if (!pin) return;
    const salt = Utilities.getUuid();
    r[0] = "";
    r[1] = salt;
    r[2] = pinHash_(salt, pin);
    changed = true;
  });
  if (changed) range.setValues(rows);
}

function findUser_(sheet, username) {
  if (sheet.getLastRow() < 2) return null;
  const want = username.toLowerCase();
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (String(r[0]).trim().toLowerCase() !== want) continue;
    return {
      row: i + 2,
      name: String(r[0]).trim(),
      salt: String(r[2]),
      hash: String(r[3]),
      active: String(r[4]).trim() !== USER_SUSPENDED,
    };
  }
  return null;
}

function login_(username, pin) {
  const name = String(username || "").trim();
  pin = String(pin || "").trim();
  if (!name || !pin) return { error: "กรุณากรอกชื่อผู้ใช้และ PIN" };

  const cache = CacheService.getScriptCache();
  const failKey = "loginfail_" + name.toLowerCase();
  const fails = Number(cache.get(failKey)) || 0;
  if (fails >= LOGIN_MAX_FAILS) return { error: "ใส่ PIN ผิดหลายครั้ง กรุณารอ 15 นาทีแล้วลองใหม่" };

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = getTab_("users");
    hashPendingPins();
    const user = findUser_(sheet, name);
    if (!user || !user.active || !user.hash || pinHash_(user.salt, pin) !== user.hash) {
      cache.put(failKey, String(fails + 1), LOGIN_LOCK_SECONDS);
      return { error: "ชื่อผู้ใช้หรือ PIN ไม่ถูกต้อง" };
    }
    cache.remove(failKey);
    sheet.getRange(user.row, 6).setValue(new Date());
    return { token: makeToken_(user.name), user: user.name };
  } finally {
    lock.releaseLock();
  }
}

/** HMAC secret, generated once and kept in Script Properties (never sent to the browser). */
function authSecret_() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty("AUTH_SECRET");
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty("AUTH_SECRET", secret);
  }
  return secret;
}

function sign_(payload) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, authSecret_()));
}

function makeToken_(username) {
  const payload = Utilities.base64EncodeWebSafe(
    JSON.stringify({ u: username, exp: Date.now() + TOKEN_HOURS * 3600 * 1000 }),
    Utilities.Charset.UTF_8,
  );
  return payload + "." + sign_(payload);
}

/** Username of a valid, unexpired token whose user is still active; otherwise null. */
function verifyToken_(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || sign_(parts[0]) !== parts[1]) return null;
  let data;
  try {
    data = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString("UTF-8"));
  } catch (err) {
    return null;
  }
  if (!data || !data.u || !(data.exp > Date.now())) return null;
  const user = findUser_(getTab_("users"), String(data.u));
  return user && user.active ? user.name : null;
}
