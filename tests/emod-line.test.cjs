// Run: node --test tests/emod-line.test.cjs. All HTTP/Sheets services are mocked.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const GROUP = 'C' + 'a'.repeat(32);
const copy = value => JSON.parse(JSON.stringify(value));
function sample() {
  return { id: 'report-1', date: '2026-10-23', recorder: 'Alice', updatedAt: '2026-10-23T10:00:00Z',
    visitorCounts: { exWalkin: { childTh: 191, adultTh: 290 }, exGroup: {} },
    activityRounds: { inspireLab: [{ childTh: 44, adultTh: 37, activity: 'กิจกรรมทดลอง' }], innovationSpace: [] },
    otherActivities: [{ name: 'Mini-Make&Play', w_childTh: 3 }, { name: 'ค่าย One Day Camp "EDP EV(Electric Vehicle)"', g_childTh: 27 }],
    revenue: { walkinOnsite: { camp: 4450 }, groupOnline: {} } };
}
function setup(options = {}) {
  let report = sample(), source = null, pushStatus = 200, networkFailure = false;
  const properties = new Map(options.configured === false ? [] : [['LINE_GROUP_ID', GROUP], ['LINE_CHANNEL_ACCESS_TOKEN', 'secret-test-token']]);
  const pushes = [], authRequests = [], groupRequests = [];
  let groupName = 'รายงานประจำวัน';
  let held = false, uuid = 0;
  const ctx = vm.createContext({ Date, console: { log() {}, warn() {} },
    HtmlService: { createHtmlOutput: text => ({ html: text }) },
    ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/test/exec' }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (algorithm, value) => [...crypto.createHash('sha256').update(value).digest()],
      base64EncodeWebSafe: value => Buffer.from(value).toString('base64url'),
      getUuid: () => '00000000-0000-4000-8000-' + String(++uuid).padStart(12, '0'),
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties.get(key) || null,
      setProperty: (key, value) => properties.set(key, value), deleteProperty: key => properties.delete(key) }) },
    LockService: { getScriptLock: () => ({ waitLock() { assert(!held); held = true; }, releaseLock() { held = false; } }) },
    UrlFetchApp: { fetch(url, options) {
      if (url.includes('/v2/bot/group/')) {
        groupRequests.push(url);
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ groupId: GROUP, groupName }) };
      }
      const data = JSON.parse(options.payload);
      if (url.includes('script.google.com')) {
        authRequests.push(data);
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ user: data.token === 'valid-session' ? 'Alice' : null }) };
      }
      assert.equal(url, 'https://api.line.me/v2/bot/message/push');
      pushes.push({ ...copy(options), data });
      if (networkFailure) throw new Error('timeout');
      return { getResponseCode: () => pushStatus, getAllHeaders: () => pushStatus === 409 ? { 'x-line-accepted-request-id': 'accepted' } : {} };
    } },
  });
  for (const file of ['E-Mod-CodeGs.gs', 'E-Mod-Line.gs']) vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
  ctx.emodGetByDate_ = () => ({ data: copy(report) });
  ctx.emodReadExhibition_ = () => copy(source);
  function preview() { return copy(ctx.emodLineAction_({ action: 'linePreview', date: report.date, token: 'valid-session' })); }
  function send(value) { return copy(ctx.emodLineAction_({ action: 'lineSend', date: report.date, token: 'valid-session', fingerprint: value.fingerprint })); }
  return { ctx, properties, pushes, authRequests, groupRequests, preview, send, report: () => report,
    setGroupName: value => { groupName = value; },
    setSource: value => { source = value; }, setReport: value => { report = value; },
    setPushStatus: value => { pushStatus = value; }, setNetworkFailure: value => { networkFailure = value; } };
}

test('two formats match supplied daily totals, Thai date, income and dynamic camp title', () => {
  const app = setup();
  const [summary, narrative] = copy(app.ctx.emodLineFormat_(sample())).map(message => message.text);
  assert.match(summary, /วันศุกร์ที่ 23 ตุลาคม 2569/);
  assert.match(summary, /เด็กไทย 191/);
  assert.match(summary, /กิจกรรม: กิจกรรมทดลอง/);
  assert.match(summary, /ทั้งหมด 592 คน/);
  assert.match(narrative, /รายได้จากการดำเนินงานรวม 4,450 บาท \(ชำระหน้างาน 4,450 บาท\)/);
  assert.match(narrative, /🌺 นิทรรศการ รวม 481 คน \(เด็ก 191 คน, ผู้ใหญ่ 290 คน\)/);
  assert.match(narrative, /🧪 Inspire Lab รวม 81 คน \(เด็ก 44 คน, ผู้ใหญ่ 37 คน\)/);
  assert.match(narrative, /🧩 Mini-Make&Play รวม 3 คน \(เด็ก 3 คน\)/);
  assert(narrative.includes('ค่าย One Day Camp "EDP EV(Electric Vehicle)" รวม 27 คน'));
  assert(!narrative.includes('Innovation Space'));
  assert(narrative.endsWith('ขอบคุณค่ะ🙏🏻🥰✨'));
});

test('format counts foreign visitors and seniors once, handles online income and new activity titles', () => {
  const app = setup();
  const report = sample();
  report.visitorCounts = { exWalkin: { childTh: 1, childFor: 2, adultFor: 3, senior: 4 }, exGroup: {} };
  report.activityRounds = {};
  report.otherActivities = [{ name: 'ค่ายใหม่', w_childFor: 5 }];
  report.revenue = { walkinOnsite: { other: 100.5 }, groupOnline: { camp: 200.25 } };
  const text = app.ctx.emodLineFormat_(report)[1].text;
  assert.match(text, /ทั้งหมด 15 คน/);
  assert.match(text, /เด็ก 3 คน, ผู้ใหญ่ 3 คน, ผู้สูงอายุ 4 คน/);
  assert.match(text, /รายได้จากการดำเนินงานรวม 300.75 บาท/);
  assert.match(text, /ชำระออนไลน์ 200.25 บาท/);
  assert.match(text, /ค่ายใหม่ รวม 5 คน/);
});

test('preview is read-only, no token leakage; reviewed send bundles two messages and deduplicates', () => {
  const app = setup();
  const preview = app.preview();
  assert.equal(app.pushes.length, 0);
  assert(!JSON.stringify(preview).includes('secret-test-token'));
  assert.equal(preview.configured, true);
  assert.equal(app.send(preview).ok, true);
  assert.equal(app.pushes.length, 1);
  assert.equal(app.pushes[0].data.to, GROUP);
  assert.equal(app.pushes[0].data.messages.length, 2);
  assert.equal(app.send(preview).alreadySent, true);
  assert.equal(app.pushes.length, 1);
  app.report().updatedAt = '2026-10-23T11:00:00Z';
  assert.equal(app.send(app.preview()).alreadySent, true, 'Saving identical content does not send it again');
});

test('requires valid Dashboard session and saved E-MOD recorder; config missing disables send', () => {
  const app = setup();
  assert.throws(() => app.ctx.emodLineAction_({ action: 'lineSend', token: 'invalid' }), /unauthorized/);
  assert.equal(app.pushes.length, 0);
  app.report().recorder = 'Exhibition (อัตโนมัติ)';
  assert.throws(() => app.preview(), /ผู้บันทึก/);
  const unconfigured = setup({ configured: false });
  const preview = unconfigured.preview();
  assert.equal(preview.configured, false);
  assert.throws(() => unconfigured.send(preview), /LINE_CHANNEL_ACCESS_TOKEN/);
  assert.equal(unconfigured.pushes.length, 0);
});

test('rejects stale previews when saved income, source counts or destination changes', () => {
  const app = setup();
  const preview = app.preview();
  app.report().revenue.walkinOnsite.camp = 6000;
  assert.throws(() => app.send(preview), /พรีวิวใหม่/);
  const current = app.preview();
  app.setSource({ walkin_child_th_1: 500, timestamp: 'changed' });
  assert.throws(() => app.send(current), /พรีวิวใหม่/);
  const latest = app.preview();
  app.properties.set('LINE_GROUP_ID', 'C' + 'b'.repeat(32));
  assert.throws(() => app.send(latest), /พรีวิวใหม่/);
  assert.equal(app.pushes.length, 0);
});

test('timeout retry reuses the same LINE retry key; accepted 409 is recorded as sent', () => {
  const app = setup();
  const preview = app.preview();
  app.setNetworkFailure(true);
  assert.throws(() => app.send(preview), /timeout/);
  app.setNetworkFailure(false);
  app.setPushStatus(409);
  assert.equal(app.send(preview).ok, true);
  assert.equal(app.pushes[0].headers['X-Line-Retry-Key'], app.pushes[1].headers['X-Line-Retry-Key']);
  assert.equal(app.send(preview).alreadySent, true);
});

test('failed LINE request is not marked sent; expired uncertain retries are blocked', () => {
  const app = setup();
  const preview = app.preview();
  app.setPushStatus(429);
  assert.throws(() => app.send(preview), /HTTP 429/);
  const key = [...app.properties.keys()].find(key => key.startsWith('LINE_DELIVERY_'));
  const delivery = JSON.parse(app.properties.get(key));
  assert.equal(delivery.status, 'pending');
  delivery.attemptedAt = Date.now() - 25 * 3600 * 1000;
  app.properties.set(key, JSON.stringify(delivery));
  assert.throws(() => app.send(preview), /24 ชั่วโมง/);
  assert.equal(app.pushes.length, 1);
});

test('invalid dates and overlong reports fail instead of sending truncated content', () => {
  const app = setup();
  assert.throws(() => app.ctx.emodLineThaiDate_('2026-02-30'), /วันที่ไม่ถูกต้อง/);
  const report = sample();
  report.otherActivities[0].name = 'ก'.repeat(5001);
  assert.throws(() => app.ctx.emodLineFormat_(report), /5,000/);
});

test('Apps Script group discovery requires a temporary setup key and never sends or changes destination', () => {
  const app = setup();
  const body = { events: [{ type: 'join', source: { type: 'group', groupId: GROUP } }] };
  assert(app.ctx.emodLineCaptureGroup_({ parameter: {} }, body).error);
  assert.equal(app.groupRequests.length, 0);
  const url = new URL(app.ctx.prepareLineGroupSetup());
  assert(url.pathname.endsWith('/exec'), 'Editor /dev URL must not be used as a public webhook');
  const e = { parameter: { setupKey: url.searchParams.get('setupKey') } };
  assert.equal(app.ctx.emodLineCaptureGroup_(e, { events: [] }).ok, true);
  assert.equal(app.ctx.doPost({ ...e, postData: { contents: JSON.stringify({ events: [] }) } }).html, 'OK');
  const originalGroupId = app.properties.get('LINE_GROUP_ID');
  assert.equal(app.ctx.emodLineCaptureGroup_(e, body).ok, true);
  assert.equal(JSON.parse(app.properties.get('LINE_GROUP_CANDIDATE')).groupName, 'รายงานประจำวัน');
  assert.equal(app.properties.get('LINE_GROUP_ID'), originalGroupId);
  assert.equal(app.pushes.length, 0);
  const result = app.ctx.confirmLineGroupSetup();
  assert.equal(result.groupId, GROUP);
  assert.equal(app.properties.get('LINE_GROUP_NAME'), 'รายงานประจำวัน');
  assert.equal(app.properties.has('LINE_GROUP_SETUP_KEY'), false);
  assert(app.ctx.emodLineCaptureGroup_(e, body).error);
});

test('Apps Script group discovery ignores other group names, expired keys and requires owner confirmation', () => {
  const app = setup();
  const url = new URL(app.ctx.prepareLineGroupSetup());
  const e = { parameter: { setupKey: url.searchParams.get('setupKey') } };
  const body = { events: [{ type: 'message', source: { type: 'group', groupId: GROUP } }] };
  app.setGroupName('กลุ่มอื่น');
  app.ctx.emodLineCaptureGroup_(e, body);
  assert.equal(app.properties.has('LINE_GROUP_CANDIDATE'), false);
  app.setGroupName('รายงานประจำวัน');
  app.ctx.emodLineCaptureGroup_(e, body);
  app.setGroupName('เปลี่ยนชื่อแล้ว');
  assert.throws(() => app.ctx.confirmLineGroupSetup(), /ชื่อกลุ่มไม่ตรง/);
  app.properties.set('LINE_GROUP_SETUP_EXPIRES', String(Date.now() - 1));
  assert(app.ctx.emodLineCaptureGroup_(e, body).error);
  assert.equal(app.pushes.length, 0);
});

test('group setup allows a production URL override and rejects editor-only dev deployments', () => {
  const app = setup();
  app.properties.set('LINE_WEBAPP_URL', 'https://script.google.com/macros/s/deployment-id/dev');
  assert.throws(() => app.ctx.prepareLineGroupSetup(), /exec/);
  app.properties.set('LINE_WEBAPP_URL', 'https://script.google.com/macros/s/deployment-id/exec');
  assert.equal(new URL(app.ctx.prepareLineGroupSetup()).pathname, '/macros/s/deployment-id/exec');
});

test('setup diagnostics report stale LINE keys and missing receiver without exposing credentials', () => {
  const app = setup();
  app.ctx.prepareLineGroupSetup();
  app.ctx.UrlFetchApp.fetch = url => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify(
    url.endsWith('/v2/bot/info') ? { basicId: '@849xixkr', displayName: 'Marty' } :
    url.endsWith('/v2/bot/channel/webhook/endpoint') ? { active: false, endpoint: 'https://script.google.com/macros/s/old/exec?setupKey=old-private-key' } :
    { error: 'unknown action' }) });
  const notes = copy(app.ctx.checkLineGroupSetup()).join('\n');
  assert.match(notes, /Use webhook: ปิด/);
  assert.match(notes, /setupKey ใน LINE ไม่ตรง/);
  assert.match(notes, /deployment ยังไม่มีโค้ดรับกลุ่ม/);
  assert(!notes.includes('secret-test-token'));
  assert(!notes.includes('old-private-key'));
});
