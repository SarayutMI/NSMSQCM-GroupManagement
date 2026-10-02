// Builds the repeated parts of the form: walk-in / group rows, one block per room,
// and the staff / activity dropdowns. Rooms and names come from the Sheet (see api.js).
// Field ids are the column names in the Data tab, so keep them stable.

const WALKIN_ROWS = 3;
const GROUP_ROWS = 11;
const COUNT_COLS = ["child_th", "adult_th", "child_intl", "adult_intl"];
const COUNT_HEADS = ["เด็กไทย", "ผู้ใหญ่ไทย", "เด็กต่างชาติ", "ผู้ใหญ่ต่างชาติ"];

// Rooms currently drawn: [{key, label, rounds, color, activities}]
let formRooms = [];

// data-calc: any edit to this input recalculates every total (form-calc.js)
const numCell = (id) => `<td><input type="text" id="${id}" placeholder="0" inputmode="none" data-calc /></td>`;
// ชื่อโรงเรียน: ช่องข้อความธรรมดา ล้อไปตามฟิลด์เดียวกันใน E-Mod (ไม่ต้อง data-calc เพราะไม่ใช่ตัวเลข)
// ใช้คลาส "wide" ที่มีอยู่แล้วใน form.css (ชิดซ้าย ไม่จำกัดความกว้างเหมือนช่องตัวเลข)
const schoolCell = (id) => `<input type="text" id="${id}" class="wide" placeholder="ชื่อโรงเรียน">`;

function renderExhibitRows() {
  let walkin = "";
  for (let i = 1; i <= WALKIN_ROWS; i++) {
    walkin += `<tr>${COUNT_COLS.map((c) => numCell(`walkin_${c}_${i}`)).join("")}</tr>`;
  }
  $("walkin-rows").innerHTML = walkin;

  let group = "";
  for (let i = 1; i <= GROUP_ROWS; i++) {
    group += `<tr><td>${schoolCell("group_school_" + i)}</td>${numCell("group_child_" + i)}${numCell("group_adult_" + i)}</tr>`;
  }
  $("group-rows").innerHTML = group;
}

// ---------- กิจกรรมอื่นๆ (ชุดเดียวกับ E-Mod: 4 รายการล็อก + ตั้งชื่อเอง 2 แถว) ----------
// key = ส่วนของ id ช่องกรอก: activity_<key>_w_<count>, activity_<key>_g_<count>, activity_<key>_school,
// activity_<key>_name (เฉพาะแถวตั้งชื่อเอง) และยอดรวม activity_<key>_child / _adult (คำนวณให้)
const EXTERNAL_ACTIVITIES = [
  { key: "walkrally", label: "Walk Rally" },
  { key: "dontmiss", label: "Don't Miss" },
  { key: "iscream", label: "I-Scream" },
  { key: "miniplay", label: "Mini Make & Play" },
  { key: "other1", label: null },
  { key: "other2", label: null },
];
const EXT_SIDES = [["w", "Walk-in"], ["g", "Group"]];

function renderExternal() {
  const head2 = EXT_SIDES.map(() => COUNT_HEADS.map((h) => `<th>${h}</th>`).join("")).join("");
  const rows = EXTERNAL_ACTIVITIES.map((a) => {
    const name = a.label
      ? `<td class="rowlabel">${esc(a.label)}</td>`
      : `<td><input type="text" id="activity_${a.key}_name" class="wide" placeholder="กิจกรรมอื่น (กรอกชื่อ)"></td>`;
    const cells = EXT_SIDES.map(([s]) => COUNT_COLS.map((c) => numCell(`activity_${a.key}_${s}_${c}`)).join("")).join("");
    return `<tr>${name}${cells}<td>${schoolCell(`activity_${a.key}_school`)}</td></tr>`;
  }).join("");
  $("external-detail").innerHTML = `<table class="ext-table">
      <thead>
        <tr><th class="rowlabel" rowspan="2">กิจกรรม</th>${EXT_SIDES.map(([, l]) => `<th colspan="4">${l}</th>`).join("")}<th class="rowlabel" rowspan="2">ชื่อโรงเรียน</th></tr>
        <tr>${head2}</tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  // สรุปต่อกิจกรรม (เห็นทั้งบนจอและตอนพิมพ์ — ตอนพิมพ์ใช้ตารางนี้แทนตารางเต็มให้จบในหน้าเดียว)
  $("external-summary").innerHTML = `<table>
      <thead><tr><th class="rowlabel">กิจกรรม</th><th>เด็ก</th><th>ผู้ใหญ่</th></tr></thead>
      <tbody>
        ${EXTERNAL_ACTIVITIES.map((a) => `<tr>
          <td class="rowlabel" ${a.label ? "" : `id="activity_${a.key}_label"`}>${a.label ? esc(a.label) : "กิจกรรมอื่น"}</td>
          <td><input type="text" id="activity_${a.key}_child" class="tag-gray" placeholder="0" readonly /></td>
          <td><input type="text" id="activity_${a.key}_adult" class="tag-gray" placeholder="0" readonly /></td></tr>`).join("")}
        <tr class="total-room">
          <td class="rowlabel">รวมยอด External Activity</td>
          <td colspan="2"><input type="text" id="external_rooms_total" class="val-lg tag-blue" placeholder="0" readonly /></td>
        </tr>
      </tbody>
    </table>`;
}

/** ข้อมูลที่บันทึกก่อนมีตารางเต็ม (มีแค่ activity_<key>_child/_adult): ย้ายเข้าช่องใหม่ตอนโหลด
    ยอดเด็ก → Walk-in เด็กไทย, ผู้ใหญ่ → Walk-in ผู้ใหญ่ไทย; แถวเดิม "other1" คือ Don't Miss, "other2" คือ กิจกรรมอื่นๆ */
function migrateLegacyExternal(data) {
  if (!data || Object.keys(data).some((k) => /^activity_[a-z0-9]+_[wg]_/.test(k))) return data;
  const out = Object.assign({}, data);
  const move = { walkrally: "walkrally", miniplay: "miniplay", other1: "dontmiss", other2: "other1" };
  Object.keys(move).forEach((old) => {
    const c = out[`activity_${old}_child`], a = out[`activity_${old}_adult`];
    delete out[`activity_${old}_child`];
    delete out[`activity_${old}_adult`];
    const to = move[old];
    if (c !== undefined && c !== "") out[`activity_${to}_w_child_th`] = c;
    if (a !== undefined && a !== "") out[`activity_${to}_w_adult_th`] = a;
    if (old === "other2" && ((c && Number(c)) || (a && Number(a)))) out.activity_other1_name = out.activity_other1_name || "กิจกรรมอื่นๆ";
  });
  return out;
}

function roomBlock(room) {
  const k = room.key;
  let rows = "";
  for (let i = 1; i <= room.rounds; i++) {
    rows += `<tr>
      <td><select id="${k}_activity_${i}" class="activity-select" data-room="${k}"></select></td>
      <td><select id="${k}_staff_${i}" class="staff-select"></select></td>
      ${COUNT_COLS.map((c) => numCell(`${k}_${c}_${i}`)).join("")}
      <td>${schoolCell(`${k}_school_${i}`)}</td>
    </tr>`;
  }
  // th/intl subtotals feed the POS box; kept as hidden inputs so they are saved too
  const hidden = COUNT_COLS.map((c) => `<input type="hidden" id="${k}_${c}_total" />`).join("");
  return `<div class="sub-bento" data-room="${k}">
    <div class="lab-head"><span class="name">${esc(room.label)}</span><span class="tag">กิจกรรม</span></div>
    <table>
      <thead>
        <tr>
          <th class="rowlabel">เรื่อง</th>
          <th class="rowlabel">ผู้ดำเนินกิจกรรม</th>
          ${COUNT_HEADS.map((h) => `<th>${h}</th>`).join("")}
          <th class="rowlabel">ชื่อโรงเรียน</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tbody>
        <tr class="total">
          <td class="rowlabel">รวมยอด</td>
          <td></td>
          <td class="rowlabel">รวมยอดเด็ก</td>
          <td><input type="text" id="${k}_child_total" class="tag-gray" readonly /></td>
          <td class="rowlabel">รวมยอดผู้ใหญ่</td>
          <td><input type="text" id="${k}_adult_total" class="tag-gray" readonly /></td>
          <td></td>
        </tr>
        <tr class="total-room">
          <td class="rowlabel">รวมยอดห้อง ${esc(room.label)} ทั้งหมด</td>
          <td colspan="6"><input type="text" id="${k}_rooms_total" class="val-lg tag-blue" readonly /></td>
        </tr>
      </tbody>
    </table>
    ${hidden}
  </div>`;
}

/** Draws one block per room. Wipes what was typed in the room blocks: see applyConfig(). */
function renderRooms(rooms) {
  formRooms = rooms;
  $("rooms").innerHTML = rooms.length
    ? rooms.map(roomBlock).join("")
    : '<p class="block-label">ยังไม่มีห้องที่ใช้งาน: เพิ่มห้องในแท็บ Exhibition_Rooms ของ Google Sheet</p>';
  addCounterButtons($("rooms"));
}

// ---------- dropdowns ----------

/** Rebuilds a <select>, keeping a picked value even if it is no longer in the list (e.g. hidden since). */
function fillSelect(select, build) {
  const current = select.value;
  select.innerHTML = '<option value="">-----</option>';
  build(select);
  if (!current) return;
  if (![...select.options].some((o) => o.value === current)) {
    select.appendChild(new Option(current, current));
  }
  select.value = current;
}

/** staff: [{name, role}]. Grouped by role (อาสา / เจ้าหน้าที่) once any role is set in the Sheet. */
function fillStaff(staff) {
  const hasRoles = staff.some((s) => s.role);
  const groups = hasRoles
    ? [...ROLES, ""].map((role) => ({
        label: role || "ยังไม่ระบุประเภท",
        members: staff.filter((s) => s.role === role),
      }))
    : [{ label: "", members: staff }];

  document.querySelectorAll(".staff-select").forEach((select) => {
    fillSelect(select, (sel) => {
      groups.forEach((g) => {
        if (!g.members.length) return;
        let parent = sel;
        if (g.label) {
          parent = document.createElement("optgroup");
          parent.label = g.label;
          sel.appendChild(parent);
        }
        g.members.forEach((m) => parent.appendChild(new Option(m.name, m.name)));
      });
    });
  });
}

function fillActivities(rooms) {
  rooms.forEach((room) => {
    document.querySelectorAll(`.activity-select[data-room="${room.key}"]`).forEach((select) => {
      fillSelect(select, (sel) => room.activities.forEach((name) => sel.appendChild(new Option(name, name))));
    });
  });
}

// ---------- +/- buttons next to numeric cells ----------

function addCounterButtons(root) {
  root.querySelectorAll("input[data-calc]:not([readonly])").forEach((inp) => {
    if (inp.closest(".counter")) return;

    const wrap = document.createElement("span");
    wrap.className = "counter";
    inp.parentNode.insertBefore(wrap, inp);
    wrap.appendChild(inp);

    const steps = document.createElement("span");
    steps.className = "counter-steps";
    const mkBtn = (cls, text, label, delta) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "counter-btn " + cls;
      b.textContent = text;
      b.setAttribute("aria-label", label);
      b.tabIndex = -1;
      b.addEventListener("click", (e) => {
        e.preventDefault();
        inp.value = Math.max(0, (parseInt(inp.value) || 0) + delta);
        inp.dispatchEvent(new Event("input", { bubbles: true }));
      });
      return b;
    };
    steps.appendChild(mkBtn("counter-up", "+", "เพิ่ม", 1));
    steps.appendChild(mkBtn("counter-down", "−", "ลด", -1));
    wrap.appendChild(steps);
  });
}
