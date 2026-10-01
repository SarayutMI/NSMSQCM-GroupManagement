// Shared by index.html and dashboard.html. Load first.
// Names of rooms / activities / staff are NOT here: they live in the Google Sheet (see Code.gs).

// Web App URL from Code.gs (Deploy > Manage deployments). Change it here only.
const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbyf7y6hVcFQ2D-U-fuEPF3FvmIJlNj2Hao2JqBr4HZjHSpht5yb8571Jtbxm9NSaa920g/exec";

const TH_DAYS = ["วันอาทิตย์", "วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์"];
const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const TH_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// Fixed by the form design, not by the Sheet.
const ROLES = ["อาสา", "เจ้าหน้าที่"];

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
