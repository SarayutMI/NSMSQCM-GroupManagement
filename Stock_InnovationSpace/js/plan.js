// ผังห้อง + ตำแหน่งจัดเก็บ + Live point (จุดกระพริบชี้ตำแหน่งของที่ค้นหา)
// ตำแหน่งบนผังเก็บเป็น % ของรูป (x จากซ้าย, y จากบน) จึงใช้ได้กับรูปทุกขนาด

let planState = "loading"; // loading | ok | missing

function initPlanImage() {
  const img = $("planImg");
  img.hidden = true; // ซ่อนไว้จนโหลดสำเร็จ (ไม่ให้ข้อความ alt โผล่ตอนยังไม่มีไฟล์)
  img.onload = () => {
    planState = "ok";
    img.hidden = false;
    $("plan").classList.remove("no-image");
    $("planEmpty").hidden = true;
  };
  img.onerror = () => {
    planState = "missing";
    img.removeAttribute("src");
    $("plan").classList.add("no-image");
    $("planEmpty").hidden = false;
  };
  img.src = STOCK_CONFIG.PLAN_IMAGE + "?v=" + Date.now().toString(36).slice(0, -4); // เปลี่ยนรูปแล้วเห็นภายใน ~30 นาที ไม่ติด cache นาน
}

const isPlaced = (l) => l && l.x !== "" && l.x != null && l.y !== "" && l.y != null;

function renderPlan() {
  const focusItem = itemById(ui.focusItemId);
  const focusLocId = focusItem ? focusItem.locationId : ui.selectedLocId;

  // ---- markers ----
  $("planMarkers").innerHTML = LOCATIONS.filter(isPlaced)
    .map((l) => {
      const items = ITEMS.filter((i) => i.locationId === l.id);
      const need = items.filter(needsRefill).length;
      const cls = ["marker", need ? "has-need" : "", l.id === ui.selectedLocId ? "selected" : "", l.id === focusLocId && focusItem ? "live" : ""].join(" ");
      return `<button class="${cls}" style="left:${Number(l.x)}%;top:${Number(l.y)}%" data-loc="${esc(l.id)}" title="${esc(l.name)} · ${items.length} รายการ${need ? ` · ต้องเติม ${need}` : ""}">
        <span class="dot"></span><span class="tag">${esc(l.name)}${items.length ? ` <b>${items.length}</b>` : ""}</span></button>`;
    })
    .join("");

  $("planHint").textContent = LOCATIONS.length
    ? "คลิกจุดเพื่อดูของในตำแหน่งนั้น · คลิกที่ว่างบนผังเพื่อเพิ่มตำแหน่งใหม่"
    : "👉 คลิกบนผังตรงที่เก็บของ (เช่น ชั้นวาง ตู้) เพื่อเพิ่มตำแหน่งแรก";

  // ---- placing mode banner ----
  const placing = locById(ui.placingLocId);
  $("placeBanner").hidden = !placing;
  $("plan").classList.toggle("placing", !!placing);
  if (placing) $("placeBanner").innerHTML = `📌 คลิกบนผังเพื่อวาง <b>${esc(placing.name)}</b> <button class="btn btn-small" data-cancel-place>ยกเลิก</button>`;

  // ---- live point card ----
  if (focusItem) {
    const loc = locById(focusItem.locationId);
    $("focusCard").innerHTML = `<div class="focus">
      <div><span class="live-dot"></span> <b>${esc(focusItem.name)}</b> ${statusPill(itemStatus(focusItem))} คงเหลือ ${fmtQty(focusItem.qty)} ${esc(focusItem.unit)}</div>
      <div class="sub">${loc ? `อยู่ที่ <b>${esc(loc.name)}</b>${loc.zone ? " · " + esc(loc.zone) : ""}${focusItem.locationNote ? " · " + esc(focusItem.locationNote) : ""}${isPlaced(loc) ? "" : " — ⚠ ตำแหน่งนี้ยังไม่ได้วางบนผัง"}` : "⚠ ยังไม่ได้ระบุตำแหน่งจัดเก็บ (กดแก้ไขเพื่อเลือกตำแหน่ง)"}</div>
      <div class="focus-actions"><button class="btn btn-small" data-edit="${esc(focusItem.id)}">แก้ไข</button><button class="btn btn-small" data-unfocus>ปิด</button></div></div>`;
  } else $("focusCard").innerHTML = "";

  // ---- locations table ----
  $("locCount").textContent = `(${LOCATIONS.length})`;
  $("locTable").innerHTML = LOCATIONS.length
    ? `<table><thead><tr><th>ตำแหน่ง</th><th>ของ</th><th></th></tr></thead><tbody>${LOCATIONS.map((l) => {
        const items = ITEMS.filter((i) => i.locationId === l.id);
        const need = items.filter(needsRefill).length;
        return `<tr class="clickable ${l.id === ui.selectedLocId ? "picked" : ""}" data-loc="${esc(l.id)}">
          <td><b>${esc(l.name)}</b><div class="sub">${esc(l.zone || "")}${isPlaced(l) ? "" : " · ยังไม่วางบนผัง"}</div></td>
          <td class="num">${items.length}${need ? ` <span class="t-out">(${need})</span>` : ""}</td>
          <td class="actions"><button class="btn btn-small" data-place="${esc(l.id)}" title="วาง/ย้ายจุดบนผัง">📌</button>
            <button class="btn btn-small" data-edit-loc="${esc(l.id)}">แก้ไข</button>
            <button class="btn btn-small btn-danger" data-del-loc="${esc(l.id)}">ลบ</button></td></tr>`;
      }).join("")}</tbody></table>`
    : '<div class="empty">ยังไม่มีตำแหน่งจัดเก็บ — กด ＋ เพิ่มตำแหน่ง แล้วกด 📌 เพื่อวางบนผัง</div>';

  // ---- selected location detail ----
  const sel = locById(ui.selectedLocId);
  $("locDetail").hidden = !sel;
  if (sel) {
    const items = ITEMS.filter((i) => i.locationId === sel.id);
    $("locDetail").innerHTML = `<div class="card-head"><span class="t">📍 ${esc(sel.name)} <span class="n">${items.length} รายการ</span></span>
        <button class="btn btn-primary btn-small" data-add-here>＋ เพิ่มของที่นี่</button></div>
      ${sel.note ? `<p class="sub">${esc(sel.note)}</p>` : ""}
      ${items.length ? `<ul class="loc-items">${items.map((it) => `<li class="${ui.focusItemId === it.id ? "picked" : ""}"><button class="link" data-focus="${esc(it.id)}">${esc(it.name)}</button> ${statusPill(itemStatus(it))}<span class="num">${fmtQty(it.qty)} ${esc(it.unit)}</span></li>`).join("")}</ul>` : '<div class="empty">ยังไม่มีของในตำแหน่งนี้</div>'}`;
  }

  // พาไปดูจุด live ถ้ามองไม่เห็น
  const live = document.querySelector(".marker.live");
  if (live) setTimeout(() => live.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }), 60);
}

/** คลิกบนผังตอนอยู่ในโหมดวางจุด -> % ของรูป */
/** คลิกบนผัง: โหมดวางจุด = ย้ายจุดของตำแหน่งนั้น, คลิกที่ว่าง = เพิ่มตำแหน่งใหม่ตรงจุดที่คลิก */
function onPlanClick(e) {
  const rect = $("plan").getBoundingClientRect();
  const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
  const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
  if (x < 0 || y < 0 || x > 100 || y > 100) return;
  if (!ui.placingLocId) {
    if (e.target.closest(".marker")) return; // คลิกจุดเดิม = ดูของในตำแหน่งนั้น (จัดการใน main.js)
    const ghost = $("planGhost");
    ghost.style.left = x + "%";
    ghost.style.top = y + "%";
    ghost.hidden = false;
    openLocationForm(null, { x: x, y: y });
    return;
  }
  const id = ui.placingLocId;
  ui.placingLocId = null;
  ui.selectedLocId = id;
  savePlacement(id, x, y);
}
