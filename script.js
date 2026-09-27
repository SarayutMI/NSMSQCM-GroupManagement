/* =========================================================
   CONFIG
   - ถ้า API_URL ว่างไว้: ข้อมูล "การจอง" เก็บในเบราว์เซอร์ (localStorage) เครื่องเดียว
   - ถ้าใส่ API_URL (ลิงก์ Web App จาก Google Apps Script ที่แนบไฟล์ Code.gs ไว้แล้ว):
     ระบบจะอ่าน/บันทึกการจองลง Google Sheet จริงทันที และ "สร้างชีต + หัวตารางที่ต้องใช้ให้เองอัตโนมัติ"
     ในสเปรดชีตที่ผูกกับสคริปต์นั้น (ไม่ต้องสร้างชีตหรือตั้งหัวตารางเอง) — ดูขั้นตอนเต็มใน README.md
   - ข้อมูล "อ้างอิง" (รายชื่อโรงเรียน) ดึงจาก Google Sheet ที่ Publish to web เป็น CSV แยกต่างหาก
     วิธีทำ: เปิด Sheet > File > Share > Publish to web > เลือกแท็บ > Comma-separated values (.csv)
     แล้วคัดลอกลิงก์มาใส่ที่ SCHOOLS_CSV_URL ด้านล่าง (คอลัมน์: school_TH, school_ENG, contactPerson, contactPhone)
   ========================================================= */
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbxVEm1uJp76f0DLDiOklytQfbVmjniAu8jvu2jwL_3aFZCC_4oU9tUlEeImXuVSSZ_vlg/exec',            // <-- ใส่ URL ของ Google Apps Script Web App (จาก Code.gs) ที่นี่ เพื่อเชื่อม Sheet จริง
  SCHOOLS_CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHwC49QdSskveBiTSa9BZLxSMEvW6wa_XUEhFQQP5jStHI-EVPGdIjG3Goo_-iNiXKJkmYevzcC2kl/pub?gid=0&single=true&output=csv',     // คอลัมน์: school_TH, school_ENG, contactPerson, contactPhone
  // รายชื่อพนักงาน (แท็บ Staff_Name ในชีตเดียวกัน, คอลัมน์: Staff_Name, Role) ใช้เป็นตัวเลือก "ผู้บันทึก/ผู้แก้ไข"
  STAFF_CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHwC49QdSskveBiTSa9BZLxSMEvW6wa_XUEhFQQP5jStHI-EVPGdIjG3Goo_-iNiXKJkmYevzcC2kl/pub?gid=1863604525&single=true&output=csv',
  // รายชื่อ "สถานที่" (แท็บ Location ในชีตเดียวกัน, คอลัมน์เดียว: แถวแรกเป็นหัวตาราง)
  LOCATIONS_CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHwC49QdSskveBiTSa9BZLxSMEvW6wa_XUEhFQQP5jStHI-EVPGdIjG3Goo_-iNiXKJkmYevzcC2kl/pub?gid=437766438&single=true&output=csv',
  // รายการ "เรื่อง/หัวข้อ" ของแต่ละห้อง/กิจกรรม (ชีตเดียวกับรายชื่อโรงเรียน คนละแท็บ, 2 คอลัมน์: ไทย, อังกฤษ — แถวแรกเป็นหัวตาราง)
  ACTIVITY_CSV_URLS: {
    innovation: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHwC49QdSskveBiTSa9BZLxSMEvW6wa_XUEhFQQP5jStHI-EVPGdIjG3Goo_-iNiXKJkmYevzcC2kl/pub?gid=116326658&single=true&output=csv',
    inspirelab: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHwC49QdSskveBiTSa9BZLxSMEvW6wa_XUEhFQQP5jStHI-EVPGdIjG3Goo_-iNiXKJkmYevzcC2kl/pub?gid=1497609226&single=true&output=csv',
    other:      'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHwC49QdSskveBiTSa9BZLxSMEvW6wa_XUEhFQQP5jStHI-EVPGdIjG3Goo_-iNiXKJkmYevzcC2kl/pub?gid=867048367&single=true&output=csv'
  }
};

/* ตั้งค่าข้อความ/ข้อมูลที่ใช้พิมพ์ในเอกสาร แก้ตรงนี้ได้ตามหน่วยงานจริง */
const DOC_CONFIG = {
  venueName: 'จัตุรัสวิทยาศาสตร์ อพวช. เชียงใหม่',
  facebookPage: 'NSM Science Square at Chiang Mai',
  contactEmail: 'Yuttana.s@nsm.or.th',
  contactPhone: '093-745-8550',
  paymentNote: 'การชำระเงินกรุณาชำระผ่านการโอนได้ที่เคาน์เตอร์ในวันที่มาร่วมกิจกรรมเท่านั้น (งดรับเงินสด)',
  // ราคาแยกเป็นหัวข้อหลัก: มี lines = หัวข้อ + รายการย่อย, ไม่มี lines = บรรทัดหลักที่มีราคาในตัวเอง (ใช้ประโยคเดียวกันทุกบรรทัด)
  priceGroups: [
    {title:'Inspire Lab และ Innovation Space', lines:[
      {label:'Basic', price:90, normalPrice:100},
      {label:'Advance', price:180, normalPrice:200}
    ]},
    {title:'Walk Rally', price:45, normalPrice:50},
    {title:"Don't Miss", price:90, normalPrice:100},
    {title:'Mini Make and Play', price:45, normalPrice:50}
  ],
  policyNoteBold: '',   // ท่อนที่จะพิมพ์ตัวหนาในหมายเหตุข้อแรก (เว้นว่าง = ไม่หนา) เช่น 'หมู่คณะ 10 คนขึ้นไปต่อรอบ'
  policyNotes: [
    'ค่าธรรมเนียมเข้าร่วมกิจกรรมกรณีเป็นหมู่คณะ 10 คนขึ้นไปต่อรอบ',
    'หากจองเข้าร่วมเป็นหมู่คณะ 15 คนขึ้นไปต่อรอบ สามารถเลือกเรื่องกิจกรรมที่ต้องการเข้าร่วมได้ (ตามตารางกิจกรรม)',
    'กรณีที่ผู้เข้าร่วมกิจกรรมมาไม่ครบตามจำนวนที่แจ้ง ขอเก็บค่าธรรมเนียมขั้นต่ำที่ 15 คนต่อรอบ หากมามากกว่าที่แจ้งไว้ คิดค่าธรรมเนียมตามจำนวนที่มาจริง',
    'หากมีผู้เข้าร่วมกิจกรรมน้อยกว่า 20 คนต่อรอบ ทางจัตุรัสวิทยาศาสตร์มีสิทธิ์รับผู้เข้าร่วมกิจกรรมภายนอกเพิ่มเติม',
    'แจ้งยืนยันการเข้าร่วมกิจกรรมล่วงหน้าก่อน 7 วัน',
    'กรณีต้องการเปลี่ยนแปลงหรือยกเลิกการจองเข้าร่วมกิจกรรมกรุณาแจ้งก่อนวันที่เข้าร่วมอย่างน้อย 3 วันทำการ'
  ]
};

/* ภาษาของเอกสาร export: th = ไทย (ใช้ค่าจาก DOC_CONFIG ด้านบน), en = อังกฤษ
   ข้อความอังกฤษทั้งหมดแก้ตรงนี้ได้ (แปลจากต้นฉบับภาษาไทย ควรให้เจ้าของงานตรวจอีกครั้ง) */
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS_FULL_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DOC_LANG = {
  th: {
    venueName: DOC_CONFIG.venueName,
    paymentNote: DOC_CONFIG.paymentNote,
    policyNotes: DOC_CONFIG.policyNotes,
    policyNoteBold: DOC_CONFIG.policyNoteBold,
    policyNoteFit: 3,   // หมายเหตุข้อที่ต้องอยู่บรรทัดเดียว (index เริ่ม 0) — ย่อขนาดตัวอักษรลงเล็กน้อย
    priceGroups: DOC_CONFIG.priceGroups,
    filePrefix: {all:'เอกสารกิจกรรม', A:'แบบตอบรับ', B:'ตารางกิจกรรม'},
    date: d=> thaiFullDate(d),
    dateWithDay: d=> thaiFullDateWithDay(d),
    room: id=> roomInfo(id).label,
    time: t=> thTime(t),
    onwards: 'เป็นต้นไป',
    grades: g=> g,
    s: {
      titleA:'แบบตอบรับการจองเข้าร่วมกิจกรรม', at:'ณ', school:'1. ชื่อหน่วยงาน/โรงเรียน',
      visitDate:(date,venue)=>`2. เข้าร่วมกิจกรรมในวันที่ ${date} ณ ${venue}`,
      roomSets:(label,topic,n)=>`กิจกรรม ${label}${topic} รวมจำนวนชุดกิจกรรม ${n} ชุด`,
      details:'3. รายละเอียดการเข้าร่วมกิจกรรม',
      roomTopic:(room,topics)=>`${room} เรื่อง ${topics}`,
      contact:'4. ผู้ประสานงาน', fullName:'ชื่อ-สกุล', phone:'โทรศัพท์', notes:'หมายเหตุ',
      priceLine:(p,n)=>`ราคา คนละ ${p} บาท ต่อรอบกิจกรรม (จากปกติคนละ ${n} บาท ต่อรอบกิจกรรม)`,
      sign:'ลงชื่อ', position:'ตำแหน่ง',
      footer1:(fb,email)=>`รบกวนส่งแบบตอบรับมาที่ Facebook Page : ${fb} หรือ Email : ${email}`,
      footer2:tel=>`สอบถามรายละเอียดเพิ่มเติม โทร. ${tel}`,
      titleB:venue=>`ตารางการเข้าร่วมกิจกรรม ณ ${venue}`,
      studentsCol:'จำนวนนักเรียน', group:n=>`กลุ่ม ${n}`, people:n=>`(${n} คน)`,
      detailsB:'รายละเอียดการเข้าร่วมกิจกรรม',
      intro:(dateWD,grades,n)=>`${dateWD} ผู้เข้าร่วมกิจกรรม${grades?`ระดับชั้น ${grades} `:''}จำนวน ${n} คน`,
      costTitle:'สรุปค่าใช้จ่ายในการทำกิจกรรม',
      costLine:(label,topic,n,amount)=>`กิจกรรม ${label}${topic} รวมจำนวนชุดกิจกรรม ${n} ชุด เป็นเงิน ${amount} บาท`,
      total:(amount,pkg)=>`รวมค่าใช้จ่ายในการเข้าร่วมกิจกรรม ${amount} บาท${pkg?` (${pkg})`:''}`
    }
  },
  en: {
    venueName: 'NSM Science Square at Chiang Mai',
    paymentNote: 'Payment by bank transfer at the counter on the day of the activity only (no cash).',
    policyNotes: [
      'Fee for groups of 10 or more participants per round',
      'Groups of 15 or more per round may choose their activities.',
      'If fewer people attend than registered, a minimum fee for 15 people per round applies; if more attend, the fee is based on actual attendance.',
      'If a round has fewer than 20 participants, Science Square may admit additional outside participants.',
      'Please confirm attendance at least 7 days in advance.',
      'To change or cancel, please notify us at least 3 working days before the visit.'
    ],
    policyNoteBold: '',   // เว้นว่าง = ไม่หนา
    policyNoteFit: -1,
    priceGroups: [
      {title:'Inspire Lab and Innovation Space', lines:[
        {label:'Basic', price:90, normalPrice:100},
        {label:'Advance', price:180, normalPrice:200}
      ]},
      {title:'Walk Rally', price:45, normalPrice:50},
      {title:"Don't Miss", price:90, normalPrice:100},
      {title:'Mini Make and Play', price:45, normalPrice:50}
    ],
    filePrefix: {all:'ActivityDocuments', A:'BookingConfirmation', B:'ActivitySchedule'},
    date: d=>{ const x = parseDate(d); return `${x.getDate()} ${MONTHS_EN[x.getMonth()]} ${x.getFullYear()}`; },
    dateWithDay: d=>{ const x = parseDate(d); return `${WEEKDAYS_FULL_EN[x.getDay()]}, ${x.getDate()} ${MONTHS_EN[x.getMonth()]} ${x.getFullYear()}`; },
    room: id=> id==='other' ? 'Others' : roomInfo(id).label,
    time: t=> t,
    onwards: 'onwards',
    grades: g=> g.replace(/ป\./g,'P.').replace(/ม\./g,'M.').replace(/อ\./g,'K.'),   // ป=ประถม(P) ม=มัธยม(M) อ=อนุบาล(K)
    s: {
      titleA:'Activity Booking Confirmation Form', at:'', school:'1. Organization / School:',
      visitDate:(date,venue)=>`2. Date of visit: ${date}, ${venue}`,
      roomSets:(label,topic,n)=>`Activity: ${label}${topic} — total ${n} activity sets`,
      details:'3. Activity Details',
      roomTopic:(room,topics)=>`${room} — Topic: ${topics}`,
      contact:'4. Contact Person', fullName:'Full name', phone:'Phone', notes:'Notes',
      priceLine:(p,n)=>`Price ${p} baht per person per round (regular price ${n} baht)`,
      sign:'Signature', position:'Position',
      footer1:(fb,email)=>`Please send the completed form to our Facebook Page: ${fb} or Email: ${email}`,
      footer2:tel=>`For more information, please call ${tel}`,
      titleB:venue=>`Activity Schedule: ${venue}`,
      studentsCol:'Number of students', group:n=>`Group ${n}`, people:n=>`(${n} students)`,
      detailsB:'Activity Details',
      intro:(dateWD,grades,n)=>`${dateWD}: ${n} participants${grades?` (Grade ${grades})`:''}`,
      costTitle:'Cost Summary',
      costLine:(label,topic,n,amount)=>`Activity: ${label}${topic} — ${n} activity sets, total ${amount} baht`,
      total:(amount,pkg)=>`Total activity fee: ${amount} baht${pkg?` (${pkg})`:''}`
    }
  }
};

const ROOM_CATEGORIES = [
  {id:'innovation', label:'Innovation Space', color:'var(--yellow)', bg:'var(--yellow-dim)', tint:'var(--yellow-tint)'},
  {id:'inspirelab', label:'Inspire Lab',       color:'var(--sky)',   bg:'var(--sky-dim)',    tint:'var(--sky-tint)'},
  {id:'other',      label:'อื่นๆ',              color:'var(--purple)', bg:'var(--purple-dim)', tint:'var(--purple-tint)'}
];
const ROOM_DEFAULT_PRICE = { innovation: 90, inspirelab: 90, other: 100 };
// รายชื่อสถานที่ตั้งต้น (ใช้ก่อนโหลดจาก LOCATIONS_CSV_URL เสร็จ หรือกรณีโหลดไม่สำเร็จ)
let refLocations = ['LAB Room', 'INNO Room', 'ADA Space', 'Andromeda', 'WorkingSpace'];

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
  {school_TH:'โรงเรียนสันป่าตอง สุวรรณราษฎร์วิทยาคาร', school_ENG:'', contactPerson:'ครูนภา', contactPhone:'081-999-0000'},
  {school_TH:'โรงเรียนสาธิตจุฬาลงกรณ์มหาวิทยาลัย', school_ENG:'', contactPerson:'ครูอรทัย', contactPhone:'081-234-5678'},
  {school_TH:'โรงเรียนกรุงเทพคริสเตียนวิทยาลัย', school_ENG:'', contactPerson:'ครูสมชาย', contactPhone:'089-111-2222'},
  {school_TH:'โรงเรียนอัสสัมชัญ', school_ENG:'', contactPerson:'ครูวิภา', contactPhone:'062-333-4444'},
  {school_TH:'โรงเรียนเซนต์คาเบรียล', school_ENG:'', contactPerson:'ครูปิยะ', contactPhone:'095-555-6666'}
];

let refSchools = [];
let refActivities = {innovation:[], inspirelab:[], other:[]};
let refActivityEN = {innovation:{}, inspirelab:{}, other:{}};   // {[room]: {topicTH: topicENG}}
let refStaff = [];

let state = {
  visits: [],
  view: 'month',
  cursorDate: new Date(),
  miniMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),  // เดือนที่ปฏิทินย่อยด้านซ้ายกำลังแสดง
  miniSyncedKey: '',
  orderWeekStart: startOfWeek(new Date()),
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
function isDayOff(dateOrStr){
  const d = (typeof dateOrStr==='string') ? parseDate(dateOrStr) : dateOrStr;
  return d.getDay()===1; // วันจันทร์ = วันหยุดของสถานที่
}
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
// ความสูงต่อ 30 นาทีคงที่ (กระชับพอดีกับข้อมูลจริง ไม่ยืดตามพื้นที่จอ — ยืดแล้วดูโหว่เกินไปเมื่อ
// วันนั้นมีรายการน้อย พื้นที่ว่างใต้ตารางถือเป็นเรื่องปกติเหมือนปฏิทินทั่วไป)
const AGENDA_SLOT_PX = 45; // +20% จาก 34px เดิม แล้ว +10% อีกรอบจาก 41px
function timeToMinutes(t){
  if(!t) return null;
  const [h,m] = t.split(':').map(Number);
  return h*60+(m||0);
}
const AGENDA_COLUMN_ORDER = ['inspirelab','innovation','other'];
function layoutAgendaItems(dayItems){
  // คอลัมน์แบ่งตามหมวดห้องคงที่ทั้งวัน: Inspire Lab ซ้ายสุด, Innovation ถัดไป, อื่นๆ ขยายไปทางขวาเรื่อยๆ
  // ภายในหมวดเดียวกันถ้าเวลาทับซ้อนกันจะแตกเป็นคอลัมน์ย่อยเพิ่มด้วย greedy packing
  const withMin = dayItems.map(o=>{
    const startMin = timeToMinutes(o.startTime) ?? AGENDA_GRID_START;
    const rawEndMin = (o.endTime==='23:59'||!o.endTime) ? AGENDA_GRID_END : (timeToMinutes(o.endTime) ?? AGENDA_GRID_END);
    const endMin = Math.max(rawEndMin, startMin+AGENDA_SLOT_MIN);
    return {...o, startMin, endMin};
  });

  const placed = [];
  const groups = [];
  let colOffset = 0;
  AGENDA_COLUMN_ORDER.forEach(catId=>{
    // แสดงคอลัมน์ทั้ง 3 หมวด (Inspire Lab / Innovation Space / อื่นๆ) ไว้เสมอทุกวัน แม้หมวดนั้น
    // จะไม่มีการจองเลย — กันไม่ให้เลย์เอาต์เพี้ยนไปมาแต่ละวัน (เดิม: หมวดว่างจะถูกข้ามไปเลย
    // ทำให้หมวดที่มีจองอยู่ยืดเต็มความกว้างแทน)
    const catItems = withMin.filter(o=>o.room===catId).sort((a,b)=> a.startMin-b.startMin || a.endMin-b.endMin);

    let colSpan = 1;
    if(catItems.length){
      // แตก cluster เฉพาะช่วงที่เวลาทับซ้อนกันจริงๆ ในหมวดนี้ ถ้าช่วงไหนมีอันเดียวจะเต็มแถว
      const clusters = [];
      let current = [], currentEnd = -Infinity;
      catItems.forEach(ev=>{
        if(current.length && ev.startMin >= currentEnd){ clusters.push(current); current=[]; currentEnd=-Infinity; }
        current.push(ev);
        currentEnd = Math.max(currentEnd, ev.endMin);
      });
      if(current.length) clusters.push(current);

      clusters.forEach(cluster=>{
        const colEnds = [];
        cluster.forEach(ev=>{
          let col = colEnds.findIndex(end=> end<=ev.startMin);
          if(col===-1){ col = colEnds.length; colEnds.push(ev.endMin); }
          else colEnds[col] = ev.endMin;
          ev.localCol = col;
        });
        cluster.forEach(ev=> ev.localColCount = colEnds.length);
        colSpan = Math.max(colSpan, colEnds.length);
      });
    }

    groups.push({catId, colStart:colOffset, colSpan});
    catItems.forEach(ev=>{
      ev.bandColStart = colOffset;
      ev.bandColSpan = colSpan;
      placed.push(ev);
    });
    colOffset += colSpan;
  });
  const colCount = Math.max(colOffset,1);
  const items = placed.map(ev=>{
    const widthPct = (ev.bandColSpan/ev.localColCount)/colCount*100;
    const leftPct = (ev.bandColStart + (ev.localCol/ev.localColCount)*ev.bandColSpan)/colCount*100;
    return {...ev, widthPct, leftPct};
  });
  return {items, groups, colCount};
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
function locationColorInfo(loc){
  // เทียบแบบไม่สนตัวพิมพ์เล็ก/ใหญ่และคำเต็ม/ย่อ เพราะชื่อสถานที่มาจากชีต (Lab Room, Innovation Room, ...)
  // อาจสะกดต่างจากค่าเดิมที่เคย hardcode ไว้ (LAB Room, INNO Room)
  const s = String(loc||'').toLowerCase();
  if(s.includes('lab')) return {bg:'var(--sky)', color:'#fff'};
  if(s.includes('inno')) return {bg:'#F4B400', color:'#fff'};
  return {bg:'var(--purple)', color:'#fff'};
}
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
// ลำดับห้องในตารางค่าใช้จ่าย: Inspire Lab → Innovation Space → อื่นๆ
const COST_ROOM_ORDER = ['inspirelab','innovation','other'];
function visitActivitiesByTimeThenRoom(v){
  const rank = a=>{ const i = COST_ROOM_ORDER.indexOf(a.room); return i<0 ? COST_ROOM_ORDER.length : i; };
  return [...v.activities].sort((a,b)=>
    (a.startTime||'').localeCompare(b.startTime||'') || rank(a)-rank(b));
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
  // คอลัมน์ = เวลาที่มีรอบจริงอย่างน้อย 1 รอบ (ยึดเวลาที่มีอยู่แล้วเป็นหลัก ไม่เพิ่มคอลัมน์ใหม่เปล่าๆ)
  // ถ้าหลายกิจกรรมเริ่มเวลาเดียวกันแต่ระยะเวลาไม่เท่ากัน ใช้อันที่ "สั้นที่สุด" เป็นคอลัมน์หลักของเวลานั้น
  // ส่วนอันที่ยาวกว่า (เช่น Don't Miss 9.30-11.00) จะไปเชื่อม (colspan) ข้ามคอลัมน์ที่มีอยู่แล้วแทน
  // ไม่สร้างคอลัมน์ใหม่ให้มัน แม้ปลายทางจริงจะไม่ตรงเป๊ะกับขอบคอลัมน์ที่ไปเชื่อมถึงก็ตาม (ดู docActivitySpan)
  const byStart = new Map();
  acts.forEach(a=>{
    if(!a.startTime) return;
    const openEnded = !a.endTime || a.endTime==='23:59';
    const dur = openEnded ? Infinity : timeToMinutes(a.endTime)-timeToMinutes(a.startTime);
    const cur = byStart.get(a.startTime);
    if(!cur || dur < cur.dur) byStart.set(a.startTime, {startTime:a.startTime, endTime: openEnded?'':a.endTime, dur});
  });
  return [...byStart.values()]
    .sort((x,y)=> x.startTime.localeCompare(y.startTime))
    .map(({startTime,endTime})=>({startTime,endTime}));
}
function timeSlotLabel(slot){
  return thTime(slot.startTime)+(slot.endTime?(' – '+thTime(slot.endTime)):' เป็นต้นไป');
}
/** จำนวนคอลัมน์ (slot) ติดต่อกันที่กิจกรรม a ต้องเชื่อมถึง เริ่มนับจาก slots[fromIndex] (ซึ่งต้องเป็น
 *  slot ที่ a.startTime ตรงกับ slots[fromIndex].startTime อยู่แล้ว) — เดินหาคอลัมน์แรกที่ปลายเวลาถึง
 *  หรือเลยเวลาสิ้นสุดจริงของ a แล้วหยุด (ไม่ต้องตรงเป๊ะ เพราะไม่มีการเพิ่มคอลัมน์ใหม่ให้) */
function docActivitySpan(a, slots, fromIndex, g){
  if(!a.endTime || a.endTime==='23:59') return slots.length - fromIndex;
  let span = 1;
  for(let i=fromIndex+1; i<slots.length; i++){
    // คอลัมน์ถัดไปเริ่มหลังจากกิจกรรมนี้จบไปแล้ว (มีช่องว่างคั่น) ไม่ต้องคาบต่อ — กันไม่ให้กิจกรรมสั้นๆ
    // ที่จบไปนานแล้วโดนยืดไปกินคอลัมน์ที่ไม่เกี่ยวข้องกันเลยในเวลาต่อมา
    if(slots[i].startTime >= a.endTime) break;
    // กลุ่มเดียวกันมีกิจกรรมอื่นเริ่มพอดีที่คอลัมน์ถัดไปอยู่แล้ว ห้ามคาบข้ามไปทับ ต้องเว้นให้มันโชว์เอง
    // (กันไม่ให้กิจกรรมที่ colspan ยาวๆ กลืนคอลัมน์ของกิจกรรมอื่นในแถวเดียวกันจนหายไป)
    if(g.some(x=> x.startTime===slots[i].startTime)) break;
    span++;
    const end = slots[i].endTime;
    if(!end || end==='23:59' || end>=a.endTime) break;
  }
  return span;
}
/** เซลล์จริงที่ต้องเรนเดอร์ของกลุ่ม g ตามแนวเวลา slots (ตัดช่องที่ถูก colspan คลุมไปแล้วออก) */
function docRowCells(g, slots){
  const cells = [];
  let skipUntil = -1;
  slots.forEach((s, i)=>{
    if(i<=skipUntil) return;
    const a = g.find(x=> x.startTime===s.startTime);
    if(!a){ cells.push({activity:null, span:1}); return; }
    const span = docActivitySpan(a, slots, i, g);
    skipUntil = i+span-1;
    cells.push({activity:a, span});
  });
  return cells;
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
        visitId: v.id, activityId: a.id, room: a.room, topic: a.topic, location: a.location,
        startTime: a.startTime || '00:00', endTime: a.endTime || '23:59',
        school: v.school, status: v.status, date: v.date, childrenCount: a.childrenCount
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
function parseCsvFirstColumn(text){
  // คอลัมน์แรกของทุกแถว ข้ามหัวตาราง รองรับค่าที่ครอบด้วย "..." (กรณีมีเครื่องหมายจุลภาคในชื่อ)
  return text.trim().split(/\r?\n/).slice(1).map(line=>{
    const m = line.match(/^"((?:[^"]|"")*)"/);
    return (m ? m[1].replace(/""/g,'"') : line.split(',')[0]).trim();
  }).filter(Boolean);
}
function parseCsvCell(cell){
  const m = (cell||'').match(/^"((?:[^"]|"")*)"/);
  return (m ? m[1].replace(/""/g,'"') : cell).trim();
}
function parseCsvTwoColumns(text){
  // คอลัมน์ที่ 1 = ไทย (หลัก), คอลัมน์ที่ 2 = อังกฤษ (เสริม ไม่บังคับมี) — แถวแรกเป็นหัวตาราง ไม่สนใจชื่อหัวตาราง
  return text.trim().split(/\r?\n/).slice(1).map(line=>{
    const cells = line.split(',');
    return { th: parseCsvCell(cells[0]||''), en: parseCsvCell(cells[1]||'') };
  }).filter(r=>r.th);
}
async function loadRefActivities(){
  await Promise.all(ROOM_CATEGORIES.map(async r=>{
    const url = CONFIG.ACTIVITY_CSV_URLS && CONFIG.ACTIVITY_CSV_URLS[r.id];
    if(!url) return;
    try{
      const res = await fetch(url);
      const rows = parseCsvTwoColumns(await res.text());
      refActivities[r.id] = [...new Set(rows.map(x=>x.th))];
      const enMap = {};
      rows.forEach(x=>{ if(x.en) enMap[x.th] = x.en; });
      refActivityEN[r.id] = enMap;
    }catch(err){ /* คงรายการเดิมไว้ */ }
  }));
  document.querySelectorAll('#activityRows .activity-slot').forEach(refreshTopicOptions);
}
/* ---------------- สถานที่ (รายชื่อจากชีต — 2 คอลัมน์ ไทย/อังกฤษ เหมือนกิจกรรม) ---------------- */
let refLocationEN = {};   // {locationTH: locationENG}
async function loadRefLocations(){
  if(!CONFIG.LOCATIONS_CSV_URL) return;
  try{
    const res = await fetch(CONFIG.LOCATIONS_CSV_URL);
    const rows = parseCsvTwoColumns(await res.text());
    const list = [...new Set(rows.map(x=>x.th))];
    if(list.length) refLocations = list;
    const enMap = {};
    rows.forEach(x=>{ if(x.en) enMap[x.th] = x.en; });
    refLocationEN = enMap;
  }catch(err){ /* คงรายการเดิมไว้ */ }
}
/* ---------------- แปลชื่อโรงเรียน/เรื่องกิจกรรม/สถานที่เป็นอังกฤษสำหรับเอกสาร (ไม่มี = ใช้ไทยแทน) ---------------- */
function schoolNameEN(schoolTH){
  const key = String(schoolTH||'').trim();
  const match = refSchools.find(s=>String(s.school_TH||'').trim()===key);
  return (match && match.school_ENG) ? match.school_ENG : schoolTH;
}
function topicNameEN(room, topicTH){
  const key = String(topicTH||'').trim();
  const en = (refActivityEN[room] || {})[key];   // enMap ถูก trim ไว้แล้วตอนโหลด (parseCsvCell)
  return en || topicTH;
}
function locationNameEN(locTH){
  const key = String(locTH||'').trim();
  return refLocationEN[key] || locTH;
}
function localizeVisitForLang(v, lang){
  if(lang!=='en') return v;
  return { ...v, school: schoolNameEN(v.school), activities: v.activities.map(a=>({...a, topic: topicNameEN(a.room, a.topic), location: locationNameEN(a.location)})) };
}
/* ---------------- ผู้บันทึก / ผู้แก้ไข (รายชื่อพนักงานจากชีต) ---------------- */
async function loadRefStaff(){
  if(!CONFIG.STAFF_CSV_URL) return;
  try{
    const res = await fetch(CONFIG.STAFF_CSV_URL);
    refStaff = [...new Set(parseCsvFirstColumn(await res.text()))];
  }catch(err){ /* คงรายการเดิมไว้ */ }
  renderStaffOptions();
}
function staffOptionsHtml(placeholder, current){
  const extra = current && !refStaff.includes(current) ? `<option value="${escapeHtml(current)}" selected>${escapeHtml(current)}</option>` : '';
  return `<option value="">${placeholder}</option>` +
    refStaff.map(n=>`<option value="${escapeHtml(n)}" ${n===current?'selected':''}>${escapeHtml(n)}</option>`).join('') + extra;
}
function renderStaffOptions(){
  const rec = document.getElementById('f_recorder'), edt = document.getElementById('f_editor');
  if(!rec || !edt) return;
  rec.innerHTML = staffOptionsHtml('- เลือกผู้บันทึก -', rec.value);
  edt.innerHTML = staffOptionsHtml(state.editingId ? '- เลือกผู้แก้ไข -' : '- (เฉพาะตอนแก้ไข) -', edt.value);
}
// เพิ่มใหม่: ผู้บันทึกเลือกได้, ผู้แก้ไขปิดไว้ | แก้ไข: ผู้บันทึกล็อกถ้ามีแล้ว (ใส่ได้ครั้งเดียว), ผู้แก้ไขต้องเลือกใหม่ทุกครั้ง (เริ่มว่างเสมอ)
function setupStaffFields(v){
  const rec = document.getElementById('f_recorder'), edt = document.getElementById('f_editor');
  rec.innerHTML = staffOptionsHtml('- เลือกผู้บันทึก -', v ? (v.recorder||'') : '');
  rec.value = v ? (v.recorder||'') : '';
  rec.disabled = !!(v && v.recorder);
  edt.innerHTML = staffOptionsHtml(v ? '- เลือกผู้แก้ไข -' : '- (เฉพาะตอนแก้ไข) -', '');
  edt.value = '';
  edt.disabled = !v;
  rec.classList.remove('needs-input'); edt.classList.remove('needs-input');
}
document.getElementById('f_recorder').addEventListener('change', e=> e.target.classList.remove('needs-input'));
document.getElementById('f_editor').addEventListener('change', e=> e.target.classList.remove('needs-input'));

function topicOptionsHtml(room, current){
  const list = refActivities[room] || [];
  const extra = current && !list.includes(current) ? `<option value="${escapeHtml(current)}" selected>${escapeHtml(current)}</option>` : '';
  return `<option value="">- เลือกเรื่อง/หัวข้อ -</option>` +
    list.map(t=>`<option value="${escapeHtml(t)}" ${t===current?'selected':''}>${escapeHtml(t)}</option>`).join('') + extra;
}
function refreshTopicOptions(slot){
  const sel = slot.querySelector('.act-topic');
  sel.innerHTML = topicOptionsHtml(slot.querySelector('.act-room').value, sel.value);
}
function renderSchoolDatalist(){
  document.getElementById('schoolRefList').innerHTML =
    refSchools.map(s=>`<option value="${escapeHtml(s.school_TH)}">`).join('');
}
document.getElementById('f_school').addEventListener('change', (e)=>{
  const match = refSchools.find(s=>s.school_TH===e.target.value);
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
    const dayOff = isDayOff(cellDate);
    const dayItems = items.filter(o=>o.date===ds).sort((a,b)=>a.startTime.localeCompare(b.startTime));
    const shown = dayItems.slice(0,3);
    const extra = dayItems.length - shown.length;
    body += `<div class="day-cell ${isOther?'other-month':''} ${isToday?'today':''} ${dayOff?'day-off':''}" data-date="${ds}">
      <div class="daynum">${cellDate.getDate()}${dayOff?'<span class="dayoff-tag">ปิด</span>':''}</div>
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
  container.innerHTML = `<div class="agenda-columns ${state.view==='week'?'is-week':'is-day'}">
    <div class="agenda-timeaxis">
      <div class="ahead">&nbsp;</div>
      <div class="agenda-colheads"><div class="agenda-colhead">&nbsp;</div></div>
      <div class="axis-body" style="height:${gridHeight}px">${agendaAxisHtml()}</div>
    </div>
    ${days.map(d=>{
    const ds = fmtDate(d);
    const dayItems = items.filter(o=>o.date===ds);
    const isToday = ds===todayStr();
    const dayOff = isDayOff(d);
    const {items:laidOut, groups, colCount} = layoutAgendaItems(dayItems);
    return `<div class="agenda-day ${isToday?'today':''} ${dayOff?'day-off':''}">
      <div class="ahead">${WEEKDAYS_TH[d.getDay()]} <span class="num">${d.getDate()}</span>${dayOff?'<span class="dayoff-tag">ปิดทำการ</span>':''}</div>
      <div class="agenda-colheads">
        ${groups.map(g=>{
          const r = roomInfo(g.catId);
          const widthPct = g.colSpan/colCount*100;
          return `<div class="agenda-colhead" style="width:${widthPct}%;background:${r.bg};color:${r.color}">${r.label}</div>`;
        }).join('')}
      </div>
      <div class="agenda-events" style="height:${gridHeight}px">
        ${groups.map(g=>{
          const r = roomInfo(g.catId);
          const widthPct = g.colSpan/colCount*100;
          const leftPct = g.colStart/colCount*100;
          return `<div class="agenda-colband" style="left:${leftPct}%;width:${widthPct}%;background:${r.tint}"></div>`;
        }).join('')}
        ${agendaGridLinesHtml()}
        ${dayItems.length===0 ? `<div class="agenda-empty">${dayOff?'ปิดทำการ (วันจันทร์)':'ไม่มีการจอง'}</div>` : ''}
        ${laidOut.map(o=>{
          const r = roomInfo(o.room), s = statusInfo(o.status);
          const top = (Math.max(o.startMin,AGENDA_GRID_START)-AGENDA_GRID_START)/AGENDA_SLOT_MIN*AGENDA_SLOT_PX;
          const bottom = (Math.min(o.endMin,AGENDA_GRID_END)-AGENDA_GRID_START)/AGENDA_SLOT_MIN*AGENDA_SLOT_PX;
          const height = Math.max(bottom-top, AGENDA_SLOT_PX*0.7);
          return `<div class="agenda-card" data-visit-id="${o.visitId}" style="border-left-color:${r.color};background:${r.bg};top:${top}px;height:${height}px;left:${o.leftPct}%;width:calc(${o.widthPct}% - 4px)">
            <div class="corner-info">
              <div class="people-count" title="จำนวนคน">${Number(o.childrenCount)||0} คน</div>
              ${o.location ? (()=>{ const lc = locationColorInfo(o.location); return `<div class="location-tag" title="สถานที่" style="background:${lc.bg};color:${lc.color}">${escapeHtml(o.location)}</div>`; })() : ''}
            </div>
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

/* ---------------- Mini calendar (sidebar, คลิกวันเพื่อไปยังวันนั้น) ---------------- */
function renderMiniCal(){
  const el = document.getElementById('miniCal');
  const cur = state.cursorDate;
  // เมื่อปฏิทินหลักข้ามเดือน ให้ปฏิทินย่อยตามไปด้วย (แต่ไม่รีเซ็ตเมื่อผู้ใช้เลื่อนดูเดือนอื่นเอง)
  const curKey = cur.getFullYear()+'-'+cur.getMonth();
  if(state.miniSyncedKey !== curKey){
    state.miniSyncedKey = curKey;
    state.miniMonth = new Date(cur.getFullYear(), cur.getMonth(), 1);
  }
  const m = state.miniMonth;
  const gridStart = addDays(m, -m.getDay());
  const busy = new Set(visibleOccurrences().map(o=>o.date));
  const today = todayStr();
  let selStart = null, selEnd = null;   // ช่วงที่กำลังแสดงในปฏิทินหลัก (สัปดาห์/วัน)
  if(state.view==='week'){ selStart = fmtDate(startOfWeek(cur)); selEnd = fmtDate(addDays(startOfWeek(cur),6)); }
  else if(state.view==='day'){ selStart = selEnd = fmtDate(cur); }
  let cells = '';
  for(let i=0;i<42;i++){
    const d = addDays(gridStart, i), ds = fmtDate(d);
    const cls = ['mini-day'];
    if(d.getMonth()!==m.getMonth()) cls.push('muted');
    if(ds===today) cls.push('is-today');
    if(selStart && ds>=selStart && ds<=selEnd) cls.push('in-range');
    if(busy.has(ds)) cls.push('has-events');
    cells += `<button type="button" class="${cls.join(' ')}" data-date="${ds}">${d.getDate()}</button>`;
  }
  el.innerHTML = `<div class="mini-head">
      <span class="mini-title">${MONTHS_TH[m.getMonth()]} ${m.getFullYear()+543}</span>
      <button type="button" class="mini-nav" data-step="-1" aria-label="เดือนก่อนหน้า">‹</button>
      <button type="button" class="mini-nav" data-step="1" aria-label="เดือนถัดไป">›</button>
    </div>
    <div class="mini-grid">${WEEKDAYS_TH.map(w=>`<div class="mini-wd">${w}</div>`).join('')}${cells}</div>`;
}
document.getElementById('miniCal').addEventListener('click', (e)=>{
  const nav = e.target.closest('.mini-nav');
  if(nav){
    const m = state.miniMonth;
    state.miniMonth = new Date(m.getFullYear(), m.getMonth()+Number(nav.dataset.step), 1);
    renderMiniCal();
    return;
  }
  const day = e.target.closest('.mini-day');
  if(day){
    state.cursorDate = parseDate(day.dataset.date);
    state.miniSyncedKey = '';   // ให้ปฏิทินย่อยตามเดือนของวันที่เลือก
    renderAll();
  }
});

function renderAll(){
  updatePeriodLabel();
  renderMiniCal();
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

/* ---------------- Order: สรุปกิจกรรมรายสัปดาห์ แยก Inspire Lab / Innovation Space / อื่นๆ สำหรับคนเตรียมของ ---------------- */
const ORDER_ROOMS = [   // ลำดับคอลัมน์ + สี
  {id:'inspirelab', color:'#3E93C9', bg:'#E7F2F8'},
  {id:'innovation', color:'#A67C00', bg:'#FFF3CC'},
  {id:'other',      color:'#7C4DBB', bg:'#F1E9FA'}
];
const ORDER_CSS = `
.order-sheet{font-family:'Sarabun','TH SarabunPSK',sans-serif;color:#1B2836;font-size:14px;line-height:1.45;}
.order-sheet h1{font-size:20px;margin:0 0 2px;color:#1E3A5F;}
.order-sheet .order-sub{color:#5B6B85;font-size:13px;margin-bottom:14px;}
.order-sheet .order-cols{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;align-items:start;}
.order-sheet .order-col{border:1px solid #DEE5EC;border-radius:10px;overflow:hidden;background:#fff;}
.order-sheet .order-col-head{display:flex;justify-content:space-between;align-items:baseline;padding:9px 12px;font-weight:700;}
.order-sheet .order-col-head small{font-weight:600;font-size:12px;}
.order-sheet .order-col-head .order-col-right{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
.order-sheet .order-col-print{border:1px solid currentColor;background:rgba(255,255,255,.7);color:inherit;border-radius:7px;padding:2px 9px;font:inherit;font-size:12px;font-weight:700;cursor:pointer;}
.order-sheet .order-col-print:hover{background:#fff;}
.order-sheet .order-col-pick{border:none;background:transparent;color:inherit;text-decoration:underline;font:inherit;font-size:11px;font-weight:600;cursor:pointer;padding:0 1px;opacity:.85;}
.order-sheet .order-col-pick:hover{opacity:1;}
.order-sheet .order-item{padding:9px 12px;border-top:1px solid #EEF2F7;}
.order-sheet .order-topic{display:flex;justify-content:space-between;gap:8px;font-weight:700;}
.order-sheet .order-topic span:last-child{white-space:nowrap;}
.order-sheet .order-group-line{display:flex;align-items:center;gap:6px;cursor:pointer;min-width:0;}
.order-sheet .order-group-chk{flex-shrink:0;accent-color:#2A66C4;cursor:pointer;}
.order-sheet .order-lines{margin:3px 0 0;padding:0;list-style:none;color:#5B6B85;font-size:12.5px;}
.order-sheet .order-lines li{padding:2px 0;}
.order-sheet .order-row-line{display:flex;align-items:flex-start;gap:6px;cursor:pointer;}
.order-sheet .order-row-chk{margin-top:3px;flex-shrink:0;accent-color:#2A66C4;cursor:pointer;}
.order-sheet .order-lines li.is-printed{opacity:.55;}
.order-sheet .printed-tag{color:#9AA7B8;font-weight:600;}
.order-sheet .order-empty{padding:12px;color:#9AA7B8;font-size:13px;}
.order-sheet .status-tag{font-weight:600;white-space:nowrap;}
@media (max-width:760px){.order-sheet .order-cols{grid-template-columns:1fr;}}
/* ใบพิมพ์ 80 มม. (เครื่องพิมพ์ความร้อน/สลิป) — ขาวดำล้วน ห้องละ 1 ใบ */
.order-receipt{font-family:'Sarabun','TH SarabunPSK',sans-serif;color:#000;background:#fff;font-size:15px;line-height:1.35;width:100%;}
.order-receipt .r-title{font-size:21px;font-weight:700;text-align:center;}
.order-receipt .r-room{font-size:19px;font-weight:700;text-align:center;border:1.5px solid #000;padding:3px 0;margin:4px 0;}
.order-receipt .r-week{text-align:center;font-size:15px;}
.order-receipt .r-total{text-align:center;font-weight:700;margin-top:3px;}
.order-receipt hr{border:none;border-top:1px dashed #000;margin:7px 0;}
.order-receipt .r-topic{font-weight:700;font-size:17px;}
.order-receipt .r-sum{font-weight:700;}
.order-receipt .r-row{margin:4px 0 0 6px;}
.order-receipt .r-when{font-weight:600;}
.order-receipt .r-foot{text-align:center;font-size:12px;margin-top:5px;}
.order-receipt + .order-receipt{page-break-before:always;}
`;
(function injectOrderStyle(){
  const st = document.createElement('style'); st.id = 'orderStyle'; st.textContent = ORDER_CSS; document.head.appendChild(st);
})();

/* ติ๊กเลือกรายการก่อนพิมพ์ — กันพิมพ์ซ้ำเมื่อมีรายการเพิ่มเข้ามาทีหลัง: รายการที่เคยพิมพ์แล้ว
   (จำไว้ต่อสัปดาห์ผ่าน localStorage) จะไม่ถูกติ๊กให้อัตโนมัติในครั้งถัดไป ส่วนรายการใหม่ที่ยังไม่
   เคยพิมพ์จะติ๊กไว้ให้เลย พิมพ์เฉพาะที่ติ๊กเท่านั้น */
function orderRowKey(o){ return o.visitId+'|'+o.activityId; }
function orderPrintedStoreKey(weekStart){ return 'order_printed_'+fmtDate(weekStart); }
function loadOrderPrinted(weekStart){
  try{ return new Set(JSON.parse(localStorage.getItem(orderPrintedStoreKey(weekStart))||'[]')); }
  catch(e){ return new Set(); }
}
function saveOrderPrinted(weekStart, set){
  try{ localStorage.setItem(orderPrintedStoreKey(weekStart), JSON.stringify([...set])); } catch(e){ /* ignore */ }
}
function orderWeekLabel(weekStart){
  const end = addDays(weekStart, 6);
  return `${weekStart.getDate()} ${MONTHS_TH[weekStart.getMonth()].slice(0,3)} – ${end.getDate()} ${MONTHS_TH[end.getMonth()].slice(0,3)} ${end.getFullYear()+543}`;
}
function buildOrderData(weekStart){
  // รายการในสัปดาห์นั้น (ไม่รวมที่ยกเลิก) จัดกลุ่มตามห้อง → ชื่อกิจกรรม/หัวข้อ
  const from = fmtDate(weekStart), to = fmtDate(addDays(weekStart, 6));
  const occ = flattenOccurrences().filter(o=> o.date>=from && o.date<=to && o.status!=='cancelled');
  return ORDER_ROOMS.map(r=>{
    const byTopic = new Map();
    occ.filter(o=>o.room===r.id).forEach(o=>{
      const topic = String(o.topic||'').trim() || '(ไม่ระบุเรื่อง)';
      if(!byTopic.has(topic)) byTopic.set(topic, {topic, total:0, rows:[]});
      const g = byTopic.get(topic);
      g.total += Number(o.childrenCount)||0;
      g.rows.push(o);
    });
    const groups = [...byTopic.values()].sort((a,b)=> a.topic.localeCompare(b.topic,'th'));
    groups.forEach(g=> g.rows.sort((a,b)=> (a.date+a.startTime).localeCompare(b.date+b.startTime)));
    return {...r, label: roomInfo(r.id).label, groups, total: groups.reduce((n,g)=>n+g.total,0)};
  });
}
function buildOrderHtml(weekStart){
  const cols = buildOrderData(weekStart);
  const printed = loadOrderPrinted(weekStart);
  const rowLine = o=>{
    const d = parseDate(o.date);
    const time = o.startTime + (o.endTime!=='23:59' ? '–'+o.endTime : ' เป็นต้นไป');
    const st = statusInfo(o.status);
    const isPrinted = printed.has(orderRowKey(o));
    return `<li class="${isPrinted?'is-printed':''}">
      <label class="order-row-line">
        <input type="checkbox" class="order-row-chk" data-key="${orderRowKey(o)}" ${isPrinted?'':'checked'}>
        <span>${WEEKDAYS_TH[d.getDay()]} ${d.getDate()} ${MONTHS_TH[d.getMonth()].slice(0,3)} · ${time} · ${escapeHtml(o.school)} · ${Number(o.childrenCount)||0} ชุด${o.location?' · '+escapeHtml(o.location):''} · <span class="status-tag" style="color:${st.color}">${st.label}</span>${isPrinted?' · <span class="printed-tag">พิมพ์แล้ว</span>':''}</span>
      </label>
    </li>`;
  };
  return `<div class="order-sheet">
    <h1>Order · สรุปกิจกรรมสำหรับเตรียมของ</h1>
    <div class="order-sub">สัปดาห์ ${orderWeekLabel(weekStart)} · แยกตามห้อง/กิจกรรม และชื่อกิจกรรม (ไม่รวมรายการที่ยกเลิก · จำนวน = ชุดกิจกรรม) · ติ๊กเลือกรายการที่จะพิมพ์ — รายการที่เคยพิมพ์แล้วจะไม่ถูกติ๊กให้อัตโนมัติอีก</div>
    <div class="order-cols">
      ${cols.map(c=>`<div class="order-col" data-room="${c.id}">
        <div class="order-col-head" style="background:${c.bg};color:${c.color}">
          <span>${escapeHtml(c.label)}</span>
          <span class="order-col-right">
            <small>รวม ${c.total} ชุด</small>
            ${c.groups.length ? `<button type="button" class="order-col-pick" data-pick="all">เลือกทั้งหมด</button><button type="button" class="order-col-pick" data-pick="none">ล้าง</button>` : ''}
            <button type="button" class="order-col-print" data-order-print="${c.id}" title="พิมพ์เฉพาะรายการที่ติ๊กเลือกไว้ของ ${escapeHtml(c.label)} (80 มม.)">🖨 พิมพ์ที่เลือก</button>
          </span>
        </div>
        ${c.groups.length ? c.groups.map(g=>`<div class="order-item">
          <div class="order-topic">
            <label class="order-group-line"><input type="checkbox" class="order-group-chk"><span>${escapeHtml(g.topic)}</span></label>
            <span>${g.total} ชุด · ${g.rows.length} รอบ</span>
          </div>
          <ul class="order-lines">${g.rows.map(rowLine).join('')}</ul>
        </div>`).join('') : '<div class="order-empty">ไม่มีรายการ</div>'}
      </div>`).join('')}
    </div>
  </div>`;
}
function updateOrderGroupCheckboxes(root){
  // เช็คบล็อกที่หัวแต่ละกิจกรรม: ติ๊กเมื่อทุกแถวในกิจกรรมนั้นถูกติ๊ก, indeterminate เมื่อติ๊กบางส่วน
  root.querySelectorAll('.order-item').forEach(item=>{
    const rows = [...item.querySelectorAll('.order-row-chk')];
    const groupChk = item.querySelector('.order-group-chk');
    if(!groupChk || !rows.length) return;
    const checkedCount = rows.filter(r=>r.checked).length;
    groupChk.checked = checkedCount===rows.length;
    groupChk.indeterminate = checkedCount>0 && checkedCount<rows.length;
  });
}
function renderOrder(){
  document.getElementById('orderBody').innerHTML = buildOrderHtml(state.orderWeekStart);
  updateOrderGroupCheckboxes(document.getElementById('orderBody'));
}
function shiftOrderWeek(weeks){ state.orderWeekStart = addDays(state.orderWeekStart, 7*weeks); renderOrder(); }
document.getElementById('orderBtn').addEventListener('click', ()=>{
  state.orderWeekStart = startOfWeek(state.cursorDate);   // เริ่มที่สัปดาห์ที่กำลังดูอยู่ แล้วกดเลื่อนดูสัปดาห์อื่นได้ในหน้านี้
  renderOrder();
  openOverlay('orderOverlay');
});
document.getElementById('orderPrev').addEventListener('click', ()=> shiftOrderWeek(-1));
document.getElementById('orderNext').addEventListener('click', ()=> shiftOrderWeek(1));
document.getElementById('orderThisWeek').addEventListener('click', ()=>{ state.orderWeekStart = startOfWeek(new Date()); renderOrder(); });
/* ---- พิมพ์ใบ Order ขนาด 80 มม. (FUJITSU FP-2000 / เครื่องพิมพ์ความร้อน) ---- */
const RECEIPT_PAGE_CSS = '@page{size:80mm auto;margin:3mm 4mm;}';   // ความกว้าง 80 มม. ความยาวตามเนื้อหา
function buildOrderReceiptHtml(weekStart, col){
  const rowHtml = o=>{
    const d = parseDate(o.date);
    const time = o.startTime + (o.endTime!=='23:59' ? '–'+o.endTime : ' เป็นต้นไป');
    const st = statusInfo(o.status);
    return `<div class="r-row"><div class="r-when">${WEEKDAYS_TH[d.getDay()]} ${d.getDate()} ${MONTHS_TH[d.getMonth()].slice(0,3)} · ${time}</div>
      <div>${escapeHtml(o.school)} · ${Number(o.childrenCount)||0} ชุด${o.location?' · '+escapeHtml(o.location):''} · (${st.label})</div></div>`;
  };
  return `<div class="order-receipt">
    <div class="r-title">ORDER</div>
    <div class="r-room">${escapeHtml(col.label)}</div>
    <div class="r-week">สัปดาห์ ${orderWeekLabel(weekStart)}</div>
    <div class="r-total">รวม ${col.total} ชุด</div>
    ${col.groups.map(g=>`<hr>
      <div class="r-topic">${escapeHtml(g.topic)}</div>
      <div class="r-sum">รวม ${g.total} ชุด · ${g.rows.length} รอบ</div>
      ${g.rows.map(rowHtml).join('')}`).join('')}
    <hr>
    <div class="r-foot">พิมพ์เมื่อ ${new Date().toLocaleString('th-TH')}</div>
  </div>`;
}
function buildSelectedOrderData(weekStart, which){
  // ตัดเหลือเฉพาะแถวที่ผู้ใช้ติ๊กเลือกไว้บนหน้าจอ (คำนวณจำนวนรวมของแต่ละกลุ่ม/ห้องใหม่ตามแถวที่เหลือ)
  const cols = buildOrderData(weekStart);
  const checkedKeys = new Set([...document.querySelectorAll('#orderBody .order-row-chk:checked')].map(el=>el.dataset.key));
  const scoped = which==='all' ? cols : cols.filter(c=>c.id===which);
  return scoped.map(c=>{
    const groups = c.groups
      .map(g=>({...g, rows: g.rows.filter(o=>checkedKeys.has(orderRowKey(o)))}))
      .filter(g=>g.rows.length)
      .map(g=>({...g, total: g.rows.reduce((n,o)=>n+(Number(o.childrenCount)||0),0)}));
    return {...c, groups, total: groups.reduce((n,g)=>n+g.total,0)};
  }).filter(c=>c.groups.length);
}
function printOrder(which){
  const picked = buildSelectedOrderData(state.orderWeekStart, which);
  if(picked.length===0){ alert('กรุณาติ๊กเลือกรายการที่ต้องการพิมพ์อย่างน้อย 1 รายการ'); return; }
  document.getElementById('printArea').innerHTML = picked.map(c=> buildOrderReceiptHtml(state.orderWeekStart, c)).join('');
  let st = document.getElementById('receiptPageStyle');
  if(!st){ st = document.createElement('style'); st.id = 'receiptPageStyle'; document.head.appendChild(st); }
  st.textContent = RECEIPT_PAGE_CSS;   // ใช้เฉพาะตอนพิมพ์ Order แล้วเอาออกเมื่อพิมพ์เสร็จ ไม่กระทบเอกสาร A4
  const printed = loadOrderPrinted(state.orderWeekStart);
  picked.forEach(c=> c.groups.forEach(g=> g.rows.forEach(o=> printed.add(orderRowKey(o)))));
  saveOrderPrinted(state.orderWeekStart, printed);
  window.addEventListener('afterprint', ()=> { st.remove(); renderOrder(); }, {once:true});
  window.print();
}
document.getElementById('orderOverlay').addEventListener('click', (e)=>{
  const printBtn = e.target.closest('[data-order-print]');
  if(printBtn){ printOrder(printBtn.dataset.orderPrint); return; }
  const pickBtn = e.target.closest('.order-col-pick');
  if(pickBtn){
    const col = pickBtn.closest('.order-col');
    col.querySelectorAll('.order-row-chk').forEach(chk=> chk.checked = pickBtn.dataset.pick==='all');
    updateOrderGroupCheckboxes(col);
    return;
  }
  const pickAllBtn = e.target.closest('[data-pick-all]');
  if(pickAllBtn){
    const body = document.getElementById('orderBody');
    body.querySelectorAll('.order-row-chk').forEach(chk=> chk.checked = pickAllBtn.dataset.pickAll==='all');
    updateOrderGroupCheckboxes(body);
  }
});
document.getElementById('orderBody').addEventListener('change', (e)=>{
  if(e.target.classList.contains('order-row-chk')){
    updateOrderGroupCheckboxes(e.target.closest('.order-item'));
  } else if(e.target.classList.contains('order-group-chk')){
    const item = e.target.closest('.order-item');
    item.querySelectorAll('.order-row-chk').forEach(chk=> chk.checked = e.target.checked);
    e.target.indeterminate = false;
  }
});

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
  try{ await Promise.all([loadRefSchools(), loadRefActivities(), loadRefStaff(), loadRefLocations(), loadVisits()]); }
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
/* เวลา: input ข้อความธรรมดา (HH:MM) พิมพ์ตัวเลขจากคีย์บอร์ดได้ตรงๆ พร้อม popup กดเลือกชั่วโมง/นาที
   ทุก 5 นาที (นาทีของ picker เดิมแบบ type=time โชว์ทีละ 1 นาทีเสมอ ปรับด้วย step ไม่ได้จริงในเบราว์เซอร์)
   ค่า "HH:MM" อยู่ใน .value เหมือนเดิม โค้ดที่อ่าน .act-start/.act-end อื่นๆ ไม่ต้องแก้ */
function timeFieldHtml(cls, value){
  return `<input type="text" inputmode="numeric" maxlength="5" placeholder="HH:MM" class="${cls} time-text" value="${value||''}">`;
}
const TIME_PICKER_MINUTES = Array.from({length:12}, (_,i)=> pad(i*5));
const TIME_PICKER_HOURS = Array.from({length:24}, (_,i)=> pad(i));
let timePickerTarget = null;
function timePickerOptionsHtml(){
  document.getElementById('tpHours').innerHTML = TIME_PICKER_HOURS.map(h=>`<div class="tp-opt" data-h="${h}">${h}</div>`).join('');
  document.getElementById('tpMinutes').innerHTML = TIME_PICKER_MINUTES.map(m=>`<div class="tp-opt" data-m="${m}">${m}</div>`).join('');
}
timePickerOptionsHtml();
function openTimePicker(input){
  timePickerTarget = input;
  const [h,m] = (input.value||'').split(':');
  const popup = document.getElementById('timePickerPopup');
  popup.querySelectorAll('.tp-opt').forEach(el=>{
    el.classList.toggle('active', ('h' in el.dataset && el.dataset.h===h) || ('m' in el.dataset && el.dataset.m===m));
  });
  const rect = input.getBoundingClientRect();
  popup.style.left = Math.round(rect.left)+'px';
  popup.style.top = Math.round(rect.bottom+4)+'px';
  popup.classList.add('show');
  const activeH = popup.querySelector('#tpHours .tp-opt.active');
  if(activeH) activeH.scrollIntoView({block:'center'});
  const activeM = popup.querySelector('#tpMinutes .tp-opt.active');
  if(activeM) activeM.scrollIntoView({block:'center'});
}
function closeTimePicker(){
  document.getElementById('timePickerPopup').classList.remove('show');
  timePickerTarget = null;
}
document.getElementById('timePickerPopup').addEventListener('mousedown', e=> e.preventDefault());
document.getElementById('timePickerPopup').addEventListener('click', e=>{
  const opt = e.target.closest('.tp-opt');
  if(!opt || !timePickerTarget) return;
  const [ch,cm] = (timePickerTarget.value||'').split(':');
  const h = 'h' in opt.dataset ? opt.dataset.h : (ch||'00');
  const m = 'm' in opt.dataset ? opt.dataset.m : (cm||'00');
  timePickerTarget.value = `${h}:${m}`;
  timePickerTarget.dispatchEvent(new Event('input', {bubbles:true}));
  timePickerTarget.dispatchEvent(new Event('change', {bubbles:true}));
  openTimePicker(timePickerTarget); // อัปเดต highlight ไว้ ไม่ปิด เผื่อกดเลือกอีกฝั่ง
});
document.addEventListener('focusin', e=>{
  if(e.target.matches('.time-text')) openTimePicker(e.target);
  else if(timePickerTarget && !document.getElementById('timePickerPopup').contains(e.target)) closeTimePicker();
});
document.addEventListener('click', e=>{
  if(!timePickerTarget) return;
  if(e.target.matches('.time-text') || document.getElementById('timePickerPopup').contains(e.target)) return;
  closeTimePicker();
});
document.addEventListener('input', e=>{
  if(!e.target.matches('.time-text')) return;
  let v = e.target.value.replace(/[^0-9]/g,'').slice(0,4);
  if(v.length>=3) v = v.slice(0,2)+':'+v.slice(2);
  e.target.value = v;
});
document.addEventListener('focusout', e=>{
  if(!e.target.matches('.time-text')) return;
  const m = e.target.value.match(/^(\d{1,2}):(\d{1,2})$/);
  if(!m) return;
  const h = Math.min(23, parseInt(m[1],10));
  const mi = Math.min(59, parseInt(m[2],10));
  e.target.value = pad(h)+':'+pad(mi);
});
function activitySlotHtml(a){
  const id = a.id || uid();
  return `<div class="activity-slot" data-activity-id="${id}" data-room="${a.room||ROOM_CATEGORIES[0].id}">
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
        <select class="act-topic">${topicOptionsHtml(a.room||ROOM_CATEGORIES[0].id, a.topic||'')}</select>
      </div>
      <div class="field">
        <label>สถานที่</label>
        <select class="act-location">
          <option value="">- ไม่ระบุ -</option>
          ${refLocations.map(loc=>`<option value="${escapeHtml(loc)}" ${a.location===loc?'selected':''}>${escapeHtml(loc)}</option>`).join('')}
          ${a.location && !refLocations.includes(a.location) ? `<option value="${escapeHtml(a.location)}" selected>${escapeHtml(a.location)}</option>` : ''}
        </select>
      </div>
      <div class="field">
        <label>เวลาเริ่ม</label>
        ${timeFieldHtml('act-start', a.startTime)}
      </div>
      <div class="field">
        <label>สิ้นสุด</label>
        ${timeFieldHtml('act-end', a.endTime)}
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
    <div class="group-banner">
      <button type="button" class="group-remove-btn" title="ลบกลุ่มนี้ทั้งหมด">✕ ลบกลุ่ม</button>
    </div>
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
  refreshLocationAvailability();
}
document.getElementById('addActivityBtn').addEventListener('click', ()=> addActivityGroup());
document.getElementById('activityRows').addEventListener('click', (e)=>{
  if(e.target.classList.contains('add-slot-btn')){
    const group = e.target.closest('.activity-group');
    const defaults = {room: ROOM_CATEGORIES[0].id, pricePerPerson: ROOM_DEFAULT_PRICE[ROOM_CATEGORIES[0].id]};
    group.querySelector('.activity-slots').insertAdjacentHTML('beforeend', activitySlotHtml(defaults));
    recomputeGroupSubtotal(group);
    refreshLocationAvailability();
  } else if(e.target.classList.contains('group-remove-btn')){
    e.target.closest('.activity-group').remove();
    updateTotalPeople();
    refreshLocationAvailability();
  } else if(e.target.classList.contains('activity-remove-btn')){
    const group = e.target.closest('.activity-group');
    const slot = e.target.closest('.activity-slot');
    if(group.querySelectorAll('.activity-slot').length<=1){ group.remove(); } else { slot.remove(); }
    updateTotalPeople();
    refreshLocationAvailability();
  } else if(e.target.matches('.round-presets button')){
    const slot = e.target.closest('.activity-slot');
    slot.querySelector('.act-start').value = e.target.dataset.s || '';
    slot.querySelector('.act-end').value = e.target.dataset.e || '';
    refreshLocationAvailability();
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
    slot.dataset.room = e.target.value;
    slot.querySelector('.act-topic').value = '';
    refreshTopicOptions(slot);
    const priceInput = slot.querySelector('.act-price');
    if(!priceInput.value){ priceInput.value = ROOM_DEFAULT_PRICE[e.target.value] ?? ''; }
    recomputeGroupSubtotal(e.target.closest('.activity-group'));
  }
  if(e.target.matches('.act-start, .act-end, .act-location')){
    refreshLocationAvailability();
  }
});
document.getElementById('f_date').addEventListener('change', ()=>{
  refreshLocationAvailability();
  const warn = document.getElementById('conflictWarning');
  const date = document.getElementById('f_date').value;
  if(date && isDayOff(date)){
    warn.style.display='block';
    warn.innerHTML = '⛔ วันจันทร์เป็นวันหยุดของสถานที่ ไม่สามารถจองกิจกรรมในวันนี้ได้ กรุณาเลือกวันอื่น';
  } else if(warn.innerHTML.includes('วันหยุดของสถานที่')){
    warn.style.display='none';
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
  setupStaffFields(null);
  updateTotalPeople();
  refreshLocationAvailability();
  openOverlay('formOverlay');
}
function openEditForm(v){
  state.editingId = v.id;
  setupStaffFields(v);
  document.getElementById('formTitle').textContent = 'แก้ไขการจอง';
  document.getElementById('f_id').value = v.id;
  document.getElementById('f_school').value = v.school;
  const packageSel = document.getElementById('f_packageLabel');
  const pkg = v.packageLabel||'';
  const BASE_PACKAGE_OPTIONS = ['', 'Basic', 'Advance'];
  [...packageSel.options].forEach(o=>{ if(!BASE_PACKAGE_OPTIONS.includes(o.value)) o.remove(); }); // ล้างตัวเลือกเก่าที่เคยเติมไว้จากการแก้ไขครั้งก่อน
  if(pkg && !BASE_PACKAGE_OPTIONS.includes(pkg)){
    packageSel.appendChild(new Option(pkg, pkg)); // ข้อมูลเก่าที่เคยพิมพ์เองนอกเหนือ Basic/Advance ไม่ให้หายไปเงียบๆ
  }
  packageSel.value = pkg;
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
  refreshLocationAvailability();
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
        location: slotEl.querySelector('.act-location').value.trim(),
        startTime: slotEl.querySelector('.act-start').value,
        endTime: slotEl.querySelector('.act-end').value,
        childrenCount,
        pricePerPerson: Number(slotEl.querySelector('.act-price').value)||0
      });
    });
  });
  return activities;
}
/* ---------------- ตรวจสอบสถานที่ (physical location) ชนกันเวลาเดียวกัน — ห้ามเลือกซ้ำ ---------------- */
function formSlotsSnapshot(){
  return [...document.querySelectorAll('#activityRows .activity-slot')].map(slotEl=>({
    slotEl,
    id: slotEl.dataset.activityId,
    startTime: slotEl.querySelector('.act-start').value,
    endTime: slotEl.querySelector('.act-end').value || '23:59',
    locationSel: slotEl.querySelector('.act-location')
  }));
}
function findLocationConflict(location, startTime, endTime, date, excludeVisitId, excludeSlotId, formSlots){
  if(!location || !startTime || !date) return null;
  const end = endTime || '23:59';
  for(const v of state.visits){
    if(v.id === excludeVisitId) continue;
    if(v.date !== date) continue;
    for(const a of v.activities){
      if(a.location !== location || !a.startTime) continue;
      if(timeOverlap(startTime, end, a.startTime, a.endTime || '23:59')) return v.school;
    }
  }
  for(const s of formSlots){
    if(s.id === excludeSlotId) continue;
    if(s.locationSel.value !== location || !s.startTime) continue;
    if(timeOverlap(startTime, end, s.startTime, s.endTime)) return 'รอบอื่นในฟอร์มนี้';
  }
  return null;
}
function refreshLocationAvailability(){
  const date = document.getElementById('f_date').value;
  const formSlots = formSlotsSnapshot();
  formSlots.forEach(s=>{
    [...s.locationSel.options].forEach(opt=>{
      if(!opt.value){ opt.disabled = false; opt.title=''; return; }
      const conflict = findLocationConflict(opt.value, s.startTime, s.endTime, date, state.editingId, s.id, formSlots);
      opt.disabled = !!conflict;
      opt.title = conflict ? `ไม่ว่าง ช่วงเวลานี้ (${escapeHtml(conflict)})` : '';
    });
  });
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
  if(isDayOff(date)){
    alert('วันจันทร์เป็นวันหยุดของสถานที่ ไม่สามารถจองกิจกรรมในวันนี้ได้ กรุณาเลือกวันอื่น'); return;
  }
  const activities = readActivitiesFromForm();
  if(activities.length===0){
    alert('กรุณาเพิ่มกิจกรรมอย่างน้อย 1 รายการ'); return;
  }
  for(const a of activities){
    if(!a.startTime){ alert('กรุณาระบุเวลาเริ่มของทุกกิจกรรม'); return; }
    if(a.endTime && a.endTime <= a.startTime){ alert('เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม'); return; }
  }
  for(const a of activities){
    if(!a.location) continue;
    const clash = findLocationConflict(a.location, a.startTime, a.endTime, date, state.editingId, a.id, formSlotsSnapshot());
    if(clash){ alert(`สถานที่ "${a.location}" ไม่ว่างช่วงเวลานี้ (ชนกับ ${clash}) กรุณาเลือกสถานที่อื่นหรือปรับเวลา`); return; }
  }

  // ผู้บันทึก: ต้องมีเสมอ (ใส่ครั้งเดียว) | ผู้แก้ไข: ต้องเลือกทุกครั้งที่แก้ไข
  const recorderEl = document.getElementById('f_recorder'), editorEl = document.getElementById('f_editor');
  const recorder = recorderEl.value.trim(), editor = editorEl.value.trim();
  if(!recorder){
    recorderEl.classList.add('needs-input'); recorderEl.focus();
    alert(refStaff.length ? 'กรุณาเลือกผู้บันทึก' : 'ยังไม่มีรายชื่อพนักงานจาก Sheet (แท็บ Staff_Name) — กด "⟳ ซิงก์ข้อมูลอ้างอิง" แล้วลองใหม่'); return;
  }
  if(state.editingId && !editor){
    editorEl.classList.add('needs-input'); editorEl.focus();
    alert('กรุณาเลือกผู้แก้ไข (ต้องระบุทุกครั้งที่แก้ไข)'); return;
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
    recorder,
    editor: state.editingId ? editor : '',   // การจองใหม่ยังไม่มีผู้แก้ไข
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
    <tr><td class="k">ผู้บันทึก</td><td>${escapeHtml(v.recorder)||'-'}</td></tr>
    <tr><td class="k">ผู้แก้ไขล่าสุด</td><td>${escapeHtml(v.editor)||'-'}</td></tr>
  `;
  const acts = visitActivitiesByTimeThenRoom(v);
  const grand = visitGrandTotal(v);
  const billable = billableCount(v);
  document.getElementById('costTable').innerHTML = `
    <tr><th>กิจกรรม</th><th>สถานที่</th><th>ระดับชั้น/กลุ่ม</th><th>เวลา</th><th>จำนวนเด็ก</th><th>ราคา/คน</th><th>รวม (บาท)</th></tr>
    ${acts.map(a=>`<tr data-room="${roomInfo(a.room).id}">
      <td>${roomInfo(a.room).label}${a.topic?('<br><span style="color:var(--ink-faint);font-size:11.5px;">'+escapeHtml(a.topic)+'</span>'):''}</td>
      <td>${escapeHtml(a.location)||'-'}</td>
      <td>${escapeHtml(a.gradeLevel)||'-'}</td>
      <td>${a.startTime}${a.endTime?('–'+a.endTime):' เป็นต้นไป'}</td>
      <td>${a.childrenCount||0}</td>
      <td>${money(a.pricePerPerson)}</td>
      <td>${money(activitySubtotal(a))}</td>
    </tr>`).join('')}
    <tr class="total-row"><td colspan="6">รวมค่าใช้จ่ายทั้งหมด (คิดจากเด็ก ${billable} คน)</td><td>${money(grand)} บาท</td></tr>
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
function policyNoteHtml(text, T){
  const b = T.policyNoteBold;
  if(!b || !text.includes(b)) return escapeHtml(text);
  const [before, after] = text.split(b);
  return `${escapeHtml(before)}<b>${escapeHtml(b)}</b>${escapeHtml(after)}`;
}
function buildDocA_Html(v, lang='th'){
  v = localizeVisitForLang(v, lang);
  const T = DOC_LANG[lang], S = T.s;
  const acts = v.activities;
  const roomLine = (id, showTopics)=>{
    const matched = acts.filter(x=>x.room===id);
    const total = matched.reduce((sum,a)=> sum+(Number(a.childrenCount)||0), 0);
    const topics = [...new Set(matched.map(a=>String(a.topic||'').trim()).filter(Boolean))];
    const topicPart = (showTopics && topics.length) ? ` (${topics.map(escapeHtml).join(', ')})` : '';
    return `<div class="doc-checkbox-line">☐ ${S.roomSets(T.room(id), topicPart, total)}</div>`;
  };
  return `
  <div class="doc-page">
    <div class="doc-title">${S.titleA}</div>
    <div class="doc-title sub">${`${S.at} ${escapeHtml(T.venueName)}`.trim()}</div>
    <hr class="doc-rule">
    <div class="doc-line"><b>${S.school} ${escapeHtml(v.school)}</b></div>
    <div class="doc-line"><b>${S.visitDate(T.date(v.date), escapeHtml(T.venueName))}</b></div>
    ${roomLine('innovation')}
    ${roomLine('inspirelab')}
    ${roomLine('other', true)}
    <div class="doc-section-title">${S.details}</div>
    ${roomTopicLines(acts).map(r=>`<div class="doc-line">${S.roomTopic(T.room(r.room), r.topics.map(escapeHtml).join(', '))}</div>`).join('') || '<div class="doc-line">-</div>'}
    <div class="doc-section-title">${S.contact}</div>
    <div class="doc-line doc-fill-line"><span>${S.fullName}</span><span class="fill-dots"></span></div>
    <div class="doc-line doc-fill-line"><span>${S.phone}</span><span class="fill-dots"></span></div>
    <div class="doc-notes-title">${S.notes}</div>
    <ul class="doc-notes-list">
      <li>${policyNoteHtml(T.policyNotes[0], T)}</li>
    </ul>
    <div class="doc-price-lines">
      ${T.priceGroups.map(g=> g.lines
        ? `<div class="doc-price-group-title">${escapeHtml(g.title)}</div>
      ${g.lines.map(p=>`<div class="doc-line doc-price-line">- <span class="doc-highlight">${escapeHtml(p.label)} :</span> ${S.priceLine(p.price, p.normalPrice)}</div>`).join('')}`
        : `<div class="doc-price-main"><u>${escapeHtml(g.title)}</u> : ${S.priceLine(g.price, g.normalPrice)}</div>`
      ).join('')}
    </div>
    <ul class="doc-notes-list">
      ${T.policyNotes.slice(1).map((n,i)=>`<li${i+1===T.policyNoteFit?' class="doc-fit-line"':''}>${escapeHtml(n)}</li>`).join('')}
    </ul>
    <div class="doc-payment-note">${escapeHtml(T.paymentNote)}</div>
    <div class="doc-sign">
      <div class="line-fill">${S.sign} ........................................</div>
      <div class="line-fill">(........................................)</div>
      <div class="line-fill">${S.position} ........................................</div>
    </div>
    <div class="doc-footer">
      ${S.footer1(escapeHtml(DOC_CONFIG.facebookPage), escapeHtml(DOC_CONFIG.contactEmail))}<br>
      ${S.footer2(escapeHtml(DOC_CONFIG.contactPhone))}
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
function docSlotLabel(slot, T){
  return T.time(slot.startTime)+(slot.endTime?(' – '+T.time(slot.endTime)):' '+T.onwards);
}
function buildDocB_Html(v, lang='th'){
  v = localizeVisitForLang(v, lang);
  const T = DOC_LANG[lang], S = T.s;
  const billable = billableCount(v);
  const acts = visitActivitiesSorted(v);
  const grand = visitGrandTotal(v);
  const gradesLabel = T.grades(compactGradeSummary(acts));
  const introText = S.intro(T.dateWithDay(v.date), escapeHtml(gradesLabel), billable);
  const slots = buildTimeSlots(acts);
  return `
  <div class="doc-page">
    <div class="doc-title small">${S.titleB(escapeHtml(T.venueName))}</div>
    <div class="doc-title sub small">${escapeHtml(v.school)}</div>
    <hr class="doc-rule">
    <table class="doc-table">
      <tr>
        <th style="width:22%;">${S.studentsCol}</th>
        ${slots.map(s=>`<th>${docSlotLabel(s, T)}</th>`).join('')}
      </tr>
      ${groupActivitiesByGroup(acts).map((g,i)=>{
        const label = g[0].gradeLevel ? escapeHtml(g[0].gradeLevel) : S.group(i+1);
        return `<tr>
        <td><b><u>${label}</u></b><br>${S.people(g[0].childrenCount||0)}</td>
        ${docRowCells(g, slots).map(c=> c.activity ? `<td${c.span>1?` colspan="${c.span}"`:''}><div class="room">${T.room(c.activity.room)}</div>${c.activity.topic?`<div class="topic">${escapeHtml(c.activity.topic)}</div>`:''}${c.activity.location?`<div class="location">${escapeHtml(c.activity.location)}</div>`:''}</td>` : '<td></td>').join('')}
      </tr>`;
      }).join('')}
    </table>
    <div class="doc-section-title">${S.detailsB}</div>
    <div class="doc-line">${introText}</div>
    <div class="doc-section-title">${S.costTitle}</div>
    <ul class="doc-notes-list">
      ${roomCostSummary(acts).map(r=>{ const topicPart = (r.room==='other' && r.topics.length) ? ` (${r.topics.map(escapeHtml).join(', ')})` : ''; return `<li>${S.costLine(T.room(r.room), topicPart, r.children, money(r.cost))}</li>`; }).join('')}
    </ul>
    <div class="doc-line doc-cost-blue">${S.total(money(grand), v.packageLabel ? escapeHtml(v.packageLabel) : '')}</div>
    <div class="doc-payment-note" style="margin-left:0;">${escapeHtml(T.paymentNote)}</div>
  </div>`;
}

/* ---------------- Preview modal (แทนการ window.print() ตรงๆ) ----------------
   เปิดเป็น popup/modal ในหน้าเดิม (ไม่เปิดแท็บใหม่) โดยใช้ iframe แสดงตัวอย่างให้ซูมดูได้
   เหมือนกันทุกเบราว์เซอร์ (Chrome/Edge/Safari) — เนื้อหา .doc-page และ style.css ที่ใช้
   พิมพ์จริงไม่มีการแก้ไขใดๆ ยังคงเหมือนเดิมทุกประการ
   ส่วนปุ่ม "พิมพ์ / บันทึก PDF" ไม่ได้สั่งพิมพ์จาก iframe ตรงๆ (เบราว์เซอร์บางตัวเรนเดอร์
   หน้าว่างเปล่าเมื่อพิมพ์จาก iframe) แต่ใช้กลไก #printArea + window.print() เดิมของหน้าเว็บ
   ซึ่งพิสูจน์แล้วว่าใช้งานได้จริง — ผลลัพธ์ที่พิมพ์/บันทึกเป็น PDF จึงเหมือนกับ iframe ที่เห็นทุกจุด */
let docPreviewZoom = 1;
let docPreviewPagesHtml = [];
function setDocPreviewZoom(z){
  docPreviewZoom = Math.min(2, Math.max(0.4, Math.round(z*100)/100));
  const frame = document.getElementById('docPreviewFrame');
  const stack = frame.contentDocument && frame.contentDocument.getElementById('pvStack');
  if(stack) stack.style.transform = 'scale('+docPreviewZoom+')';
  document.getElementById('docPreviewZoomLabel').textContent = Math.round(docPreviewZoom*100)+'%';
}
document.getElementById('docPreviewZoomIn').addEventListener('click', ()=> setDocPreviewZoom(docPreviewZoom+0.1));
document.getElementById('docPreviewZoomOut').addEventListener('click', ()=> setDocPreviewZoom(docPreviewZoom-0.1));
document.getElementById('docPreviewZoomReset').addEventListener('click', ()=> setDocPreviewZoom(1));
document.getElementById('docPreviewPrintBtn').addEventListener('click', ()=>{
  document.getElementById('printArea').innerHTML = docPreviewPagesHtml.join('');
  window.print();
});

function openDocPreviewModal(pagesHtml, title){
  docPreviewPagesHtml = pagesHtml;
  const frame = document.getElementById('docPreviewFrame');
  const cssHref = new URL('style.css', location.href).href;
  const sheets = pagesHtml.map(html => `<div class="pvPage">${html}</div>`).join('');
  frame.srcdoc = `<!DOCTYPE html>
<html lang="th"><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${cssHref}">
<style>
  html,body{margin:0;background:#787878;}
  #pvStack{padding:24px 0 60px;display:flex;flex-direction:column;align-items:center;gap:24px;transform-origin:top center;}
  .pvPage{width:210mm;min-height:297mm;background:#fff;box-shadow:0 2px 16px rgba(0,0,0,.3);padding:25mm 20mm 15mm 25mm;box-sizing:border-box;}
  @media print{
    html,body{background:#fff !important;}
    #pvStack{padding:0 !important;gap:0 !important;transform:none !important;}
    .pvPage{width:auto !important;min-height:0 !important;box-shadow:none !important;padding:0 !important;margin:0 !important;}
    .pvPage + .pvPage{page-break-before:always;}
    @page{size:A4;margin:25mm 20mm 15mm 25mm;}
  }
</style>
</head><body><div id="pvStack">${sheets}</div></body></html>`;
  document.getElementById('docPreviewTitle').textContent = title || 'พรีวิวเอกสาร';
  docPreviewZoom = 1;
  document.getElementById('docPreviewZoomLabel').textContent = '100%';
  openOverlay('docPreviewOverlay');
}

function printDocs(which, lang){
  const v = state.visits.find(x=>x.id===state.currentDetailId);
  if(!v) return;
  const pages = [];
  if(which==='A'||which==='all') pages.push(buildDocA_Html(v, lang));
  if(which==='B'||which==='all') pages.push(buildDocB_Html(v, lang));
  openDocPreviewModal(pages, `พรีวิวเอกสาร — ${v.school || ''}`);
}

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
    bullet: opts.bullet ? {level:0} : undefined,
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
    columnSpan: opts.colSpan && opts.colSpan>1 ? opts.colSpan : undefined,
    children: Array.isArray(paras) ? paras : [paras]
  });
}

function buildDocA_DocxChildren(v, lang='th'){
  v = localizeVisitForLang(v, lang);
  const T = DOC_LANG[lang], S = T.s;
  const acts = v.activities;
  const roomLinePara = (id, showTopics)=>{
    const matched = acts.filter(x=>x.room===id);
    const total = matched.reduce((sum,a)=> sum+(Number(a.childrenCount)||0), 0);
    const topics = [...new Set(matched.map(a=>String(a.topic||'').trim()).filter(Boolean))];
    const topicPart = (showTopics && topics.length) ? ` (${topics.join(', ')})` : '';
    return dCheckboxPara(false, S.roomSets(T.room(id), topicPart, total));
  };
  const topicParas = roomTopicLines(acts).map(r=> dPara(S.roomTopic(T.room(r.room), r.topics.join(', ')), {after:30}));
  const priceParas = T.priceGroups.flatMap(g=> g.lines ? [
    dPara(g.title, {indent:360, after:20, underline:true}),
    ...g.lines.map(p=> dParaMulti([
      {text:'- '},
      {text:p.label+' :'},
      {text:' '+S.priceLine(p.price, p.normalPrice)}
    ], {after:20, indent:720}))
  ] : [
    dParaMulti([
      {text:g.title, underline:true},
      {text:' : '+S.priceLine(g.price, g.normalPrice)}
    ], {after:20, indent:360})
  ]);
  const noteParas = T.policyNotes.map((n,i)=>{
    if(i===0 && T.policyNoteBold && n.includes(T.policyNoteBold)){
      const [before, after] = n.split(T.policyNoteBold);
      return dParaMulti([{text:before}, {text:T.policyNoteBold, bold:true}, {text:after}], {after:20, bullet:true});
    }
    return dPara(n, {after:20, bullet:true, size: i===T.policyNoteFit ? 27 : undefined});
  });

  return [
    dPara(S.titleA, {align:'center', bold:true, size:32, after:20}),
    dPara((S.at+' '+T.venueName).trim(), {align:'center', bold:true, size:32, after:60, borderBottom:true}),
    dPara(S.school+'  '+v.school, {bold:true, after:40}),
    dPara(S.visitDate(T.date(v.date), T.venueName), {bold:true, after:30}),
    roomLinePara('innovation'),
    roomLinePara('inspirelab'),
    roomLinePara('other', true),
    dPara(S.details, {bold:true, after:20, before:30}),
    ...(topicParas.length?topicParas:[dPara('-', {after:30})]),
    dPara(S.contact, {bold:true, after:20}),
    dSignLine(S.fullName, {after:20}),
    dSignLine(S.phone, {after:60}),
    dPara(S.notes, {bold:true, after:20}),
    noteParas[0],
    ...priceParas,
    ...noteParas.slice(1),
    dPara(T.paymentNote, {bold:true, color:'B00000', indent:720, after:480}),
    dPara(S.sign+' ........................................', {align:'right', after:6}),
    dPara('(........................................)', {align:'right', after:6}),
    dPara(S.position+' ........................................', {align:'right', after:120})
  ];
}
function docAFooterParas(lang='th'){
  // ปักไว้มุมล่างซ้ายของทุกหน้าด้วย docx footer จริง (ไม่ไหลตามเนื้อหาข้างบน)
  const S = DOC_LANG[lang].s;
  return [
    dPara(S.footer1(DOC_CONFIG.facebookPage, DOC_CONFIG.contactEmail), {size:24, after:20}),
    dPara(S.footer2(DOC_CONFIG.contactPhone), {size:24})
  ];
}
function buildDocA_Docx(v, lang='th'){
  return new docx.Document({ sections:[{ properties: DOCX_PAGE_PROPERTIES, children: buildDocA_DocxChildren(v, lang), footers:{ default: new docx.Footer({ children: docAFooterParas(lang) }) } }] });
}

function buildDocB_DocxChildren(v, opts={}, lang='th'){
  v = localizeVisitForLang(v, lang);
  const T = DOC_LANG[lang], S = T.s;
  const billable = billableCount(v);
  const acts = visitActivitiesSorted(v);
  const grand = visitGrandTotal(v);

  const slots = buildTimeSlots(acts);
  const headerCells = [
    dCell(dPara(S.studentsCol, {align:'center', bold:true, size:27, after:0}), {width:22, fill:'BDD7EE'}),
    ...slots.map(s=> dCell(dPara(docSlotLabel(s, T), {align:'center', bold:true, size:27, after:0}), {fill:'BDD7EE'}))
  ];
  const rows = groupActivitiesByGroup(acts).map((g,i)=> new docx.TableRow({children:[
    dCell([
      dPara(g[0].gradeLevel || S.group(i+1), {align:'center', bold:true, underline:true, size:27, after:10}),
      dPara(S.people(g[0].childrenCount||0), {align:'center', size:24, after:0})
    ]),
    ...docRowCells(g, slots).map(c=>{
      const a = c.activity;
      return dCell(a ? [
        dPara(T.room(a.room), {align:'center', bold:true, size:27, after:10}),
        dPara(a.topic||'-', {align:'center', size:24, after: a.location?10:0}),
        ...(a.location ? [dPara(a.location, {align:'center', size:21, after:0})] : [])
      ] : [dPara('', {after:0})], {colSpan: c.span});
    })
  ]}));
  const table = new docx.Table({
    width: {size:100, type:docx.WidthType.PERCENTAGE},
    rows: [ new docx.TableRow({children:headerCells}), ...rows ]
  });

  const introText = S.intro(T.dateWithDay(v.date), T.grades(compactGradeSummary(acts)), billable);
  const costBullets = roomCostSummary(acts).map(r=>{
    const topicPart = (r.room==='other' && r.topics.length) ? ` (${r.topics.join(', ')})` : '';
    return dPara(S.costLine(T.room(r.room), topicPart, r.children, money(r.cost)), {after:20, bullet:true});
  });

  return [
    dPara(S.titleB(T.venueName), {align:'center', bold:true, size:27, after:15, pageBreakBefore: !!opts.pageBreakBefore}),
    dPara(v.school, {align:'center', bold:true, size:27, after:60, borderBottom:true}),
    table,
    dPara('', {after:60}),
    dPara(S.detailsB, {bold:true, after:20}),
    dPara(introText, {after:20}),
    dPara(S.costTitle, {bold:true, after:20, before:20}),
    ...costBullets,
    dPara(S.total(money(grand), v.packageLabel||''), {bold:true, color:'1F4E96', after:40}),
    dPara(T.paymentNote, {bold:true, color:'B00000'})
  ];
}
function buildDocB_Docx(v, lang='th'){
  return new docx.Document({ sections:[{ properties: DOCX_PAGE_PROPERTIES, children: buildDocB_DocxChildren(v, {}, lang) }] });
}
function buildCombined_Docx(v, lang='th'){
  const children = [
    ...buildDocA_DocxChildren(v, lang),
    ...buildDocB_DocxChildren(v, {pageBreakBefore:true}, lang)
  ];
  return new docx.Document({ sections:[{ properties: DOCX_PAGE_PROPERTIES, children, footers:{ default: new docx.Footer({ children: docAFooterParas(lang) }) } }] });
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
function downloadDocs(which, lang){
  const v = state.visits.find(x=>x.id===state.currentDetailId);
  if(!v) return;
  const doc = which==='A' ? buildDocA_Docx(v, lang) : which==='B' ? buildDocB_Docx(v, lang) : buildCombined_Docx(v, lang);
  triggerDocxDownload(doc, `${DOC_LANG[lang].filePrefix[which]}_${v.docNo||v.id}.docx`);
}
// ปุ่ม export ทุกปุ่ม: data-doc = all|A|B, data-act = print|word, data-lang = th|en
document.querySelector('.doc-export-grid').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-doc]');
  if(!btn) return;
  const {doc, act, lang} = btn.dataset;
  if(act==='print') printDocs(doc, lang); else downloadDocs(doc, lang);
});

/* ---------------- Init ---------------- */
(async ()=>{
  showLoading('กำลังโหลดข้อมูล...');
  try{ await Promise.all([loadVisits(), loadRefSchools(), loadRefActivities(), loadRefStaff(), loadRefLocations()]); }
  finally{ hideLoading(); }
})();
if(CONFIG.API_URL){
  setInterval(loadVisits, 20000); // ดึงข้อมูลใหม่ทุก 20 วิ เพื่อให้หลายคนเห็นข้อมูลตรงกัน (เงียบ ไม่ขึ้นป๊อปอัป)
}
