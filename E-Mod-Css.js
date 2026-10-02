/* =========================================================
   E-Mod — reset เล็กน้อยที่ Tailwind utility ทำเองไม่ได้สะดวก
   (สไตล์หลักทั้งหมดใช้ Tailwind CDN ในหน้า E-Mod.html)
   ========================================================= */
(function () {
  /* กติกาการจัดหน้าตอนพิมพ์ (ใช้ทั้งใน @media print จริง และใน E-Mod-Script.js
     สำหรับสร้างหน้าต่างพรีวิวที่หน้าตาต้องตรงกับตอนพิมพ์เป๊ะๆ — ห้ามแก้เลเอาต์ในนี้
     โดยไม่แก้ใน E-Mod-Script.js ไปพร้อมกัน เพราะพรีวิวอ้างอิงข้อความชุดนี้ตรงๆ) */
  var printRules = `
  .print-hide { display: none !important; }
  html, body { background: #fff; font-size: 8.5px; }

  /* การ์ดหลัก: เอาเงา/มุมโค้ง/ระยะขอบทิ้ง เอกสารพิมพ์ควรเต็มหน้ากระดาษ */
  .mx-auto.max-w-6xl { max-width: none !important; margin: 0 !important; padding: 0 !important; }
  .rounded-2xl { border-radius: 0 !important; box-shadow: none !important; padding: 0 !important; }
  /* การ์ดแต่ละ section (ใช้เฉพาะจัดกลุ่มตอนกรอกข้อมูลบนจอ) เอกสารพิมพ์ไม่ต้องมี ให้กลับไปแน่นเหมือนเดิม */
  .emod-card { background: none !important; border: none !important; box-shadow: none !important; padding: 0 !important; border-radius: 0 !important; }

  /* บังคับขึ้นหน้าใหม่ก่อนส่วน "บันทึกจำนวนผู้เข้าชม" เท่านั้น รวมทั้งฉบับเป็น 2 หน้าพอดี */
  #sectionCounts { break-before: page; page-break-before: always; }

  /* ลดระยะห่างทุกจุดให้เนื้อหาแน่นพอดีหน้ากระดาษ */
  section { margin-top: 5px !important; }
  h1 { font-size: 13px !important; }
  h2 { font-size: 10.5px !important; margin-bottom: 4px !important; padding-left: 6px !important; border-left-width: 3px !important; }
  h3 { font-size: 9px !important; margin: 4px 0 3px !important; }
  .text-lg, .text-xl { font-size: 12px !important; }
  .text-xs, .text-sm { font-size: 8.5px !important; }

  /* กล่องข้อความคงที่ (เวลาเปิดทำการ / ระเบียบ) */
  .bg-slate-50.rounded-lg, [class*="rounded-lg"].bg-slate-50 { padding: 3px 6px !important; line-height: 1.25 !important; }

  /* ตาราง: ให้พอดีความกว้างหน้ากระดาษเสมอ ไม่ล้นแนวนอน, หัวตารางซ้ำทุกหน้าถ้าตารางถูกตัดข้ามหน้า */
  .overflow-x-auto { overflow: visible !important; }
  table { width: 100% !important; min-width: 0 !important; table-layout: auto; font-size: 8px !important; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  th, td { padding: 1.5px 3px !important; }

  /* input/select ในตารางพิมพ์เป็นข้อความเฉย ๆ ไม่ต้องมีกรอบ */
  input, select {
    border: none !important; background: transparent !important; box-shadow: none !important;
    padding: 0 !important; font-size: 8px !important; color: #000 !important;
  }
  select { -webkit-appearance: none; appearance: none; }

  /* กริดฟิลด์ผู้เข้าชม/ทีม MOD: บีบให้แน่นและไม่ล้นแถว */
  .grid { gap: 2px !important; }
  [class*="rounded-lg"].border { padding: 3px !important; }

  .grand-total, .bg-blue-50 { padding: 3px 6px !important; }

  /* สรุปผู้เข้าชมแยกกลุ่ม: กระดาษมีที่จำกัด (ต้องจบใน A4 2 แผ่น) — ซ่อนแถวที่เป็น 0 และบีบระยะ */
  #visitorSummaryBody tr.sum-zero { display: none !important; }
  #visitorSummaryWrap th, #visitorSummaryWrap td { padding: 0 3px !important; line-height: 1.1 !important; font-size: 7.5px !important; }
  /* ช่องเซ็นชื่อท้ายรายงาน: เส้นเซ็นเตี้ยลง ให้จบในหน้า 2 */
  #sectionSign .h-10 { height: 22px !important; }
  `;
  window.EMOD_PRINT_RULES = printRules;

  var css = `
/* clip (ไม่ใช่ hidden): hidden ทำให้ body เป็นกล่องเลื่อนเอง แถบเครื่องมือ sticky เลยไม่ติดด้านบน */
html, body { overflow-x: hidden; overflow-x: clip; }
input[type=number]{ -moz-appearance: textfield; }
input[type=number]::-webkit-outer-spin-button,
input[type=number]::-webkit-inner-spin-button{ -webkit-appearance: none; margin: 0; }
@page { size: A4; margin: 8mm 7mm; }

/* การ์ดแต่ละ section บนจอ (ตอนพิมพ์ถูกรีเซ็ตทิ้งด้านบนแล้ว หน้าตาเอกสารเหมือนเดิมทุกประการ) */
.emod-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 1rem; padding: 1.125rem 1.25rem; box-shadow: 0 1px 3px rgba(15,23,42,.06); transition: box-shadow .15s ease; }
.emod-card:focus-within { box-shadow: 0 0 0 3px rgba(37,99,235,.12); border-color: #93c5fd; }
select:focus, input:focus, textarea:focus { outline: none; box-shadow: 0 0 0 3px rgba(37,99,235,.15); border-color: #60a5fa !important; }

/* Numpad กดตัวเลข: ปุ่มใหญ่กดง่ายทั้งเมาส์/นิ้ว */
/* ทุกอย่างบนจอใหญ่ขึ้น 40% (แถบเครื่องมือ, เมนูลัด, ตัวรายงาน, numpad) — ตารางกว้างเกินจอให้เลื่อนดูได้
   เฉพาะ @media screen: ตอนพิมพ์/Export และหน้าพรีวิวยังเป็น A4 2 แผ่นตามกติกา print ด้านบนเหมือนเดิม */
@media screen {
  /* ขยายด้วยขนาดตัวอักษรฐาน (Tailwind ใช้หน่วย rem เกือบทั้งหมด) แทน CSS zoom —
     Safari บน iPad คำนวณจุดที่แตะผิดเมื่อใช้ zoom กับ sticky/fixed ทำให้กดไม่ติด */
  html { font-size: 140%; }
}
/* จอแคบ (มือถือ): แถบเครื่องมือขยายแล้วสูงเกินครึ่งจอ จึงไม่ให้ติดค้างด้านบน */
@media screen and (max-width: 640px) {
  .emod-zoom.sticky { position: static; }
}
/* dropdown ใหญ่ขึ้น แตะง่าย — เฉพาะบนจอ (เอกสารพิมพ์ไม่เปลี่ยน) */
@media screen {
  select { min-height: 2.125rem; cursor: pointer; }
  .tap-select { cursor: pointer; }
}
@media screen and (pointer: coarse) {
  /* นิ้ว: ช่องสูงขึ้น + ตัวหนังสืออย่างน้อย 16px กัน iPhone/iPad ซูมเข้าเองตอนแตะ */
  select, input[type=text], input[type=number], input:not([type]), textarea { font-size: max(16px, 0.875rem) !important; }
  select { min-height: 2.625rem; }
}
.numpad-btn {
  padding: 0.75rem 0; border-radius: 0.625rem; border: 1px solid #e2e8f0; background: #f8fafc;
  font-size: 1.25rem; font-weight: 600; color: #1e293b; user-select: none; -webkit-tap-highlight-color: transparent;
}
.numpad-btn:active { background: #dbeafe; border-color: #60a5fa; }
.numpad-action { background: #fef3c7; border-color: #fde68a; color: #92400e; font-size: 1rem; }
.numpad-action:active { background: #fde68a; }
.numpad-done { background: #2563eb; border-color: #2563eb; color: #fff; font-size: 1rem; }
.numpad-done:active { background: #1d4ed8; }
/* ปุ่มเมนู ☰ มุมขวาล่าง (nav-drawer.js) บังปุ่ม ✓ เสร็จ: ซ่อนไว้ระหว่างที่ numpad เปิด */
body.numpad-open .nsmnav-btn { display: none !important; }

/* ปุ่ม +/- ข้างช่องตัวเลขทุกช่อง (E-Mod-Script.js: addSteppers) — ตอนพิมพ์ซ่อนด้วย .print-hide */
.cnt-step { display: flex; align-items: stretch; gap: 2px; min-width: 0; }
.cnt-step > input { flex: 1 1 auto; min-width: 0; }
.cnt-step-btns { display: flex; flex-direction: column; gap: 2px; flex: none; }
.cnt-step-btns button {
  width: 1.5rem; flex: 1 1 0; min-height: 0.8rem; padding: 0; border: 1px solid #cbd5e1; border-radius: 0.25rem;
  background: #f8fafc; color: #475569; font-size: 0.75rem; font-weight: 700; line-height: 1; cursor: pointer;
  user-select: none; -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.cnt-step-btns button:hover { border-color: #60a5fa; color: #2563eb; }
.cnt-step-btns button:active { background: #dbeafe; }
.cnt-step input[readonly] + .cnt-step-btns { visibility: hidden; }
@media print {
${printRules}
}
`;
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();
