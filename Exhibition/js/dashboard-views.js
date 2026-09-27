// Dashboard: the three views (visitors, staff, activities). Needs dashboard-core.js.

const NO_ACTIVITY = "(ไม่ได้เลือกกิจกรรม)";
const selectedKey = () => (state.gran === "all" ? null : periodKey());

// ---------- view: visitors ----------
function renderVisitors() {
  const g = trendGran();
  const series = visitorSeries();
  const buckets = visitorBuckets(g);
  const period = state.gran === "all" ? sumBuckets(buckets) : buckets.find((b) => b.key === periodKey()) || zero();
  const label = bucketLabel(periodKey(), state.gran);
  const roundsByRoom = emptyRoomCounts();
  SESSIONS.forEach((s) => {
    if (inPeriod(s.date) && s.room in roundsByRoom) roundsByRoom[s.room] += 1;
  });

  $("v-kpi").innerHTML = kpiTiles([
    { lbl: "ผู้เข้าชมรวม", val: fmt(period.summary_AllDay_participants), sub: "นิทรรศการ + กิจกรรม" },
    { lbl: "เข้านิทรรศการ", color: EXHIBIT_COLOR, val: fmt(period.exhibition_grand_total), sub: `Walk-in ${fmt(period.walkin_grand_total)} · กลุ่ม ${fmt(period.group_grand_total)}` },
    { lbl: "เข้ากิจกรรมรวม", val: fmt(period.summary_activity_total), sub: `${fmt(period.rounds)} รอบ` },
    ...ROOMS.map((r) => ({ lbl: r.label, color: r.color, val: fmt(period[roomField(r.key)]), sub: `${fmt(roundsByRoom[r.key])} รอบ` })),
    { lbl: "กิจกรรมภายนอก", color: EXTERNAL_COLOR, val: fmt(period.external_rooms_total) },
  ]);

  $("v-donut-title").innerHTML = `สัดส่วนผู้เข้าชม<span class="n">${esc(label)}</span>`;
  renderDonut($("v-donut"), series.map((s) => ({ label: s.label, color: s.color, value: period[s.key] || 0 })), "รวม");

  const shown = trendWindow(buckets.map((b) => b.key), selectedKey(), g);
  const shownBuckets = buckets
    .filter((b) => shown.includes(b.key))
    .map((b) => ({
      key: b.key,
      tick: tickLabel(b.key, g),
      label: bucketLabel(b.key, g),
      values: series.map((s) => b[s.key] || 0),
      total: series.reduce((sum, s) => sum + (b[s.key] || 0), 0),
    }));
  $("v-trend-title").innerHTML = `แนวโน้มผู้เข้าชม<span class="n">แยกราย${GRAN_NOUN[g]} · คลิกแท่งเพื่อเลือก</span>`;
  renderLegend($("v-legend"), series);
  renderStacked($("v-bars"), shownBuckets, series, selectedKey(), "คน");

  $("v-table-title").textContent = `ตารางสรุปราย${GRAN_NOUN[g]}`;
  const cells = (b, first) => [
    first,
    fmt(b.summary_AllDay_participants),
    fmt(b.exhibition_grand_total),
    fmt(b.walkin_grand_total),
    fmt(b.group_grand_total),
    fmt(b.summary_activity_total),
    ...ROOMS.map((r) => fmt(b[roomField(r.key)])),
    fmt(b.external_rooms_total),
    fmt(b.rounds),
  ];
  const rows = buckets
    .slice()
    .reverse()
    .map((b) => ({
      attrs: b.key === selectedKey() ? ' class="picked"' : "",
      cells: cells(b, esc(bucketLabel(b.key, g))),
    }));
  $("v-table").innerHTML = table(
    ["ช่วงเวลา", "รวม", "นิทรรศการ", "Walk-in", "กลุ่ม", "กิจกรรม", ...ROOMS.map((r) => esc(r.label)), "ภายนอก", "รอบกิจกรรม"],
    rows,
    { foot: cells(sumBuckets(buckets), "รวมทั้งหมด") },
  );
}

// ---------- view: staff ----------
function personRows(sessions) {
  const m = new Map();
  sessions.forEach((s) => {
    if (!s.staff) return;
    if (!m.has(s.staff)) m.set(s.staff, { name: s.staff, role: s.role, rounds: 0, rooms: emptyRoomCounts(), count: 0, days: new Set() });
    const p = m.get(s.staff);
    p.rounds += 1;
    p.rooms[s.room] = (p.rooms[s.room] || 0) + 1;
    p.count += s.count;
    p.days.add(s.date);
  });
  return [...m.values()].sort((a, b) => b.rounds - a.rounds || a.name.localeCompare(b.name, "th"));
}

function renderStaff() {
  const g = trendGran();
  const filtered = SESSIONS.filter(sessionMatches);
  const inP = filtered.filter((s) => inPeriod(s.date));
  const label = bucketLabel(periodKey(), state.gran);

  // notice: staff with no role in the Staff tab
  const unsetNames = [...new Set(SESSIONS.filter((s) => s.staff && !s.role).map((s) => s.staff))];
  $("s-notice").innerHTML = unsetNames.length
    ? `<div class="notice">มี ${unsetNames.length} คนที่ยังไม่ได้ระบุประเภท (อาสา / เจ้าหน้าที่) ในแท็บ <b>Staff</b> ของ Google Sheet: ${esc(unsetNames.slice(0, 12).join(", "))}${unsetNames.length > 12 ? " ..." : ""}</div>`
    : "";

  const roundsBy = (role) => inP.filter((s) => s.role === role).length;
  const peopleBy = (role) => new Set(inP.filter((s) => s.staff && s.role === role).map((s) => s.staff)).size;
  const noStaff = inP.filter((s) => !s.staff).length;
  $("s-kpi").innerHTML = kpiTiles([
    { lbl: "รอบกิจกรรมรวม", val: fmt(inP.length), sub: `ผู้เข้าร่วม ${fmt(inP.reduce((a, s) => a + s.count, 0))} คน`, span: "span-3" },
    { lbl: ROLES[0], color: ROLE_COLOR[ROLES[0]], val: fmt(roundsBy(ROLES[0])), sub: `${fmt(peopleBy(ROLES[0]))} คน`, span: "span-3" },
    { lbl: ROLES[1], color: ROLE_COLOR[ROLES[1]], val: fmt(roundsBy(ROLES[1])), sub: `${fmt(peopleBy(ROLES[1]))} คน`, span: "span-3" },
    { lbl: "ยังไม่ระบุ", color: ROLE_COLOR[""], val: fmt(roundsBy("")), sub: noStaff ? `ในนี้ ${fmt(noStaff)} รอบไม่ได้เลือกผู้ดำเนินการ` : `${fmt(peopleBy(""))} คน`, span: "span-3" },
  ]);

  // trend by role
  const m = new Map();
  filtered.forEach((s) => {
    const k = bucketKey(s.date, g);
    if (!m.has(k)) m.set(k, { key: k, values: ROLE_SERIES.map(() => 0), rooms: emptyRoomCounts(), count: 0 });
    const b = m.get(k);
    b.values[ROLE_SERIES.findIndex((r) => r.role === s.role)] += 1;
    b.rooms[s.room] = (b.rooms[s.room] || 0) + 1;
    b.count += s.count;
  });
  const keys = [...m.keys()].sort();
  const shown = trendWindow(keys, selectedKey(), g);
  const bucketsAll = keys.map((k) => {
    const b = m.get(k);
    return { key: k, tick: tickLabel(k, g), label: bucketLabel(k, g), values: b.values, total: b.values.reduce((a, v) => a + v, 0), rooms: b.rooms, count: b.count };
  });
  $("s-trend-title").innerHTML = `จำนวนรอบกิจกรรม<span class="n">แยกราย${GRAN_NOUN[g]} · คลิกแท่งเพื่อเลือก</span>`;
  renderLegend($("s-legend"), ROLE_SERIES);
  renderStacked($("s-bars"), bucketsAll.filter((b) => shown.includes(b.key)), ROLE_SERIES, selectedKey(), "รอบ");

  const sumOf = (fn) => fmt(bucketsAll.reduce((a, b) => a + fn(b), 0));
  $("s-bucket-table").innerHTML = table(
    ["ช่วงเวลา", "รอบรวม", ...ROLE_SERIES.map((r) => r.label), ...ROOMS.map((r) => esc(r.label)), "ผู้เข้าร่วม"],
    bucketsAll
      .slice()
      .reverse()
      .map((b) => ({
        attrs: b.key === selectedKey() ? ' class="picked"' : "",
        cells: [esc(bucketLabel(b.key, g)), fmt(b.total), ...b.values.map(fmt), ...ROOMS.map((r) => fmt(b.rooms[r.key])), fmt(b.count)],
      })),
    {
      foot: ["รวมทั้งหมด", sumOf((b) => b.total), ...ROLE_SERIES.map((_, i) => sumOf((b) => b.values[i])), ...ROOMS.map((r) => sumOf((b) => b.rooms[r.key])), sumOf((b) => b.count)],
    },
  );

  // people
  const people = personRows(inP);
  $("s-people-title").innerHTML = `รายบุคคล<span class="n">${esc(label)} · ${people.length} คน</span>`;
  $("s-people").innerHTML = table(
    ["ชื่อ", "ประเภท", "รอบรวม", ...ROOMS.map((r) => esc(r.label)), "จำนวนวัน", "ผู้เข้าร่วม"],
    people.map((p) => ({
      attrs: ` class="clickable${state.person === p.name ? " picked" : ""}" data-person="${esc(p.name)}"`,
      cells: [esc(p.name), rolePill(p.role), fmt(p.rounds), ...ROOMS.map((r) => fmt(p.rooms[r.key])), fmt(p.days.size), fmt(p.count)],
    })),
    { left: [1] },
  );
  $("s-people").querySelectorAll("th:nth-child(2), td:nth-child(2)").forEach((el) => (el.style.textAlign = "left"));

  renderPerson();
}

function renderPerson() {
  const card = $("s-person-card");
  if (!state.person) {
    card.hidden = true;
    return;
  }
  card.hidden = false;
  const mine = SESSIONS.filter((s) => s.staff === state.person && (state.room === "all" || s.room === state.room));
  const inP = mine.filter((s) => inPeriod(s.date));
  const role = (mine[0] || {}).role || (STAFF.find((s) => s.name === state.person) || {}).role || "";
  const label = bucketLabel(periodKey(), state.gran);

  const byAct = new Map();
  inP.forEach((s) => {
    const k = s.room + "|" + s.activity;
    if (!byAct.has(k)) byAct.set(k, { room: s.room, activity: s.activity || NO_ACTIVITY, rounds: 0, count: 0 });
    const a = byAct.get(k);
    a.rounds += 1;
    a.count += s.count;
  });
  const acts = [...byAct.values()].sort((a, b) => b.rounds - a.rounds);

  const byDay = new Map();
  inP.forEach((s) => {
    if (!byDay.has(s.date)) byDay.set(s.date, []);
    byDay.get(s.date).push(s);
  });
  const dayRows = [...byDay.keys()].sort().reverse().map((d) => ({
    cells: [
      esc(bucketLabel(d, "day")),
      byDay.get(d).map((s) => `<span class="chip">${esc(s.activity || NO_ACTIVITY)}<b>${esc(roomLabel(s.room))}</b></span>`).join(""),
      fmt(byDay.get(d).length),
    ],
  }));

  const byMonth = new Map();
  mine.forEach((s) => {
    const k = s.date.slice(0, 7);
    if (!byMonth.has(k)) byMonth.set(k, emptyRoomCounts());
    byMonth.get(k)[s.room] = (byMonth.get(k)[s.room] || 0) + 1;
  });
  const monthRows = [...byMonth.keys()].sort().reverse().map((k) => {
    const c = byMonth.get(k);
    return { cells: [esc(bucketLabel(k, "month")), ...ROOMS.map((r) => fmt(c[r.key])), fmt(Object.values(c).reduce((a, v) => a + v, 0))] };
  });

  card.innerHTML = `
    <div class="card-head">
      <span class="t">${esc(state.person)} ${rolePill(role)}<span class="n">${esc(label)}</span></span>
      <button class="tab" data-close-person>ปิด</button>
    </div>
    <div class="mini-kpis">
      <div><b>${fmt(inP.length)}</b>รอบ</div>
      <div><b>${fmt(acts.length)}</b>เรื่อง</div>
      <div><b>${fmt(byDay.size)}</b>วัน</div>
      <div><b>${fmt(inP.reduce((a, s) => a + s.count, 0))}</b>ผู้เข้าร่วม</div>
    </div>
    <div class="person-grid">
      <div>
        <h3>กิจกรรมที่ดำเนินการ (${esc(label)})</h3>
        <div class="scroll-y">${table(["เรื่อง", "ห้อง", "รอบ", "ผู้เข้าร่วม"], acts.map((a) => ({ cells: [esc(a.activity), roomPill(a.room), fmt(a.rounds), fmt(a.count)] })), { left: [1] })}</div>
      </div>
      <div>
        <h3>รายวัน (${esc(label)})</h3>
        <div class="scroll-y">${table(["วันที่", "เรื่อง / ห้อง", "รอบ"], dayRows, { left: [1] })}</div>
      </div>
      <div>
        <h3>รอบรายเดือน (ทุกช่วงที่บันทึก)</h3>
        <div class="scroll-y">${table(["เดือน", ...ROOMS.map((r) => esc(r.label)), "รวม"], monthRows)}</div>
      </div>
    </div>`;
}

// ---------- view: activities ----------
function renderActivities() {
  const inP = SESSIONS.filter((s) => sessionMatches(s) && inPeriod(s.date));
  const label = bucketLabel(periodKey(), state.gran);
  const m = new Map();
  inP.forEach((s) => {
    const k = s.room + "|" + s.activity;
    if (!m.has(k)) m.set(k, { room: s.room, activity: s.activity || NO_ACTIVITY, rounds: 0, count: 0, vol: 0, off: 0, who: new Map() });
    const a = m.get(k);
    a.rounds += 1;
    a.count += s.count;
    if (s.role === ROLES[0]) a.vol += 1;
    if (s.role === ROLES[1]) a.off += 1;
    const w = s.staff || "(ไม่ระบุ)";
    a.who.set(w, (a.who.get(w) || 0) + 1);
  });
  const acts = [...m.values()].sort((a, b) => b.rounds - a.rounds || b.count - a.count);

  $("a-kpi").innerHTML = kpiTiles([
    { lbl: "จำนวนเรื่องที่ทำ", val: fmt(acts.length), span: "span-3" },
    { lbl: "รอบรวม", val: fmt(inP.length), span: "span-3" },
    { lbl: "ผู้เข้าร่วม", val: fmt(inP.reduce((a, s) => a + s.count, 0)), span: "span-3" },
    { lbl: "เฉลี่ยต่อรอบ", val: inP.length ? (inP.reduce((a, s) => a + s.count, 0) / inP.length).toFixed(1) : "-", sub: "คน", span: "span-3" },
  ]);
  $("a-title").innerHTML = `รายกิจกรรม<span class="n">${esc(label)}</span>`;
  $("a-table").innerHTML = table(
    ["เรื่อง", "ห้อง", "รอบ", "ผู้เข้าร่วม", `${ROLES[0]} (รอบ)`, `${ROLES[1]} (รอบ)`, "ผู้ดำเนินกิจกรรม"],
    acts.map((a) => ({
      cells: [
        esc(a.activity),
        roomPill(a.room),
        fmt(a.rounds),
        fmt(a.count),
        fmt(a.vol),
        fmt(a.off),
        [...a.who.entries()].sort((x, y) => y[1] - x[1]).map(([n, c]) => `<span class="chip">${esc(n)}<b>${c}</b></span>`).join(""),
      ],
    })),
    { left: [1, 6] },
  );
}
