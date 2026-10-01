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
      <div><span class="live-dot"></span> <b>${esc(focusItem.name)}</b> ${statusPill(itemStatus(focusItem))} คงเหลือรวม ${fmtQty(focusItem.qty)} ${esc(focusItem.unit)}</div>
      <div>${pileText(focusItem)}</div>
      <div class="sub">${loc ? `อยู่ที่ <b>${esc(loc.name)}</b>${loc.zone ? " · " + esc(loc.zone) : ""}${focusItem.locationNote ? " · " + esc(focusItem.locationNote) : ""}${isPlaced(loc) ? "" : " — ⚠ ตำแหน่งนี้ยังไม่ได้วางบนผัง"}` : "⚠ ยังไม่ได้ระบุตำแหน่งจัดเก็บ (กดแก้ไขเพื่อเลือกตำแหน่ง)"}</div>
      <div class="focus-actions">${manageButtons(focusItem.id)}<button class="btn btn-small" data-unfocus>ปิด</button></div></div>`;
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
      ${items.length ? `<ul class="loc-items">${items.map((it) => `<li class="${ui.focusItemId === it.id ? "picked" : ""}"><button class="link" data-focus="${esc(it.id)}">${esc(it.name)}</button> ${statusPill(itemStatus(it))}<span class="num">${fmtQty(it.qty)} ${esc(it.unit)}<span class="sub"> (S ${fmtQty(piles(it).stock)} / SB ${fmtQty(piles(it).standby)})</span></span></li>`).join("")}</ul>` : '<div class="empty">ยังไม่มีของในตำแหน่งนี้</div>'}`;
  }

  // พาไปดูจุด live ถ้ามองไม่เห็น
  const live = document.querySelector(".marker.live");
  if (live)
    setTimeout(() => {
      // จอเล็ก: ซูมเข้าไปที่จุดให้เห็นชัด แล้วเลื่อนหน้าให้ผังอยู่ในจอ
      zoomToMarker(live, window.innerWidth < 700 ? 2 : 1);
      $("planViewport").scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 60);
}

/** คลิกบนผังตอนอยู่ในโหมดวางจุด -> % ของรูป */
/** คลิกบนผัง: โหมดวางจุด = ย้ายจุดของตำแหน่งนั้น, คลิกที่ว่าง = เพิ่มตำแหน่งใหม่ตรงจุดที่คลิก */
function onPlanClick(e) {
  if (Date.now() - pinchEndedAt < 500) return;
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

// ---------- ซูมผัง ----------
// ปุ่ม − / + / ⤢, Ctrl+ล้อเมาส์ หรือ pinch บน trackpad, และสองนิ้วบนมือถือ/แท็บเล็ต
// ซูมโดยขยายความกว้างของ .plan แล้วเลื่อนดูในกรอบ — จุดวางเป็น % จึงอยู่ที่เดิมบนรูปเสมอ
const ZOOM_MIN = 1;
const ZOOM_MAX = 5;
let planZoom = 1;
let pinchEndedAt = 0;

/** ซูมไปที่ z โดยให้จุด (cx, cy) ในกรอบ (px) อยู่ที่เดิม; ไม่ระบุ = กลางกรอบ */
function setPlanZoom(z, cx, cy) {
  const vp = $("planViewport");
  z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));
  if (cx == null) {
    cx = vp.clientWidth / 2;
    cy = vp.clientHeight / 2;
  }
  const rx = (vp.scrollLeft + cx) / vp.scrollWidth;
  const ry = (vp.scrollTop + cy) / vp.scrollHeight;
  planZoom = z;
  $("plan").style.width = z * 100 + "%";
  vp.scrollLeft = rx * vp.scrollWidth - cx;
  vp.scrollTop = ry * vp.scrollHeight - cy;
  $("planZoomLvl").textContent = Math.round(z * 100) + "%";
  document.querySelector('#planZoom [data-zoom="out"]').disabled = z <= ZOOM_MIN;
  document.querySelector('#planZoom [data-zoom="in"]').disabled = z >= ZOOM_MAX;
}

/** ซูมเข้าไปที่จุดตำแหน่ง (ใช้ตอนชี้ Live point บนจอเล็ก) */
function zoomToMarker(el, z) {
  const vp = $("planViewport");
  if (planZoom < z) setPlanZoom(z);
  const m = el.getBoundingClientRect(), v = vp.getBoundingClientRect();
  vp.scrollLeft += m.left + m.width / 2 - (v.left + v.width / 2);
  vp.scrollTop += m.top + m.height / 2 - (v.top + v.height / 2);
}

function bindPlanZoom() {
  const vp = $("planViewport");
  $("planZoom").addEventListener("click", (e) => {
    const b = e.target.closest("[data-zoom]");
    if (!b) return;
    if (b.dataset.zoom === "in") setPlanZoom(planZoom * 1.5);
    else if (b.dataset.zoom === "out") setPlanZoom(planZoom / 1.5);
    else setPlanZoom(1);
  });

  vp.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return; // ล้อธรรมดา = เลื่อนดู
      e.preventDefault();
      const r = vp.getBoundingClientRect();
      setPlanZoom(planZoom * Math.exp(-e.deltaY * 0.002), e.clientX - r.left, e.clientY - r.top);
    },
    { passive: false },
  );

  let start = null;
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  vp.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 2) start = { d: dist(e.touches), z: planZoom };
    },
    { passive: true },
  );
  vp.addEventListener(
    "touchmove",
    (e) => {
      if (!start || e.touches.length !== 2) return;
      e.preventDefault();
      const r = vp.getBoundingClientRect();
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
      setPlanZoom((start.z * dist(e.touches)) / start.d, cx, cy);
    },
    { passive: false },
  );
  vp.addEventListener("touchend", (e) => {
    if (start && e.touches.length < 2) {
      start = null;
      pinchEndedAt = Date.now(); // กันนิ้วที่ยกทีหลังกลายเป็น "คลิกเพิ่มตำแหน่ง"
    }
  });
  setPlanZoom(1);
}
