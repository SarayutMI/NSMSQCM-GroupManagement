// Dashboard: the three views (visitors, staff, activities). Needs dashboard-core.js.

const NO_ACTIVITY = "(ไม่ได้เลือกกิจกรรม)";
const selectedKey = () => (state.gran === "all" ? null : periodKey());

// ---------- view: visitors ----------
function renderVisitors() {
  const g = trendGran();
  const area = visitorSeries();
  const byAge = state.vmode === "age";
  const series = byAge ? AGE_SERIES : area;
  const valueOf = (b, s) => (byAge ? ageTotals(b)[s.key] : b[s.key] || 0);
  const buckets = visitorBuckets(g);
  const period = state.gran === "all" ? sumBuckets(buckets) : buckets.find((b) => b.key === periodKey()) || zero();
  const label = bucketLabel(periodKey(), state.gran);
  const roundsByRoom = emptyRoomCounts();
  SESSIONS.forEach((s) => {
    if (inPeriod(s.date) && s.room in roundsByRoom) roundsByRoom[s.room] += 1;
  });
  const age = ageTotals(period);
  const actChild = age.child - (period.exhibition_total_child || 0);
  const actAdult = age.adult - (period.exhibition_total_adult || 0);

  $("v-kpi").innerHTML = kpiTiles([
    { lbl: "ผู้เข้าชมรวม", val: fmt(period.summary_AllDay_participants), sub: ageSub(age.child, age.adult) },
    { lbl: "เข้านิทรรศการ", color: EXHIBIT_COLOR, val: fmt(period.exhibition_grand_total), sub: `${ageSub(period.exhibition_total_child, period.exhibition_total_adult)}<br>Walk-in ${fmt(period.walkin_grand_total)} · กลุ่ม ${fmt(period.group_grand_total)}` },
    { lbl: "เข้ากิจกรรมรวม", val: fmt(period.summary_activity_total), sub: `${ageSub(actChild, actAdult)}<br>${fmt(period.rounds)} รอบ` },
    ...ROOMS.map((r) => {
      const n = roomNat(period, r.key);
      return { lbl: r.label, color: r.color, val: fmt(period[roomField(r.key)]), sub: `${ageSub(natChild(n), natAdult(n))}<br>${fmt(roundsByRoom[r.key])} รอบ` };
    }),
    { lbl: "กิจกรรมภายนอก", color: EXTERNAL_COLOR, val: fmt(period.external_rooms_total), sub: ageSub(period.external_child, period.external_adult) },
  ]);

  document.querySelectorAll("#v-mode .tab").forEach((t) => t.classList.toggle("active", t.dataset.vmode === state.vmode));
  $("v-donut-title").innerHTML = `สัดส่วนผู้เข้าชม${byAge ? "ตามวัย" : "ตามพื้นที่"}<span class="n">${esc(label)}</span>`;
  renderDonut($("v-donut"), series.map((s) => ({ label: s.label, color: s.color, value: valueOf(period, s) })), "รวม");

  const shown = trendWindow(buckets.map((b) => b.key), selectedKey(), g);
  const shownBuckets = buckets
    .filter((b) => shown.includes(b.key))
    .map((b) => {
      const values = series.map((s) => valueOf(b, s));
      return { key: b.key, tick: tickLabel(b.key, g), label: bucketLabel(b.key, g), values, total: values.reduce((a, v) => a + v, 0) };
    });
  $("v-trend-title").innerHTML = `แนวโน้มผู้เข้าชม${byAge ? "ตามวัย" : "ตามพื้นที่"}<span class="n">แยกราย${GRAN_NOUN[g]} · คลิกแท่งเพื่อเลือก</span>`;
  renderLegend($("v-legend"), series);
  renderGrouped($("v-bars"), shownBuckets, series, selectedKey(), "คน");

  renderVisitorBreakdown(period, label);

  $("v-table-title").textContent = `ตารางสรุปราย${GRAN_NOUN[g]}`;
  const cells = (b, first) => {
    const a = ageTotals(b);
    return [
      first,
      fmt(b.summary_AllDay_participants),
      fmt(a.child),
      fmt(a.adult),
      fmt(b.exhibition_grand_total),
      fmt(b.walkin_grand_total),
      fmt(b.group_grand_total),
      fmt(b.summary_activity_total),
      ...ROOMS.map((r) => fmt(b[roomField(r.key)])),
      fmt(b.external_rooms_total),
      fmt(b.rounds),
    ];
  };
  const rows = buckets
    .slice()
    .reverse()
    .map((b) => ({
      attrs: b.key === selectedKey() ? ' class="picked"' : "",
      cells: cells(b, esc(bucketLabel(b.key, g))),
    }));
  $("v-table").innerHTML = table(
    ["ช่วงเวลา", "รวม", "เด็ก", "ผู้ใหญ่", "นิทรรศการ", "Walk-in", "กลุ่ม", "กิจกรรม", ...ROOMS.map((r) => esc(r.label)), "ภายนอก", "รอบกิจกรรม"],
    rows,
    { foot: cells(sumBuckets(buckets), "รวมทั้งหมด") },
  );
}

/** Every source split into เด็กไทย / เด็กต่างชาติ / ผู้ใหญ่ไทย / ผู้ใหญ่ต่างชาติ where the form records it. */
function renderVisitorBreakdown(period, label) {
  const dash = '<span class="muted">–</span>';
  const row = (name, nat, child, adult) => {
    const cells = NAT_COLS.map((c) => (nat ? fmt(nat[c.key]) : dash));
    return { cells: [name, ...cells, fmt(child), fmt(adult), fmt(child + adult)] };
  };
  const walk = walkinNat(period);
  const rows = [
    row("Walk-in (นิทรรศการ)", walk, natChild(walk), natAdult(walk)),
    row("กลุ่ม / โรงเรียน (นิทรรศการ)", null, period.group_child_grand_total || 0, period.group_adult_grand_total || 0),
    ...ROOMS.map((r) => {
      const n = roomNat(period, r.key);
      return row(roomPill(r.key), n, natChild(n), natAdult(n));
    }),
    row("กิจกรรมภายนอก", null, period.external_child || 0, period.external_adult || 0),
  ];
  const a = ageTotals(period);
  $("v-break-title").innerHTML = `แยกกลุ่มผู้เข้าชม<span class="n">${esc(label)} · กลุ่มโรงเรียนและกิจกรรมภายนอกบันทึกแค่เด็ก/ผู้ใหญ่</span>`;
  $("v-break").innerHTML = table(["แหล่ง", ...NAT_COLS.map((c) => c.label), "เด็กรวม", "ผู้ใหญ่รวม", "รวม"], rows, {
    left: [0],
    foot: ["รวมทั้งหมด", ...NAT_COLS.map(() => ""), fmt(a.child), fmt(a.adult), fmt(a.child + a.adult)],
  });
}

// ---------- view: staff ----------
/** Adds a session's headcount per category to acc (acc.child_th, ..., acc.count). */
function addNat(acc, s) {
  NAT_COLS.forEach((c) => (acc[c.key] = (acc[c.key] || 0) + (s[c.key] || 0)));
  acc.count = (acc.count || 0) + s.count;
  return acc;
}
const sumNat = (sessions) => sessions.reduce(addNat, {});
const natHead = () => [...NAT_COLS.map((c) => c.label), "เด็กรวม", "ผู้ใหญ่รวม", "ผู้เข้าร่วมรวม"];
const natCells = (n) => [...NAT_COLS.map((c) => fmt(n[c.key])), fmt(natChild(n)), fmt(natAdult(n)), fmt(n.count)];

function personRows(sessions) {
  const m = new Map();
  sessions.forEach((s) => {
    if (!s.staff) return;
    if (!m.has(s.staff)) m.set(s.staff, { name: s.staff, role: s.role, rounds: 0, rooms: emptyRoomCounts(), count: 0, days: new Set() });
    const p = m.get(s.staff);
    p.rounds += 1;
    p.rooms[s.room] = (p.rooms[s.room] || 0) + 1;
    addNat(p, s);
    p.days.add(s.date);
  });
  return [...m.values()].sort((a, b) => b.rounds - a.rounds || a.name.localeCompare(b.name, "th"));
}

function renderStaff() {
  const g = trendGran();
  const filtered = SESSIONS.filter(sessionMatches);
  const inP = filtered.filter((s) => inPeriod(s.date));
  const label = bucketLabel(periodKey(), state.gran);

  // notice: names in Data that are in neither Staff_Name nor Exhibition_Volunteers
  const unsetNames = [...new Set(SESSIONS.filter((s) => s.staff && !s.role).map((s) => s.staff))];
  $("s-notice").innerHTML = unsetNames.length
    ? `<div class="notice">มี ${unsetNames.length} คนที่ไม่มีในรายชื่อ <b>Staff_Name</b> (เจ้าหน้าที่) หรือแท็บ <b>Exhibition_Volunteers</b> (อาสา) ของ Google Sheet: ${esc(unsetNames.slice(0, 12).join(", "))}${unsetNames.length > 12 ? " ..." : ""}</div>`
    : "";

  const roundsBy = (role) => inP.filter((s) => s.role === role).length;
  const peopleBy = (role) => new Set(inP.filter((s) => s.staff && s.role === role).map((s) => s.staff)).size;
  const noStaff = inP.filter((s) => !s.staff).length;
  const all = sumNat(inP);
  $("s-kpi").innerHTML = kpiTiles([
    { lbl: "รอบกิจกรรมรวม", val: fmt(inP.length), sub: `ผู้เข้าร่วม ${fmt(all.count)} คน<br>${ageSub(natChild(all), natAdult(all))}`, span: "span-3" },
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
    addNat(b, s);
  });
  const keys = [...m.keys()].sort();
  const shown = trendWindow(keys, selectedKey(), g);
  const bucketsAll = keys.map((k) => {
    const b = m.get(k);
    return Object.assign({}, b, { tick: tickLabel(k, g), label: bucketLabel(k, g), total: b.values.reduce((a, v) => a + v, 0) });
  });
  $("s-trend-title").innerHTML = `จำนวนรอบกิจกรรม<span class="n">แยกราย${GRAN_NOUN[g]} · คลิกแท่งเพื่อเลือก</span>`;
  renderLegend($("s-legend"), ROLE_SERIES);
  renderStacked($("s-bars"), bucketsAll.filter((b) => shown.includes(b.key)), ROLE_SERIES, selectedKey(), "รอบ");

  const sumOf = (fn) => fmt(bucketsAll.reduce((a, b) => a + fn(b), 0));
  $("s-bucket-table").innerHTML = table(
    ["ช่วงเวลา", "รอบรวม", ...ROLE_SERIES.map((r) => r.label), ...ROOMS.map((r) => esc(r.label)), "เด็ก", "ผู้ใหญ่", "ผู้เข้าร่วม"],
    bucketsAll
      .slice()
      .reverse()
      .map((b) => ({
        attrs: b.key === selectedKey() ? ' class="picked"' : "",
        cells: [esc(bucketLabel(b.key, g)), fmt(b.total), ...b.values.map(fmt), ...ROOMS.map((r) => fmt(b.rooms[r.key])), fmt(natChild(b)), fmt(natAdult(b)), fmt(b.count)],
      })),
    {
      foot: ["รวมทั้งหมด", sumOf((b) => b.total), ...ROLE_SERIES.map((_, i) => sumOf((b) => b.values[i])), ...ROOMS.map((r) => sumOf((b) => b.rooms[r.key])), sumOf(natChild), sumOf(natAdult), sumOf((b) => b.count)],
    },
  );

  // people
  const people = personRows(inP);
  $("s-people-title").innerHTML = `รายบุคคล<span class="n">${esc(label)} · ${people.length} คน</span>`;
  $("s-people").innerHTML = table(
    ["ชื่อ", "ประเภท", "รอบรวม", ...ROOMS.map((r) => esc(r.label)), "จำนวนวัน", ...natHead()],
    people.map((p) => ({
      attrs: ` class="clickable${state.person === p.name ? " picked" : ""}" data-person="${esc(p.name)}"`,
      cells: [esc(p.name), rolePill(p.role), fmt(p.rounds), ...ROOMS.map((r) => fmt(p.rooms[r.key])), fmt(p.days.size), ...natCells(p)],
    })),
    {
      left: [1],
      foot: ["รวม", "", fmt(people.reduce((a, p) => a + p.rounds, 0)), ...ROOMS.map((r) => fmt(people.reduce((a, p) => a + p.rooms[r.key], 0))), "", ...natCells(sumNat(inP.filter((s) => s.staff)))],
    },
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
    addNat(a, s);
  });
  const acts = [...byAct.values()].sort((a, b) => b.rounds - a.rounds);
  const mineNat = sumNat(inP);

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
      <div><b>${fmt(mineNat.count)}</b>ผู้เข้าร่วม</div>
      <div><b>${fmt(natChild(mineNat))}</b>เด็ก</div>
      <div><b>${fmt(natAdult(mineNat))}</b>ผู้ใหญ่</div>
    </div>
    <div class="person-grid">
      <div>
        <h3>กิจกรรมที่ดำเนินการ (${esc(label)})</h3>
        <div class="scroll-y">${table(["เรื่อง", "ห้อง", "รอบ", "เด็ก", "ผู้ใหญ่", "รวม"], acts.map((a) => ({ cells: [esc(a.activity), roomPill(a.room), fmt(a.rounds), fmt(natChild(a)), fmt(natAdult(a)), fmt(a.count)] })), { left: [1] })}</div>
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
    addNat(a, s);
    if (s.role === ROLES[0]) a.vol += 1;
    if (s.role === ROLES[1]) a.off += 1;
    const w = s.staff || "(ไม่ระบุ)";
    a.who.set(w, (a.who.get(w) || 0) + 1);
  });
  const acts = [...m.values()].sort((a, b) => b.rounds - a.rounds || b.count - a.count);
  const all = sumNat(inP);

  $("a-kpi").innerHTML = kpiTiles([
    { lbl: "จำนวนเรื่องที่ทำ", val: fmt(acts.length), span: "span-3" },
    { lbl: "รอบรวม", val: fmt(inP.length), span: "span-3" },
    { lbl: "ผู้เข้าร่วม", val: fmt(all.count), sub: ageSub(natChild(all), natAdult(all)), span: "span-3" },
    { lbl: "เฉลี่ยต่อรอบ", val: inP.length ? (inP.reduce((a, s) => a + s.count, 0) / inP.length).toFixed(1) : "-", sub: "คน", span: "span-3" },
  ]);
  $("a-title").innerHTML = `รายกิจกรรม<span class="n">${esc(label)}</span>`;
  $("a-table").innerHTML = table(
    ["เรื่อง", "ห้อง", "รอบ", ...natHead(), `${ROLES[0]} (รอบ)`, `${ROLES[1]} (รอบ)`, "ผู้ดำเนินกิจกรรม"],
    acts.map((a) => ({
      cells: [
        esc(a.activity),
        roomPill(a.room),
        fmt(a.rounds),
        ...natCells(a),
        fmt(a.vol),
        fmt(a.off),
        [...a.who.entries()].sort((x, y) => y[1] - x[1]).map(([n, c]) => `<span class="chip">${esc(n)}<b>${c}</b></span>`).join(""),
      ],
    })),
    { left: [1, 12] },
  );
}

// ---------- view: finance (revenue table of E-Mod) ----------
// Same keys/labels as REVENUE_ROWS / REVENUE_COLS in E-Mod-Script.js. Keys not listed here
// (added to E-Mod later) still show up, labelled by their key.
const FIN_CHANNELS = [
  { key: "walkinOnsite", label: "Walk-in : On-site", color: "#2a78d6" },
  { key: "walkinOnline", label: "Walk-in : Online", color: "#7fb3ef" },
  { key: "groupOnsite", label: "Group : On-site", color: "#eb6834" },
  { key: "groupOnline", label: "Group : Online", color: "#f4b08f" },
];
const FIN_SECTIONS = [
  { key: "inspireLab", label: "Inspire Lab" },
  { key: "innovationSpace", label: "Innovation space" },
  { key: "walkRally", label: "Walk Rally" },
  { key: "miniMakePlay", label: "Mini make & play" },
  { key: "dontMiss", label: "Don't Miss" },
  { key: "iScream", label: "I-Scream" },
  { key: "camp", label: "Camp" },
  { key: "workshop", label: "Workshop" },
  { key: "member", label: "Member" },
  { key: "other", label: "Other" },
];
const fmtBaht = (n) => (Number(n) || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 });

function finKeys() {
  const ch = FIN_CHANNELS.slice();
  const sec = FIN_SECTIONS.slice();
  FINANCE.forEach((f) =>
    Object.keys(f.revenue).forEach((c) => {
      if (!ch.some((x) => x.key === c)) ch.push({ key: c, label: c, color: "#9aa1ac" });
      Object.keys(f.revenue[c] || {}).forEach((s) => {
        if (!sec.some((x) => x.key === s)) sec.push({ key: s, label: s });
      });
    }),
  );
  return { ch, sec };
}

/** {cell: {channel: {section: amount}}, total} summed over the E-Mod reports that pass `keep(date)`. */
function sumFinance(keep) {
  const cell = {};
  let total = 0;
  FINANCE.forEach((f) => {
    if (!keep(f.date)) return;
    Object.keys(f.revenue).forEach((c) => {
      const row = f.revenue[c] || {};
      cell[c] = cell[c] || {};
      Object.keys(row).forEach((s) => {
        const v = Number(row[s]) || 0;
        cell[c][s] = (cell[c][s] || 0) + v;
        total += v;
      });
    });
  });
  return { cell, total };
}
const chTotal = (sum, c) => Object.values(sum.cell[c] || {}).reduce((a, v) => a + v, 0);
const secTotal = (sum, s, ch) => ch.reduce((a, c) => a + ((sum.cell[c.key] || {})[s] || 0), 0);

function renderFinance() {
  const g = trendGran();
  const { ch, sec } = finKeys();
  const label = bucketLabel(periodKey(), state.gran);
  const period = sumFinance(inPeriod);
  const days = FINANCE.filter((f) => inPeriod(f.date)).length;

  $("f-kpi").innerHTML = kpiTiles([
    { lbl: "รายได้รวม", val: fmtBaht(period.total), sub: `บาท · จาก E-Mod ${fmt(days)} วัน`, span: "span-4" },
    ...ch.map((c) => ({ lbl: c.label, color: c.color, val: fmtBaht(chTotal(period, c.key)), sub: "บาท", span: "span-2" })),
  ]);

  // by section x channel for the selected period
  $("f-sec-title").innerHTML = `รายได้แยกตามส่วนงาน<span class="n">${esc(label)}</span>`;
  const secRows = sec
    .map((s) => ({ s, total: secTotal(period, s.key, ch) }))
    .filter((r) => r.total || FIN_SECTIONS.some((x) => x.key === r.s.key))
    .map((r) => ({ cells: [esc(r.s.label), ...ch.map((c) => fmtBaht((period.cell[c.key] || {})[r.s.key])), fmtBaht(r.total), period.total ? ((r.total / period.total) * 100).toFixed(1) + "%" : "–"] }));
  $("f-sec").innerHTML = table(["ส่วนงาน", ...ch.map((c) => esc(c.label)), "รวม", "สัดส่วน"], secRows, {
    foot: ["รวมทั้งหมด", ...ch.map((c) => fmtBaht(chTotal(period, c.key))), fmtBaht(period.total), ""],
  });

  // trend: one bar per channel
  const keys = [...new Set(FINANCE.map((f) => bucketKey(f.date, g)))].sort();
  const shown = trendWindow(keys, selectedKey(), g);
  const sums = new Map(keys.map((k) => [k, sumFinance((d) => bucketKey(d, g) === k)]));
  const buckets = shown.map((k) => {
    const values = ch.map((c) => chTotal(sums.get(k), c.key));
    return { key: k, tick: tickLabel(k, g), label: bucketLabel(k, g), values, total: values.reduce((a, v) => a + v, 0) };
  });
  $("f-trend-title").innerHTML = `แนวโน้มรายได้<span class="n">แยกราย${GRAN_NOUN[g]} · คลิกแท่งเพื่อเลือก</span>`;
  renderLegend($("f-legend"), ch);
  renderGrouped($("f-bars"), buckets, ch, selectedKey(), "บาท");

  // per period x section
  $("f-table-title").textContent = `ตารางรายได้ราย${GRAN_NOUN[g]} (บาท)`;
  const usedSec = sec.filter((s) => FINANCE.some((f) => ch.some((c) => Number((f.revenue[c.key] || {})[s.key]))));
  const all = sumFinance(() => true);
  $("f-table").innerHTML = table(
    ["ช่วงเวลา", "รวม", ...usedSec.map((s) => esc(s.label))],
    keys
      .slice()
      .reverse()
      .map((k) => {
        const sm = sums.get(k);
        return {
          attrs: k === selectedKey() ? ' class="picked"' : "",
          cells: [esc(bucketLabel(k, g)), fmtBaht(sm.total), ...usedSec.map((s) => fmtBaht(secTotal(sm, s.key, ch)))],
        };
      }),
    { foot: ["รวมทั้งหมด", fmtBaht(all.total), ...usedSec.map((s) => fmtBaht(secTotal(all, s.key, ch)))] },
  );
}
