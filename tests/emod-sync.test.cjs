// Run: node --test tests/emod-sync.test.cjs
// Apps Script services are in memory: these tests never contact the live databases.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const EX_ID = '1tHFy0w7ucsWwTqGbAtIICwUgHCnHeCRKv7tZjN0x24c';
const EM_ID = '1FJLd5tucqX1WGTWn9P0NipZwZDSJr73be20_FlIlxz8';
const DATE = '2026-10-24';
const plain = value => JSON.parse(JSON.stringify(value));

class Sheet {
  constructor(rows = []) { this.rows = rows; }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return Math.max(0, ...this.rows.map(row => row.length)); }
  getDataRange() { return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  getRange(row, col, height = 1, width = 1) {
    const sheet = this;
    return {
      getValues() { return Array.from({ length: height }, (_, i) => Array.from({ length: width }, (_, j) => sheet.rows[row - 1 + i]?.[col - 1 + j] ?? '')); },
      setValues(values) {
        values.forEach((cells, i) => cells.forEach((value, j) => {
          sheet.rows[row - 1 + i] ||= [];
          sheet.rows[row - 1 + i][col - 1 + j] = value;
        }));
        return this;
      },
      setNumberFormat() { return this; }, setFontWeight() { return this; },
    };
  }
  appendRow(row) { this.rows.push(row.slice()); }
  insertRowBefore(row) { this.rows.splice(row - 1, 0, []); }
  setFrozenRows() {}
}

function setup() {
  const databases = new Map([EX_ID, EM_ID].map(id => [id, {
    sheets: new Map(),
    getSheetByName(name) { return this.sheets.get(name) || null; },
    insertSheet(name) { const sheet = new Sheet(); this.sheets.set(name, sheet); return sheet; },
    getSpreadsheetTimeZone() { return 'Asia/Bangkok'; },
  }]));
  const source = databases.get(EX_ID).insertSheet('Exhibition_Data');
  source.rows = [['timestamp', 'visitDate', 'walkin_child_th_1', 'walkin_adult_intl_1',
    'group_school_1', 'group_child_1', 'group_adult_1', 'inspire_activity_1', 'inspire_child_th_1',
    'innovation_activity_1', 'innovation_adult_th_1', 'activity_walkrally_w_child_th', 'activity_other1_name']];
  const fetches = [];
  const locks = {};
  let uuid = 0, failSync = false;
  const cache = new Map();
  const contexts = {};
  for (const [name, filename] of [['emod', 'E-Mod-CodeGs.gs'], ['exhibition', 'Exhibition/Code.gs']]) {
    const lock = { held: false, count: 0,
      waitLock() { assert.equal(this.held, false, 'No nested project lock'); this.held = true; this.count++; },
      releaseLock() { this.held = false; },
    };
    locks[name] = lock;
    const context = vm.createContext({
      console: { error() {}, log() {} }, Date,
      SpreadsheetApp: { openById(id) { assert(databases.has(id), 'Configured database ID'); return databases.get(id); }, flush() {} },
      LockService: { getScriptLock: () => lock },
      Session: { getScriptTimeZone: () => 'Asia/Bangkok' },
      Utilities: {
        getUuid: () => 'report-' + (++uuid),
        formatDate: value => value.toISOString().slice(0, 10),
      },
      ContentService: { MimeType: { JSON: 'json', JAVASCRIPT: 'javascript' }, createTextOutput(body) { return { body, setMimeType() { return this; } }; } },
      CacheService: { getScriptCache: () => ({ get: key => cache.get(key) || null, put: (key, value) => cache.set(key, value) }) },
      UrlFetchApp: { fetch(url, options) {
        assert.equal(locks.exhibition.held, false, 'Source lock released before calling E-MOD');
        fetches.push(JSON.parse(options.payload));
        if (failSync) throw new Error('E-MOD unavailable');
        const result = contexts.emod.doPost({ postData: { contents: options.payload } });
        return { getResponseCode: () => 200, getContentText: () => result.body };
      } },
    });
    vm.runInContext(fs.readFileSync(path.join(ROOT, filename), 'utf8'), context, { filename });
    contexts[name] = context;
  }
  function post(name, body) { return JSON.parse(contexts[name].doPost({ postData: { contents: JSON.stringify(body) } }).body); }
  function read(date = DATE) { return plain(contexts.emod.emodGetByDate_(date).data); }
  function save(data) { return post('exhibition', { visitDate: DATE, ...data }); }
  return { databases, contexts, source, locks, fetches, post, read, save, failSync(value) { failSync = value; } };
}

test('one save writes DBExhibition and DBEMOD; both dashboard readers use DBEMOD', () => {
  const app = setup();
  const result = app.save({ walkin_child_th_1: '12', walkin_adult_intl_1: '3',
    group_school_1: 'School', group_child_1: '20', group_adult_1: '2',
    inspire_activity_1: 'Lab', inspire_child_th_1: '8', innovation_adult_th_1: '4', activity_walkrally_w_child_th: '5' });
  assert.equal(result.saved, true);
  assert.equal(result.sync.ok, true);
  assert.deepEqual(app.fetches, [{ action: 'syncExhibition', date: DATE }]);
  assert.equal(app.source.getLastRow(), 2);
  assert.equal(app.databases.get(EX_ID).getSheetByName('EMod'), null);
  const report = app.read();
  assert.equal(report.visitorCounts.exWalkin.childTh, 12);
  assert.equal(report.visitorCounts.groups[0].school, 'School');
  assert.equal(report.sumTotal, 54);
  assert(report.exhibitionSyncedAt);
  const income = app.post('emod', { action: 'update', data: { ...report, recorder: 'Alice', revenue: { walkinOnsite: { inspireLab: 500 } } } });
  assert(!income.error);
  const dashboard = plain(app.contexts.exhibition.readEmodReports_());
  assert.equal(dashboard[0].visitorCounts.exWalkin.childTh, 12);
  assert.equal(dashboard[0].revenue.walkinOnsite.inspireLab, 500);
  assert.equal(plain(app.contexts.exhibition.readFinance_())[0].revenue.walkinOnsite.inspireLab, 500);
});

test('sync preserves MOD income/team/evening/seniors and clears deleted source counts and activities', () => {
  const app = setup();
  app.save({ walkin_child_th_1: '10', group_school_1: 'School', group_child_1: '3', inspire_child_th_1: '8', activity_walkrally_w_child_th: '2' });
  const initial = app.read();
  initial.visitorCounts.exWalkin.senior = 4;
  const manual = app.post('emod', { action: 'update', data: { ...initial, recorder: 'Alice', mod: 'Bob', signer: 'Alice',
    evening: { vsCounter2: { notes: 'Keep me' } }, specialActivities: ['Event'], revenue: { groupOnline: { camp: 900 } } } });
  assert(!manual.error);
  const id = manual.data.id;
  app.save({ walkin_child_th_1: '0', group_school_1: '', group_child_1: '', inspire_child_th_1: '', activity_walkrally_w_child_th: '0' });
  const report = app.read();
  assert.equal(report.id, id);
  assert.equal(report.visitorCounts.exWalkin.childTh, 0);
  assert.equal(report.visitorCounts.exWalkin.senior, 4);
  assert.equal(report.visitorCounts.groupCount, 0);
  assert.deepEqual(report.visitorCounts.groups, []);
  assert.equal(report.activityRounds.inspireLab[0].childTh, 0);
  assert.equal(report.otherActivities[0].w_childTh, 0);
  assert.equal(report.sumTotal, 4);
  assert.equal(report.revenue.groupOnline.camp, 900);
  assert.equal(report.mod, 'Bob');
  assert.equal(report.signer, 'Alice');
  assert.equal(report.evening.vsCounter2.notes, 'Keep me');
  assert.deepEqual(report.specialActivities, ['Event']);
});

test('saving a stale E-MOD form retains the latest committed Exhibition totals', () => {
  const app = setup();
  app.save({ walkin_child_th_1: '10' });
  const stale = app.read();
  app.save({ walkin_child_th_1: '99' });
  const result = app.post('emod', { action: 'update', data: { ...stale, recorder: 'Alice', revenue: { walkinOnsite: { inspireLab: 200 } } } });
  assert(!result.error);
  assert.equal(result.data.visitorCounts.exWalkin.childTh, 99);
  assert.equal(result.data.revenue.walkinOnsite.inspireLab, 200);
  assert.equal(app.locks.emod.held, false);
  assert(app.locks.emod.count >= 3);
});

test('sync failure retains source save; retry pulls latest data and does not create duplicate dates', () => {
  const app = setup();
  app.failSync(true);
  const result = app.save({ walkin_child_th_1: '5' });
  assert.equal(result.ok, true);
  assert.equal(result.sync.ok, false);
  assert.equal(app.source.getLastRow(), 2);
  assert.equal(app.read(), null);
  app.failSync(false);
  app.save({ walkin_child_th_1: '7' });
  app.post('emod', { action: 'syncExhibition', date: DATE, data: { walkin_child_th_1: '999' } });
  assert.equal(app.read().visitorCounts.exWalkin.childTh, 7, 'Payload counts are ignored');
  assert.equal(app.databases.get(EM_ID).getSheetByName('EMod').getLastRow(), 2);
});

test('new E-MOD form can claim an auto-created report; recorder/editor validation stays enforced', () => {
  const app = setup();
  app.save({ walkin_child_th_1: '5' });
  const missing = app.post('emod', { action: 'create', data: { date: DATE } });
  assert.match(missing.error, /ผู้บันทึก/);
  const result = app.post('emod', { action: 'create', data: { date: DATE, recorder: 'Alice', revenue: { walkinOnsite: { camp: 300 } } } });
  assert(!result.error);
  assert.equal(result.data.visitorCounts.exWalkin.childTh, 5);
  const noEditor = app.post('emod', { action: 'update', data: result.data });
  assert.match(noEditor.error, /ผู้แก้ไข/);
  const edited = app.post('emod', { action: 'update', data: { ...result.data, editor: 'Bob' } });
  assert(!edited.error);
  assert.equal(app.databases.get(EM_ID).getSheetByName('EMod').getLastRow(), 2);
});

test('invalid/missing source date is rejected; absent legacy columns preserve manual sections', () => {
  const app = setup();
  assert(app.post('exhibition', { visitDate: '' }).error);
  assert(app.post('emod', { action: 'syncExhibition', date: 'bad' }).error);
  assert(app.post('emod', { action: 'syncExhibition', date: DATE }).error);
  const merged = plain(app.contexts.emod.emodMergeExhibition_({ visitorCounts: { exWalkin: { childTh: 42 } }, activityRounds: { inspireLab: [{ childTh: 2 }] }, otherActivities: [{ name: 'Manual', w_childTh: 8 }] }, { visitDate: DATE }));
  assert.equal(merged.visitorCounts.exWalkin.childTh, 42);
  assert.equal(merged.activityRounds.inspireLab[0].childTh, 2);
  assert.equal(merged.otherActivities[0].name, 'Manual');
});

test('cross-project source date matching accepts Buddhist-era and sheet dates', () => {
  const app = setup();
  app.source.rows.push(['now', '24/10/2569', '11']);
  assert.equal(app.post('emod', { action: 'syncExhibition', date: DATE }).ok, true);
  assert.equal(app.read().visitorCounts.exWalkin.childTh, 11);
  app.source.rows.push(['now', new Date('2026-10-24T12:00:00Z'), '13']);
  assert.equal(app.post('emod', { action: 'syncExhibition', date: DATE }).ok, true);
  assert.equal(app.read().visitorCounts.exWalkin.childTh, 13);
});

test('backfill syncs saved dates, reports failures and can be safely rerun', () => {
  const app = setup();
  app.failSync(true);
  app.save({ walkin_child_th_1: '6' });
  assert.equal(plain(app.contexts.exhibition.syncSavedExhibitionToEmod())[0].error, 'E-MOD unavailable');
  app.failSync(false);
  assert.equal(plain(app.contexts.exhibition.syncSavedExhibitionToEmod())[0].ok, true);
  assert.equal(plain(app.contexts.exhibition.syncSavedExhibitionToEmod())[0].ok, true);
  assert.equal(app.read().visitorCounts.exWalkin.childTh, 6);
  assert.equal(app.databases.get(EM_ID).getSheetByName('EMod').getLastRow(), 2);
});

test('manual E-MOD report can be saved before Exhibition and source sync preserves its income', () => {
  const app = setup();
  const created = app.post('emod', { action: 'create', data: { date: DATE, recorder: 'Alice',
    visitorCounts: { exWalkin: { childTh: 2, senior: 3 } }, revenue: { walkinOnline: { member: 100 } } } });
  assert(!created.error);
  app.save({ walkin_child_th_1: '10' });
  const report = app.read();
  assert.equal(report.id, created.data.id);
  assert.equal(report.visitorCounts.exWalkin.childTh, 10);
  assert.equal(report.visitorCounts.exWalkin.senior, 3);
  assert.equal(report.revenue.walkinOnline.member, 100);
});

test('LINE authorization route uses the existing token verifier without writing either database', () => {
  const app = setup();
  app.contexts.exhibition.verifyToken_ = token => token === 'active-session' ? 'Alice' : null;
  assert.equal(app.post('exhibition', { action: 'validateToken', token: 'active-session' }).user, 'Alice');
  assert.equal(app.post('exhibition', { action: 'validateToken', token: 'expired-session' }).user, null);
  assert.equal(app.source.getLastRow(), 1);
  assert.equal(app.databases.get(EM_ID).getSheetByName('EMod'), null);
});
