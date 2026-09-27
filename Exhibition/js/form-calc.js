// All totals of the form. Recomputed from scratch on every edit (cheap, and keeps the
// rules in one place). Needs form-render.js for WALKIN_ROWS, GROUP_ROWS, COUNT_COLS, formRooms.

const EXTERNAL_IDS = ["walkrally", "miniplay", "other1", "other2"].flatMap((k) => [`activity_${k}_child`, `activity_${k}_adult`]);

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
  const external = EXTERNAL_IDS.reduce((a, id) => a + num(id), 0);
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
