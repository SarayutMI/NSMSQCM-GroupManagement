// Numpad กดตัวเลข (แบบเดียวกับ Exhibition) สำหรับช่อง [data-num] ทุกช่อง: คงเหลือ, ขั้นต่ำ, รับ/เบิก, ตรวจนับ
// ช่องเหล่านี้เป็น type="text" + inputmode="none" กันคีย์บอร์ดมือถือเด้งซ้อน (คีย์บอร์ดจริงยังพิมพ์ได้)
const StockNumpad = (() => {
  let target = null;
  const bar = $("numpadBar");

  function label(input) {
    const lbl = input.closest("label");
    if (lbl) return lbl.childNodes[0].textContent.trim();
    const row = input.closest("tr");
    const name = row && row.querySelector("b");
    return name ? "นับได้จริง — " + name.textContent.trim() : "กรอกตัวเลข";
  }
  function open(input) {
    target = input;
    $("numpadLabel").textContent = label(input);
    bar.classList.add("is-open");
    // numpad ขึ้นมาบังครึ่งล่างของจอ: เลื่อนช่องที่กำลังกรอกให้มองเห็น
    setTimeout(() => input.scrollIntoView({ block: "center" }), 220);
  }
  function close() {
    bar.classList.remove("is-open");
    target = null;
  }

  document.addEventListener("focusin", (e) => {
    if (e.target.matches("input[data-num]")) open(e.target);
    else if (target && !bar.contains(e.target)) close();
  });
  bar.addEventListener("mousedown", (e) => e.preventDefault()); // กัน input เสีย focus ก่อนปุ่มติด
  bar.addEventListener("click", (e) => {
    const btn = e.target.closest(".numpad-btn");
    if (!btn || !target) return;
    const k = btn.dataset.k;
    if (k === "done") return close();
    const cur = target.value || "";
    if (k === "back") target.value = cur.slice(0, -1);
    else if (k === "clear") target.value = "";
    else if (k === ".") {
      if (!cur.includes(".")) target.value = (cur || "0") + ".";
    } else target.value = (cur === "0" ? "" : cur) + k;
    target.dispatchEvent(new Event("input", { bubbles: true }));
  });
  $("numpadCloseX").addEventListener("click", close);

  return { close };
})();
