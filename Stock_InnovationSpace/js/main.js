// จุดเริ่มต้นของหน้า: ผูกปุ่ม/ช่องค้นหา แล้วโหลดข้อมูล
// ลำดับโหลด: config.js, api.js, app.js, views.js, plan.js, main.js

function bindEvents() {
  $("viewTabs").addEventListener("click", (e) => {
    const t = e.target.closest("[data-view]");
    if (t) showView(t.dataset.view);
  });
  $("refreshBtn").addEventListener("click", () => reload());
  $("userSelect").addEventListener("change", () => {
    try {
      localStorage.setItem(USER_KEY, currentUser());
    } catch (e) {
      /* storage blocked: เลือกใหม่ทุกครั้งที่เปิดหน้า */
    }
  });

  // ปุ่มที่อยู่ในตาราง/การ์ด (วาดใหม่ทุกครั้ง) ใช้ตัวจับเหตุการณ์ตัวเดียว
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-goto], [data-focus], [data-adjust], [data-move], [data-pile-move], [data-relocate], [data-edit], [data-del], [data-loc], [data-place], [data-edit-loc], [data-del-loc], [data-add-here], [data-unfocus], [data-cancel-place], [data-close]");
    if (!el) return;
    const d = el.dataset;
    if ("close" in d) return closeModal();
    if ("goto" in d) {
      if (d.goto === "items") {
        $("fText").value = "";
        $("fStatus").value = d.status || "";
      }
      return showView(d.goto);
    }
    if ("focus" in d) return focusItem(d.focus);
    if ("adjust" in d) return quickAdjust(d.adjust, Number(d.delta));
    if ("move" in d) return openAdjustForm(d.move);
    if ("pileMove" in d) return openMoveForm(d.pileMove);
    if ("relocate" in d) return openRelocateForm(d.relocate);
    if ("edit" in d) return openItemForm(d.edit);
    if ("del" in d) return deleteItem(d.del);
    if ("place" in d) {
      ui.placingLocId = d.place;
      ui.focusItemId = null;
      renderPlan();
      $("plan").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if ("editLoc" in d) return openLocationForm(d.editLoc);
    if ("delLoc" in d) return deleteLocation(d.delLoc);
    if ("addHere" in d) return openItemForm(null);
    if ("unfocus" in d) {
      ui.focusItemId = null;
      return renderPlan();
    }
    if ("cancelPlace" in d) {
      ui.placingLocId = null;
      return renderPlan();
    }
    if ("loc" in d) {
      if (ui.placingLocId) return; // อยู่ในโหมดวางจุด: ให้ผังจัดการคลิกนี้
      ui.selectedLocId = ui.selectedLocId === d.loc ? null : d.loc;
      ui.focusItemId = null;
      return renderPlan();
    }
  });

  $("plan").addEventListener("click", onPlanClick);
  bindPlanZoom();
  $("addItemBtn").addEventListener("click", () => openItemForm(null));
  $("addLocBtn").addEventListener("click", () => openLocationForm(null));

  // modal
  // หมวดหมู่: เลือก "เพิ่มหมวดใหม่" แล้วแสดงช่องพิมพ์ชื่อ
  $("modalForm").addEventListener("change", (e) => {
    if (e.target.id !== "fCategorySel") return;
    const isNew = e.target.value === NEW_CATEGORY;
    $("fCategoryNewBox").hidden = !isNew;
    if (isNew) $("fCategoryNew").focus();
  });
  // ฟอร์มรายการ: แสดงยอดรวม Stock + Standby ทันทีที่กรอก
  $("modalForm").addEventListener("input", (e) => {
    if (!["stockQty", "standbyQty"].includes(e.target.name) || !$("fQtySum")) return;
    const f = $("modalBody");
    const sum = (Number(f.querySelector("[name=stockQty]").value) || 0) + (Number(f.querySelector("[name=standbyQty]").value) || 0);
    $("fQtySum").textContent = fmtQty(sum);
  });
  $("modalForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (modalSubmit) modalSubmit(formValues());
  });
  $("modal").addEventListener("click", (e) => {
    if (e.target === $("modal")) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!$("modal").hidden) closeModal();
    else if (ui.placingLocId) {
      ui.placingLocId = null;
      renderPlan();
    }
    hideSearch();
  });

  // ตัวกรองของแต่ละแท็บ
  ["fText", "fCategory", "fLocation", "fStatus"].forEach((id) => $(id).addEventListener("input", renderItems));
  ["cLocation", "cText"].forEach((id) => $(id).addEventListener("input", renderCount));
  ["lText", "lAction"].forEach((id) => $(id).addEventListener("input", renderLog));

  // ตรวจนับ: เก็บค่าที่กรอกไว้ แสดงส่วนต่างทันที
  $("countTable").addEventListener("input", (e) => {
    const id = e.target.dataset.count;
    if (!id) return;
    countDraft[id] = Object.assign(countDraft[id] || {}, { [e.target.dataset.pile]: e.target.value });
    const cell = document.querySelector(`[data-diff="${CSS.escape(id)}"]`);
    if (cell) cell.innerHTML = diffText(itemById(id), countDraft[id]);
    updateCountButton();
  });
  $("countFillBtn").addEventListener("click", () => {
    document.querySelectorAll("#countTable [data-count]").forEach((el) => {
      if (el.value !== "") return;
      const d = (countDraft[el.dataset.count] = countDraft[el.dataset.count] || {});
      d[el.dataset.pile] = String(piles(itemById(el.dataset.count))[el.dataset.pile]);
    });
    renderCount();
  });
  $("countClearBtn").addEventListener("click", () => {
    Object.keys(countDraft).forEach((k) => delete countDraft[k]);
    renderCount();
  });
  $("countSaveBtn").addEventListener("click", saveCount);

  // บาร์โค้ด: กล้อง หรือเครื่องยิง (เครื่องยิงพิมพ์เลขแล้วกด Enter ให้เอง)
  $("scanSearchBtn").addEventListener("click", () => Scanner.open(openByBarcode, "สแกนเพื่อค้นหา"));
  $("countScanBtn").addEventListener("click", () => Scanner.open(countByBarcode, "สแกนเพื่อนับ"));
  $("cText").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && itemByBarcode($("cText").value)) {
      e.preventDefault();
      countByBarcode($("cText").value);
    }
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-scan-into]");
    if (!b) return;
    Scanner.open((code) => {
      const input = $(b.dataset.scanInto);
      input.value = code;
      const other = itemByBarcode(code);
      if (other) setStatus(`บาร์โค้ดนี้ใช้กับ "${other.name}" อยู่แล้ว`, "warn");
    }, "สแกนบาร์โค้ดของสิ่งของ");
  });

  bindSearch();
}

// ---------- ช่องค้นหาด้านบน: พิมพ์แล้วเลือกเพื่อชี้ตำแหน่งบนผัง ----------
function hideSearch() {
  $("searchResults").hidden = true;
}
function bindSearch() {
  const box = $("globalSearch");
  const show = () => {
    const q = box.value.trim();
    if (!q) return hideSearch();
    const hits = ITEMS.filter((it) => matchText(it, q)).slice(0, 12);
    const locHits = LOCATIONS.filter((l) => [l.name, l.zone, l.note].join(" ").toLowerCase().includes(q.toLowerCase())).slice(0, 5);
    $("searchResults").innerHTML =
      hits.map((it) => `<button class="hit" data-focus="${esc(it.id)}">${it.code ? `<span class="code item-code">${esc(it.code)}</span> ` : ""}<b>${esc(it.name)}</b> ${statusPill(itemStatus(it))}<span class="sub">📍 ${esc(locName(it.locationId) || "ไม่ระบุตำแหน่ง")} · คงเหลือ ${fmtQty(it.qty)} ${esc(it.unit)}</span></button>`).join("") +
      locHits.map((l) => `<button class="hit" data-loc-hit="${esc(l.id)}"><b>📍 ${esc(l.name)}</b><span class="sub">ตำแหน่งจัดเก็บ${l.zone ? " · " + esc(l.zone) : ""}</span></button>`).join("") ||
      '<div class="empty">ไม่พบ</div>';
    $("searchResults").hidden = false;
  };
  box.addEventListener("input", show);
  box.addEventListener("focus", show);
  box.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    if (itemByBarcode(box.value)) {
      // ยิงบาร์โค้ดใส่ช่องค้นหา -> ไปที่ของชิ้นนั้นทันที
      openByBarcode(box.value);
      box.value = "";
      hideSearch();
      return;
    }
    const first = $("searchResults").querySelector(".hit");
    if (first) first.click();
  });
  $("searchResults").addEventListener("click", (e) => {
    const loc = e.target.closest("[data-loc-hit]");
    if (loc) {
      ui.selectedLocId = loc.dataset.locHit;
      ui.focusItemId = null;
      showView("plan");
    }
    if (e.target.closest(".hit")) {
      hideSearch();
      box.blur();
    }
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-box")) hideSearch();
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  initPlanImage();
  render();
  fillUsers([]);
  fetchNames(STOCK_CONFIG.STAFF_CSV_URLS).then(fillUsers);
  await reload();
});
