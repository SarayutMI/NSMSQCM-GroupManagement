/** Add this file to the SAME Apps Script project as E-Mod-CodeGs.gs.
 * Configure LINE_CHANNEL_ACCESS_TOKEN and LINE_GROUP_ID in Script Properties.
 * No automatic send trigger: only an authenticated, reviewed send from E-MOD.
 */
const EMOD_LINE_AUTH_URL = 'https://script.google.com/macros/s/AKfycby5RLO-MH-MLQKZujv4nFQh8wq-IGDTSWKdM7I9AwqeDQR1YHntmHupxLIizP_ZKRY/exec';
const EMOD_LINE_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzvszL_VKR80f_yR8wKltgR_FFOmscAT6Rtld_-qufkvbPCdS4MUQUwvwJfV4lAwdS2Ew/exec';

/** Run from the editor: open a 30-minute, key-protected group-discovery window.
 * Apps Script does not expose LINE's signature header. This is ONLY for setup:
 * group membership/name is checked through LINE and the owner must confirm in
 * the editor. Incoming events can never send reports or change the destination.
 */
function prepareLineGroupSetup() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('LINE_CHANNEL_ACCESS_TOKEN')) throw new Error('กรุณาตั้ง LINE_CHANNEL_ACCESS_TOKEN ก่อน');
  // Running in the editor can make getService().getUrl() return /dev, which
  // requires editor access. LINE must call the deployed public /exec endpoint.
  const url = (props.getProperty('LINE_WEBAPP_URL') || EMOD_LINE_WEBAPP_URL).trim();
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)) {
    throw new Error('LINE_WEBAPP_URL ต้องเป็น Web App URL ที่ลงท้าย /exec จาก Manage deployments');
  }
  const key = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  props.setProperty('LINE_GROUP_SETUP_KEY', key);
  props.setProperty('LINE_GROUP_SETUP_EXPIRES', String(Date.now() + 30 * 60 * 1000));
  props.deleteProperty('LINE_GROUP_CANDIDATE');
  props.deleteProperty('LINE_GROUP_SETUP_STATUS');
  const webhookUrl = url + '?setupKey=' + encodeURIComponent(key);
  console.log('Webhook URL (ใช้ได้ 30 นาที): ' + webhookUrl);
  return webhookUrl;
}

function emodLineGroupSummary_(groupId) {
  if (!/^C[0-9a-f]{32}$/i.test(groupId)) throw new Error('groupId ไม่ถูกต้อง');
  const token = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');
  if (!token) throw new Error('กรุณาตั้ง LINE_CHANNEL_ACCESS_TOKEN ก่อน');
  const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/group/' + groupId + '/summary', {
    headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) throw new Error('ตรวจกลุ่มกับ LINE ไม่สำเร็จ (HTTP ' + res.getResponseCode() + ') ตรวจ token และการเชิญบอตเข้ากลุ่ม');
  const result = JSON.parse(res.getContentText());
  if (result.groupId !== groupId || !result.groupName) throw new Error('ข้อมูลกลุ่มจาก LINE ไม่ถูกต้อง');
  return { groupId: result.groupId, groupName: result.groupName };
}

function emodLineCaptureGroup_(e, body) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const props = PropertiesService.getScriptProperties();
    const key = props.getProperty('LINE_GROUP_SETUP_KEY');
    const expires = Number(props.getProperty('LINE_GROUP_SETUP_EXPIRES'));
    if (!key || !e.parameter || e.parameter.setupKey !== key || !expires || Date.now() >= expires) {
      return { error: 'ปิดรับข้อมูลกลุ่ม กรุณารัน prepareLineGroupSetup ใหม่จาก editor' };
    }
    // LINE's Verify button sends an empty events array.
    console.log('LINE setup events: ' + JSON.stringify(body.events.map(event => ({
      event: event && event.type, chat: event && event.source && event.source.type,
    }))));
    const ids = [...new Set(body.events.filter(event => event && (event.type === 'join' || event.type === 'message') &&
      event.source && event.source.type === 'group').map(event => event.source.groupId))];
    for (const groupId of ids.slice(0, 5)) {
      const group = emodLineGroupSummary_(groupId);
      const expected = (props.getProperty('LINE_EXPECTED_GROUP_NAME') || 'รายงานประจำวัน').trim();
      console.log('LINE group name: ' + JSON.stringify(group.groupName) + '; expected: ' + JSON.stringify(expected));
      if (group.groupName.trim() !== expected) {
        const message = 'ได้รับข้อมูลจากกลุ่ม "' + group.groupName + '" แต่ตั้งชื่อกลุ่มเป้าหมายเป็น "' + expected + '"';
        props.setProperty('LINE_GROUP_SETUP_STATUS', message);
        console.log(message);
        continue;
      }
      props.setProperty('LINE_GROUP_CANDIDATE', JSON.stringify(group));
      props.deleteProperty('LINE_GROUP_SETUP_STATUS');
      console.log('พบกลุ่มจาก LINE: ' + group.groupName + ' (' + group.groupId + ') — รัน confirmLineGroupSetup เพื่อยืนยันปลายทาง');
    }
    return { ok: true };
  } finally { lock.releaseLock(); }
}

/** Run ONLY from the Apps Script editor after checking the candidate group. */
function confirmLineGroupSetup() {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const props = PropertiesService.getScriptProperties();
    const raw = props.getProperty('LINE_GROUP_CANDIDATE');
    if (!raw) throw new Error(props.getProperty('LINE_GROUP_SETUP_STATUS') || 'ยังไม่พบกลุ่ม กรุณารัน checkLineGroupSetup เพื่อตรวจ Webhook');
    const group = emodLineGroupSummary_(JSON.parse(raw).groupId);
    if (group.groupName.trim() !== (props.getProperty('LINE_EXPECTED_GROUP_NAME') || 'รายงานประจำวัน').trim()) {
      throw new Error('ชื่อกลุ่มไม่ตรงกับกลุ่มรายงานประจำวัน กรุณาตรวจปลายทางใหม่');
    }
    props.setProperty('LINE_GROUP_ID', group.groupId);
    props.setProperty('LINE_GROUP_NAME', group.groupName);
    ['LINE_GROUP_SETUP_KEY', 'LINE_GROUP_SETUP_EXPIRES', 'LINE_GROUP_CANDIDATE'].forEach(key => props.deleteProperty(key));
    console.log('ตั้งกลุ่มปลายทางแล้ว: ' + group.groupName + ' — ปิด Use webhook ใน LINE Developers ได้เลย');
    return group;
  } finally { lock.releaseLock(); }
}

/** Owner-only diagnostics. Logs no token, setup key, or full webhook URL. */
function checkLineGroupSetup() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('LINE_CHANNEL_ACCESS_TOKEN');
  const notes = [];
  if (!token) { console.log('ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN'); return; }
  const key = props.getProperty('LINE_GROUP_SETUP_KEY');
  const expires = Number(props.getProperty('LINE_GROUP_SETUP_EXPIRES'));
  notes.push(key && expires > Date.now() ? 'ช่วงรับกลุ่ม: เปิดอยู่' : 'ช่วงรับกลุ่ม: ปิดหรือหมดอายุ ต้องรัน prepareLineGroupSetup และเปลี่ยน Webhook URL ให้ตรงกัน');
  const query = path => {
    const res = UrlFetchApp.fetch('https://api.line.me' + path, {
      headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) throw new Error('LINE HTTP ' + res.getResponseCode() + ' กรุณาตรวจ Channel access token');
    return JSON.parse(res.getContentText());
  };
  try {
    const bot = query('/v2/bot/info');
    notes.push('บอตของ token นี้: ' + bot.basicId + ' (' + bot.displayName + ')' + (bot.basicId === '@849xixkr' ? '' : ' — ไม่ตรงกับ @849xixkr'));
    const webhook = query('/v2/bot/channel/webhook/endpoint');
    notes.push('Use webhook: ' + (webhook.active ? 'เปิด' : 'ปิด — กรุณาเปิดใน LINE Developers'));
    const expectedUrl = (props.getProperty('LINE_WEBAPP_URL') || EMOD_LINE_WEBAPP_URL).trim();
    const endpoint = String(webhook.endpoint || '');
    notes.push(endpoint.split('?')[0] === expectedUrl ? 'Webhook ชี้ deployment ถูกต้อง' : 'Webhook ชี้ URL ไม่ตรงกับ LINE_WEBAPP_URL');
    const match = endpoint.match(/[?&]setupKey=([^&]*)/);
    notes.push(key && match && decodeURIComponent(match[1]) === key ? 'setupKey ใน LINE ตรงกับค่าปัจจุบัน' : 'setupKey ใน LINE ไม่ตรง ต้องนำ URL จาก prepareLineGroupSetup ครั้งล่าสุดไป Update ใหม่');
    try {
      const res = UrlFetchApp.fetch(expectedUrl + '?action=lineSetupHealth', { muteHttpExceptions: true });
      const health = JSON.parse(res.getContentText());
      notes.push(health.lineSetupReceiver ? 'deployment มีโค้ดรับกลุ่มแล้ว' : 'deployment ยังไม่มีโค้ดรับกลุ่ม: อัปเดต Code.gs และ E-Mod-Line.gs แล้ว Deploy New version');
    } catch (err) { notes.push('ตรวจ deployment ไม่สำเร็จ: ตรวจ URL และสิทธิ์ Web App ให้ Anyone'); }
  } catch (err) { notes.push(err.message); }
  notes.push(props.getProperty('LINE_GROUP_CANDIDATE') ? 'พบข้อมูลกลุ่มแล้ว รัน confirmLineGroupSetup ได้' : 'ยังไม่มีข้อมูลกลุ่มที่ตรงชื่อ');
  if (props.getProperty('LINE_GROUP_SETUP_STATUS')) notes.push(props.getProperty('LINE_GROUP_SETUP_STATUS'));
  console.log(notes.join('\n'));
  return notes;
}

function emodLineAuthenticate_(token) {
  if (!token || typeof token !== 'string') throw new Error('unauthorized');
  const res = UrlFetchApp.fetch(EMOD_LINE_AUTH_URL, {
    method: 'post', contentType: 'text/plain;charset=utf-8',
    payload: JSON.stringify({ action: 'validateToken', token: token }), muteHttpExceptions: true,
  });
  let result;
  try { result = JSON.parse(res.getContentText()); }
  catch (err) { throw new Error('ตรวจสิทธิ์ไม่ได้ กรุณาอัปเดต Exhibition Code.gs'); }
  if (res.getResponseCode() !== 200 || !result || !result.user) throw new Error('unauthorized');
  return result.user;
}

function emodLineHash_(value) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8));
}

function emodLineThaiDate_(date) {
  if (!emodValidDate_(date)) throw new Error('วันที่ไม่ถูกต้อง');
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  if (value.toISOString().slice(0, 10) !== date) throw new Error('วันที่ไม่ถูกต้อง');
  const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  return 'วัน' + days[value.getUTCDay()] + 'ที่ ' + day + ' ' + months[month - 1] + ' ' + (year + 543);
}

/** Pure formatter. Counts use the same categories/calculation as E-MOD Dashboard. */
function emodLineFormat_(report) {
  const n = value => Number(value) || 0;
  const fmt = value => n(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const summary = emodSummary_(report);
  const categories = summary.rows;
  const exhibit = { label: 'นิทรรศการ' };
  EMOD_CATS.concat(['total']).forEach(key => {
    exhibit[key] = categories.filter(row => row.key === 'exWalkin' || row.key === 'exGroup')
      .reduce((sum, row) => sum + row[key], 0);
  });
  const rows = [exhibit].concat(categories.filter(row => row.key !== 'exWalkin' && row.key !== 'exGroup'));
  const children = row => n(row.childTh) + n(row.childFor);
  const adults = row => n(row.adultTh) + n(row.adultFor);
  const ages = row => [children(row) ? 'เด็ก ' + fmt(children(row)) + ' คน' : '',
    adults(row) ? 'ผู้ใหญ่ ' + fmt(adults(row)) + ' คน' : '',
    row.senior ? 'ผู้สูงอายุ ' + fmt(row.senior) + ' คน' : ''].filter(Boolean).join(', ');
  const detail = row => ['เด็กไทย ' + fmt(row.childTh), 'ผู้ใหญ่ไทย ' + fmt(row.adultTh),
    'เด็กต่างชาติ ' + fmt(row.childFor), 'ผู้ใหญ่ต่างชาติ ' + fmt(row.adultFor),
    row.senior ? 'ผู้สูงอายุ ' + fmt(row.senior) : ''].filter(Boolean).join(' / ') + ' คน';
  const emoji = label => {
    if (label === 'นิทรรศการ') return '🌺';
    if (/inspire/i.test(label)) return '🧪';
    if (/innovation/i.test(label)) return '💡';
    if (/mini.*make/i.test(label)) return '🧩';
    if (/camp|ค่าย/i.test(label)) return '👷‍♂️';
    return '🎯';
  };
  const revenue = report.revenue || {};
  const channelTotal = channel => Object.values(revenue[channel] || {}).reduce((sum, value) => sum + n(value), 0);
  const channels = [['walkinOnsite', 'Walk-in หน้างาน'], ['walkinOnline', 'Walk-in ออนไลน์'],
    ['groupOnsite', 'Group หน้างาน'], ['groupOnline', 'Group ออนไลน์']];
  const totalRevenue = channels.reduce((sum, [key]) => sum + channelTotal(key), 0);
  const onsite = channelTotal('walkinOnsite') + channelTotal('groupOnsite');
  const online = channelTotal('walkinOnline') + channelTotal('groupOnline');
  const payment = [onsite ? 'ชำระหน้างาน ' + fmt(onsite) + ' บาท' : '', online ? 'ชำระออนไลน์ ' + fmt(online) + ' บาท' : ''].filter(Boolean);
  const date = emodLineThaiDate_(report.date);
  const first = ['📊 สรุปยอดประจำวัน ' + date, '', '🏛️ นิทรรศการ รวม ' + fmt(exhibit.total) + ' คน'];
  categories.filter(row => row.key === 'exWalkin' || row.key === 'exGroup').forEach(row => {
    first.push('- ' + row.label + ' ' + fmt(row.total) + ' คน (' + detail(row) + ')');
  });
  const groups = (report.visitorCounts || {}).groups || [];
  if (groups.length) {
    first.push('จำนวนกรุ๊ป ' + fmt(groups.length) + ' กรุ๊ป');
    groups.forEach(group => {
      const count = EMOD_CATS.reduce((sum, cat) => sum + n(group[cat]), 0);
      first.push('  • ' + (group.school || 'ไม่ระบุชื่อโรงเรียน') + ' ' + fmt(count) + ' คน');
    });
  }
  first.push('', '🎯 ผู้เข้าร่วมกิจกรรม');
  let activityTotal = 0;
  categories.filter(row => row.key !== 'exWalkin' && row.key !== 'exGroup' && row.total > 0).forEach(row => {
    activityTotal += row.total;
    first.push('- ' + row.label + ' ' + fmt(row.total) + ' คน (' + detail(row) + ')');
    const rounds = (report.activityRounds || {})[row.key];
    if (rounds) {
      const names = [...new Set(rounds.map(round => String(round.activity || '').trim()).filter(Boolean))];
      if (names.length) first.push('  กิจกรรม: ' + names.join(', '));
    }
  });
  first.push('รวมผู้เข้าร่วมกิจกรรม ' + fmt(activityTotal) + ' คน', '',
    '👤 รวมผู้เข้าชมนิทรรศการและผู้เข้าร่วมกิจกรรมทั้งหมด ' + fmt(summary.total.total) + ' คน',
    '💸 รายได้รวม ' + fmt(totalRevenue) + ' บาท');
  channels.forEach(([key, label]) => { if (channelTotal(key)) first.push('- ' + label + ' ' + fmt(channelTotal(key)) + ' บาท'); });
  if (report.mod) first.push('MOD: ' + report.mod);

  const narrative = ['🌿🛝🌷🙏🏻 รายงานการดำเนินงานของจัตุรัสวิทยาศาสตร์ อพวช. เชียงใหม่ ประจำ' + date, '',
    '💸 รายได้จากการดำเนินงานรวม ' + fmt(totalRevenue) + ' บาท' + (payment.length ? ' (' + payment.join(', ') + ')' : ''), '',
    '👤 จำนวนผู้เข้าชมนิทรรศการและผู้เข้าร่วมกิจกรรมทั้งหมด ' + fmt(summary.total.total) + ' คน แบ่งเป็น'];
  const activeRows = rows.filter(row => row.total > 0);
  activeRows.forEach(row => {
    narrative.push('- ' + emoji(row.label) + ' ' + row.label + ' รวม ' + fmt(row.total) + ' คน' + (ages(row) ? ' (' + ages(row) + ')' : ''));
  });
  if (!activeRows.length) narrative.push('- ยังไม่มีผู้เข้าชมหรือผู้เข้าร่วมกิจกรรมในรายงาน');
  narrative.push('', 'ขอบคุณค่ะ🙏🏻🥰✨');
  const messages = [first.join('\n'), narrative.join('\n')].map(text => ({ type: 'text', text: text }));
  // Do not silently truncate school/activity names or send an incomplete report.
  if (messages.some(message => message.text.length > 5000)) throw new Error('รายงานยาวเกิน 5,000 ตัวอักษรต่อข้อความ กรุณาย่อชื่อหรือรายละเอียดก่อนส่ง');
  return messages;
}

function emodLineBuild_(date) {
  if (!emodValidDate_(date)) throw new Error('วันที่ไม่ถูกต้อง');
  const saved = emodGetByDate_(date).data;
  if (!saved || !saved.recorder || /^Exhibition/.test(saved.recorder)) throw new Error('กรุณาบันทึกรายงาน E-MOD พร้อมผู้บันทึกก่อนเตรียมข้อความ LINE');
  const source = emodReadExhibition_(date);
  const report = source ? emodMergeExhibition_(saved, source) : saved;
  const messages = emodLineFormat_(report);
  const props = PropertiesService.getScriptProperties();
  const groupId = props.getProperty('LINE_GROUP_ID') || '';
  const configured = !!props.getProperty('LINE_CHANNEL_ACCESS_TOKEN') && /^C[0-9a-f]{32}$/i.test(groupId);
  const fingerprint = emodLineHash_(JSON.stringify({ date: date, groupId: groupId, messages: messages,
    updatedAt: saved.updatedAt, sourceTimestamp: source && source.timestamp }));
  return { date: date, messages: messages, fingerprint: fingerprint, configured: configured,
    targetName: props.getProperty('LINE_GROUP_NAME') || 'กลุ่ม LINE ที่ตั้งค่าไว้' };
}

function emodLineAction_(body) {
  const user = emodLineAuthenticate_(body.token);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const preview = emodLineBuild_(body.date);
    if (body.action === 'linePreview') return preview;
    if (body.fingerprint !== preview.fingerprint) throw new Error('ข้อมูลหรือกลุ่มปลายทางเปลี่ยนแล้ว กรุณาเปิดพรีวิวใหม่ก่อนส่ง');
    if (!preview.configured) throw new Error('กรุณาตั้ง LINE_CHANNEL_ACCESS_TOKEN และ LINE_GROUP_ID ใน Script Properties ของ E-MOD');
    const props = PropertiesService.getScriptProperties();
    const groupId = props.getProperty('LINE_GROUP_ID');
    // Message identity excludes save timestamps; saving identical data must not send it twice.
    const deliveryId = emodLineHash_(JSON.stringify({ groupId: groupId, date: body.date, messages: preview.messages }));
    const key = 'LINE_DELIVERY_' + deliveryId;
    const raw = props.getProperty(key);
    let delivery = raw ? JSON.parse(raw) : null;
    if (delivery && delivery.status === 'sent') return { ok: true, alreadySent: true, date: body.date };
    if (delivery && Date.now() - delivery.attemptedAt >= 24 * 3600 * 1000) throw new Error('คำขอเดิมเกิน 24 ชั่วโมงแล้ว กรุณาตรวจข้อความในกลุ่มก่อนลองส่งใหม่');
    if (!delivery) delivery = { retryKey: Utilities.getUuid(), attemptedAt: Date.now(), status: 'pending' };
    props.setProperty(key, JSON.stringify(delivery));
    const response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + props.getProperty('LINE_CHANNEL_ACCESS_TOKEN'), 'X-Line-Retry-Key': delivery.retryKey },
      payload: JSON.stringify({ to: groupId, messages: preview.messages }),
    });
    const status = response.getResponseCode();
    const headers = response.getAllHeaders();
    const acceptedRetry = status === 409 && Object.keys(headers).some(name => name.toLowerCase() === 'x-line-accepted-request-id');
    if (status !== 200 && !acceptedRetry) throw new Error('LINE ไม่รับข้อความ (HTTP ' + status + ') กรุณาตรวจ token สิทธิ์บอต หรือโควตาข้อความ');
    delivery.status = 'sent'; delivery.sentAt = new Date().toISOString(); delivery.user = user;
    props.setProperty(key, JSON.stringify(delivery));
    return { ok: true, date: body.date, sentAt: delivery.sentAt };
  } finally { lock.releaseLock(); }
}
