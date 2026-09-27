/**
 * Google Apps Script backend for แบบบันทึกจำนวนผู้เข้าชมกิจกรรม.
 *
 * Setup:
 * 1. Create a Google Sheet (or open an existing one).
 * 2. Extensions > Apps Script, paste this whole file in as Code.gs.
 * 3. Run setupSheets() once from the editor (creates the tabs below, asks for permission).
 * 4. Deploy > New deployment > type "Web app".
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the /exec URL into WEBAPP_URL in js/config.js.
 * 6. After editing this file: Deploy > Manage deployments > Edit > New version
 *    (the /exec URL stays the same).
 *
 * Everything the pages show lives in the Sheet. Nothing is hard-coded in the HTML/JS.
 *
 *   Rooms       รหัส | ชื่อห้อง | จำนวนรอบ | สี | สถานะ
 *   Staff       ชื่อ | ประเภท (อาสา / เจ้าหน้าที่) | สถานะ
 *   Activities  ห้อง (ชื่อห้องจากแท็บ Rooms) | ชื่อกิจกรรม | สถานะ
 *   Data        one row per saved form (written by doPost)
 *
 * Add a room / person / activity by adding a row. Set สถานะ to "ซ่อน" to remove it from
 * the form dropdowns while keeping it for past dashboard data.
 * Rooms: รหัส is a short English id (a-z, 0-9) that prefixes the form fields of that room
 * (e.g. inspire_staff_1). Never change it once the room has data; ชื่อห้อง can be renamed
 * (then update the ห้อง column of that room's rows in Activities to the new name).
 * Don't rename a person/activity that already has history: Data stores the name as text.
 */

const SHEET_NAME = "Data";

const ROLES = ["อาสา", "เจ้าหน้าที่"];
const STATUS_ACTIVE = "ใช้งาน";
const STATUS_HIDDEN = "ซ่อน";
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
  "group_grand_total",
  "exhibition_grand_total",
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

// Roles are left blank on purpose: pick อาสา / เจ้าหน้าที่ in the sheet.
const DEFAULT_STAFF = [
  "นล", "อิง", "ยีน", "แนน", "เปรม", "เอิร์น", "หมอก", "ออมสิน", "วิว",
  "กระตุ้น", "เฟิร์น", "ป๊อกกี้", "เฟิร์น ชาย", "ฮาร์ทบีท", "เกียร์", "ออม",
  "นุ่น", "ครีม", "อาร์มมี่", "ไนน์", "ติณณ์", "วรรณ", "ติ้นโอ๊ค", "กอเกียร์",
  "น้ำฝน", "บอล", "พี่ปลา", "พี่โต",
];

// room code -> activity names
const DEFAULT_ACTIVITIES = {
  inspire: [
    "ใสปิ๊งไม่ทิ้งเชื้อ",
    "Bath Bomb",
    "ค้นฟ้าคว้ารุ้ง",
    "หอคอยหลากสีกับอัญมณีลึกลับ",
    "ช่อกะเฌอ เฮอร์บาเรียม",
    "ปั้นแป้ง แฝงวิทย์",
    "สติ๊กเกอร์เปลี่ยนสี",
    "ช็อกโกแลตฮาเฮ",
    "เทียนแฟนซี",
    "DIY สบู่ฝังลาย",
    "เยลลี่ไข่ปลา",
    "ไอศกรีมแสนอร่อย",
    "The Skin ดูแลแคร์ผิว",
    "ชวนกันคิดชวนกัน Code V.1",
    "ชวนกันคิดชวนกัน Code V.2",
    "ความลับของการซักผ้า",
    "DNA กล้วยๆ",
    "สถานีโยเกิร์ต",
    "หิมะจำลองและผองเพื่อน",
    "Trash to treasure จากขยะล้นโลก สู่ของโปรดชิ้นใหม่",
  ],
  innovation: [
    "แขนกลไฮดรอลิก",
    "บ้านต้านแผ่นดินไหว",
    "ยานอวกาศพิชิตภารกิจ",
    "Bug Battle Bot",
    "สร้างสรรค์จากลังกระดาษ",
    "ใบพัดจักรกล",
    "ยานน้อยลอยลม",
    "ปะติดปะต่อ ข้อต่อของฉัน",
    "DIY My Zodiac",
    "รหัสลับกับรถไฟ",
    "ฉันส่งให้เธอ LEGO STEAM Park",
    "Hydraulic Toy",
    "LED Keychain",
    "Gear Box",
    "My Robot",
    "Light Saber (ดาบแห่งแสง)",
    "เรื่องของฟันเฟือง",
    "Car racing",
    "Spinning Drum",
    "กังหันน้ำชัยพัฒนา",
  ],
};

// ---------- tabs ----------

const TABS = {
  rooms: {
    name: "Rooms",
    header: ["รหัส", "ชื่อห้อง", "จำนวนรอบ", "สี", "สถานะ"],
    seed: () => DEFAULT_ROOMS,
    validations: () => [{ col: 5, rule: listRule_([STATUS_ACTIVE, STATUS_HIDDEN]) }],
  },
  staff: {
    name: "Staff",
    header: ["ชื่อ", "ประเภท", "สถานะ"],
    seed: () => DEFAULT_STAFF.map((n) => [n, "", STATUS_ACTIVE]),
    validations: () => [
      { col: 2, rule: listRule_(ROLES) },
      { col: 3, rule: listRule_([STATUS_ACTIVE, STATUS_HIDDEN]) },
    ],
  },
  activities: {
    name: "Activities",
    header: ["ห้อง", "ชื่อกิจกรรม", "สถานะ"],
    seed: () => {
      const rows = [];
      DEFAULT_ROOMS.forEach((room) => {
        (DEFAULT_ACTIVITIES[room[0]] || []).forEach((n) => rows.push([room[1], n, STATUS_ACTIVE]));
      });
      return rows;
    },
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
}

function getTab_(key) {
  const def = TABS[key];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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

/** สร้างแท็บ Data พร้อมหัวคอลัมน์ทันทีถ้ายังไม่มี (ไม่ต้องรอฟอร์มบันทึกครั้งแรกก่อน) */
function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (sheet) return sheet;

  sheet = ss.insertSheet(SHEET_NAME);
  const header = ["timestamp"].concat(dataHeader_());
  sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight("bold");
  sheet.setFrozenRows(1);
  return sheet;
}

/** Run once from the editor: creates every tab (Rooms, Staff, Activities, Data) พร้อมหัวตาราง
 *  ครบ และ (re)applies the dropdowns — ไม่ต้องรอให้มีคนบันทึกฟอร์มก่อนแท็บถึงจะโผล่ */
function setupSheets() {
  getTab_("rooms"); // Activities' room dropdown points at it; ต้องมาก่อน getSheet_() ที่อ่านห้องจากแท็บนี้
  getSheet_();
  Object.keys(TABS).forEach((key) => applyValidations_(key, getTab_(key)));
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

function readStaff_() {
  return readRows_(getTab_("staff"), 3, 0).map((r) => {
    const role = String(r[1]).trim();
    return {
      name: String(r[0]).trim(),
      role: ROLES.indexOf(role) === -1 ? "" : role,
      active: isActive_(r[2]),
    };
  });
}

function readActivities_(rooms) {
  const keyByRoom = {};
  rooms.forEach((room) => {
    keyByRoom[room.key] = room.key;
    keyByRoom[room.label] = room.key; // ห้อง column may hold the name or the code
  });
  return readRows_(getTab_("activities"), 3, 1)
    .map((r) => ({
      room: keyByRoom[String(r[0]).trim()],
      name: String(r[1]).trim(),
      active: isActive_(r[2]),
    }))
    .filter((a) => a.room);
}

// ---------- POST: save a form ----------

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = getSheet_();

    let header = [];
    if (sheet.getLastRow() === 0) {
      header = ["timestamp", ...Object.keys(data)];
      sheet.appendRow(header);
    } else {
      header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      // append any new field the form started sending that isn't a column yet
      const missing = Object.keys(data).filter((k) => header.indexOf(k) === -1);
      if (missing.length) {
        sheet.getRange(1, header.length + 1, 1, missing.length).setValues([missing]);
        header = header.concat(missing);
      }
    }

    const row = header.map((key) =>
      key === "timestamp" ? new Date() : data[key] !== undefined ? data[key] : "",
    );
    sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }

  return json_({ ok: true });
}

// ---------- GET ----------

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
  const v = record.visitDate;
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
      const count = COUNT_SUFFIXES.reduce(
        (sum, s) => sum + (Number(record[room.key + "_" + s + "_" + i]) || 0),
        0,
      );
      if (!activity && !staff && !count) continue;
      sessions.push({
        date: date,
        room: room.key,
        activity: activity,
        staff: staff,
        role: staff ? roleByName[staff] || "" : "",
        count: count,
      });
    }
  });
  return sessions;
}

function buildDashboard_() {
  const { header, rows } = readAllRows_();
  const rooms = readRooms_();
  const staff = readStaff_();
  const fields = BASE_NUMERIC_FIELDS.concat(rooms.map((room) => room.key + "_rooms_total"));

  const roleByName = {};
  staff.forEach((s) => {
    if (!(s.name in roleByName)) roleByName[s.name] = s.role;
  });

  const daily = {};
  const sessions = [];

  rows
    .map((row) => rowToRecord_(header, row))
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
  };
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
  const result = params.action === "config" ? buildConfig_() : buildDashboard_();
  return json_(result, params.callback);
}
