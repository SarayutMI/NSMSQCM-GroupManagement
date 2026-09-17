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
  API_URL: 'https://script.google.com/macros/s/AKfycbwMZD55K857pQ1XCi0q2jwsRmsj_4tOLE5H33DFyzynKh96vaJhsPK5A3n9vmM78k07uw/exec',            // <-- ใส่ URL ของ Google Apps Script Web App (จาก Code.gs) ที่นี่ เพื่อเชื่อม Sheet จริง
  SCHOOLS_CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHwC49QdSskveBiTSa9BZLxSMEvW6wa_XUEhFQQP5jStHI-EVPGdIjG3Goo_-iNiXKJkmYevzcC2kl/pub?gid=0&single=true&output=csv'     // <-- ใส่ลิงก์ CSV รายชื่อโรงเรียนอ้างอิงจาก Google Sheet ที่นี่
};

/* ตั้งค่าข้อความ/ข้อมูลที่ใช้พิมพ์ในเอกสาร แก้ตรงนี้ได้ตามหน่วยงานจริง */
const DOC_CONFIG = {
  venueName: 'จัตุรัสวิทยาศาสตร์ อพวช. เชียงใหม่',
  facebookPage: 'NSM Science Square at Chiang Mai',
  contactEmail: 'Yuttana.s@nsm.or.th',
  contactPhone: '093-745-8550',
  paymentNote: 'การชำระเงินกรุณาชำระผ่านการโอนได้ที่เคาน์เตอร์ในวันที่มาร่วมกิจกรรมเท่านั้น (งดรับเงินสด)',
  priceLines: [
    {label:'Basic', price:90, normalPrice:100},
    {label:'Advance', price:180, normalPrice:200}
  ],
  policyNotes: [
    'ค่าธรรมเนียมเข้าร่วมกิจกรรมกรณีเป็นหมู่คณะ 10 คนขึ้นไปต่อรอบ',
    'หากจองเข้าร่วมเป็นหมู่คณะ 15 คนขึ้นไปต่อรอบ สามารถเลือกเรื่องกิจกรรมที่ต้องการเข้าร่วมได้ (ตามตารางกิจกรรม)',
    'กรณีที่ผู้เข้าร่วมกิจกรรมมาไม่ครบตามจำนวนที่แจ้ง ขอเก็บค่าธรรมเนียมขั้นต่ำที่ 15 คนต่อรอบ หากมามากกว่าที่แจ้งไว้ คิดค่าธรรมเนียมตามจำนวนที่มาจริง',
    'หากมีผู้เข้าร่วมกิจกรรมน้อยกว่า 20 คนต่อรอบ ทาง จัตุรัสวิทยาศาสตร์ มีสิทธิ์รับผู้เข้าร่วมกิจกรรมภายนอกเพิ่มเติม',
    'แจ้งยืนยันการเข้าร่วมกิจกรรมล่วงหน้าก่อน 7 วัน',
    'กรณีต้องการเปลี่ยนแปลงหรือยกเลิกการจองเข้าร่วมกิจกรรมกรุณาแจ้งก่อนวันที่เข้าร่วมอย่างน้อย 3 วันทำการ'
  ]
};

const ROOM_CATEGORIES = [
  {id:'innovation', label:'Innovation Space', color:'var(--yellow)', bg:'var(--yellow-dim)'},
  {id:'inspirelab', label:'Inspire Lab',       color:'var(--sky)',   bg:'var(--sky-dim)'},
  {id:'other',      label:'อื่นๆ',              color:'var(--purple)', bg:'var(--purple-dim)'}
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
/* ---------------- Agenda (week/day) time grid ---------------- */
const AGENDA_GRID_START = 8*60;  // 08:00
const AGENDA_GRID_END = 17*60;   // 17:00
const AGENDA_SLOT_MIN = 30;
const AGENDA_SLOT_PX = 34;
function timeToMinutes(t){
  if(!t) return null;
  const [h,m] = t.split(':').map(Number);
  return h*60+(m||0);
}
function layoutAgendaItems(dayItems){
  // จัดตำแหน่ง block ตามเวลาจริง + แบ่งคอลัมน์ย่อยถ้าเวลาทับซ้อนกันในวันเดียวกัน
  const withMin = dayItems.map(o=>{
    const startMin = timeToMinutes(o.startTime) ?? AGENDA_GRID_START;
    const rawEndMin = (o.endTime==='23:59'||!o.endTime) ? AGENDA_GRID_END : (timeToMinutes(o.endTime) ?? AGENDA_GRID_END);
    const endMin = Math.max(rawEndMin, startMin+AGENDA_SLOT_MIN);
    return {...o, startMin, endMin};
  }).sort((a,b)=> a.startMin-b.startMin || a.endMin-b.endMin);

  const clusters = [];
  let current = [], currentEnd = -Infinity;
  withMin.forEach(ev=>{
    if(current.length && ev.startMin >= currentEnd){ clusters.push(current); current=[]; currentEnd=-Infinity; }
    current.push(ev);
    currentEnd = Math.max(currentEnd, ev.endMin);
  });
  if(current.length) clusters.push(current);

  const placed = [];
  clusters.forEach(cluster=>{
    const colEnds = [];
    cluster.forEach(ev=>{
      let col = colEnds.findIndex(end=> end<=ev.startMin);
      if(col===-1){ col = colEnds.length; colEnds.push(ev.endMin); }
      else colEnds[col] = ev.endMin;
      ev.col = col;
    });
    const colCount = colEnds.length;
    cluster.forEach(ev=> placed.push({...ev, colCount}));
  });
  return placed;
}
function agendaGridHeightPx(){ return (AGENDA_GRID_END-AGENDA_GRID_START)/AGENDA_SLOT_MIN*AGENDA_SLOT_PX; }
function agendaAxisHtml(){
  let out = '';
  for(let m=AGENDA_GRID_START; m<=AGENDA_GRID_END; m+=60){
    const top = (m-AGENDA_GRID_START)/AGENDA_SLOT_MIN*AGENDA_SLOT_PX;
    out += `<div class="axis-label" style="top:${top}px">${pad(Math.floor(m/60))}:00</div>`;
  }
  return out;
}
function agendaGridLinesHtml(){
  let out = '';
  for(let m=AGENDA_GRID_START; m<=AGENDA_GRID_END; m+=AGENDA_SLOT_MIN){
    const top = (m-AGENDA_GRID_START)/AGENDA_SLOT_MIN*AGENDA_SLOT_PX;
    out += `<div class="agenda-gridline ${m%60===0?'hour':''}" style="top:${top}px"></div>`;
  }
  return out;
}
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
function extractGradeTokens(str){
  // ดึงคู่ (ป/ม/อ, เลขชั้น) จากข้อความได้ทุกที่ ไม่ต้องอยู่ต้นสตริง เผื่อช่อง "ระดับชั้น/กลุ่ม" เป็นชื่อกลุ่มที่พิมพ์เองแบบ "กลุ่ม 1 อ.3"
  // บังคับต้องมีจุดหลังตัวย่อ (ป./ม./อ.) กันไปแมตช์ตัวอักษร ป/ม/อ ที่อยู่ในคำอื่น เช่น "กลุ่ม" ลงท้ายด้วย ม
  const out = [];
  const re = /(ป|ม)\.\s*(\d+)|อ(?:นุบาล)?\.\s*(\d+)/g;
  let m;
  while((m = re.exec(str||''))){
    if(m[1]) out.push({prefix:m[1], num:Number(m[2])});
    else out.push({prefix:'อ', num:Number(m[3])});
  }
  return out;
}
function compactGradeSummary(acts){
  // สรุประดับชั้นรวมแบบย่อ เช่น "ป.1-6 ม.2,5" — เลขต่อเนื่องรวมเป็นช่วง เลขไม่ต่อเนื่องคั่นด้วยจุลภาค
  const byPrefix = new Map();
  const prefixOrder = [];
  acts.forEach(a=>{
    extractGradeTokens(a.gradeLevel).forEach(({prefix,num})=>{
      if(!byPrefix.has(prefix)){ byPrefix.set(prefix, new Set()); prefixOrder.push(prefix); }
      byPrefix.get(prefix).add(num);
    });
  });
  const prefixRank = {'อ':0,'ป':1,'ม':2};
  const sortedPrefixes = prefixOrder.slice().sort((a,b)=> (prefixRank[a]??9)-(prefixRank[b]??9));
  const parts = sortedPrefixes.map(prefix=>{
    const nums = [...byPrefix.get(prefix)].sort((a,b)=>a-b);
    const ranges = [];
    let start = nums[0], prev = nums[0];
    for(let i=1;i<=nums.length;i++){
      const n = nums[i];
      if(n === prev+1){ prev = n; continue; }
      ranges.push(start===prev ? String(start) : `${start}-${prev}`);
      start = prev = n;
    }
    return `${prefix}.${ranges.join(',')}`;
  });
  if(parts.length) return parts.join(' ');
  // ไม่เจอเลขชั้นในข้อความเลย (พิมพ์เป็นชื่อกลุ่มอิสระ) — โชว์ข้อความดิบที่ไม่ซ้ำแทน
  return [...new Set(acts.map(a=>String(a.gradeLevel||'').trim()).filter(Boolean))].join(', ');
}

/* ---------------- Visit / activity helpers ---------------- */
function visitTotalPeople(v){ return (Number(v.childrenCount)||0) + (Number(v.adultCount)||0); }
function billableCount(v){
  // นับหัวเด็กครั้งเดียวต่อกลุ่ม (กลุ่มเดียวกันอาจเข้าหลายกิจกรรม/หลายรอบเวลา ไม่นับซ้ำ) ไม่รวมผู้ใหญ่
  return groupActivitiesByGroup(v.activities).reduce((sum,g)=> sum + (Number(g[0].childrenCount)||0), 0);
}
function activitySubtotal(a){ return (Number(a.pricePerPerson)||0) * (Number(a.childrenCount)||0); }
function visitGrandTotal(v){
  return v.activities.reduce((sum,a)=> sum + activitySubtotal(a), 0);
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
function buildTimeSlots(acts){
  const seen = new Map();
  acts.forEach(a=>{
    const key = a.startTime+'|'+(a.endTime||'');
    if(!seen.has(key)) seen.set(key, {startTime:a.startTime, endTime:a.endTime});
  });
  return [...seen.values()].sort((x,y)=> (x.startTime||'').localeCompare(y.startTime||''));
}
function timeSlotLabel(slot){
  return thTime(slot.startTime)+(slot.endTime?(' – '+thTime(slot.endTime)):' เป็นต้นไป');
}
function sameSlot(a, slot){
  return a.startTime===slot.startTime && (a.endTime||'')===(slot.endTime||'');
}
function groupActivitiesByGroup(acts){
  const map = new Map();
  (acts||[]).forEach(a=>{
    const gid = a.groupId || a.id;
    if(!map.has(gid)) map.set(gid, []);
    map.get(gid).push(a);
  });
  return [...map.values()];
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
    const fb = document.getElementById('f_contactFacebook');
    if(!cp.value) cp.value = match.contactPerson||'';
    if(!ct.value) ct.value = match.contactPhone||'';
    if(!fb.value) fb.value = match.contactFacebook||'';
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
      packageLabel:'Basic', contactPerson:'ครูนภา', contactPhone:'081-999-0000',
      date: d(1), childrenCount:81, adultCount:2, status:'confirmed',
      notes:'',
      activities:[
        {id:uid(), room:'inspirelab', gradeLevel:'ป.1', topic:'หิมะจำลองและผองเพื่อน', startTime:'09:30', endTime:'10:30', childrenCount:27, pricePerPerson:90},
        {id:uid(), room:'innovation', gradeLevel:'ป.1', topic:'D.I.Y. My Zodiac', startTime:'11:00', endTime:'12:00', childrenCount:27, pricePerPerson:90},
        {id:uid(), room:'other', gradeLevel:'ป.2', topic:'', startTime:'13:00', endTime:'', childrenCount:27, pricePerPerson:100}
      ],
      createdAt: now, updatedAt: now
    },
    {
      id: uid(), docNo:'BK-DEMO-002', school:'โรงเรียนอัสสัมชัญ',
      contactPerson:'ครูวิภา', contactPhone:'062-333-4444',
      date: d(2), childrenCount:18, adultCount:3, status:'pending', notes:'',
      activities:[
        {id:uid(), room:'inspirelab', gradeLevel:'ม.2', topic:'ค่ายไอเดียสร้างสรรค์', startTime:'13:00', endTime:'16:00', childrenCount:18, pricePerPerson:90}
      ],
      createdAt: now, updatedAt: now
    },
    {
      id: uid(), docNo:'BK-DEMO-003', school:'โรงเรียนเซนต์คาเบรียล',
      contactPerson:'ครูปิยะ', contactPhone:'095-555-6666',
      date: d(4), childrenCount:30, adultCount:4, status:'pending', notes:'มีเด็กแพ้ถั่ว 1 คน',
      activities:[
        {id:uid(), room:'other', gradeLevel:'', topic:'ทัศนศึกษาแลกเปลี่ยน', startTime:'10:00', endTime:'11:30', childrenCount:30, pricePerPerson:100}
      ],
      createdAt: now, updatedAt: now
    },
    {
      id: uid(), docNo:'BK-DEMO-004', school:'โรงเรียนกรุงเทพคริสเตียนวิทยาลัย',
      contactPerson:'ครูสมชาย', contactPhone:'089-111-2222',
      date: d(-1), childrenCount:20, adultCount:2, status:'confirmed', notes:'',
      activities:[
        {id:uid(), room:'innovation', gradeLevel:'ม.1', topic:'อบรมการเขียนโค้ดพื้นฐาน', startTime:'09:00', endTime:'12:00', childrenCount:20, pricePerPerson:90}
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
  const gridHeight = agendaGridHeightPx();
  container.innerHTML = `<div class="agenda-columns">
    <div class="agenda-timeaxis">
      <div class="ahead">&nbsp;</div>
      <div class="axis-body" style="height:${gridHeight}px">${agendaAxisHtml()}</div>
    </div>
    ${days.map(d=>{
    const ds = fmtDate(d);
    const dayItems = items.filter(o=>o.date===ds);
    const isToday = ds===todayStr();
    const laidOut = layoutAgendaItems(dayItems);
    return `<div class="agenda-day ${isToday?'today':''}">
      <div class="ahead">${WEEKDAYS_TH[d.getDay()]} <span class="num">${d.getDate()}</span></div>
      <div class="agenda-events" style="height:${gridHeight}px">
        ${agendaGridLinesHtml()}
        ${dayItems.length===0 ? '<div class="agenda-empty">ไม่มีการจอง</div>' : ''}
        ${laidOut.map(o=>{
          const r = roomInfo(o.room), s = statusInfo(o.status);
          const top = (Math.max(o.startMin,AGENDA_GRID_START)-AGENDA_GRID_START)/AGENDA_SLOT_MIN*AGENDA_SLOT_PX;
          const bottom = (Math.min(o.endMin,AGENDA_GRID_END)-AGENDA_GRID_START)/AGENDA_SLOT_MIN*AGENDA_SLOT_PX;
          const height = Math.max(bottom-top, AGENDA_SLOT_PX*0.7);
          const widthPct = 100/o.colCount;
          const leftPct = o.col*widthPct;
          return `<div class="agenda-card" data-visit-id="${o.visitId}" style="border-left-color:${r.color};background:${r.bg};top:${top}px;height:${height}px;left:${leftPct}%;width:calc(${widthPct}% - 4px)">
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

/* ---------------- Booking form: activity groups (1 กลุ่มนักเรียน อาจมีหลายรอบเวลา/กิจกรรม) ---------------- */
function activitySlotHtml(a){
  const id = a.id || uid();
  return `<div class="activity-slot" data-activity-id="${id}">
    <button type="button" class="activity-remove-btn" title="ลบรอบนี้">✕</button>
    <div class="activity-slot-grid">
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
        <label>ราคา/คน (บาท)</label>
        <input type="number" min="0" class="act-price" value="${a.pricePerPerson ?? ''}">
      </div>
    </div>
    <div class="round-presets">
      <button type="button" data-s="09:30" data-e="10:30">09:30–10:30</button>
      <button type="button" data-s="11:00" data-e="12:00">11:00–12:00</button>
      <button type="button" data-s="13:00" data-e="">13:00 เป็นต้นไป</button>
    </div>
  </div>`;
}
function activityGroupHtml(groupId, groupActs){
  const first = groupActs[0];
  return `<div class="activity-group" data-group-id="${groupId}">
    <button type="button" class="group-remove-btn" title="ลบกลุ่มนี้ทั้งหมด">✕ ลบกลุ่ม</button>
    <div class="activity-group-head">
      <div class="field">
        <label>ระดับชั้น/กลุ่ม</label>
        <input class="grp-grade" value="${escapeHtml(first.gradeLevel||'')}" placeholder="เช่น ป.1, ม.2/3 หรือ กลุ่ม 1 อ.3 (ใช้เป็นชื่อกลุ่มในตารางเอกสารโดยตรง)">
      </div>
      <div class="field">
        <label>จำนวนเด็กในกลุ่มนี้</label>
        <input type="number" min="0" class="grp-children" value="${first.childrenCount||0}">
      </div>
    </div>
    <div class="activity-slots">
      ${groupActs.map(activitySlotHtml).join('')}
    </div>
    <button type="button" class="btn btn-sm add-slot-btn">+ เพิ่มรอบเวลา/กิจกรรมในกลุ่มนี้</button>
    <div class="activity-subtotal">รวมค่าใช้จ่ายกลุ่มนี้: <b class="grp-subtotal-value">0</b> บาท</div>
  </div>`;
}
function getFormTotalPeople(){
  const c = getFormChildrenCount();
  const a = Number(document.getElementById('f_adultCount').value)||0;
  return c+a;
}
function getFormChildrenCount(){
  return [...document.querySelectorAll('#activityRows .grp-children')].reduce((sum,el)=> sum+(Number(el.value)||0), 0);
}
function recomputeGroupSubtotal(groupEl){
  const children = Number(groupEl.querySelector('.grp-children').value)||0;
  let total = 0;
  groupEl.querySelectorAll('.activity-slot .act-price').forEach(el=>{ total += (Number(el.value)||0)*children; });
  groupEl.querySelector('.grp-subtotal-value').textContent = money(total);
}
function recomputeAllGroupSubtotals(){
  document.querySelectorAll('#activityRows .activity-group').forEach(recomputeGroupSubtotal);
}
function addActivityGroup(prefillActs){
  const gid = uid();
  const defaults = {room: ROOM_CATEGORIES[0].id, pricePerPerson: ROOM_DEFAULT_PRICE[ROOM_CATEGORIES[0].id]};
  const acts = (prefillActs && prefillActs.length) ? prefillActs : [defaults];
  document.getElementById('activityRows').insertAdjacentHTML('beforeend', activityGroupHtml(gid, acts));
  const groups = document.querySelectorAll('#activityRows .activity-group');
  recomputeGroupSubtotal(groups[groups.length-1]);
  updateTotalPeople();
}
document.getElementById('addActivityBtn').addEventListener('click', ()=> addActivityGroup());
document.getElementById('activityRows').addEventListener('click', (e)=>{
  if(e.target.classList.contains('add-slot-btn')){
    const group = e.target.closest('.activity-group');
    const defaults = {room: ROOM_CATEGORIES[0].id, pricePerPerson: ROOM_DEFAULT_PRICE[ROOM_CATEGORIES[0].id]};
    group.querySelector('.activity-slots').insertAdjacentHTML('beforeend', activitySlotHtml(defaults));
    recomputeGroupSubtotal(group);
  } else if(e.target.classList.contains('group-remove-btn')){
    e.target.closest('.activity-group').remove();
    updateTotalPeople();
  } else if(e.target.classList.contains('activity-remove-btn')){
    const group = e.target.closest('.activity-group');
    const slot = e.target.closest('.activity-slot');
    if(group.querySelectorAll('.activity-slot').length<=1){ group.remove(); } else { slot.remove(); }
    updateTotalPeople();
  } else if(e.target.matches('.round-presets button')){
    const slot = e.target.closest('.activity-slot');
    slot.querySelector('.act-start').value = e.target.dataset.s || '';
    slot.querySelector('.act-end').value = e.target.dataset.e || '';
  }
});
document.getElementById('activityRows').addEventListener('input', (e)=>{
  if(e.target.classList.contains('act-price') || e.target.classList.contains('grp-children')){
    recomputeGroupSubtotal(e.target.closest('.activity-group'));
  }
  if(e.target.classList.contains('grp-children')){
    updateTotalPeople();
  }
});
document.getElementById('activityRows').addEventListener('change', (e)=>{
  if(e.target.classList.contains('act-room')){
    const slot = e.target.closest('.activity-slot');
    const priceInput = slot.querySelector('.act-price');
    if(!priceInput.value){ priceInput.value = ROOM_DEFAULT_PRICE[e.target.value] ?? ''; }
    recomputeGroupSubtotal(e.target.closest('.activity-group'));
  }
});
document.getElementById('f_adultCount').addEventListener('input', updateTotalPeople);
function updateTotalPeople(){
  document.getElementById('f_childrenCount').value = getFormChildrenCount();
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
  addActivityGroup();
  updateTotalPeople();
  openOverlay('formOverlay');
}
function openEditForm(v){
  state.editingId = v.id;
  document.getElementById('formTitle').textContent = 'แก้ไขการจอง';
  document.getElementById('f_id').value = v.id;
  document.getElementById('f_school').value = v.school;
  document.getElementById('f_packageLabel').value = v.packageLabel||'';
  document.getElementById('f_contactPerson').value = v.contactPerson||'';
  document.getElementById('f_contactPhone').value = v.contactPhone||'';
  document.getElementById('f_contactFacebook').value = v.contactFacebook||'';
  document.getElementById('f_date').value = v.date;
  document.getElementById('f_adultCount').value = v.adultCount||0;
  document.getElementById('f_notes').value = v.notes||'';
  const groups = groupActivitiesByGroup(v.activities);
  document.getElementById('activityRows').innerHTML = groups.map(g=> activityGroupHtml(g[0].groupId || g[0].id, g)).join('');
  document.getElementById('conflictWarning').style.display = 'none';
  recomputeAllGroupSubtotals();
  updateTotalPeople();
  closeOverlay('detailOverlay');
  openOverlay('formOverlay');
}
document.getElementById('addBtn').addEventListener('click', ()=> openAddForm(fmtDate(state.cursorDate)));

function readActivitiesFromForm(){
  const activities = [];
  document.querySelectorAll('#activityRows .activity-group').forEach(groupEl=>{
    const groupId = groupEl.dataset.groupId;
    const gradeLevel = groupEl.querySelector('.grp-grade').value.trim();
    const childrenCount = Number(groupEl.querySelector('.grp-children').value)||0;
    groupEl.querySelectorAll('.activity-slot').forEach(slotEl=>{
      activities.push({
        id: slotEl.dataset.activityId,
        groupId,
        room: slotEl.querySelector('.act-room').value,
        gradeLevel,
        topic: slotEl.querySelector('.act-topic').value.trim(),
        startTime: slotEl.querySelector('.act-start').value,
        endTime: slotEl.querySelector('.act-end').value,
        childrenCount,
        pricePerPerson: Number(slotEl.querySelector('.act-price').value)||0
      });
    });
  });
  return activities;
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
  const warn = document.getElementById('conflictWarning');
  if(conflicts.length>0){
    warn.style.display='block';
    warn.innerHTML = '⚠ เวลาทับซ้อนกับ: ' + conflicts.map(c=>`${escapeHtml(c.school)} - ${roomInfo(c.room).label} (${c.startTime}-${c.endTime})`).join(', ') +
      ' — บันทึกจองซ้อนได้ตามปกติ';
  } else {
    warn.style.display='none';
  }

  const data = {
    school,
    packageLabel: document.getElementById('f_packageLabel').value.trim(),
    contactPerson: document.getElementById('f_contactPerson').value.trim(),
    contactPhone: document.getElementById('f_contactPhone').value.trim(),
    contactFacebook: document.getElementById('f_contactFacebook').value.trim(),
    date,
    childrenCount: groupActivitiesByGroup(activities).reduce((sum,g)=> sum+(Number(g[0].childrenCount)||0), 0),
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
    <tr><td class="k">ผู้ประสานงาน</td><td>${escapeHtml(v.contactPerson)||'-'} ${v.contactPhone?('· '+escapeHtml(v.contactPhone)):''} ${v.contactFacebook?('· FB: '+escapeHtml(v.contactFacebook)):''}</td></tr>
    <tr><td class="k">วันที่</td><td>${v.date} (${thaiFullDate(v.date)})</td></tr>
    <tr><td class="k">จำนวนคน</td><td>เด็ก ${v.childrenCount||0} · ผู้ใหญ่ ${v.adultCount||0} · รวม ${totalPeople} คน</td></tr>
    <tr><td class="k">หมายเหตุ</td><td>${escapeHtml(v.notes)||'-'}</td></tr>
  `;
  const acts = visitActivitiesSorted(v);
  const grand = visitGrandTotal(v);
  const billable = billableCount(v);
  document.getElementById('costTable').innerHTML = `
    <tr><th>กิจกรรม</th><th>ระดับชั้น/กลุ่ม</th><th>เวลา</th><th>จำนวนเด็ก</th><th>ราคา/คน</th><th>รวม (บาท)</th></tr>
    ${acts.map(a=>`<tr>
      <td>${roomInfo(a.room).label}${a.topic?('<br><span style="color:var(--ink-faint);font-size:11.5px;">'+escapeHtml(a.topic)+'</span>'):''}</td>
      <td>${escapeHtml(a.gradeLevel)||'-'}</td>
      <td>${a.startTime}${a.endTime?('–'+a.endTime):' เป็นต้นไป'}</td>
      <td>${a.childrenCount||0}</td>
      <td>${money(a.pricePerPerson)}</td>
      <td>${money(activitySubtotal(a))}</td>
    </tr>`).join('')}
    <tr class="total-row"><td colspan="5">รวมค่าใช้จ่ายทั้งหมด (คิดจากเด็ก ${billable} คน)</td><td>${money(grand)} บาท</td></tr>
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
function roomTopicLines(acts){
  // 1 บรรทัดต่อห้อง/กิจกรรม (เรียงตาม ROOM_CATEGORIES เสมอ) — เรื่องซ้ำไม่พิมพ์ซ้ำ เรื่องต่างกันต่อด้วยจุลภาคในบรรทัดเดียว
  const map = new Map();
  acts.forEach(a=>{
    const topic = String(a.topic||'').trim();
    if(!topic) return;
    if(!map.has(a.room)) map.set(a.room, []);
    const topics = map.get(a.room);
    if(!topics.includes(topic)) topics.push(topic);
  });
  return ROOM_CATEGORIES.map(r=>r.id).filter(room=>map.has(room)).map(room=> ({room, topics: map.get(room)}));
}
function buildDocA_Html(v){
  const acts = v.activities;
  const roomLine = (id, label, showTopics)=>{
    const matched = acts.filter(x=>x.room===id);
    const total = matched.reduce((sum,a)=> sum+(Number(a.childrenCount)||0), 0);
    const topics = [...new Set(matched.map(a=>String(a.topic||'').trim()).filter(Boolean))];
    const topicPart = (showTopics && topics.length) ? ` (${topics.map(escapeHtml).join(', ')})` : '';
    return `<div class="doc-checkbox-line">☐ กิจกรรม ${label}${topicPart} รวม จำนวน ${total} คน</div>`;
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
    ${roomLine('other', roomInfo('other').label, true)}
    <div class="doc-section-title">3. รายละเอียดการเข้าร่วมกิจกรรม</div>
    ${roomTopicLines(acts).map(r=>`<div class="doc-line">${roomInfo(r.room).label} เรื่อง ${r.topics.map(escapeHtml).join(', ')}</div>`).join('') || '<div class="doc-line">-</div>'}
    <div class="doc-section-title">4. ผู้ประสานงาน</div>
    <div class="doc-line doc-fill-line"><span>ชื่อ-สกุล</span><span class="fill-dots"></span></div>
    <div class="doc-line doc-fill-line"><span>โทรศัพท์</span><span class="fill-dots"></span></div>
    <div class="doc-notes-title">หมายเหตุ</div>
    <ul class="doc-notes-list">
      <li>${escapeHtml(DOC_CONFIG.policyNotes[0])}</li>
    </ul>
    <div class="doc-price-lines">
      ${DOC_CONFIG.priceLines.map(p=>`<div class="doc-line">- <span class="doc-highlight">${escapeHtml(p.label)} :</span> ราคา คนละ ${p.price} บาท ต่อรอบกิจกรรม (จากปกติคนละ ${p.normalPrice} บาท ต่อรอบกิจกรรม)</div>`).join('')}
    </div>
    <ul class="doc-notes-list">
      ${DOC_CONFIG.policyNotes.slice(1).map(n=>`<li>${escapeHtml(n)}</li>`).join('')}
    </ul>
    <div class="doc-payment-note">- ${escapeHtml(DOC_CONFIG.paymentNote)}</div>
    <div class="doc-sign">
      <div class="line-fill">ลงชื่อ ........................................</div>
      <div class="line-fill">(........................................)</div>
      <div class="line-fill">ตำแหน่ง ........................................</div>
    </div>
    <div class="doc-footer">
      รบกวนส่งแบบตอบรับมาที่ Facebook Page : ${escapeHtml(DOC_CONFIG.facebookPage)} หรือ Email : ${escapeHtml(DOC_CONFIG.contactEmail)}<br>
      สอบถามรายละเอียดเพิ่มเติม โทร. ${escapeHtml(DOC_CONFIG.contactPhone)}
    </div>
  </div>`;
}

/* ---------------- Document B: ตารางการเข้าร่วมกิจกรรม + ค่าใช้จ่าย ---------------- */
function roomCostSummary(acts){
  // รวมยอดคน+เงินตามห้อง/กิจกรรม 1 บรรทัดต่อห้อง ไม่แยกย่อยตามกลุ่ม/รอบเวลา
  const map = new Map();
  acts.forEach(a=>{
    if(!map.has(a.room)) map.set(a.room, {children:0, cost:0, topics:[]});
    const e = map.get(a.room);
    e.children += Number(a.childrenCount)||0;
    e.cost += activitySubtotal(a);
    const topic = String(a.topic||'').trim();
    if(topic && !e.topics.includes(topic)) e.topics.push(topic);
  });
  return ROOM_CATEGORIES.map(r=>r.id).filter(id=>map.has(id)).map(id=> ({room:id, ...map.get(id)}));
}
function roomDetailLine(r){
  // 1 บรรทัดต่อหมวดกิจกรรม รวมเรื่อง+จำนวนคนทุกกลุ่ม/รอบเข้าด้วยกัน ไม่บอกกลุ่ม/ระดับชั้น
  const topicPart = r.topics.length ? ` เรื่อง ${r.topics.map(escapeHtml).join(', ')}` : '';
  return `กิจกรรม ${roomInfo(r.room).label}${topicPart} รวม ${r.children} คน`;
}
function buildDocB_Html(v){
  const billable = billableCount(v);
  const acts = visitActivitiesSorted(v);
  const grand = visitGrandTotal(v);
  const gradesLabel = compactGradeSummary(acts);
  const gradesPart = gradesLabel ? `ระดับชั้น ${escapeHtml(gradesLabel)} ` : '';
  const introText = `${thaiFullDateWithDay(v.date)} ผู้เข้าร่วมกิจกรรม${gradesPart}จำนวน ${billable} คน`;
  const slots = buildTimeSlots(acts);
  return `
  <div class="doc-page">
    <div class="doc-title small">ตารางการเข้าร่วมกิจกรรม ณ ${escapeHtml(DOC_CONFIG.venueName)}</div>
    <div class="doc-title sub small">${escapeHtml(v.school)}</div>
    <hr class="doc-rule">
    <table class="doc-table">
      <tr>
        <th style="width:22%;">จำนวนนักเรียน</th>
        ${slots.map(s=>`<th>${timeSlotLabel(s)}</th>`).join('')}
      </tr>
      ${groupActivitiesByGroup(acts).map((g,i)=>{
        const label = g[0].gradeLevel ? escapeHtml(g[0].gradeLevel) : ('กลุ่ม '+(i+1));
        return `<tr>
        <td><b><u>${label}</u></b><br>(${g[0].childrenCount||0} คน)</td>
        ${slots.map(s=>{ const a = g.find(x=>sameSlot(x,s)); return a ? `<td><div class="room">${roomInfo(a.room).label}</div>${a.topic?`<div class="topic">${escapeHtml(a.topic)}</div>`:''}</td>` : '<td></td>'; }).join('')}
      </tr>`;
      }).join('')}
    </table>
    <div class="doc-section-title">รายละเอียดการเข้าร่วมกิจกรรม</div>
    <div class="doc-line"><b>${introText}</b></div>
    <ul class="doc-notes-list">
      ${roomCostSummary(acts).map(r=>`<li>${roomDetailLine(r)}</li>`).join('')}
    </ul>
    <div class="doc-section-title">สรุปค่าใช้จ่ายในการทำกิจกรรม</div>
    <ul class="doc-notes-list">
      ${roomCostSummary(acts).map(r=>{ const topicPart = (r.room==='other' && r.topics.length) ? ` (${r.topics.map(escapeHtml).join(', ')})` : ''; return `<li>กิจกรรม ${roomInfo(r.room).label}${topicPart} ผู้เข้าร่วม รวม ${r.children} คน รวมเป็นเงิน ${money(r.cost)} บาท</li>`; }).join('')}
    </ul>
    <div class="doc-line doc-cost-blue">รวมค่าใช้จ่ายในการเข้าร่วมกิจกรรม ${money(grand)} บาท${v.packageLabel?(' ('+escapeHtml(v.packageLabel)+')'):''}</div>
    <div class="doc-payment-note" style="margin-left:0;">${escapeHtml(DOC_CONFIG.paymentNote)}</div>
  </div>`;
}

document.getElementById('printDocAllBtn').addEventListener('click', ()=>{
  const v = state.visits.find(x=>x.id===state.currentDetailId);
  if(!v) return;
  document.getElementById('printArea').innerHTML = buildDocA_Html(v) + buildDocB_Html(v);
  window.print();
});
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
const DOCX_FONT = 'TH SarabunPSK';
const DOCX_MARGIN_TOP = docx.convertMillimetersToTwip(25);
const DOCX_MARGIN_RIGHT = docx.convertMillimetersToTwip(20);
const DOCX_MARGIN_BOTTOM = docx.convertMillimetersToTwip(15);
const DOCX_MARGIN_LEFT = docx.convertMillimetersToTwip(25);
const DOCX_PAGE_WIDTH = docx.convertMillimetersToTwip(210); // A4
const DOCX_PAGE_PROPERTIES = { page: {
  size: { width: DOCX_PAGE_WIDTH, height: docx.convertMillimetersToTwip(297) },
  margin: { top: DOCX_MARGIN_TOP, right: DOCX_MARGIN_RIGHT, bottom: DOCX_MARGIN_BOTTOM, left: DOCX_MARGIN_LEFT }
} };
const DOCX_CONTENT_WIDTH = DOCX_PAGE_WIDTH - DOCX_MARGIN_LEFT - DOCX_MARGIN_RIGHT;
function dRun(text, opts={}){
  return new docx.TextRun({ text: String(text), font: DOCX_FONT, size: opts.size||29, bold: !!opts.bold, color: opts.color||undefined, underline: opts.underline ? {type: docx.UnderlineType.SINGLE} : undefined });
}
function dPara(text, opts={}){
  const alignMap = {left:docx.AlignmentType.LEFT, center:docx.AlignmentType.CENTER, right:docx.AlignmentType.RIGHT};
  return new docx.Paragraph({
    alignment: alignMap[opts.align||'left'],
    spacing: {after: opts.after??70, before: opts.before||0},
    indent: opts.indent ? {left: opts.indent} : undefined,
    border: opts.borderBottom ? {bottom:{color:'999999', space:4, style:docx.BorderStyle.SINGLE, size:6}} : undefined,
    pageBreakBefore: !!opts.pageBreakBefore,
    bullet: opts.bullet ? {level:0} : undefined,
    children: [dRun(text, opts)]
  });
}
function dParaMulti(runs, opts={}){
  const alignMap = {left:docx.AlignmentType.LEFT, center:docx.AlignmentType.CENTER, right:docx.AlignmentType.RIGHT};
  return new docx.Paragraph({
    alignment: alignMap[opts.align||'left'],
    spacing: {after: opts.after??120, before: opts.before||0},
    indent: opts.indent ? {left: opts.indent} : undefined,
    children: runs.map(r=> dRun(r.text, {size: opts.size, bold: opts.bold, ...r}))
  });
}
function dSignLine(label, opts={}){
  return new docx.Paragraph({
    tabStops: [{type: docx.TabStopType.RIGHT, position: DOCX_CONTENT_WIDTH, leader: docx.LeaderType.DOT}],
    spacing: {after: opts.after??20, before: opts.before||0},
    children: [ dRun(label+'\t', opts) ]
  });
}
function dCheckboxPara(checked, text, opts={}){
  return new docx.Paragraph({
    spacing: {after:30}, indent: {left:360},
    children: [ dRun(checked?'☒ ':'☐ ', opts), dRun(text, opts) ]
  });
}
function dCell(paras, opts={}){
  return new docx.TableCell({
    width: opts.width ? {size:opts.width, type:docx.WidthType.PERCENTAGE} : undefined,
    shading: opts.fill ? {fill: opts.fill} : undefined,
    children: Array.isArray(paras) ? paras : [paras]
  });
}

function buildDocA_DocxChildren(v){
  const acts = v.activities;
  const roomLinePara = (id,label,showTopics)=>{
    const matched = acts.filter(x=>x.room===id);
    const total = matched.reduce((sum,a)=> sum+(Number(a.childrenCount)||0), 0);
    const topics = [...new Set(matched.map(a=>String(a.topic||'').trim()).filter(Boolean))];
    const topicPart = (showTopics && topics.length) ? ` (${topics.join(', ')})` : '';
    return dCheckboxPara(false, `กิจกรรม ${label}${topicPart} รวม จำนวน ${total} คน`);
  };
  const topicParas = roomTopicLines(acts).map(r=> dPara(`${roomInfo(r.room).label} เรื่อง ${r.topics.join(', ')}`, {after:30}));
  const priceParas = DOC_CONFIG.priceLines.map(p=> dParaMulti([
    {text:'- '},
    {text:p.label+' :'},
    {text:` ราคา คนละ ${p.price} บาท ต่อรอบกิจกรรม (จากปกติคนละ ${p.normalPrice} บาท ต่อรอบกิจกรรม)`}
  ], {after:20}));
  const noteParas = DOC_CONFIG.policyNotes.map(n=> dPara(n, {after:20, bullet:true}));

  return [
    dPara('แบบตอบรับการจองเข้าร่วมกิจกรรม', {align:'center', bold:true, size:32, after:20}),
    dPara('ณ '+DOC_CONFIG.venueName, {align:'center', bold:true, size:32, after:60, borderBottom:true}),
    dPara('1. ชื่อหน่วยงาน/โรงเรียน  '+v.school, {after:40}),
    dPara('2. เข้าร่วมกิจกรรมในวันที่ '+thaiFullDate(v.date)+' ณ '+DOC_CONFIG.venueName, {after:30}),
    roomLinePara('innovation','Innovation Space'),
    roomLinePara('inspirelab','Inspire Lab'),
    roomLinePara('other', roomInfo('other').label, true),
    dPara('3. รายละเอียดการเข้าร่วมกิจกรรม', {bold:true, after:20, before:30}),
    ...(topicParas.length?topicParas:[dPara('-', {after:30})]),
    dPara('4. ผู้ประสานงาน', {bold:true, after:20}),
    dSignLine('ชื่อ-สกุล', {after:20}),
    dSignLine('โทรศัพท์', {after:60}),
    dPara('หมายเหตุ', {bold:true, after:20}),
    noteParas[0],
    ...priceParas,
    ...noteParas.slice(1),
    dPara(DOC_CONFIG.paymentNote, {bold:true, color:'B00000', indent:360, after:140}),
    dPara('ลงชื่อ ........................................', {align:'right', after:6}),
    dPara('(........................................)', {align:'right', after:6}),
    dPara('ตำแหน่ง ........................................', {align:'right', after:120})
  ];
}
function docAFooterParas(){
  // ปักไว้มุมล่างซ้ายของทุกหน้าด้วย docx footer จริง (ไม่ไหลตามเนื้อหาข้างบน)
  return [
    dPara('รบกวนส่งแบบตอบรับมาที่ Facebook Page : '+DOC_CONFIG.facebookPage+' หรือ Email : '+DOC_CONFIG.contactEmail, {size:24, after:20}),
    dPara('สอบถามรายละเอียดเพิ่มเติม โทร. '+DOC_CONFIG.contactPhone, {size:24})
  ];
}
function buildDocA_Docx(v){
  return new docx.Document({ sections:[{ properties: DOCX_PAGE_PROPERTIES, children: buildDocA_DocxChildren(v), footers:{ default: new docx.Footer({ children: docAFooterParas() }) } }] });
}

function buildDocB_DocxChildren(v, opts={}){
  const billable = billableCount(v);
  const acts = visitActivitiesSorted(v);
  const grand = visitGrandTotal(v);

  const slots = buildTimeSlots(acts);
  const headerCells = [
    dCell(dPara('จำนวนนักเรียน', {align:'center', bold:true, size:27, after:0}), {width:22, fill:'BDD7EE'}),
    ...slots.map(s=> dCell(dPara(timeSlotLabel(s), {align:'center', bold:true, size:27, after:0}), {fill:'BDD7EE'}))
  ];
  const rows = groupActivitiesByGroup(acts).map((g,i)=> new docx.TableRow({children:[
    dCell([
      dPara(g[0].gradeLevel || ('กลุ่ม '+(i+1)), {align:'center', bold:true, underline:true, size:27, after:10}),
      dPara(`(${g[0].childrenCount||0} คน)`, {align:'center', size:24, after:0})
    ]),
    ...slots.map(s=>{
      const a = g.find(x=>sameSlot(x,s));
      return dCell(a ? [
        dPara(roomInfo(a.room).label, {align:'center', bold:true, size:27, after:10}),
        dPara(a.topic||'-', {align:'center', size:24, after:0})
      ] : [dPara('', {after:0})]);
    })
  ]}));
  const table = new docx.Table({
    width: {size:100, type:docx.WidthType.PERCENTAGE},
    rows: [ new docx.TableRow({children:headerCells}), ...rows ]
  });

  const detailBullets = roomCostSummary(acts).map(r=> dPara(roomDetailLineDocx(r), {after:20, bullet:true}));
  const gradesLabelDocx = compactGradeSummary(acts);
  const gradesPartDocx = gradesLabelDocx ? `ระดับชั้น ${gradesLabelDocx} ` : '';
  const introText = `${thaiFullDateWithDay(v.date)} ผู้เข้าร่วมกิจกรรม${gradesPartDocx}จำนวน ${billable} คน`;
  const costBullets = roomCostSummary(acts).map(r=>{
    const topicPart = (r.room==='other' && r.topics.length) ? ` (${r.topics.join(', ')})` : '';
    return dPara(`กิจกรรม ${roomInfo(r.room).label}${topicPart} ผู้เข้าร่วม รวม ${r.children} คน รวมเป็นเงิน ${money(r.cost)} บาท`, {after:20, bullet:true});
  });

  return [
    dPara('ตารางการเข้าร่วมกิจกรรม ณ '+DOC_CONFIG.venueName, {align:'center', bold:true, size:27, after:15, pageBreakBefore: !!opts.pageBreakBefore}),
    dPara(v.school, {align:'center', bold:true, size:27, after:60, borderBottom:true}),
    table,
    dPara('', {after:60}),
    dPara('รายละเอียดการเข้าร่วมกิจกรรม', {bold:true, after:20}),
    dPara(introText, {bold:true, after:20}),
    ...detailBullets,
    dPara('สรุปค่าใช้จ่ายในการทำกิจกรรม', {bold:true, after:20, before:20}),
    ...costBullets,
    dPara(`รวมค่าใช้จ่ายในการเข้าร่วมกิจกรรม ${money(grand)} บาท${v.packageLabel?(' ('+v.packageLabel+')'):''}`, {bold:true, color:'1F4E96', after:40}),
    dPara(DOC_CONFIG.paymentNote, {bold:true, color:'B00000'})
  ];
}
function buildDocB_Docx(v){
  return new docx.Document({ sections:[{ properties: DOCX_PAGE_PROPERTIES, children: buildDocB_DocxChildren(v) }] });
}
function buildCombined_Docx(v){
  const children = [
    ...buildDocA_DocxChildren(v),
    ...buildDocB_DocxChildren(v, {pageBreakBefore:true})
  ];
  return new docx.Document({ sections:[{ properties: DOCX_PAGE_PROPERTIES, children, footers:{ default: new docx.Footer({ children: docAFooterParas() }) } }] });
}
function roomDetailLineDocx(r){
  const topicPart = r.topics.length ? ` เรื่อง ${r.topics.join(', ')}` : '';
  return `กิจกรรม ${roomInfo(r.room).label}${topicPart} รวม ${r.children} คน`;
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
document.getElementById('downloadDocAllBtn').addEventListener('click', ()=>{
  const v = state.visits.find(x=>x.id===state.currentDetailId);
  if(!v) return;
  triggerDocxDownload(buildCombined_Docx(v), `เอกสารกิจกรรม_${v.docNo||v.id}.docx`);
});
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
