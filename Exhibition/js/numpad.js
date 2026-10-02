// Numpad กดตัวเลขสำหรับช่อง [data-calc] ทุกช่อง — ใช้แทนคีย์บอร์ดเครื่อง ให้กรอกได้แบบเดียวกัน
// ทั้ง Browser (เมาส์คลิก) และมือถือ/แท็บเล็ต (แตะ) โดยไม่พึ่งคีย์บอร์ดเสมือนของแต่ละอุปกรณ์
// (ช่อง data-calc ทุกช่องมี inputmode="none" กันคีย์บอร์ดเดิมของมือถือเด้งซ้อน)
(function () {
  let target = null;
  const bar = document.getElementById("numpadBar");
  if (!bar) return;

  function label(input) {
    const cell = input.closest("td");
    const row = cell && cell.closest("tr");
    const rowLabel = row && row.querySelector(".rowlabel");
    const bento = input.closest(".bento");
    const heading = bento && bento.querySelector(".bento-head .t");
    return (rowLabel && rowLabel.textContent.trim()) || (heading && heading.textContent.trim()) || "กรอกตัวเลข";
  }

  function open(input) {
    target = input;
    document.getElementById("numpadLabel").textContent = label(input);
    bar.classList.add("is-open");
    document.body.classList.add("numpad-open"); // class แทน CSS :has() (Safari หน่วงมาก)
  }
  function close() {
    bar.classList.remove("is-open");
    document.body.classList.remove("numpad-open");
    target = null;
  }

  document.addEventListener("focusin", (e) => {
    if (e.target.matches("input[data-calc]")) open(e.target);
    else if (target && !bar.contains(e.target)) close();
  });

  bar.addEventListener("mousedown", (e) => e.preventDefault()); // กัน input เสีย focus ก่อนปุ่มติด
  bar.addEventListener("click", (e) => {
    const btn = e.target.closest(".numpad-btn");
    if (!btn || !target) return;
    if (btn.dataset.k === "done") { close(); return; }
    const cur = target.value || "";
    if (btn.dataset.k === "back") target.value = cur.slice(0, -1);
    else if (btn.dataset.k === "clear") target.value = "";
    else target.value = (cur === "0" ? "" : cur) + btn.dataset.k;
    target.dispatchEvent(new Event("input", { bubbles: true }));
  });
  document.getElementById("numpadCloseX").addEventListener("click", close);
})();
