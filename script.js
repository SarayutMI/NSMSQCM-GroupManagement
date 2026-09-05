/* =========================================================
   CONFIG
   - ถ้า API_URL ว่างไว้: ข้อมูล "การจอง" เก็บในเบราว์เซอร์ (localStorage) เครื่องเดียว
   - ถ้าใส่ API_URL (ลิงก์ Web App จาก Google Apps Script ที่แนบไฟล์ Code.gs ไว้แล้ว):
     ระบบจะอ่าน/บันทึกการจองลง Google Sheet จริงทันที และ "สร้างชีต + หัวตารางที่ต้องใช้ให้เองอัตโนมัติ"
     ในสเปรดชีตที่ผูกกับสคริปต์นั้น (ไม่ต้องสร้างชีตหรือตั้งหัวตารางเอง) — ดูขั้นตอนเต็มใน README.md
   - ข้อมูล "อ้างอิง" (รายชื่อโรงเรียน) ดึงจาก Google Sheet ที่ Publish to web เป็น CSV แยกต่างหาก
     วิธีทำ: เปิด Sheet > File > Share > Publish to web > เลือกแท็บ > Comma-separated values (.csv)
     แล้วคัดลอกลิงก์มาใส่ที่ SCHOOLS_CSV_URL ด้านล่าง (คอลัมน์: school, contactPerson, contactPhone)
   ========================================================= */
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbyc0kCzjNJ15WZNuZH3_CgsAjPnwOeuZZYp7fYHHycmFnEvSGBdTvpDqK7BuL4HDA7SZw/exec',            // <-- ใส่ URL ของ Google Apps Script Web App (จาก Code.gs) ที่นี่ เพื่อเชื่อม Sheet จริง
  SCHOOLS_CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHwC49QdSskveBiTSa9BZLxSMEvW6wa_XUEhFQQP5jStHI-EVPGdIjG3Goo_-iNiXKJkmYevzcC2kl/pub?gid=0&single=true&output=csv'     // <-- ใส่ลิงก์ CSV รายชื่อโรงเรียนอ้างอิงจาก Google Sheet ที่นี่
};

/* ตั้งค่าข้อความ/ข้อมูลที่ใช้พิมพ์ในเอกสาร แก้ตรงนี้ได้ตามหน่วยงานจริง */
const DOC_CONFIG = {
  venueName: 'จัตุรัสวิทยาศาสตร์ อพวช. เชียงใหม่',
  contactEmail: 'Yuttana.s@nsm.or.th',
  contactPhone: '093-745-8550',
  paymentNote: 'การชำระเงินกรุณาชำระผ่านการโอนได้ที่เคาน์เตอร์ในวันที่มาร่วมกิจกรรมเท่านั้น (งดรับเงินสด)',
  policyNotes: [
    'ค่าธรรมเนียมเข้าร่วมกิจกรรมกรณีเป็นหมู่คณะ 10 คนขึ้นไป ราคา คนละ 90 บาท ต่อรอบกิจกรรม (จากปกติคนละ 100 บาท ต่อรอบกิจกรรม) Advance : หมู่คณะ ราคา คนละ 180 บาท (จากปกติคนละ 200 บาท ต่อรอบกิจกรรม)',
    'หากจองเข้าร่วมเป็นหมู่คณะ 15 คนขึ้นไปต่อรอบ สามารถเลือกเรื่องกิจกรรมที่ต้องการเข้าร่วมได้ (ตามตารางกิจกรรม)',
    'กรณีที่ผู้เข้าร่วมกิจกรรมมาไม่ครบตามจำนวนที่แจ้ง ขอเก็บค่าธรรมเนียมขั้นต่ำที่ 15 คนต่อรอบ หากมามากกว่าที่แจ้งไว้ คิดค่าธรรมเนียมตามจำนวนที่มาจริง',
    'หากมีผู้เข้าร่วมกิจกรรมน้อยกว่า 20 คนต่อรอบ ทาง จัตุรัสวิทยาศาสตร์ มีสิทธิ์รับผู้เข้าร่วมกิจกรรมภายนอกเพิ่มเติม',
    'แจ้งยืนยันการเข้าร่วมกิจกรรมล่วงหน้าก่อน 7 วัน',
    'กรณีต้องการเปลี่ยนแปลงหรือยกเลิกการจองเข้าร่วมกิจกรรมกรุณาแจ้งก่อนวันที่เข้าร่วมอย่างน้อย 3 วันทำการ'
  ]
};

const ROOM_CATEGORIES = [
  {id:'innovation', label:'Innovation Space', color:'var(--navy)',  bg:'var(--blue-dim)'},
  {id:'inspirelab', label:'Inspire Lab',       color:'var(--sky)',   bg:'var(--sky-dim)'},
  {id:'other',      label:'อื่นๆ',              color:'var(--slate)', bg:'var(--slate-dim)'}
];
const ROOM_DEFAULT_PRICE = { innovation: 90, inspirelab: 90, other: 100 };

const STATUS_CONFIG = {
  pending:   {label:'รอยืนยัน',   color:'var(--pending)',   bg:'var(--pending-bg)'},
  confirmed: {label:'ยืนยันแล้ว', color:'var(--confirmed)', bg:'var(--confirmed-bg)'},
  cancelled: {label:'ยกเลิก',     color:'var(--cancelled)', bg:'var(--cancelled-bg)'}
};
const WEEKDAYS_TH = ['อา','จ','อ','พ','พฤ','ศ','ส'];
const WEEKDAYS_FULL_TH = ['วันอาทิตย์','วันจันทร์','วันอังคาร','วันพุธ','วันพฤหัสบดี','วันศุกร์','วันเสาร์'];
const MONTHS_TH = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

/* ตัวอย่างรายชื่อโรงเรียนอ้างอิง (ใช้เมื่อยังไม่ได้ตั้งค่า SCHOOLS_CSV_URL) */
const SAMPLE_SCHOOLS = [
  {school:'โรงเรียนสันป่าตอง สุวรรณราษฎร์วิทยาคาร', contactPerson:'ครูนภา', contactPhone:'081-999-0000'},
  {school:'โรงเรียนสาธิตจุฬาลงกรณ์มหาวิทยาลัย', contactPerson:'ครูอรทัย', contactPhone:'081-234-5678'},
  {school:'โรงเรียนกรุงเทพคริสเตียนวิทยาลัย', contactPerson:'ครูสมชาย', contactPhone:'089-111-2222'},
  {school:'โรงเรียนอัสสัมชัญ', contactPerson:'ครูวิภา', contactPhone:'062-333-4444'},
  {school:'โรงเรียนเซนต์คาเบรียล', contactPerson:'ครูปิยะ', contactPhone:'095-555-6666'}
];

let refSchools = [];

let state = {
  visits: [],
  view: 'month',
  cursorDate: new Date(),
  activeRoomFilters: new Set(ROOM_CATEGORIES.map(r=>r.id)),
  activeStatusFilters: new Set(Object.keys(STATUS_CONFIG)),
  search: '',
  editingId: null,
  currentDetailId: null
};

/* ---------------- Loading overlay ---------------- */
let loadingDepth = 0;
function showLoading(msg){
  loadingDepth++;
  document.getElementById('loadingText').textContent = msg || 'กำลังโหลดข้อมูล...';
  document.getElementById('loadingOverlay').classList.add('show');
}
function hideLoading(){
  loadingDepth = Math.max(0, loadingDepth-1);
  if(loadingDepth===0) document.getElementById('loadingOverlay').classList.remove('show');
}

/* ---------------- Utility ---------------- */
function uid(){ return Date.now() + '-' + Math.random().toString(36).slice(2,8); }
function pad(n){ return String(n).padStart(2,'0'); }
function fmtDate(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
function parseDate(s){ const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
function todayStr(){ return fmtDate(new Date()); }
function normalizeDateStr(s){
  // แถวเก่าในชีต (ก่อนแก้บั๊กฝั่ง Apps Script) อาจส่ง date กลับมาเป็น ISO datetime
  // เช่น "2026-09-15T17:00:00.000Z" แทนที่จะเป็น "2026-09-16" ทำให้ parseDate() พังและ
  // รายการนั้นหายไปจากปฏิทินเงียบๆ ฟังก์ชันนี้แปลงกลับเป็นวันที่ตามเขตเวลาไทย (UTC+7)
  if(!s || typeof s !== 'string' || !s.includes('T')) return s;
  const ms = Date.parse(s);
  if(Number.isNaN(ms)) return s;
  const bkk = new Date(ms + 7*60*60*1000);
  return bkk.getUTCFullYear()+'-'+pad(bkk.getUTCMonth()+1)+'-'+pad(bkk.getUTCDate());
}
function roomInfo(id){ return ROOM_CATEGORIES.find(r=>r.id===id) || ROOM_CATEGORIES[2]; }
function statusInfo(id){ return STATUS_CONFIG[id] || STATUS_CONFIG.pending; }
function timeOverlap(s1,e1,s2,e2){ return s1 < e2 && s2 < e1; }
function escapeHtml(str){
  return String(str||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function addDays(d,n){ const r = new Date(d); r.setDate(r.getDate()+n); return r; }
function startOfWeek(d){ const r = new Date(d); r.setDate(d.getDate()-d.getDay()); r.setHours(0,0,0,0); return r; }
function money(n){ return Number(n||0).toLocaleString('th-TH'); }
function thaiFullDate(dateStr){
  if(!dateStr) return '-';
  const d = parseDate(dateStr);
  return `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear()+543}`;
}
function thaiFullDateWithDay(dateStr){
  if(!dateStr) return '-';
  const d = parseDate(dateStr);
  return `${WEEKDAYS_FULL_TH[d.getDay()]}ที่ ${d.getDate()} ${MONTHS_TH[d.getMonth()]} พ.ศ. ${d.getFullYear()+543}`;
}
function thTime(t){ return t ? t.replace(':','.') : t; }
function expandGradeLevel(g){
  if(!g) return '';
  g = g.trim();
  let m;
  if(m = g.match(/^ป\.?\s*(\d+)/)) return `ชั้นประถมศึกษาปีที่ ${m[1]}`;
  if(m = g.match(/^ม\.?\s*(\d+)/)) return `ชั้นมัธยมศึกษาปีที่ ${m[1]}`;
  if(m = g.match(/^อ(?:นุบาล)?\.?\s*(\d+)/)) return `ชั้นอนุบาลปีที่ ${m[1]}`;
  return g.startsWith('ชั้น') ? g : `ชั้น${g}`;
}

/* ---------------- Visit / activity helpers ---------------- */
function visitTotalPeople(v){ return (Number(v.childrenCount)||0) + (Number(v.adultCount)||0); }
function billableCount(v){ return Number(v.childrenCount)||0; } // ราคาคิดจากจำนวนเด็กเท่านั้น ไม่รวมผู้ใหญ่
function activitySubtotal(a, count){ return (Number(a.rounds)||1) * (Number(a.pricePerPerson)||0) * count; }
function visitGrandTotal(v){
  const bc = billableCount(v);
  return v.activities.reduce((sum,a)=> sum + activitySubtotal(a, bc), 0);
}
function visitActivitiesSorted(v){
  return [...v.activities].sort((a,b)=> (a.startTime||'').localeCompare(b.startTime||''));
}
function visitTimeRange(v){
  const starts = v.activities.map(a=>a.startTime).filter(Boolean).sort();
  const ends = v.activities.map(a=>a.endTime).filter(Boolean).sort();
  return { start: starts[0] || '', end: ends[ends.length-1] || '' };
}
function visitRoomLabels(v){
  return [...new Set(v.activities.map(a=>roomInfo(a.room).label))];
}
function flattenOccurrences(){
  const list = [];
  state.visits.forEach(v=>{
    v.activities.forEach(a=>{
      list.push({
        visitId: v.id, activityId: a.id, room: a.room, topic: a.topic,
        startTime: a.startTime || '00:00', endTime: a.endTime || '23:59',
        school: v.school, status: v.status, date: v.date
      });
    });
  });
  return list;
}
function visibleOccurrences(){
  const q = state.search.trim().toLowerCase();
  return flattenOccurrences().filter(o=>
    state.activeRoomFilters.has(o.room) &&
    state.activeStatusFilters.has(o.status) &&
    (!q || (o.school||'').toLowerCase().includes(q) || (o.topic||'').toLowerCase().includes(q))
  );
}

/* ---------------- Reference data (schools) from Google Sheet CSV ---------------- */
function parseCSV(text){
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map(h=>h.trim());
  return lines.slice(1).filter(l=>l.trim()).map(line=>{
    const cells = line.split(',').map(c=>c.trim());
    const obj = {};
    headers.forEach((h,i)=> obj[h]=cells[i]||'');
    return obj;
  });
}
async function loadRefSchools(){
  const banner = document.getElementById('syncBanner');
  if(!CONFIG.SCHOOLS_CSV_URL){
    refSchools = SAMPLE_SCHOOLS;
    banner.className = 'sync-banner';
    banner.textContent = 'โหมดตัวอย่าง: ใช้รายชื่อโรงเรียนตัวอย่าง ' + refSchools.length + ' แห่ง (ยังไม่ได้ตั้งค่า SCHOOLS_CSV_URL)';
  } else {
    try{
      const res = await fetch(CONFIG.SCHOOLS_CSV_URL);
      const text = await res.text();
      refSchools = parseCSV(text);
      banner.className = 'sync-banner ok';
      banner.textContent = '✓ โหลดรายชื่อโรงเรียนจาก Google Sheet สำเร็จ (' + refSchools.length + ' แห่ง)';
    }catch(err){
      refSchools = SAMPLE_SCHOOLS;
      banner.className = 'sync-banner';
      banner.textContent = '⚠ โหลดจาก Sheet ไม่สำเร็จ ใช้รายชื่อตัวอย่างแทน';
    }
  }
  renderSchoolDatalist();
}
function renderSchoolDatalist(){
  document.getElementById('schoolRefList').innerHTML =
    refSchools.map(s=>`<option value="${escapeHtml(s.school)}">`).join('');
}
document.getElementById('f_school').addEventListener('change', (e)=>{
  const match = refSchools.find(s=>s.school===e.target.value);
  if(match){
    const cp = document.getElementById('f_contactPerson');
    const ct = document.getElementById('f_contactPhone');
    if(!cp.value) cp.value = match.contactPerson||'';
    if(!ct.value) ct.value = match.contactPhone||'';
  }
});

/* ---------------- Visits storage: Google Sheet (via Apps Script) or localStorage ---------------- */
async function apiListVisits(){
  const res = await fetch(CONFIG.API_URL + '?action=list');
  const json = await res.json();
  if(json.error) throw new Error(json.error);
  const data = json.data || [];
  data.forEach(v=>{ v.date = normalizeDateStr(v.date); });
  return data;
}
async function apiSendVisit(action, payload){
  const res = await fetch(CONFIG.API_URL, {
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'}, // เลี่ยง CORS preflight ของ Apps Script
    body: JSON.stringify({action, ...payload})
  });
  const json = await res.json();
  if(json.error) throw new Error(json.error);
  const data = json.data;
  if(data && data.date) data.date = normalizeDateStr(data.date);
  return data;
}
function saveVisitsLocal(){ localStorage.setItem('sgm_visits', JSON.stringify(state.visits)); }
function setVisitSyncBanner(mode, err){
  const el = document.getElementById('visitSyncBanner');
  if(!el) return;
  if(!CONFIG.API_URL){
    el.className = 'sync-banner';
    el.textContent = 'โหมดทดลอง: ข้อมูลการจองเก็บในเบราว์เซอร์นี้เท่านั้น (ยังไม่ได้ตั้งค่า API_URL)';
  } else if(mode==='ok'){
    el.className = 'sync-banner ok';
    el.textContent = '✓ เชื่อมต่อ Google Sheet สำเร็จ · ข้อมูลการจองซิงก์กับทุกคน';
  } else {
    el.className = 'sync-banner';
    el.textContent = '⚠ เชื่อมต่อ Google Sheet ไม่สำเร็จ: ' + (err||'ตรวจสอบ API_URL / การ deploy');
  }
}
async function loadVisits(){
  if(CONFIG.API_URL){
    try{
      state.visits = await apiListVisits();
      setVisitSyncBanner('ok');
    }catch(err){
      console.error(err);
      setVisitSyncBanner('error', err.message);
      state.visits = state.visits || [];
    }
  } else {
    const raw = localStorage.getItem('sgm_visits');
    if(raw){ state.visits = JSON.parse(raw); }
    else { state.visits = buildSampleVisits(); saveVisitsLocal(); }
    setVisitSyncBanner('local');
  }
  renderAll();
}
function buildSampleVisits(){
  const now = new Date().toISOString();
  const t = new Date();
  const d = (offset)=> fmtDate(addDays(t, offset));
  return [
    {
      id: uid(), docNo:'BK-DEMO-001', school:'โรงเรียนสันป่าตอง สุวรรณราษฎร์วิทยาคาร',
      gradeLevel:'ป.1', packageLabel:'Basic', contactPerson:'ครูนภา', contactPhone:'081-999-0000',
      date: d(1), childrenCount:27, adultCount:2, status:'confirmed',
      notes:'',
      activities:[
        {id:uid(), room:'inspirelab', topic:'หิมะจำลองและผองเพื่อน', startTime:'09:30', endTime:'10:30', rounds:1, pricePerPerson:90},
        {id:uid(), room:'innovation', topic:'D.I.Y. My Zodiac', startTime:'11:00', endTime:'12:00', rounds:1, pricePerPerson:90},
        {id:uid(), room:'other', topic:'', startTime:'13:00', endTime:'', rounds:1, pricePerPerson:100}
      ],
      createdAt: now, updatedAt: now
    },
    {
      id: uid(), docNo:'BK-DEMO-002', school:'โรงเรียนอัสสัมชัญ',
      gradeLevel:'ม.2', contactPerson:'ครูวิภา', contactPhone:'062-333-4444',
      date: d(2), childrenCount:18, adultCount:3, status:'pending', notes:'',
      activities:[
        {id:uid(), room:'inspirelab', topic:'ค่ายไอเดียสร้างสรรค์', startTime:'13:00', endTime:'16:00', rounds:1, pricePerPerson:90}
      ],
      createdAt: now, updatedAt: now
    },
    {
      id: uid(), docNo:'BK-DEMO-003', school:'โรงเรียนเซนต์คาเบรียล',
      gradeLevel:'', contactPerson:'ครูปิยะ', contactPhone:'095-555-6666',
      date: d(4), childrenCount:30, adultCount:4, status:'pending', notes:'มีเด็กแพ้ถั่ว 1 คน',
      activities:[
        {id:uid(), room:'other', topic:'ทัศนศึกษาแลกเปลี่ยน', startTime:'10:00', endTime:'11:30', rounds:1, pricePerPerson:100}
      ],
      createdAt: now, updatedAt: now
    },
    {
      id: uid(), docNo:'BK-DEMO-004', school:'โรงเรียนกรุงเทพคริสเตียนวิทยาลัย',
      gradeLevel:'ม.1', contactPerson:'ครูสมชาย', contactPhone:'089-111-2222',
      date: d(-1), childrenCount:20, adultCount:2, status:'confirmed', notes:'',
      activities:[
        {id:uid(), room:'innovation', topic:'อบรมการเขียนโค้ดพื้นฐาน', startTime:'09:00', endTime:'12:00', rounds:1, pricePerPerson:90}
      ],
      createdAt: now, updatedAt: now
    }
  ];
}

/* ---------------- Sidebar: filters ---------------- */
function renderFilters(){
  const occ = flattenOccurrences();
  const roomEl = document.getElementById('roomFilters');
  roomEl.innerHTML = ROOM_CATEGORIES.map(r => `
    <label class="filter-item">
      <input type="checkbox" data-room="${r.id}" ${state.activeRoomFilters.has(r.id)?'checked':''}>
      <span class="dot" style="background:${r.color}"></span>
      <span>${r.label}</span>
      <span class="count">${occ.filter(o=>o.room===r.id).length}</span>
    </label>`).join('');
  roomEl.querySelectorAll('input').forEach(cb=>{
    cb.addEventListener('change', e=>{
      const id = e.target.dataset.room;
      e.target.checked ? state.activeRoomFilters.add(id) : state.activeRoomFilters.delete(id);
      renderAll();
    });
  });

  const statusEl = document.getElementById('statusFilters');
  statusEl.innerHTML = Object.keys(STATUS_CONFIG).map(sid => {
    const s = STATUS_CONFIG[sid];
    return `<label class="filter-item">
      <input type="checkbox" data-status="${sid}" ${state.activeStatusFilters.has(sid)?'checked':''}>
      <span class="dot" style="background:${s.color}"></span>
      <span>${s.label}</span>
    </label>`;
  }).join('');
  statusEl.querySelectorAll('input').forEach(cb=>{
    cb.addEventListener('change', e=>{
      const id = e.target.dataset.status;
      e.target.checked ? state.activeStatusFilters.add(id) : state.activeStatusFilters.delete(id);
      renderAll();
    });
  });
}

function renderPendingList(){
  const pend = state.visits.filter(v=>v.status==='pending').sort((a,b)=> (a.date).localeCompare(b.date));
  document.getElementById('pendingCount').textContent = pend.length;
  const list = document.getElementById('pendingList');
  if(pend.length===0){ list.innerHTML = '<div class="empty-hint">ไม่มีรายการรอยืนยัน</div>'; return; }
  list.innerHTML = pend.slice(0,8).map(v=>{
    const range = visitTimeRange(v);
    return `<div class="pending-card" data-id="${v.id}">
      <div class="school">${escapeHtml(v.school)}</div>
      <div class="meta">${v.date} · ${range.start}-${range.end} · ${visitRoomLabels(v).join(', ')}</div>
    </div>`;
  }).join('');
  list.querySelectorAll('.pending-card').forEach(el=>{
    el.addEventListener('click', ()=> openDetail(el.dataset.id));
  });
}

/* ---------------- Header label ---------------- */
function updatePeriodLabel(){
  const d = state.cursorDate;
  const el = document.getElementById('periodLabel');
  if(state.view==='month'){
    el.textContent = `${MONTHS_TH[d.getMonth()]} ${d.getFullYear()+543}`;
  } else if(state.view==='week'){
    const start = startOfWeek(d), end = addDays(start,6);
    el.textContent = `${start.getDate()} ${MONTHS_TH[start.getMonth()].slice(0,3)} – ${end.getDate()} ${MONTHS_TH[end.getMonth()].slice(0,3)} ${end.getFullYear()+543}`;
  } else {
    el.textContent = `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear()+543}`;
  }
}

/* ---------------- Month view ---------------- */
function renderMonth(){
  const container = document.getElementById('monthView');
  const d = state.cursorDate;
  const year = d.getFullYear(), month = d.getMonth();
  const firstDay = new Date(year, month, 1);
  const gridStart = addDays(firstDay, -firstDay.getDay());
  const items = visibleOccurrences();

  let head = '<div class="month-head-row">' + WEEKDAYS_TH.map(w=>`<div>${w}</div>`).join('') + '</div>';
  let body = '<div class="month-body">';
  for(let i=0;i<42;i++){
    const cellDate = addDays(gridStart, i);
    const ds = fmtDate(cellDate);
    const isOther = cellDate.getMonth() !== month;
    const isToday = ds === todayStr();
    const dayItems = items.filter(o=>o.date===ds).sort((a,b)=>a.startTime.localeCompare(b.startTime));
    const shown = dayItems.slice(0,3);
    const extra = dayItems.length - shown.length;
    body += `<div class="day-cell ${isOther?'other-month':''} ${isToday?'today':''}" data-date="${ds}">
      <div class="daynum">${cellDate.getDate()}</div>
      ${shown.map(o=>`<div class="event-chip" data-visit-id="${o.visitId}" style="background:${roomInfo(o.room).bg};color:${roomInfo(o.room).color}">
        <b>${o.startTime}</b> ${escapeHtml(o.school)}
      </div>`).join('')}
      ${extra>0?`<div class="more-link" data-date="${ds}">+${extra} เพิ่มเติม</div>`:''}
    </div>`;
  }
  body += '</div>';
  container.innerHTML = head + '<div class="month-grid">' + body + '</div>';

  container.querySelectorAll('.event-chip').forEach(el=>{
    el.addEventListener('click', (e)=>{ e.stopPropagation(); openDetail(el.dataset.visitId); });
  });
  container.querySelectorAll('.day-cell').forEach(el=>{
    el.addEventListener('click', ()=>{
      const ds = el.dataset.date;
      state.cursorDate = parseDate(ds); state.view = 'day'; syncViewButtons(); renderAll();
    });
  });
}

/* ---------------- Agenda (week / day) view ---------------- */
function renderAgenda(){
  const container = document.getElementById('agendaView');
  const items = visibleOccurrences();
  let days = [];
  if(state.view==='week'){
    const start = startOfWeek(state.cursorDate);
    days = Array.from({length:7}, (_,i)=>addDays(start,i));
  } else {
    days = [state.cursorDate];
  }
  container.innerHTML = `<div class="agenda-columns">${days.map(d=>{
    const ds = fmtDate(d);
    const dayItems = items.filter(o=>o.date===ds).sort((a,b)=>a.startTime.localeCompare(b.startTime));
    const isToday = ds===todayStr();
    return `<div class="agenda-day ${isToday?'today':''}">
      <div class="ahead">${WEEKDAYS_TH[d.getDay()]} <span class="num">${d.getDate()}</span></div>
      <div class="agenda-events">
        ${dayItems.length===0 ? '<div class="agenda-empty">ไม่มีการจอง</div>' : dayItems.map(o=>{
          const r = roomInfo(o.room), s = statusInfo(o.status);
          return `<div class="agenda-card" data-visit-id="${o.visitId}" style="border-left-color:${r.color}">
            <div class="time">${o.startTime}${o.endTime!=='23:59'?('–'+o.endTime):' เป็นต้นไป'}</div>
            <div class="name">${escapeHtml(o.topic)||r.label}</div>
            <div class="school">${escapeHtml(o.school)} · ${r.label}</div>
            <span class="badge" style="background:${s.bg};color:${s.color}">${s.label}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('')}</div>`;
  container.querySelectorAll('.agenda-card').forEach(el=>{
    el.addEventListener('click', ()=> openDetail(el.dataset.visitId));
  });
}

function renderAll(){
  updatePeriodLabel();
  renderFilters();
  renderPendingList();
  if(state.view==='month'){
    document.getElementById('monthView').style.display='block';
    document.getElementById('agendaView').style.display='none';
    renderMonth();
  } else {
    document.getElementById('monthView').style.display='none';
    document.getElementById('agendaView').style.display='block';
    renderAgenda();
  }
}

/* ---------------- Nav controls ---------------- */
function syncViewButtons(){
  document.querySelectorAll('.view-switch button').forEach(b=>{
    b.classList.toggle('active', b.dataset.view===state.view);
  });
}
document.querySelectorAll('.view-switch button').forEach(b=>{
  b.addEventListener('click', ()=>{ state.view = b.dataset.view; syncViewButtons(); renderAll(); });
});
document.getElementById('prevBtn').addEventListener('click', ()=> stepPeriod(-1));
document.getElementById('nextBtn').addEventListener('click', ()=> stepPeriod(1));
document.getElementById('todayBtn').addEventListener('click', ()=>{ state.cursorDate = new Date(); renderAll(); });
document.getElementById('refreshBtn').addEventListener('click', async ()=>{
  showLoading('กำลังซิงก์ข้อมูล...');
  try{ await Promise.all([loadRefSchools(), loadVisits()]); }
  finally{ hideLoading(); }
});
function stepPeriod(dir){
  const d = state.cursorDate;
  if(state.view==='month') state.cursorDate = new Date(d.getFullYear(), d.getMonth()+dir, 1);
  else if(state.view==='week') state.cursorDate = addDays(d, 7*dir);
  else state.cursorDate = addDays(d, dir);
  renderAll();
}
document.getElementById('searchInput').addEventListener('input', e=>{ state.search = e.target.value; renderAll(); });

/* ---------------- Booking form: activity rows ---------------- */
function activityRowHtml(a){
  const id = a.id || uid();
  return `<div class="activity-row" data-activity-id="${id}">
    <button type="button" class="activity-remove-btn" title="ลบกิจกรรมนี้">✕</button>
    <div class="activity-row-grid">
      <div class="field">
        <label>ห้อง/กิจกรรม</label>
        <select class="act-room">
          ${ROOM_CATEGORIES.map(r=>`<option value="${r.id}" ${a.room===r.id?'selected':''}>${r.label}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>เรื่อง/หัวข้อ</label>
        <input class="act-topic" value="${escapeHtml(a.topic||'')}" placeholder="เช่น D.I.Y. My Zodiac">
      </div>
      <div class="field">
        <label>เวลาเริ่ม</label>
        <input type="time" class="act-start" value="${a.startTime||''}">
      </div>
      <div class="field">
        <label>สิ้นสุด (ว่าง=ต่อเนื่อง)</label>
        <input type="time" class="act-end" value="${a.endTime||''}">
      </div>
      <div class="field">
        <label>จำนวนรอบ</label>
        <input type="number" min="1" class="act-rounds" value="${a.rounds||1}">
      </div>
      <div class="field">
        <label>ราคา/คน/รอบ (บาท)</label>
        <input type="number" min="0" class="act-price" value="${a.pricePerPerson ?? ''}">
      </div>
    </div>
    <div class="round-presets">
      <button type="button" data-s="09:30" data-e="10:30">09:30–10:30</button>
      <button type="button" data-s="11:00" data-e="12:00">11:00–12:00</button>
      <button type="button" data-s="13:00" data-e="">13:00 เป็นต้นไป</button>
    </div>
    <div class="activity-subtotal">รวม: <b class="act-subtotal-value">0</b> บาท</div>
  </div>`;
}
function getFormTotalPeople(){
  const c = Number(document.getElementById('f_childrenCount').value)||0;
  const a = Number(document.getElementById('f_adultCount').value)||0;
  return c+a;
}
function getFormChildrenCount(){
  return Number(document.getElementById('f_childrenCount').value)||0;
}
function recomputeRowSubtotal(rowEl){
  const billable = getFormChildrenCount(); // คิดราคาจากจำนวนเด็กเท่านั้น
  const rounds = Number(rowEl.querySelector('.act-rounds').value)||0;
  const price = Number(rowEl.querySelector('.act-price').value)||0;
  const subtotal = rounds*price*billable;
  rowEl.querySelector('.act-subtotal-value').textContent = money(subtotal);
}
function recomputeAllSubtotals(){
  document.querySelectorAll('#activityRows .activity-row').forEach(recomputeRowSubtotal);
}
function addActivityRow(prefill){
  const defaults = {room: ROOM_CATEGORIES[0].id, rounds:1, pricePerPerson: ROOM_DEFAULT_PRICE[ROOM_CATEGORIES[0].id]};
  document.getElementById('activityRows').insertAdjacentHTML('beforeend', activityRowHtml({...defaults, ...(prefill||{})}));
  const rows = document.querySelectorAll('#activityRows .activity-row');
  recomputeRowSubtotal(rows[rows.length-1]);
}
document.getElementById('addActivityBtn').addEventListener('click', ()=> addActivityRow());
document.getElementById('activityRows').addEventListener('click', (e)=>{
  if(e.target.classList.contains('activity-remove-btn')){
    e.target.closest('.activity-row').remove();
  } else if(e.target.matches('.round-presets button')){
    const row = e.target.closest('.activity-row');
    row.querySelector('.act-start').value = e.target.dataset.s || '';
    row.querySelector('.act-end').value = e.target.dataset.e || '';
  }
});
document.getElementById('activityRows').addEventListener('input', (e)=>{
  if(e.target.classList.contains('act-rounds') || e.target.classList.contains('act-price')){
    recomputeRowSubtotal(e.target.closest('.activity-row'));
  }
});
document.getElementById('activityRows').addEventListener('change', (e)=>{
  if(e.target.classList.contains('act-room')){
    const row = e.target.closest('.activity-row');
    const priceInput = row.querySelector('.act-price');
    if(!priceInput.value){ priceInput.value = ROOM_DEFAULT_PRICE[e.target.value] ?? ''; }
    recomputeRowSubtotal(row);
  }
});
['f_childrenCount','f_adultCount'].forEach(id=>{
  document.getElementById(id).addEventListener('input', ()=>{ updateTotalPeople(); recomputeAllSubtotals(); });
});
function updateTotalPeople(){
  document.getElementById('totalPeopleLabel').textContent = getFormTotalPeople();
  const billableEl = document.getElementById('billableLabel');
  if(billableEl) billableEl.textContent = getFormChildrenCount();
}

/* ---------------- Booking form modal ---------------- */
function openOverlay(id){ document.getElementById(id).classList.add('show'); }
function closeOverlay(id){ document.getElementById(id).classList.remove('show'); }
document.querySelectorAll('[data-close]').forEach(el=>{
  el.addEventListener('click', ()=> closeOverlay(el.dataset.close));
});

function openAddForm(prefillDate){
  state.editingId = null;
  document.getElementById('formTitle').textContent = 'เพิ่มการจอง';
  document.getElementById('bookingForm').reset();
  document.getElementById('f_id').value = '';
  document.getElementById('f_date').value = prefillDate || todayStr();
  document.getElementById('f_childrenCount').value = 0;
  document.getElementById('f_adultCount').value = 0;
  document.getElementById('conflictWarning').style.display = 'none';
  document.getElementById('activityRows').innerHTML = '';
  addActivityRow();
  updateTotalPeople();
  openOverlay('formOverlay');
}
function openEditForm(v){
  state.editingId = v.id;
  document.getElementById('formTitle').textContent = 'แก้ไขการจอง';
  document.getElementById('f_id').value = v.id;
  document.getElementById('f_school').value = v.school;
  document.getElementById('f_gradeLevel').value = v.gradeLevel||'';
  document.getElementById('f_packageLabel').value = v.packageLabel||'';
  document.getElementById('f_contactPerson').value = v.contactPerson||'';
  document.getElementById('f_contactPhone').value = v.contactPhone||'';
  document.getElementById('f_date').value = v.date;
  document.getElementById('f_childrenCount').value = v.childrenCount||0;
  document.getElementById('f_adultCount').value = v.adultCount||0;
  document.getElementById('f_notes').value = v.notes||'';
  document.getElementById('activityRows').innerHTML = v.activities.map(activityRowHtml).join('');
  document.getElementById('conflictWarning').style.display = 'none';
  recomputeAllSubtotals();
  updateTotalPeople();
  closeOverlay('detailOverlay');
  openOverlay('formOverlay');
}
document.getElementById('addBtn').addEventListener('click', ()=> openAddForm(fmtDate(state.cursorDate)));

function readActivitiesFromForm(){
  return [...document.querySelectorAll('#activityRows .activity-row')].map(row=>({
    id: row.dataset.activityId,
    room: row.querySelector('.act-room').value,
    topic: row.querySelector('.act-topic').value.trim(),
    startTime: row.querySelector('.act-start').value,
    endTime: row.querySelector('.act-end').value,
    rounds: Number(row.querySelector('.act-rounds').value)||1,
    pricePerPerson: Number(row.querySelector('.act-price').value)||0
  }));
}
function findActivityConflicts(activities, date, excludeVisitId){
  const conflicts = [];
  state.visits.forEach(v=>{
    if(v.id === excludeVisitId) return;
    if(v.date !== date) return;
    v.activities.forEach(other=>{
      activities.forEach(a=>{
        if(a.room !== other.room) return;
        if(!a.startTime || !a.endTime || !other.startTime || !other.endTime) return;
        if(timeOverlap(a.startTime, a.endTime, other.startTime, other.endTime)){
          conflicts.push({school:v.school, room:a.room, startTime:other.startTime, endTime:other.endTime});
        }
      });
    });
  });
  return conflicts;
}

document.getElementById('saveBookingBtn').addEventListener('click', async ()=>{
  const school = document.getElementById('f_school').value.trim();
  const date = document.getElementById('f_date').value;
  if(!school || !date){
    alert('กรุณากรอกชื่อโรงเรียนและวันที่ ให้ครบ'); return;
  }
  const activities = readActivitiesFromForm();
  if(activities.length===0){
    alert('กรุณาเพิ่มกิจกรรมอย่างน้อย 1 รายการ'); return;
  }
  for(const a of activities){
    if(!a.startTime){ alert('กรุณาระบุเวลาเริ่มของทุกกิจกรรม'); return; }
    if(a.endTime && a.endTime <= a.startTime){ alert('เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม'); return; }
  }

  const saveBtn = document.getElementById('saveBookingBtn');
  const conflicts = findActivityConflicts(activities, date, state.editingId);
  if(conflicts.length>0 && !saveBtn.dataset.forced){
    const warn = document.getElementById('conflictWarning');
    warn.style.display='block';
    warn.innerHTML = '⚠ เวลาทับซ้อนกับ: ' + conflicts.map(c=>`${escapeHtml(c.school)} - ${roomInfo(c.room).label} (${c.startTime}-${c.endTime})`).join(', ') +
      '<br>กด "บันทึกการจอง" อีกครั้งเพื่อยืนยันว่าต้องการจองซ้อนจริง';
    saveBtn.dataset.forced = '1';
    return;
  }
  saveBtn.dataset.forced = '';

  const data = {
    school,
    gradeLevel: document.getElementById('f_gradeLevel').value.trim(),
    packageLabel: document.getElementById('f_packageLabel').value.trim(),
    contactPerson: document.getElementById('f_contactPerson').value.trim(),
    contactPhone: document.getElementById('f_contactPhone').value.trim(),
    date,
    childrenCount: Number(document.getElementById('f_childrenCount').value)||0,
    adultCount: Number(document.getElementById('f_adultCount').value)||0,
    notes: document.getElementById('f_notes').value.trim(),
    activities
  };

  saveBtn.disabled = true;
  showLoading(state.editingId ? 'กำลังบันทึกการแก้ไข...' : 'กำลังบันทึกการจอง...');
  try{
    if(CONFIG.API_URL){
      let saved;
      if(state.editingId){
        saved = await apiSendVisit('update', {data:{...data, id: state.editingId}});
        const i = state.visits.findIndex(v=>v.id===state.editingId);
        if(i>-1) state.visits[i] = saved; else state.visits.push(saved);
      } else {
        saved = await apiSendVisit('create', {data});
        state.visits.push(saved);
      }
      loadVisits(); // ซิงก์กับชีตเบื้องหลัง ไม่ต้องรอ เพื่อไม่ให้ปฏิทินค้างถ้าการอ่านซ้ำช้า/พลาด
    } else {
      const now = new Date().toISOString();
      if(state.editingId){
        const i = state.visits.findIndex(v=>v.id===state.editingId);
        state.visits[i] = {...state.visits[i], ...data, updatedAt: now};
      } else {
        const dayCount = state.visits.filter(v=>v.date===date).length + 1;
        const docNo = 'BK-' + date.replace(/-/g,'') + '-' + pad(dayCount);
        state.visits.push({...data, id: uid(), docNo, status:'pending', createdAt: now, updatedAt: now});
      }
      saveVisitsLocal();
    }
    // เลื่อนปฏิทินไปยังวันที่ของการจองที่เพิ่งบันทึก จะได้เห็นทันทีไม่ว่าก่อนหน้าจะดูเดือน/วันไหนอยู่
    state.cursorDate = parseDate(date);
    if(state.activeRoomFilters.size===0 || !activities.some(a=>state.activeRoomFilters.has(a.room))){
      activities.forEach(a=>state.activeRoomFilters.add(a.room));
    }
    if(!state.activeStatusFilters.has('pending')) state.activeStatusFilters.add('pending');
    if(!state.activeStatusFilters.has('confirmed')) state.activeStatusFilters.add('confirmed');
    renderAll();
    closeOverlay('formOverlay');
  }catch(err){
    alert('บันทึกไม่สำเร็จ: '+err.message);
  }finally{
    saveBtn.disabled = false;
    hideLoading();
  }
});

/* ---------------- Detail modal ---------------- */
function openDetail(id){
  const v = state.visits.find(x=>x.id===id);
  if(!v) return;
  state.currentDetailId = id;
  document.getElementById('detailStatusSelect').value = v.status;
  const totalPeople = visitTotalPeople(v);
  document.getElementById('detailTable').innerHTML = `
    <tr><td class="k">เลขที่เอกสาร</td><td>${v.docNo||'-'}</td></tr>
    <tr><td class="k">โรงเรียน</td><td>${escapeHtml(v.school)}</td></tr>
    <tr><td class="k">ระดับชั้น/กลุ่ม</td><td>${escapeHtml(v.gradeLevel)||'-'}</td></tr>
    <tr><td class="k">ผู้ประสานงาน</td><td>${escapeHtml(v.contactPerson)||'-'} ${v.contactPhone?('· '+escapeHtml(v.contactPhone)):''}</td></tr>
    <tr><td class="k">วันที่</td><td>${v.date} (${thaiFullDate(v.date)})</td></tr>
    <tr><td class="k">จำนวนคน</td><td>เด็ก ${v.childrenCount||0} · ผู้ใหญ่ ${v.adultCount||0} · รวม ${totalPeople} คน</td></tr>
    <tr><td class="k">หมายเหตุ</td><td>${escapeHtml(v.notes)||'-'}</td></tr>
  `;
  const acts = visitActivitiesSorted(v);
  const grand = visitGrandTotal(v);
  const billable = billableCount(v);
  document.getElementById('costTable').innerHTML = `
    <tr><th>กิจกรรม</th><th>เวลา</th><th>รอบ</th><th>ราคา/คน</th><th>รวม (บาท)</th></tr>
    ${acts.map(a=>`<tr>
      <td>${roomInfo(a.room).label}${a.topic?('<br><span style="color:var(--ink-faint);font-size:11.5px;">'+escapeHtml(a.topic)+'</span>'):''}</td>
      <td>${a.startTime}${a.endTime?('–'+a.endTime):' เป็นต้นไป'}</td>
      <td>${a.rounds||1}</td>
      <td>${money(a.pricePerPerson)}</td>
      <td>${money(activitySubtotal(a,billable))}</td>
    </tr>`).join('')}
    <tr class="total-row"><td colspan="4">รวมค่าใช้จ่ายทั้งหมด (คิดจากเด็ก ${billable} คน)</td><td>${money(grand)} บาท</td></tr>
  `;
  openOverlay('detailOverlay');
}
document.getElementById('detailStatusSelect').addEventListener('change', async (e)=>{
  const id = state.currentDetailId;
  const newStatus = e.target.value;
  showLoading('กำลังอัปเดตสถานะ...');
  try{
    if(CONFIG.API_URL){
      const updated = await apiSendVisit('updateStatus', {id, status:newStatus});
      const i = state.visits.findIndex(v=>v.id===id);
      if(i>-1) state.visits[i] = updated;
      renderAll();
      loadVisits(); // ซิงก์กับชีตเบื้องหลัง
    } else {
      const i = state.visits.findIndex(v=>v.id===id);
      if(i>-1){ state.visits[i].status = newStatus; state.visits[i].updatedAt = new Date().toISOString(); saveVisitsLocal(); renderAll(); }
    }
  }catch(err){
    alert('อัปเดตสถานะไม่สำเร็จ: '+err.message);
  }finally{
    hideLoading();
  }
});
document.getElementById('editBookingBtn').addEventListener('click', ()=>{
  const v = state.visits.find(x=>x.id===state.currentDetailId);
  if(v) openEditForm(v);
});
document.getElementById('deleteBookingBtn').addEventListener('click', async ()=>{
  if(!confirm('ยืนยันลบการจองนี้ทั้งหมด (ทุกกิจกรรมในการจองนี้)? การลบไม่สามารถกู้คืนได้')) return;
  showLoading('กำลังลบข้อมูล...');
  try{
    if(CONFIG.API_URL){
      await apiSendVisit('delete', {id: state.currentDetailId});
      state.visits = state.visits.filter(v=>v.id!==state.currentDetailId);
      closeOverlay('detailOverlay');
      renderAll();
      loadVisits(); // ซิงก์กับชีตเบื้องหลัง
    } else {
      state.visits = state.visits.filter(v=>v.id!==state.currentDetailId);
      saveVisitsLocal();
      closeOverlay('detailOverlay');
      renderAll();
    }
  }catch(err){
    alert('ลบไม่สำเร็จ: '+err.message);
  }finally{
    hideLoading();
  }
});

/* ---------------- Document A: แบบตอบรับการจองเข้าร่วมกิจกรรม ---------------- */
function buildDocA_Html(v){
  const billable = billableCount(v);
  const acts = v.activities;
  const roomLine = (id, label, showRounds=true)=>{
    const a = acts.find(x=>x.room===id);
    const roundsTxt = (showRounds && a) ? `จำนวน ${a.rounds||1} รอบ ` : '';
    return `<div class="doc-checkbox-line">${a?'☒':'☐'} กิจกรรม ${label} ${roundsTxt}รวม จำนวน ${billable} คน</div>`;
  };
  return `
  <div class="doc-page">
    <div class="doc-title">แบบตอบรับการจองเข้าร่วมกิจกรรม</div>
    <div class="doc-title sub">ณ ${escapeHtml(DOC_CONFIG.venueName)}</div>
    <hr class="doc-rule">
    <div class="doc-line">1. ชื่อหน่วยงาน/โรงเรียน <b>${escapeHtml(v.school)}</b></div>
    <div class="doc-line">2. เข้าร่วมกิจกรรมในวันที่ ${thaiFullDate(v.date)} ณ ${escapeHtml(DOC_CONFIG.venueName)}</div>
    ${roomLine('innovation','Innovation Space')}
    ${roomLine('inspirelab','Inspire Lab')}
    ${roomLine('other', roomInfo('other').label, false)}
    <div class="doc-section-title">3. รายละเอียดการเข้าร่วมกิจกรรม</div>
    ${acts.filter(a=>a.topic).map(a=>`<div class="doc-line">${roomInfo(a.room).label} เรื่อง ${escapeHtml(a.topic)}</div>`).join('') || '<div class="doc-line">-</div>'}
    <div class="doc-section-title">4. ผู้ประสานงาน</div>
    <div class="doc-line">ชื่อ-สกุล ${escapeHtml(v.contactPerson)||'..........................................'}</div>
    <div class="doc-line">โทรศัพท์ ${escapeHtml(v.contactPhone)||'..........................................'}</div>
    <div class="doc-notes-title">หมายเหตุ</div>
    <ul class="doc-notes-list">
      ${DOC_CONFIG.policyNotes.map(n=>`<li>${escapeHtml(n)}</li>`).join('')}
    </ul>
    <div class="doc-payment-note">- ${escapeHtml(DOC_CONFIG.paymentNote)}</div>
    <div class="doc-sign">
      <div class="line-fill">ลงชื่อ ........................................</div>
      <div class="line-fill">(........................................)</div>
      <div class="line-fill">ตำแหน่ง ........................................</div>
    </div>
    <div class="doc-footer">
      รบกวนส่งแบบตอบรับมาที่ Email : ${escapeHtml(DOC_CONFIG.contactEmail)}<br>
      สอบถามรายละเอียดเพิ่มเติม โทร. ${escapeHtml(DOC_CONFIG.contactPhone)}
    </div>
  </div>`;
}

/* ---------------- Document B: ตารางการเข้าร่วมกิจกรรม + ค่าใช้จ่าย ---------------- */
function activityDetailPhrase(a, billable){
  const topicPart = a.topic ? ` เรื่อง ${escapeHtml(a.topic)}` : '';
  const roundsPart = a.room!=='other' ? ` จำนวน ${a.rounds||1} รอบ` : '';
  return `กิจกรรม ${roomInfo(a.room).label}${topicPart}${roundsPart} รวม ${billable} คน`;
}
function buildDocB_Html(v){
  const billable = billableCount(v);
  const acts = visitActivitiesSorted(v);
  const grand = visitGrandTotal(v);
  const gradeCell = v.gradeLevel ? `<b>${escapeHtml(v.gradeLevel)}</b><br>(${billable} คน)` : `<b>ผู้เข้าร่วม</b><br>(${billable} คน)`;
  const introText = `${thaiFullDateWithDay(v.date)} ผู้เข้าร่วมกิจกรรม${escapeHtml(expandGradeLevel(v.gradeLevel))} จำนวน ${billable} คน`;
  return `
  <div class="doc-page">
    <div class="doc-title">ตารางการเข้าร่วมกิจกรรม ณ ${escapeHtml(DOC_CONFIG.venueName)}</div>
    <div class="doc-title sub">${escapeHtml(v.school)}</div>
    <hr class="doc-rule">
    <table class="doc-table">
      <tr>
        <th style="width:18%;">จำนวนนักเรียน</th>
        ${acts.map(a=>`<th>${thTime(a.startTime)}${a.endTime?(' – '+thTime(a.endTime)):' เป็นต้นไป'}</th>`).join('')}
      </tr>
      <tr>
        <td>${gradeCell}</td>
        ${acts.map(a=>`<td><div class="room">${roomInfo(a.room).label}</div>${a.topic?`<div class="topic">${escapeHtml(a.topic)}</div>`:''}</td>`).join('')}
      </tr>
    </table>
    <div class="doc-section-title">รายละเอียดการเข้าร่วมกิจกรรม</div>
    <ul class="doc-notes-list">
      <li><b>${introText}</b></li>
      ${acts.map(a=>`<li>${activityDetailPhrase(a,billable)}</li>`).join('')}
    </ul>
    <div class="doc-section-title">สรุปค่าใช้จ่ายในการทำกิจกรรม</div>
    <ul class="doc-notes-list">
      ${acts.map(a=>`<li>กิจกรรม ${roomInfo(a.room).label} รวมทั้งสิ้น ${a.rounds||1} รอบ ผู้เข้าชม รวม ${billable} คน รวมเป็นเงิน ${money(activitySubtotal(a,billable))} บาท</li>`).join('')}
    </ul>
    <div class="doc-line doc-cost-blue">รวมค่าใช้จ่ายในการเข้าร่วมกิจกรรม ${money(grand)} บาท${v.packageLabel?(' ('+escapeHtml(v.packageLabel)+')'):''}</div>
    <div class="doc-payment-note" style="margin-left:0;">${escapeHtml(DOC_CONFIG.paymentNote)}</div>
  </div>`;
}

document.getElementById('printDocABtn').addEventListener('click', ()=>{
  const v = state.visits.find(x=>x.id===state.currentDetailId);
  if(!v) return;
  document.getElementById('printArea').innerHTML = buildDocA_Html(v);
  window.print();
});
document.getElementById('printDocBBtn').addEventListener('click', ()=>{
  const v = state.visits.find(x=>x.id===state.currentDetailId);
  if(!v) return;
  document.getElementById('printArea').innerHTML = buildDocB_Html(v);
  window.print();
});

/* ---------------- Word (.docx) export using docx.js, font: TH Sarabun PSK ---------------- */
const DOCX_FONT = 'TH Sarabun PSK';
function dRun(text, opts={}){
  return new docx.TextRun({ text: String(text), font: DOCX_FONT, size: opts.size||32, bold: !!opts.bold, color: opts.color||undefined });
}
function dPara(text, opts={}){
  const alignMap = {left:docx.AlignmentType.LEFT, center:docx.AlignmentType.CENTER, right:docx.AlignmentType.RIGHT};
  return new docx.Paragraph({
    alignment: alignMap[opts.align||'left'],
    spacing: {after: opts.after??120, before: opts.before||0},
    indent: opts.indent ? {left: opts.indent} : undefined,
    border: opts.borderBottom ? {bottom:{color:'999999', space:4, style:docx.BorderStyle.SINGLE, size:6}} : undefined,
    children: [dRun(text, opts)]
  });
}
function dCheckboxPara(checked, text, opts={}){
  return new docx.Paragraph({
    spacing: {after:80}, indent: {left:360},
    children: [ dRun(checked?'☒ ':'☐ ', opts), dRun(text, opts) ]
  });
}
function dCell(paras, opts={}){
  return new docx.TableCell({
    width: opts.width ? {size:opts.width, type:docx.WidthType.PERCENTAGE} : undefined,
    children: Array.isArray(paras) ? paras : [paras]
  });
}

function buildDocA_Docx(v){
  const billable = billableCount(v);
  const acts = v.activities;
  const roomLinePara = (id,label,showRounds=true)=>{
    const a = acts.find(x=>x.room===id);
    const roundsTxt = (showRounds && a) ? `จำนวน ${a.rounds||1} รอบ ` : '';
    return dCheckboxPara(!!a, `กิจกรรม ${label} ${roundsTxt}รวม จำนวน ${billable} คน`);
  };
  const topicParas = acts.filter(a=>a.topic).map(a=> dPara(`${roomInfo(a.room).label} เรื่อง ${a.topic}`, {after:60}));
  const noteParas = DOC_CONFIG.policyNotes.map(n=> dPara('- '+n, {size:26, after:50}));

  const children = [
    dPara('แบบตอบรับการจองเข้าร่วมกิจกรรม', {align:'center', bold:true, size:40, after:30}),
    dPara('ณ '+DOC_CONFIG.venueName, {align:'center', bold:true, size:34, after:80, borderBottom:true}),
    dPara('1. ชื่อหน่วยงาน/โรงเรียน  '+v.school, {bold:true, after:80}),
    dPara('2. เข้าร่วมกิจกรรมในวันที่ '+thaiFullDate(v.date)+' ณ '+DOC_CONFIG.venueName, {after:60}),
    roomLinePara('innovation','Innovation Space'),
    roomLinePara('inspirelab','Inspire Lab'),
    roomLinePara('other', roomInfo('other').label, false),
    dPara('3. รายละเอียดการเข้าร่วมกิจกรรม', {bold:true, after:50, before:60}),
    ...(topicParas.length?topicParas:[dPara('-', {after:60})]),
    dPara('4. ผู้ประสานงาน', {bold:true, after:50}),
    dPara('ชื่อ-สกุล '+(v.contactPerson||'..........................................'), {after:40}),
    dPara('โทรศัพท์ '+(v.contactPhone||'..........................................'), {after:120}),
    dPara('หมายเหตุ', {bold:true, after:50}),
    ...noteParas,
    dPara(DOC_CONFIG.paymentNote, {bold:true, color:'B00000', size:26, indent:360, after:260}),
    dPara('ลงชื่อ ........................................', {align:'right', after:10}),
    dPara('(........................................)', {align:'right', after:10}),
    dPara('ตำแหน่ง ........................................', {align:'right', after:220}),
    dPara('รบกวนส่งแบบตอบรับมาที่ Email : '+DOC_CONFIG.contactEmail, {size:24, after:40}),
    dPara('สอบถามรายละเอียดเพิ่มเติม โทร. '+DOC_CONFIG.contactPhone, {size:24})
  ];
  return new docx.Document({ sections:[{ children }] });
}

function buildDocB_Docx(v){
  const billable = billableCount(v);
  const acts = visitActivitiesSorted(v);
  const grand = visitGrandTotal(v);

  const headerCells = [
    dCell(dPara('จำนวนนักเรียน', {align:'center', bold:true, size:28, after:0}), {width:20}),
    ...acts.map(a=> dCell(dPara(thTime(a.startTime)+(a.endTime?(' – '+thTime(a.endTime)):' เป็นต้นไป'), {align:'center', bold:true, size:28, after:0})))
  ];
  const dataCells = [
    dCell([
      dPara(v.gradeLevel||'ผู้เข้าร่วม', {align:'center', bold:true, size:28, after:20}),
      dPara(`(${billable} คน)`, {align:'center', size:26, after:0})
    ]),
    ...acts.map(a=> dCell([
      dPara(roomInfo(a.room).label, {align:'center', bold:true, size:28, after:20}),
      dPara(a.topic||'-', {align:'center', size:24, after:0})
    ]))
  ];
  const table = new docx.Table({
    width: {size:100, type:docx.WidthType.PERCENTAGE},
    rows: [ new docx.TableRow({children:headerCells}), new docx.TableRow({children:dataCells}) ]
  });

  const detailBullets = acts.map(a=> dPara('- '+activityDetailPhraseDocx(a,billable), {after:50}));
  const introText = `- ${thaiFullDateWithDay(v.date)} ผู้เข้าร่วมกิจกรรม${expandGradeLevel(v.gradeLevel)} จำนวน ${billable} คน`;
  const costBullets = acts.map(a=> dPara(`- กิจกรรม ${roomInfo(a.room).label} รวมทั้งสิ้น ${a.rounds||1} รอบ ผู้เข้าชม รวม ${billable} คน รวมเป็นเงิน ${money(activitySubtotal(a,billable))} บาท`, {after:50}));

  const children = [
    dPara('ตารางการเข้าร่วมกิจกรรม ณ '+DOC_CONFIG.venueName, {align:'center', bold:true, size:36, after:30}),
    dPara(v.school, {align:'center', bold:true, size:32, after:120, borderBottom:true}),
    table,
    dPara('', {after:160}),
    dPara('รายละเอียดการเข้าร่วมกิจกรรม', {bold:true, after:60}),
    dPara(introText, {bold:true, after:60}),
    ...detailBullets,
    dPara('สรุปค่าใช้จ่ายในการทำกิจกรรม', {bold:true, after:60, before:60}),
    ...costBullets,
    dPara(`รวมค่าใช้จ่ายในการเข้าร่วมกิจกรรม ${money(grand)} บาท${v.packageLabel?(' ('+v.packageLabel+')'):''}`, {bold:true, color:'1F4E96', after:100}),
    dPara(DOC_CONFIG.paymentNote, {bold:true, color:'B00000'})
  ];
  return new docx.Document({ sections:[{ children }] });
}
function activityDetailPhraseDocx(a, billable){
  const topicPart = a.topic ? ` เรื่อง ${a.topic}` : '';
  const roundsPart = a.room!=='other' ? ` จำนวน ${a.rounds||1} รอบ` : '';
  return `กิจกรรม ${roomInfo(a.room).label}${topicPart}${roundsPart} รวม ${billable} คน`;
}

function triggerDocxDownload(doc, filename){
  docx.Packer.toBlob(doc).then(blob=>{
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }).catch(err=> alert('สร้างไฟล์ Word ไม่สำเร็จ: '+err.message));
}
document.getElementById('downloadDocABtn').addEventListener('click', ()=>{
  const v = state.visits.find(x=>x.id===state.currentDetailId);
  if(!v) return;
  triggerDocxDownload(buildDocA_Docx(v), `แบบตอบรับ_${v.docNo||v.id}.docx`);
});
document.getElementById('downloadDocBBtn').addEventListener('click', ()=>{
  const v = state.visits.find(x=>x.id===state.currentDetailId);
  if(!v) return;
  triggerDocxDownload(buildDocB_Docx(v), `ตารางกิจกรรม_${v.docNo||v.id}.docx`);
});

/* ---------------- Init ---------------- */
(async ()=>{
  showLoading('กำลังโหลดข้อมูล...');
  try{ await Promise.all([loadVisits(), loadRefSchools()]); }
  finally{ hideLoading(); }
})();
if(CONFIG.API_URL){
  setInterval(loadVisits, 20000); // ดึงข้อมูลใหม่ทุก 20 วิ เพื่อให้หลายคนเห็นข้อมูลตรงกัน (เงียบ ไม่ขึ้นป๊อปอัป)
}
