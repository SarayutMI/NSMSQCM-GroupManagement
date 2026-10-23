# รายงานประจำวันเข้า LINE จากหน้า E-MOD

กด “เตรียมรายงาน LINE” → เข้าระบบด้วยบัญชี Dashboard → ตรวจพรีวิวสองแบบ → กด “ส่งรายงาน 2 แบบเข้ากลุ่ม LINE” ไม่มีการส่งเมื่อบันทึก ไม่มีการตั้งเวลา และบอตไม่ตอบคำสั่งในกลุ่มในเวอร์ชันนี้

แบบที่ 1: ยอดตามหมวด Exhibition — นิทรรศการ Walk-in / Group, โรงเรียน/กรุ๊ป, กิจกรรมและยอดแยกเด็กไทย/ผู้ใหญ่ไทย/ต่างชาติ/ผู้สูงอายุ, ยอดรวม และรายได้แยกช่องทาง

แบบที่ 2: ข้อความ “🌿🛝🌷🙏🏻 รายงานการดำเนินงานของจัตุรัสวิทยาศาสตร์ อพวช. เชียงใหม่…” ตามตัวอย่าง พร้อมวันที่ไทย พ.ศ., รายได้หน้างาน/ออนไลน์, นิทรรศการ, Inspire Lab และกิจกรรมอื่นที่มียอด ชื่อค่ายดึงจากชื่อที่กรอกในแถวกิจกรรมอื่น ๆ เช่น `ค่าย One Day Camp "EDP EV(Electric Vehicle)"` ไม่ได้เดาชื่อจากช่องรายได้ Camp รายการที่ยอดเป็นศูนย์ซ่อนจากแบบที่ 2

ยอดใช้ข้อมูลที่บันทึกใน DBEMOD และรวมกับข้อมูล DBExhibition ล่าสุดก่อนสร้างพรีวิว ถ้าแก้ฟอร์ม E-MOD ค้างไว้จะต้องบันทึกก่อน หากข้อมูลหรือกลุ่มปลายทางเปลี่ยนหลังพรีวิว ระบบให้โหลดพรีวิวใหม่ก่อนส่ง ข้อความอาจนับคนเดิมที่ร่วมหลายกิจกรรมตามวิธีรวมยอดเดิมของระบบ ไม่ใช่จำนวนบุคคลที่ไม่ซ้ำกัน

## 1. สร้าง LINE OA และเปิด Messaging API

1. สร้าง/เปิด LINE Official Account ใน [LINE Official Account Manager](https://manager.line.biz/)
2. เปิดใช้ Messaging API ในการตั้งค่า OA แล้วเลือก Provider ขององค์กร จะมี Messaging API channel ใน [LINE Developers Console](https://developers.line.biz/console/)
3. ใน channel → Messaging API ออก **Channel access token** แล้วเก็บใน Script Properties ของ E-MOD ไม่ใส่ใน GitHub หรือหน้าเว็บ ขั้นตอนรับกลุ่มผ่าน Apps Script ด้านล่างไม่ต้องใช้ Channel secret
4. เปิด **Allow bot to join group chats** เพื่อเชิญ OA เข้ากลุ่ม LINE ปกติ รองรับ OA เพียงหนึ่งบัญชีในกลุ่มเดียวตามข้อกำหนด LINE ไม่ใช่ LINE OpenChat

อ้างอิง: [เริ่มใช้ Messaging API](https://developers.line.biz/en/docs/messaging-api/getting-started/), [บอตในกลุ่ม](https://developers.line.biz/en/docs/messaging-api/group-chats/)

## 2. รับ groupId ผ่าน Apps Script โดยไม่ใช้ Cloudflare

กลุ่มปลายทางคือ **รายงานประจำวัน** ใช้ `source.groupId` จาก event เป็นข้อมูลเบื้องต้น แล้วตรวจชื่อ/การเข้าถึงกลุ่มกับ LINE API อีกครั้ง ระบบไม่เปลี่ยนกลุ่มปลายทางและไม่ส่งรายงานจาก webhook

1. อัปเดต `E-Mod-CodeGs.gs` และ `E-Mod-Line.gs` ในโปรเจกต์ E-MOD เดียวกัน แล้ว Deploy เป็น **New version** โดยใช้ URL `/exec` เดิม
2. ตั้ง `LINE_CHANNEL_ACCESS_TOKEN` และ `LINE_EXPECTED_GROUP_NAME` เป็น `รายงานประจำวัน` ใน Script Properties (หรือรันไฟล์ตั้งค่าส่วนตัวครั้งเดียวที่เตรียมไว้ให้นอก repository)
3. รัน `prepareLineGroupSetup()` จาก Apps Script editor จะได้ **Webhook URL สำหรับตั้งค่า มีอายุ 30 นาที** ใน Execution log URL นี้มี `?setupKey=...` ต่อท้าย ใช้ URL เต็ม ไม่ใส่แค่ `/exec` และไม่แชร์ URL ตั้งค่านี้
4. นำ URL ไปใส่ใน LINE Developers → Messaging API → Webhook settings กด **Verify** แล้วเปิด **Use webhook**
5. เชิญบอต `@849xixkr` เข้ากลุ่ม **รายงานประจำวัน** แล้วพิมพ์ข้อความหนึ่งข้อความ (ถ้าอยู่ในกลุ่มแล้ว เพียงพิมพ์ข้อความ)
6. ใน Apps Script → Executions เปิดรายการ `doPost` จะมี log ชื่อกลุ่ม/รหัสกลุ่ม ตรวจว่าตรงกับกลุ่มที่ต้องการ หรือดู `LINE_GROUP_CANDIDATE` ใน Script Properties
7. รัน `confirmLineGroupSetup()` จาก editor เพื่อตรวจชื่อกลุ่มกับ LINE อีกครั้งและบันทึก `LINE_GROUP_ID` / `LINE_GROUP_NAME` ให้อัตโนมัติ จากนั้นช่องรับข้อมูลตั้งค่าจะปิด
8. ปิด **Use webhook** ได้เลย เพราะการส่งรายงานจาก E-MOD ใช้ Push API ไม่ต้องรับข้อความ หากยังไม่พบกลุ่มภายใน 30 นาที ให้รัน `prepareLineGroupSetup()` และตั้ง URL ใหม่

หาก `confirmLineGroupSetup` แจ้งว่ายังไม่พบกลุ่ม ให้รัน `checkLineGroupSetup` จาก editor จะตรวจบอตของ token, Use webhook, URL/key ที่ LINE ตั้งไว้, อายุช่วงตั้งค่า และเวอร์ชันโค้ดรับกลุ่ม โดยไม่แสดง token หรือ setupKey ใน log ทุกครั้งที่รัน `prepareLineGroupSetup` จะเปลี่ยน key และล้างกลุ่มที่พบก่อนหน้า จึงต้อง Update URL ใน LINE ใหม่และพิมพ์ข้อความในกลุ่มอีกครั้ง อย่ารัน prepare ซ้ำหลังจับกลุ่มแล้ว

Apps Script Web App ไม่เปิด header `x-line-signature` ใน event ที่เอกสารรองรับ วิธีนี้จึงเป็นการรับข้อมูลเพื่อ **ตั้งค่าครั้งเดียว** ผ่าน key ชั่วคราว ตรวจกลุ่มกับ LINE API และให้เจ้าของรันยืนยันเอง ไม่ใช่ตัวรับคำสั่ง chatbot จากข้อความ LINE ที่ยืนยันลายเซ็นแล้ว หากภายหลังต้องการให้บอตตอบคำสั่งในกลุ่ม ควรใช้ตัวรับ webhook ที่ตรวจลายเซ็นได้ เช่น Worker ตัวอย่างที่ยังเก็บไว้ใน `line-webhook/worker.mjs`

อ้างอิง: [ตรวจลายเซ็น LINE webhook](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/), [โครงสร้าง event ของ Apps Script](https://developers.google.com/apps-script/guides/web#request_parameters)

## 3. ตั้งค่า E-MOD Apps Script

ใน **Project Settings → Script Properties** ของโปรเจกต์ E-MOD ตั้งค่า:

| Property | ค่า |
| --- | --- |
| `LINE_CHANNEL_ACCESS_TOKEN` | Channel access token จาก LINE Developers |
| `LINE_WEBAPP_URL` | ไม่บังคับ: URL ของ E-MOD ที่ลงท้าย `/exec` จาก Manage deployments หากสร้าง deployment ใหม่ให้ตั้งค่านี้ URL `/dev` ใช้รับ LINE webhook ไม่ได้ |
| `LINE_EXPECTED_GROUP_NAME` | `รายงานประจำวัน` — ใช้ตรวจชื่อกลุ่มตอนตั้งค่า |
| `LINE_GROUP_ID` | `confirmLineGroupSetup()` จะตั้งให้หลังยืนยันกลุ่ม |
| `LINE_GROUP_NAME` | ชื่อกลุ่มที่ให้ผู้ใช้เห็นในพรีวิว เช่น `รายงานประจำวัน MOD` (ไม่บังคับ) |

การตั้งค่าผ่าน Apps Script ไม่ใช้ Channel secret ส่วน token สำหรับส่งอยู่เฉพาะ E-MOD Apps Script Properties ไฟล์ตั้งค่าที่มี token เป็นไฟล์ส่วนตัวนอก repository ให้รันครั้งเดียวแล้วลบไฟล์ชั่วคราวใน Apps Script ไม่ commit token ลง repository

## 4. อัปเดตโค้ด

1. ใน E-MOD Apps Script อัปเดต `E-Mod-CodeGs.gs` และเพิ่มไฟล์สคริปต์ชื่อ `E-Mod-Line` โดยวางโค้ดจาก `E-Mod-Line.gs` **ในโปรเจกต์เดียวกัน** เพื่อใช้ฟังก์ชันฐานข้อมูลและ ScriptLock ร่วมกัน
2. ใน Exhibition Apps Script อัปเดต `Exhibition/Code.gs` ซึ่งเพิ่ม `action=validateToken` ให้ E-MOD ตรวจสิทธิ์กับบัญชี Dashboard เดิม token ที่หมดอายุหรือผู้ใช้ถูกระงับส่งไม่ได้
3. Deploy ทั้งสองโปรเจกต์เป็น **New version** โดยคง URL `/exec` เดิม ตรวจ `EMOD_LINE_AUTH_URL` ใน `E-Mod-Line.gs` ว่าตรงกับ Web App Exhibition ปัจจุบัน และอนุญาตสิทธิ์ Spreadsheet / external requests หากมีการร้องขอ
4. อัปเดตเว็บด้วย `E-Mod.html`, `E-Mod-Script.js`, `E-Mod-Line.js`, `Exhibition/js/config.js`, `Exhibition/js/api.js` และ `notify-popup.js` แล้ว reload

ขั้นตอนสร้างข้อความและส่งไม่เปิด LINE token ให้ browser และไม่รับข้อความที่ browser แต่งเองไปส่ง ผู้มีบัญชี Dashboard ที่ใช้งานได้มีสิทธิ์ส่งเข้ากลุ่มปลายทางที่ผู้ดูแลตั้งไว้

## 5. ใช้งานและตรวจสอบ

1. บันทึก Exhibition ตามวันที่ แล้วโหลดวันนั้นใน E-MOD
2. กรอกยอดรายได้และข้อมูล MOD เลือกผู้บันทึก/ผู้แก้ไขแล้วบันทึก
3. กด **เตรียมรายงาน LINE** ใช้บัญชี Dashboard เดิมในการ login หากเคย login Dashboard บนเว็บเดียวกันจะใช้ session นั้นได้
4. ตรวจวันที่ ยอดรายได้ ยอดคน ชื่อค่าย และชื่อกลุ่มในพรีวิว หากไม่มี token/groupId จะแสดงพรีวิวได้แต่ปุ่มส่งยังปิดอยู่
5. กด **ส่งรายงาน 2 แบบเข้ากลุ่ม LINE** หนึ่งครั้ง ตรวจข้อความในกลุ่ม ถ้า API ล้มเหลว โหลดพรีวิวใหม่แล้วลองอีกครั้ง ระบบใช้ retry key เดิมกับข้อความชุดเดิมและไม่ส่งชุดที่ LINE รับแล้วซ้ำ หากข้อมูลถูกแก้จริง ข้อความชุดใหม่สามารถส่งได้หลังตรวจพรีวิวอีกครั้ง

LINE รับคำขอ (HTTP 200) ไม่ได้ยืนยันว่าทุกคนอ่านหรือรับข้อความแล้ว ถ้าบอตออกจากกลุ่ม token ผิด หรือโควตาเต็ม จะมีข้อความผิดพลาดให้ตรวจการตั้งค่า การส่งที่ผลลัพธ์ไม่แน่ชัดเกิน 24 ชั่วโมงจะไม่ลองซ้ำอัตโนมัติ เนื่องจาก retry key ของ LINE มีอายุ 24 ชั่วโมง

สองข้อความถูกส่งใน push request เดียว โควตาคิดตามจำนวนผู้รับ ไม่คูณสองตามจำนวน message objects เช่น กลุ่มมีผู้รับ 10 คน ส่งหนึ่งชุดใช้ 10 ข้อความ หากส่งวันละครั้ง 30 วันจะใช้ 300 ข้อความ ยังต้องเผื่อการส่งแก้ไขหรือการส่งอื่นในเดือนเดียวกัน

อ้างอิง: [วิธีนับโควตา](https://developers.line.biz/en/docs/messaging-api/pricing/#how-to-count-the-number-of-messages-sent), [Retry key](https://developers.line.biz/en/docs/messaging-api/retrying-api-request/)

ตรวจด้วยข้อมูลจำลอง: `node --test tests/*.test.cjs tests/*.test.mjs` โดยไม่มีการส่งข้อความหรือเขียนชีทจริง
