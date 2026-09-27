/* =========================================================
   E-Mod — รายงานประจำวัน MOD (Manager On Duty)
   - ถ้า CONFIG.API_URL ว่างไว้: บันทึกลง localStorage เครื่องเดียว (โหมดทดลอง)
   - ถ้าใส่ URL ของ Web App ที่ deploy จาก E-Mod-CodeGs.gs: บันทึกลง Google Sheet จริง
   - รายชื่อพนักงาน (ผู้บันทึก/ผู้แก้ไข) ดึงจากชีตอ้างอิงเดียวกับระบบจองห้อง (แท็บ Staff_Name)
   ========================================================= */
const CONFIG = {
  API_URL: '', // <-- ใส่ URL ของ Google Apps Script Web App (จาก E-Mod-CodeGs.gs) ที่นี่
  STAFF_CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHwC49QdSskveBiTSa9BZLxSMEvW6wa_XUEhFQQP5jStHI-EVPGdIjG3Goo_-iNiXKJkmYevzcC2kl/pub?gid=1863604525&single=true&output=csv'
};

/* ---------------- โครงสร้าง Zone ของ Evening Briefing ---------------- */
const ZONES = [
  { group: 'Visitor Service', id: 'vsCounter2', name: 'เคาน์เตอร์ ชั้น 2', duty: 'ต้อนรับและแนะนำ Visitors' },
  { group: 'Visitor Service', id: 'vsCounter1', name: 'เคาน์เตอร์ ชั้น 1', duty: 'แนะนำกิจกรรมและการขาย' },
  { group: 'Exhibition', id: 'exZone1', name: 'Zone 1 เปิดโลกอาชีพ', duty: 'ดูแลชิ้นงานและ Visitors' },
  { group: 'Exhibition', id: 'exZone2', name: 'Zone 2 เปิดโลกทางการแพทย์', duty: 'ดูแลชิ้นงานและ Visitors' },
  { group: 'Exhibition', id: 'exZone3', name: 'Zone 3 ฐานปฏิบัติการภัยพิบัติ', duty: 'ดูแลชิ้นงานและ Visitors' },
  { group: 'Exhibition', id: 'exZone4', name: 'Zone 4 การบินและอวกาศ', duty: 'ดูแลชิ้นงานและ Visitors' },
  { group: 'Exhibition', id: 'exTemp', name: 'นิทรรศการชั่วคราว', duty: 'ดูแลชิ้นงานและ Visitors' },
  { group: 'Education Programs', id: 'eduInspire', name: 'Inspire Lab', duty: 'ผู้ช่วยกิจกรรม' },
  { group: 'Education Programs', id: 'eduInno', name: 'Innovation Space', duty: 'ผู้ช่วยกิจกรรม' },
  { group: 'Education Programs', id: 'eduMini', name: 'Mini Make & Play', duty: 'ผู้ช่วยกิจกรรม' },
  { group: 'Education Programs', id: 'eduIScream', name: 'I-Scream', duty: 'ผู้ช่วยกิจกรรม' },
  { group: 'Education Programs', id: 'eduOther', name: '', duty: '', editableName: true }
];

const EX_COUNT_FIELDS = [
  { key: 'childTh', label: 'เด็กไทย' }, { key: 'adultTh', label: 'ผู้ใหญ่ไทย' },
  { key: 'childFor', label: 'เด็กต่างชาติ' }, { key: 'adultFor', label: 'ผู้ใหญ่ต่างชาติ' },
  { key: 'senior', label: 'ผู้สูงอายุ' }
];
const ROUND_COLS = ['childTh', 'adultTh', 'childFor', 'adultFor'];
const OTHER_COLS = ['w_childTh', 'w_adultTh', 'w_childFor', 'w_adultFor', 'g_childTh', 'g_adultTh', 'g_childFor', 'g_adultFor'];
const REVENUE_COLS = [
  { key: 'inspireLab', label: 'Inspire Lab' }, { key: 'innovationSpace', label: 'Innovation space' },
  { key: 'walkRally', label: 'Walk Rally' }, { key: 'miniMakePlay', label: 'Mini make & play' },
  { key: 'dontMiss', label: "Don't Miss" }, { key: 'iScream', label: 'I-Scream' },
  { key: 'camp', label: 'Camp' }, { key: 'workshop', label: 'Workshop' },
  { key: 'member', label: 'Member' }, { key: 'other', label: 'Other' }
];
const REVENUE_ROWS = [
  { key: 'walkinOnsite', label: 'Walk-in : On-site' }, { key: 'walkinOnline', label: 'Walk-in : Online' },
  { key: 'groupOnsite', label: 'Group : On-site' }, { key: 'groupOnline', label: 'Group : Online' }
];
const DEFAULT_OTHER_ACTIVITIES = ['Walk Rally', "Don't Miss", 'I-Scream', '', ''];

/* ---------------- Tailwind class ก้อนที่ใช้ซ้ำ ---------------- */
const TD = 'border border-slate-200 px-2 py-1.5 align-middle';
const TD_TXT = TD + ' text-left';
const IN_BASE = 'w-full min-w-0 rounded border border-slate-300 bg-white px-1.5 py-1 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500';
const IN_NUM = IN_BASE + ' text-center cnt';
const IN_TXT = IN_BASE + ' text-left';
const MINI_BTN = 'inline-flex h-6 w-6 items-center justify-center rounded border border-slate-300 text-slate-500 hover:bg-slate-100';

/* ---------------- state ---------------- */
let refStaff = [];
let state = { id: '', editingId: false };

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function emptyRound() { return { childTh: 0, adultTh: 0, childFor: 0, adultFor: 0, leader: '', activity: '', school: '' }; }
function emptyOtherActivity(name) {
  return { name: name || '', w_childTh: 0, w_adultTh: 0, w_childFor: 0, w_adultFor: 0, g_childTh: 0, g_adultTh: 0, g_childFor: 0, g_adultFor: 0, school: '' };
}
function blankReport() {
  const evening = {};
  ZONES.forEach(z => { evening[z.id] = { name: z.name, duty: z.duty, volunteers: '', issues: '', notes: '' }; });
  const revenue = {};
  REVENUE_ROWS.forEach(r => { revenue[r.key] = {}; REVENUE_COLS.forEach(c => revenue[r.key][c.key] = 0); });
  return {
    id: '', date: todayStr(),
    mod: '', mExhibition: '', mEducation: '', mVisitorService: '',
    specialActivities: ['', ''],
    evening,
    visitorCounts: {
      exWalkin: { childTh: 0, adultTh: 0, childFor: 0, adultFor: 0, senior: 0 },
      exGroup: { childTh: 0, adultTh: 0, childFor: 0, adultFor: 0, senior: 0 }
    },
    activityRounds: {
      inspireLab: Array.from({ length: 8 }, emptyRound),
      innovationSpace: Array.from({ length: 8 }, emptyRound)
    },
    otherActivities: DEFAULT_OTHER_ACTIVITIES.map(emptyOtherActivity),
    revenue,
    recorder: '', editor: '', createdAt: '', updatedAt: ''
  };
}

/* ---------------- path helpers (สำหรับ serialize/populate DOM) ---------------- */
function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function setPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i], nextIsIndex = /^\d+$/.test(parts[i + 1]);
    if (cur[k] == null) cur[k] = nextIsIndex ? [] : {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}

/* ---------------- staff dropdowns ---------------- */
function parseCsvFirstColumn(text) {
  return text.split(/\r?\n/).slice(1).map(l => l.split(',')[0].trim()).filter(Boolean);
}
async function loadStaff() {
  if (!CONFIG.STAFF_CSV_URL) return;
  try {
    const res = await fetch(CONFIG.STAFF_CSV_URL);
    refStaff = [...new Set(parseCsvFirstColumn(await res.text()))];
  } catch (err) { /* คงรายการเดิมไว้ */ }
  renderStaffOptions();
}
function staffOptionsHtml(placeholder, current) {
  const extra = current && !refStaff.includes(current) ? `<option value="${escapeHtml(current)}" selected>${escapeHtml(current)}</option>` : '';
  return `<option value="">${placeholder}</option>` +
    refStaff.map(n => `<option value="${escapeHtml(n)}" ${n === current ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('') + extra;
}
function renderStaffOptions() {
  ['p_mod', 'p_exhibition', 'p_education', 'p_visitorService'].forEach(id => {
    const el = document.getElementById(id);
    const cur = el.dataset.value || '';
    el.innerHTML = staffOptionsHtml('- เลือก -', cur);
    el.value = cur;
  });
  const rec = document.getElementById('f_recorder'), edt = document.getElementById('f_editor');
  rec.innerHTML = staffOptionsHtml('- เลือกผู้บันทึก -', rec.dataset.value || '');
  rec.value = rec.dataset.value || '';
  edt.innerHTML = staffOptionsHtml(state.editingId ? '- เลือกผู้แก้ไข -' : '- (เฉพาะตอนแก้ไข) -', edt.dataset.value || '');
  edt.value = edt.dataset.value || '';
}

/* ---------------- render: static form parts ---------------- */
function renderSpecialActivities(list) {
  const box = document.getElementById('specialActivitiesRows');
  box.innerHTML = list.map((v, i) => `
    <div class="flex items-center gap-2">
      <span class="w-5 shrink-0 text-right text-xs text-slate-400">${i + 1}.</span>
      <input class="${IN_TXT}" data-path="specialActivities.${i}" value="${escapeHtml(v)}">
      <button type="button" class="print-hide ${MINI_BTN} rm-special" data-idx="${i}" title="ลบ">✕</button>
    </div>`).join('');
}

function countFieldsHtml(basePath, fields, values) {
  return fields.map(f => `
    <div class="flex min-w-0 flex-col gap-1">
      <label class="truncate text-[11px] text-slate-500">${f.label}</label>
      <input type="number" min="0" inputmode="none" class="${IN_NUM}" data-path="${basePath}.${f.key}" value="${values[f.key] || 0}">
    </div>`).join('');
}

function renderEvening(evening) {
  const groups = [];
  ZONES.forEach(z => { if (!groups.includes(z.group)) groups.push(z.group); });
  let html = '';
  groups.forEach(g => {
    html += `<tr><td class="border border-slate-200 bg-blue-50 px-3 py-1.5 text-left font-semibold text-navy" colspan="5">${escapeHtml(g)}</td></tr>`;
    ZONES.filter(z => z.group === g).forEach(z => {
      const v = evening[z.id] || {};
      const nameCell = z.editableName
        ? `<input class="${IN_TXT}" data-path="evening.${z.id}.name" value="${escapeHtml(v.name || '')}" placeholder="Zone อื่นๆ">`
        : `<span class="font-semibold">${escapeHtml(z.name)}</span>`;
      const dutyCell = z.editableName
        ? `<input class="${IN_TXT}" data-path="evening.${z.id}.duty" value="${escapeHtml(v.duty || '')}" placeholder="หน้าที่">`
        : escapeHtml(z.duty);
      html += `<tr>
        <td class="${TD_TXT} whitespace-nowrap">${nameCell}</td>
        <td class="${TD_TXT} whitespace-nowrap">${dutyCell}</td>
        <td class="${TD_TXT}"><input class="${IN_TXT}" data-path="evening.${z.id}.volunteers" value="${escapeHtml(v.volunteers || '')}"></td>
        <td class="${TD_TXT}"><input class="${IN_TXT}" data-path="evening.${z.id}.issues" value="${escapeHtml(v.issues || '')}"></td>
        <td class="${TD_TXT}"><input class="${IN_TXT}" data-path="evening.${z.id}.notes" value="${escapeHtml(v.notes || '')}"></td>
      </tr>`;
    });
  });
  document.getElementById('eveningBody').innerHTML = html;
}

function roundRowHtml(prefix, i, r) {
  return `<tr>
    <td class="${TD} text-center font-medium text-slate-500">${i + 1}</td>
    <td class="${TD}"><input type="number" min="0" inputmode="none" class="${IN_NUM}" data-col="childTh" data-path="activityRounds.${prefix}.${i}.childTh" value="${r.childTh || 0}"></td>
    <td class="${TD}"><input type="number" min="0" inputmode="none" class="${IN_NUM}" data-col="adultTh" data-path="activityRounds.${prefix}.${i}.adultTh" value="${r.adultTh || 0}"></td>
    <td class="${TD}"><input type="number" min="0" inputmode="none" class="${IN_NUM}" data-col="childFor" data-path="activityRounds.${prefix}.${i}.childFor" value="${r.childFor || 0}"></td>
    <td class="${TD}"><input type="number" min="0" inputmode="none" class="${IN_NUM}" data-col="adultFor" data-path="activityRounds.${prefix}.${i}.adultFor" value="${r.adultFor || 0}"></td>
    <td class="${TD_TXT}"><input class="${IN_TXT}" data-path="activityRounds.${prefix}.${i}.leader" value="${escapeHtml(r.leader || '')}"></td>
    <td class="${TD_TXT}"><input class="${IN_TXT}" data-path="activityRounds.${prefix}.${i}.activity" value="${escapeHtml(r.activity || '')}"></td>
    <td class="${TD_TXT}"><input class="${IN_TXT}" data-path="activityRounds.${prefix}.${i}.school" value="${escapeHtml(r.school || '')}"></td>
  </tr>`;
}
function renderRoundsTable(prefix, rows) {
  document.getElementById(prefix === 'inspireLab' ? 'inspireLabBody' : 'innovationBody').innerHTML =
    rows.map((r, i) => roundRowHtml(prefix, i, r)).join('');
  const totalRow = document.getElementById(prefix === 'inspireLab' ? 'inspireLabTotal' : 'innovationTotal');
  totalRow.innerHTML = `<td class="${TD} text-center">รวม</td>` +
    ROUND_COLS.map(c => `<td class="${TD} text-center" id="${prefix}Total_${c}">0</td>`).join('') +
    `<td class="${TD}" colspan="3"></td>`;
}

function otherActivityRowHtml(i, a) {
  const numCell = (col, val) => `<td class="${TD}"><input type="number" min="0" inputmode="none" class="${IN_NUM}" data-col="${col}" data-path="otherActivities.${i}.${col}" value="${val || 0}"></td>`;
  return `<tr data-idx="${i}">
    <td class="${TD_TXT}"><input class="${IN_TXT}" data-path="otherActivities.${i}.name" value="${escapeHtml(a.name || '')}" placeholder="ชื่อกิจกรรม"></td>
    ${numCell('w_childTh', a.w_childTh)}${numCell('w_adultTh', a.w_adultTh)}${numCell('w_childFor', a.w_childFor)}${numCell('w_adultFor', a.w_adultFor)}
    ${numCell('g_childTh', a.g_childTh)}${numCell('g_adultTh', a.g_adultTh)}${numCell('g_childFor', a.g_childFor)}${numCell('g_adultFor', a.g_adultFor)}
    <td class="${TD_TXT}"><input class="${IN_TXT}" data-path="otherActivities.${i}.school" value="${escapeHtml(a.school || '')}"></td>
    <td class="${TD} print-hide text-center"><button type="button" class="${MINI_BTN} rm-other" data-idx="${i}" title="ลบ">✕</button></td>
  </tr>`;
}
function renderOtherActivities(list) {
  document.getElementById('otherActivitiesBody').innerHTML = list.map((a, i) => otherActivityRowHtml(i, a)).join('');
  const totalRow = document.getElementById('otherActivitiesTotal');
  totalRow.innerHTML = `<td class="${TD}">รวม</td>` +
    OTHER_COLS.map(c => `<td class="${TD} text-center" id="otherTotal_${c}">0</td>`).join('') +
    `<td class="${TD}" colspan="2"></td>`;
}

function renderRevenue(revenue) {
  const TH = 'border border-slate-200 px-2 py-2 font-semibold whitespace-nowrap';
  document.getElementById('revenueHeadRow').innerHTML =
    `<th class="${TH} text-left">รายการ</th>` +
    REVENUE_COLS.map(c => `<th class="${TH}">${escapeHtml(c.label)}</th>`).join('') +
    `<th class="${TH}">รวม</th>`;
  document.getElementById('revenueBody').innerHTML = REVENUE_ROWS.map(r => `
    <tr data-row="${r.key}">
      <td class="${TD_TXT} whitespace-nowrap font-medium">${escapeHtml(r.label)}</td>
      ${REVENUE_COLS.map(c => `<td class="${TD}"><input type="number" min="0" inputmode="none" class="${IN_NUM} rev" data-row="${r.key}" data-col="${c.key}" data-path="revenue.${r.key}.${c.key}" value="${(revenue[r.key] && revenue[r.key][c.key]) || 0}"></td>`).join('')}
      <td class="${TD} text-center font-semibold" id="revRowTotal_${r.key}">0</td>
    </tr>`).join('');
  document.getElementById('revenueTotal').innerHTML =
    `<td class="${TD}">รวมรายได้ทั้งสิ้น</td>` +
    REVENUE_COLS.map(c => `<td class="${TD} text-center" id="revColTotal_${c.key}">0</td>`).join('') +
    `<td class="${TD} text-center" id="revGrandTotal">0</td>`;
}

/* ---------------- compute totals (อ่านค่าจาก DOM ตรงๆ) ---------------- */
function sumInputs(selector) {
  let sum = 0;
  document.querySelectorAll(selector).forEach(el => sum += Number(el.value) || 0);
  return sum;
}
function recomputeExhibition() {
  const w = {}, g = {};
  EX_COUNT_FIELDS.forEach(f => {
    w[f.key] = Number(document.querySelector(`[data-path="visitorCounts.exWalkin.${f.key}"]`).value) || 0;
    g[f.key] = Number(document.querySelector(`[data-path="visitorCounts.exGroup.${f.key}"]`).value) || 0;
  });
  const walkinTotal = w.childTh + w.adultTh + w.childFor + w.adultFor + w.senior;
  const groupTotal = g.childTh + g.adultTh + g.childFor + g.adultFor + g.senior;
  document.getElementById('exSummary').innerHTML =
    `เด็ก ${w.childTh + w.childFor} คน / ผู้ใหญ่ ${w.adultTh + w.adultFor + w.senior} คน รวมผู้เข้าชม Walk-in <b>${walkinTotal}</b> คน<br>` +
    `รวมผู้เข้าชม Group <b>${groupTotal}</b> คน — รวมทั้งสิ้น <b>${walkinTotal + groupTotal}</b> คน`;
  return walkinTotal + groupTotal;
}
function recomputeRoundsTable(prefix) {
  let total = 0;
  ROUND_COLS.forEach(c => {
    const s = sumInputs(`#${prefix === 'inspireLab' ? 'inspireLabBody' : 'innovationBody'} [data-col="${c}"]`);
    total += s;
    const cell = document.getElementById(`${prefix}Total_${c}`);
    if (cell) cell.textContent = s;
  });
  return total;
}
function recomputeOtherActivities() {
  let walkin = 0, group = 0;
  OTHER_COLS.forEach(c => {
    const s = sumInputs(`#otherActivitiesBody [data-col="${c}"]`);
    if (c[0] === 'w') walkin += s; else group += s;
    const cell = document.getElementById(`otherTotal_${c}`);
    if (cell) cell.textContent = s;
  });
  return walkin + group;
}
function recomputeRevenue() {
  let grand = 0;
  REVENUE_ROWS.forEach(r => {
    let rowSum = 0;
    REVENUE_COLS.forEach(c => { rowSum += Number((document.querySelector(`[data-path="revenue.${r.key}.${c.key}"]`) || {}).value) || 0; });
    grand += rowSum;
    const cell = document.getElementById(`revRowTotal_${r.key}`);
    if (cell) cell.textContent = rowSum;
  });
  REVENUE_COLS.forEach(c => {
    const s = sumInputs(`[data-col="${c.key}"].rev`);
    const cell = document.getElementById(`revColTotal_${c.key}`);
    if (cell) cell.textContent = s;
  });
  const gc = document.getElementById('revGrandTotal');
  if (gc) gc.textContent = grand;
}
function recomputeAll() {
  const exTotal = recomputeExhibition();
  const labTotal = recomputeRoundsTable('inspireLab');
  const innoTotal = recomputeRoundsTable('innovationSpace');
  const otherTotal = recomputeOtherActivities();
  recomputeRevenue();
  const grand = exTotal + labTotal + innoTotal + otherTotal;
  document.getElementById('grandTotalVisitors').textContent = `รวมผู้เข้าชมทั้งสิ้น ${grand} คน`;
}

/* ---------------- serialize / populate ---------------- */
function serializeReport() {
  const r = blankReport();
  r.id = state.id;
  ['p_mod:mod', 'p_exhibition:mExhibition', 'p_education:mEducation', 'p_visitorService:mVisitorService']
    .forEach(pair => { const [elId, key] = pair.split(':'); r[key] = document.getElementById(elId).value; });
  document.querySelectorAll('[data-path]').forEach(el => {
    const path = el.dataset.path;
    const val = el.type === 'number' ? (Number(el.value) || 0) : el.value;
    setPath(r, path, val);
  });
  r.date = document.getElementById('f_date').value || todayStr();
  return r;
}
function populateForm(r) {
  document.getElementById('f_date').value = r.date || todayStr();
  ['p_mod:mod', 'p_exhibition:mExhibition', 'p_education:mEducation', 'p_visitorService:mVisitorService'].forEach(pair => {
    const [elId, key] = pair.split(':');
    document.getElementById(elId).dataset.value = r[key] || '';
  });
  document.getElementById('f_recorder').dataset.value = r.recorder || '';
  document.getElementById('f_editor').dataset.value = '';
  renderStaffOptions();

  renderSpecialActivities(r.specialActivities && r.specialActivities.length ? r.specialActivities : ['']);
  renderEvening(r.evening);
  document.getElementById('exWalkinFields').innerHTML = countFieldsHtml('visitorCounts.exWalkin', EX_COUNT_FIELDS, r.visitorCounts.exWalkin);
  document.getElementById('exGroupFields').innerHTML = countFieldsHtml('visitorCounts.exGroup', EX_COUNT_FIELDS, r.visitorCounts.exGroup);
  renderRoundsTable('inspireLab', r.activityRounds.inspireLab);
  renderRoundsTable('innovationSpace', r.activityRounds.innovationSpace);
  renderOtherActivities(r.otherActivities);
  renderRevenue(r.revenue);

  document.getElementById('headSub').textContent = r.id ? `แก้ไขรายงาน (${r.date})` : `รายงานฉบับใหม่ (${r.date})`;
  recomputeAll();
}

/* ---------------- add/remove rows ---------------- */
document.getElementById('addSpecialActivity').addEventListener('click', () => {
  const r = serializeReport();
  r.specialActivities.push('');
  renderSpecialActivities(r.specialActivities);
});
document.getElementById('specialActivitiesRows').addEventListener('click', e => {
  const btn = e.target.closest('.rm-special'); if (!btn) return;
  const r = serializeReport();
  r.specialActivities.splice(Number(btn.dataset.idx), 1);
  if (!r.specialActivities.length) r.specialActivities.push('');
  renderSpecialActivities(r.specialActivities);
});
document.getElementById('addOtherActivity').addEventListener('click', () => {
  const r = serializeReport();
  r.otherActivities.push(emptyOtherActivity(''));
  renderOtherActivities(r.otherActivities);
  recomputeAll();
});
document.getElementById('otherActivitiesBody').addEventListener('click', e => {
  const btn = e.target.closest('.rm-other'); if (!btn) return;
  const r = serializeReport();
  r.otherActivities.splice(Number(btn.dataset.idx), 1);
  if (!r.otherActivities.length) r.otherActivities.push(emptyOtherActivity(''));
  renderOtherActivities(r.otherActivities);
  recomputeAll();
});

document.addEventListener('input', e => {
  if (e.target.matches('.cnt')) recomputeAll();
  scheduleAutosave();
});

/* ---------------- Numpad กดตัวเลข (แทนคีย์บอร์ดเครื่อง ให้กรอกได้แบบเดียวกันทั้ง Browser/มือถือ) ---------------- */
let numpadTarget = null;
const numpadBar = document.getElementById('numpadBar');
function numpadFieldLabel(input) {
  // ป้ายกำกับแบบคร่าวๆ (ชื่อหัวข้อของ section ที่ฟิลด์นี้อยู่) พอให้รู้ว่ากำลังกรอกส่วนไหน
  const label = input.closest('.flex')?.querySelector('label')?.textContent.trim();
  const heading = input.closest('section')?.querySelector('h2')?.textContent.trim();
  return label || heading || 'กรอกตัวเลข';
}
function openNumpad(input) {
  numpadTarget = input;
  document.getElementById('numpadLabel').textContent = numpadFieldLabel(input);
  numpadBar.classList.remove('hidden');
  requestAnimationFrame(() => numpadBar.classList.remove('translate-y-full'));
}
function closeNumpad() {
  if (!numpadTarget) return;
  numpadBar.classList.add('translate-y-full');
  setTimeout(() => numpadBar.classList.add('hidden'), 200);
  numpadTarget = null;
}
document.addEventListener('focusin', e => {
  if (e.target.matches('input.cnt')) openNumpad(e.target);
  else if (numpadTarget && !numpadBar.contains(e.target)) closeNumpad();
});
numpadBar.addEventListener('mousedown', e => e.preventDefault()); // กันไม่ให้ input เสีย focus ก่อนกดปุ่มติด
numpadBar.addEventListener('click', e => {
  const btn = e.target.closest('.numpad-btn');
  if (!btn || !numpadTarget) return;
  if (btn.dataset.k === 'done') { closeNumpad(); return; }
  const cur = numpadTarget.value || '';
  if (btn.dataset.k === 'back') numpadTarget.value = cur.slice(0, -1);
  else if (btn.dataset.k === 'clear') numpadTarget.value = '';
  else numpadTarget.value = (cur === '0' ? '' : cur) + btn.dataset.k;
  numpadTarget.dispatchEvent(new Event('input', { bubbles: true }));
});
document.getElementById('numpadCloseX').addEventListener('click', closeNumpad);

/* ---------------- autosave draft (localStorage) ---------------- */
let autosaveTimer = null;
function draftKey(date) { return 'emod_draft_' + date; }
function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    const r = serializeReport();
    try { localStorage.setItem(draftKey(r.date), JSON.stringify(r)); } catch (e) { /* ignore */ }
  }, 500);
}

/* ---------------- load / save (backend หรือ localStorage) ---------------- */
function setStatus(msg) { document.getElementById('statusMsg').textContent = msg; }

async function loadByDate(date) {
  if (CONFIG.API_URL) {
    setStatus('กำลังโหลด...');
    try {
      const res = await fetch(CONFIG.API_URL + '?action=getByDate&date=' + encodeURIComponent(date));
      const json = await res.json();
      if (json.error) { setStatus(''); return null; }
      setStatus('');
      return json.data || null;
    } catch (err) { setStatus('โหลดจาก Sheet ไม่สำเร็จ — ใช้ข้อมูลในเครื่องแทน'); }
  }
  const raw = localStorage.getItem(draftKey(date));
  return raw ? JSON.parse(raw) : null;
}

document.getElementById('newBtn').addEventListener('click', () => {
  state = { id: '', editingId: false };
  populateForm(blankReport());
  setStatus('');
});

document.getElementById('loadBtn').addEventListener('click', async () => {
  const date = document.getElementById('f_date').value || todayStr();
  const found = await loadByDate(date);
  if (found) {
    state = { id: found.id, editingId: true };
    populateForm(found);
    setStatus('โหลดรายงานวันที่ ' + date + ' แล้ว');
  } else {
    state = { id: '', editingId: false };
    const blank = blankReport(); blank.date = date;
    populateForm(blank);
    setStatus('ยังไม่มีรายงานวันที่ ' + date + ' — เริ่มฉบับใหม่');
  }
});

document.getElementById('printBtn').addEventListener('click', () => window.print());

/* ---------------- พรีวิว (popup/modal ในหน้าเดิม ไม่เปิดแท็บใหม่) ----------------
   ใช้ iframe แสดงสำเนาข้อมูลปัจจุบัน ซูม/พิมพ์ได้เหมือนกันทุกเบราว์เซอร์ Chrome/Edge/Safari
   ใช้กติกาจัดหน้าเดียวกับตอนพิมพ์จริงทุกประการ (EMOD_PRINT_RULES จาก E-Mod-Css.js)
   ไม่มีการแก้ไขเลเอาต์ของตัวเอกสารที่พิมพ์จริงแต่อย่างใด ---------------- */
function freezeCloneFormValues_(root) {
  root.querySelectorAll('input').forEach(el => {
    if (el.type === 'checkbox' || el.type === 'radio') { el.toggleAttribute('checked', el.checked); }
    else { el.setAttribute('value', el.value); el.setAttribute('readonly', ''); }
  });
  root.querySelectorAll('textarea').forEach(el => { el.textContent = el.value; el.setAttribute('readonly', ''); });
  root.querySelectorAll('select').forEach(sel => {
    [...sel.options].forEach(o => o.toggleAttribute('selected', o.value === sel.value));
    sel.setAttribute('disabled', '');
  });
}
let previewZoom = 1;
function setPreviewZoom_(z) {
  previewZoom = Math.min(2, Math.max(0.4, Math.round(z * 100) / 100));
  const frame = document.getElementById('previewFrame');
  const stack = frame.contentDocument && frame.contentDocument.getElementById('pvStack');
  if (stack) stack.style.transform = 'scale(' + previewZoom + ')';
  document.getElementById('previewZoomLabel').textContent = Math.round(previewZoom * 100) + '%';
}
function openEModPreviewModal_(cardHtml, title) {
  const frame = document.getElementById('previewFrame');
  frame.srcdoc = `<!DOCTYPE html>
<html lang="th"><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"><\/script>
<script>
  tailwind.config = { theme: { extend: { fontFamily: { sans: ['Sarabun', 'sans-serif'] }, colors: { navy: '#1E3A5F' } } } };
<\/script>
<style>
  html,body{margin:0;background:#787878;font-family:Sarabun,sans-serif;}
  #pvStack{padding:24px 0 60px;transform-origin:top center;}
  .pvPage{width:210mm;min-height:297mm;background:#fff;box-shadow:0 2px 16px rgba(0,0,0,.3);margin:0 auto;padding:8mm 7mm;box-sizing:border-box;}
  #pvStack #sectionCounts{position:relative;}
  #pvStack #sectionCounts::before{content:'— หน้า 2 —';position:absolute;top:-14px;left:0;right:0;text-align:center;font-size:9px;color:#94a3b8;}
  ${window.EMOD_PRINT_RULES || ''}
  @media print{
    html,body{background:#fff !important;}
    #pvStack{padding:0 !important;transform:none !important;}
    .pvPage{width:auto !important;min-height:0 !important;box-shadow:none !important;padding:0 !important;}
    #pvStack #sectionCounts::before{content:none !important;}
    @page{size:A4;margin:8mm 7mm;}
  }
</style>
</head><body><div id="pvStack"><div class="pvPage">${cardHtml}</div></div></body></html>`;
  document.getElementById('previewTitle').textContent = title || '🔍 พรีวิว E-Mod';
  previewZoom = 1;
  document.getElementById('previewZoomLabel').textContent = '100%';
  const overlay = document.getElementById('previewOverlay');
  overlay.classList.remove('hidden');
  overlay.classList.add('flex');
}
function closeEModPreviewModal_() {
  const overlay = document.getElementById('previewOverlay');
  overlay.classList.add('hidden');
  overlay.classList.remove('flex');
  document.getElementById('previewFrame').srcdoc = '';
}
document.getElementById('previewZoomIn').addEventListener('click', () => setPreviewZoom_(previewZoom + 0.1));
document.getElementById('previewZoomOut').addEventListener('click', () => setPreviewZoom_(previewZoom - 0.1));
document.getElementById('previewZoomReset').addEventListener('click', () => setPreviewZoom_(1));
document.getElementById('previewPrintBtn').addEventListener('click', () => {
  // ไม่สั่งพิมพ์จาก iframe ตรงๆ (บางเบราว์เซอร์เรนเดอร์หน้าว่างเปล่า) — ใช้ window.print()
  // ของหน้าเว็บจริงเหมือนปุ่ม "🖨 พิมพ์" เดิม (previewOverlay มี class print-hide จึงไม่ติด
  // ไปในกระดาษที่พิมพ์จริง — ผลลัพธ์เหมือนกับที่เห็นใน iframe พรีวิวทุกจุด)
  window.print();
});
document.getElementById('previewCloseBtn').addEventListener('click', closeEModPreviewModal_);
document.getElementById('previewBtn').addEventListener('click', () => {
  const original = document.querySelector('.rounded-2xl');
  const clone = original.cloneNode(true);
  freezeCloneFormValues_(clone);
  const dateVal = document.getElementById('f_date').value || todayStr();
  openEModPreviewModal_(clone.outerHTML, `🔍 พรีวิว E-Mod — ${dateVal}`);
});

document.getElementById('saveBtn').addEventListener('click', async () => {
  const recorderEl = document.getElementById('f_recorder'), editorEl = document.getElementById('f_editor');
  const recorder = recorderEl.value.trim(), editor = editorEl.value.trim();
  if (!recorder) { recorderEl.focus(); setStatus('กรุณาเลือกผู้บันทึก'); return; }
  if (state.editingId && !editor) { editorEl.focus(); setStatus('กรุณาเลือกผู้แก้ไข'); return; }

  const r = serializeReport();
  r.recorder = state.editingId ? (r.recorder || recorder) : recorder;
  r.editor = state.editingId ? editor : '';
  const now = new Date().toISOString();
  r.createdAt = r.createdAt || now;
  r.updatedAt = now;

  setStatus('กำลังบันทึก...');
  try {
    if (CONFIG.API_URL) {
      const action = state.editingId ? 'update' : 'create';
      const res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, data: r })
      });
      const json = await res.json();
      if (json.error) { setStatus('บันทึกไม่สำเร็จ: ' + json.error); return; }
      state = { id: json.data.id, editingId: true };
      localStorage.setItem(draftKey(r.date), JSON.stringify(json.data));
      populateForm(json.data);
      setStatus('บันทึกลง Sheet เรียบร้อย');
    } else {
      if (!r.id) r.id = 'local-' + Date.now();
      state = { id: r.id, editingId: true };
      localStorage.setItem(draftKey(r.date), JSON.stringify(r));
      populateForm(r);
      setStatus('บันทึกในเครื่องเรียบร้อย (โหมดทดลอง — ยังไม่ได้เชื่อม Sheet)');
    }
  } catch (err) {
    setStatus('บันทึกไม่สำเร็จ: ' + err.message);
  }
});

document.getElementById('f_date').addEventListener('change', () => document.getElementById('loadBtn').click());

/* ---------------- init ---------------- */
(async function init() {
  document.getElementById('f_date').value = todayStr();
  populateForm(blankReport());
  await loadStaff();
  document.getElementById('loadBtn').click();
})();
