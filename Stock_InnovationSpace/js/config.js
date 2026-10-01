// ระบบสต๊อก Innovation Space — ค่าตั้งต้นทั้งหมดอยู่ที่ไฟล์นี้ไฟล์เดียว (โหลดเป็นไฟล์แรก)

const STOCK_CONFIG = {
  // URL /exec ของ Web App ที่ deploy จาก Code.gs ในโฟลเดอร์นี้
  API_URL: "https://script.google.com/macros/s/AKfycbwE19wq7QUwWvV3GjIe45JeP7ysXf0XFp8ZgsncdFAntx5BY_mxpE6vV8VyXQtHix8H/exec",
  // รูปผังห้อง (วางไฟล์ไว้ในโฟลเดอร์ Stock_InnovationSpace) — png / jpg / svg ก็ได้
  // ตำแหน่งบนผังเก็บเป็น % ของรูป เปลี่ยนรูปใหม่ที่สัดส่วนเดิมได้โดยจุดไม่เพี้ยน
  PLAN_IMAGE: "plan.png",
  // รายชื่อผู้ทำรายการ: ชีตอ้างอิงชุดเดียวกับระบบอื่น (Staff_Name + Volunteer_Name)
  STAFF_CSV_URLS: [
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQHwC49QdSskveBiTSa9BZLxSMEvW6wa_XUEhFQQP5jStHI-EVPGdIjG3Goo_-iNiXKJkmYevzcC2kl/pub?gid=1863604525&single=true&output=csv",
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQHwC49QdSskveBiTSa9BZLxSMEvW6wa_XUEhFQQP5jStHI-EVPGdIjG3Goo_-iNiXKJkmYevzcC2kl/pub?gid=320745201&single=true&output=csv",
  ],
  // หมวดหมู่ตั้งต้นใน dropdown (หมวดที่พิมพ์เพิ่มเองจะต่อท้ายให้อัตโนมัติ)
  CATEGORIES: ["อุปกรณ์อิเล็กทรอนิกส์", "เครื่องมือช่าง", "วัสดุสิ้นเปลือง", "อุปกรณ์กิจกรรม", "เครื่องเขียน", "อื่นๆ"],
};

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
