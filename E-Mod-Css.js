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
  `;
  window.EMOD_PRINT_RULES = printRules;

  var css = `
html, body { overflow-x: hidden; }
input[type=number]{ -moz-appearance: textfield; }
input[type=number]::-webkit-outer-spin-button,
input[type=number]::-webkit-inner-spin-button{ -webkit-appearance: none; margin: 0; }
@page { size: A4; margin: 8mm 7mm; }

/* การ์ดแต่ละ section บนจอ (ตอนพิมพ์ถูกรีเซ็ตทิ้งด้านบนแล้ว หน้าตาเอกสารเหมือนเดิมทุกประการ) */
.emod-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px 20px; box-shadow: 0 1px 3px rgba(15,23,42,.06); transition: box-shadow .15s ease; }
.emod-card:focus-within { box-shadow: 0 0 0 3px rgba(37,99,235,.12); border-color: #93c5fd; }
select:focus, input:focus, textarea:focus { outline: none; box-shadow: 0 0 0 3px rgba(37,99,235,.15); border-color: #60a5fa !important; }

/* Numpad กดตัวเลข: ปุ่มใหญ่กดง่ายทั้งเมาส์/นิ้ว */
.numpad-btn {
  padding: 12px 0; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc;
  font-size: 20px; font-weight: 600; color: #1e293b; user-select: none; -webkit-tap-highlight-color: transparent;
}
.numpad-btn:active { background: #dbeafe; border-color: #60a5fa; }
.numpad-action { background: #fef3c7; border-color: #fde68a; color: #92400e; font-size: 16px; }
.numpad-action:active { background: #fde68a; }
.numpad-done { background: #2563eb; border-color: #2563eb; color: #fff; font-size: 16px; }
.numpad-done:active { background: #1d4ed8; }
@media print {
${printRules}
}
`;
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();
