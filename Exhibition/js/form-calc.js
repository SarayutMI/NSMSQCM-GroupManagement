// All totals of the form. Recomputed from scratch on every edit (cheap, and keeps the
// rules in one place). Needs form-render.js for WALKIN_ROWS, GROUP_ROWS, COUNT_COLS, formRooms.

// กิจกรรมอื่นๆ: EXTERNAL_ACTIVITIES อยู่ใน form-render.js

function num(id) {
  const el = $(id);
  return el ? parseInt(el.value) || 0 : 0;
}

function put(id, value) {
  $(id).value = value;
}

function sumRows(prefix, count) {
  let total = 0;
  for (let i = 1; i <= count; i++) total += num(prefix + i);
  return total;
}

function recalcAll() {
  // Walk-in: per column, then child / adult / all
  const walkin = {};
  COUNT_COLS.forEach((c) => {
    walkin[c] = sumRows(`walkin_${c}_`, WALKIN_ROWS);
    put(`walkin_${c}_total`, walkin[c]);
  });
  const walkinChild = walkin.child_th + walkin.child_intl;
  const walkinAdult = walkin.adult_th + walkin.adult_intl;
  put("walkin_child_grand_total", walkinChild);
  put("walkin_adult_grand_total", walkinAdult);
  put("walkin_grand_total", walkinChild + walkinAdult);

  // Group
  const groupChild = sumRows("group_child_", GROUP_ROWS);
  const groupAdult = sumRows("group_adult_", GROUP_ROWS);
  put("group_child_total", groupChild);
  put("group_adult_total", groupAdult);
  put("group_child_grand_total", groupChild);
  put("group_adult_grand_total", groupAdult);
  put("group_grand_total", groupChild + groupAdult);

  // Exhibition = walk-in + group
  const exhibitChild = walkinChild + groupChild;
  const exhibitAdult = walkinAdult + groupAdult;
  put("exhibition_total_child", exhibitChild);
  put("exhibition_total_adult", exhibitAdult);
  put("exhibition_grand_total", exhibitChild + exhibitAdult);

  // Rooms
  let roomsTotal = 0;
  const roomAdult = { adult_th: 0, adult_intl: 0 };
  formRooms.forEach((room) => {
    const t = {};
    COUNT_COLS.forEach((c) => {
      t[c] = sumRows(`${room.key}_${c}_`, room.rounds);
      put(`${room.key}_${c}_total`, t[c]);
    });
    const child = t.child_th + t.child_intl;
    const adult = t.adult_th + t.adult_intl;
    put(`${room.key}_child_total`, child);
    put(`${room.key}_adult_total`, adult);
    put(`${room.key}_rooms_total`, child + adult);
    roomsTotal += child + adult;
    roomAdult.adult_th += t.adult_th;
    roomAdult.adult_intl += t.adult_intl;
  });

  // External activities (POS)
  let external = 0;
  EXTERNAL_ACTIVITIES.forEach((a) => {
    let child = 0, adult = 0;
    EXT_SIDES.forEach(([s]) => {
      child += num(`activity_${a.key}_${s}_child_th`) + num(`activity_${a.key}_${s}_child_intl`);
      adult += num(`activity_${a.key}_${s}_adult_th`) + num(`activity_${a.key}_${s}_adult_intl`);
    });
    put(`activity_${a.key}_child`, child);
    put(`activity_${a.key}_adult`, adult);
    external += child + adult;
    if (!a.label) { // ชื่อแถวตั้งชื่อเองไปแสดงในตารางสรุปด้วย
      const nm = ($(`activity_${a.key}_name`) || {}).value;
      $(`activity_${a.key}_label`).textContent = (nm || "").trim() || "กิจกรรมอื่น";
    }
  });
  put("external_rooms_total", external);

  // POS: children only from walk-in, adults from walk-in + room activities
  put("pos_child_th", walkin.child_th);
  put("pos_adult_th", walkin.adult_th + roomAdult.adult_th);
  put("pos_child_intl", walkin.child_intl);
  put("pos_adult_intl", walkin.adult_intl + roomAdult.adult_intl);

  // Summary
  const activityTotal = external + roomsTotal;
  put("summary_activity_total", activityTotal);
  put("summary_AllDay_participants", activityTotal + exhibitChild + exhibitAdult);
}
