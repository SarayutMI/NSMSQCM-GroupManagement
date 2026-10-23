# Exhibition_Management

แบบบันทึกจำนวนผู้เข้าชมกิจกรรม + Dashboard, เก็บข้อมูลทั้งหมดใน Google Sheet.

## โครงสร้างไฟล์

```
index.html            ฟอร์มบันทึก (โครงหน้า)
dashboard.html        Dashboard (โครงหน้า)
css/base.css          ตัวแปรสี + reset ที่ใช้ร่วมกัน
css/form.css          สไตล์ฟอร์ม + print
css/dashboard.css     สไตล์ Dashboard
js/config.js          WEBAPP_URL (แก้ที่เดียว) + ค่าคงที่/ตัวช่วยที่ใช้ร่วมกัน
js/api.js             คุยกับ Apps Script (อ่านแบบ JSONP, บันทึกแบบ POST)
js/form-render.js     สร้างแถว walk-in / หมู่คณะ / บล็อกแต่ละห้อง / dropdown
js/form-calc.js       สูตรรวมยอดทั้งหมดของฟอร์ม
js/form.js            จุดเริ่มฟอร์ม: โหลด config จาก Sheet, ปุ่มบันทึก
js/dashboard-core.js  state, วันที่, การรวมข้อมูล, กราฟ
js/dashboard-views.js 3 มุมมอง: ผู้เข้าชม / อาสา-เจ้าหน้าที่ / รายกิจกรรม
js/dashboard.js       ตัวควบคุม + โหลดข้อมูล
Code.gs               Google Apps Script (วางใน Apps Script ของ Sheet)
```

## ข้อมูลใน Google Sheet

แยกฐานข้อมูลเป็นสองไฟล์ และใช้รายชื่ออ้างอิงชุดเดียวกับ Group Management:

- DBExhibition: `1tHFy0w7ucsWwTqGbAtIICwUgHCnHeCRKv7tZjN0x24c` — แท็บ `Exhibition_Data` และการตั้งค่า/ผู้ใช้ Dashboard
- DBEMOD: `1FJLd5tucqX1WGTWn9P0NipZwZDSJr73be20_FlIlxz8` — แท็บ `EMod` สำหรับยอดคน รายได้ และข้อมูล MOD

รายชื่ออ้างอิง (ชีตอ้างอิงของ Group Management, Publish to web เป็น CSV — แก้ที่นั่นที่เดียว):

| แท็บ | ใช้ทำอะไร |
| --- | --- |
| `Staff_Name` | รายชื่อผู้ดำเนินกิจกรรม ทุกคนนับเป็น **เจ้าหน้าที่** |
| `Volunteer_Name` | รายชื่อผู้ดำเนินกิจกรรม ทุกคนนับเป็น **อาสา** |
| `Innovation_activity` | กิจกรรมของห้อง `innovation` (ใช้คอลัมน์ภาษาไทย) |
| `InspireLab_activity` | กิจกรรมของห้อง `inspire` (ใช้คอลัมน์ภาษาไทย) |

แท็บของ Exhibition ใน Spreadsheet Group Management (สร้างอัตโนมัติตอนรัน `setupSheets()`):

| แท็บ | คอลัมน์ | ใช้ทำอะไร |
| --- | --- | --- |
| `Exhibition_Rooms` | รหัส · ชื่อห้อง · จำนวนรอบ · สี · สถานะ | ห้องกิจกรรม เพิ่มแถว = เพิ่มห้องในฟอร์ม + Dashboard |
| `Exhibition_Volunteers` | ชื่อ · สถานะ | รายชื่อ **อาสา** เพิ่มเติม (ชื่อที่มีใน `Staff_Name` / `Volunteer_Name` แล้วจะถูกข้าม) |
| `Exhibition_Activities` | ห้อง · ชื่อกิจกรรม · สถานะ | กิจกรรมของห้องที่ไม่มีรายชื่ออ้างอิง (ไม่ใช่ inspire / innovation) |
| `Exhibition_Data` | (สร้างอัตโนมัติพร้อมหัวคอลัมน์) | หนึ่งแถวต่อหนึ่งฟอร์มที่บันทึก |

- รายชื่ออ้างอิงถูก cache ไว้ 5 นาที แก้ในชีตอ้างอิงแล้วรอสักครู่ฟอร์มจะเห็นเอง
- สถานะ `ซ่อน` = ไม่แสดงใน dropdown ของฟอร์ม แต่ยังอยู่ใน Dashboard ของข้อมูลเก่า
- `รหัส` ของห้อง (a-z, 0-9) ห้ามเปลี่ยนหลังมีข้อมูลแล้ว; `ชื่อห้อง` เปลี่ยนได้ (แก้คอลัมน์ `ห้อง` ใน `Exhibition_Activities` ให้ตรงด้วย)
- ห้ามเปลี่ยนชื่อคน/กิจกรรมที่มีประวัติแล้ว เพราะ `Exhibition_Data` เก็บชื่อเป็นข้อความ

## ติดตั้ง / อัปเดต Code.gs

1. script.google.com > New project (ต้องแยกจากโปรเจกต์ Code.gs ของ Group Management) แล้ววาง `Code.gs` ทั้งไฟล์
2. ตรวจ `DATA_SPREADSHEET_ID` (DBExhibition), `EMOD_SPREADSHEET_ID` (DBEMOD) และ `EMOD_API_URL` (Web App ของ E-MOD) ซึ่งตั้งไว้แล้วตามระบบปัจจุบัน
3. รัน `setupSheets()` หนึ่งครั้ง (อนุญาตสิทธิ์ Spreadsheet + เรียก URL ภายนอก) จะสร้างแท็บ `Exhibition_*` ครบพร้อม dropdown
4. ย้ายข้อมูลเก่า (ถ้ามี): คัดลอกแท็บ `Data` เดิมมาวางเป็น `Exhibition_Data`, `Rooms` เป็น `Exhibition_Rooms`, และชื่ออาสาจากแท็บ `Staff` เดิมลง `Exhibition_Volunteers`
5. Deploy > Manage deployments > Edit > **New version** (URL `/exec` เดิม) หรือ New deployment ถ้าเป็นโปรเจกต์ใหม่
6. ใส่ URL ใน `WEBAPP_URL` ที่ `js/config.js`

## อัปเดตการ sync Exhibition → E-MOD

ลำดับการทำงาน: หน้า Exhibition → Exhibition `Code.gs` บันทึก `Exhibition_Data` → เรียก E-MOD `Code.gs` ด้วยวันที่ → E-MOD อ่านแถวล่าสุดจาก DBExhibition แล้วรวมกับรายงานใน DBEMOD

ผู้เขียน DBEMOD ทั้งการ sync และการบันทึกรายได้ใช้ E-MOD Apps Script โปรเจกต์เดียวกัน จึงใช้ `ScriptLock` เดียวกันได้ การเปิดฟอร์ม E-MOD ค้างไว้แล้วบันทึกรายได้จะดึงยอดล่าสุดจาก DBExhibition ก่อนเขียน ป้องกันยอดคนเก่าจากหน้าเว็บทับข้อมูลใหม่

ขั้นตอนเปิดใช้งาน (ต้องอัปเดตทั้ง Apps Script และไฟล์หน้าเว็บ):

1. บัญชีที่ใช้รัน Web App ทั้งสองตัวต้องมีสิทธิ์อ่านทั้งสอง Spreadsheet และ E-MOD ต้องแก้ไข DBEMOD ได้
2. วางไฟล์ `../E-Mod-CodeGs.gs` ทั้งไฟล์ในโปรเจกต์ Apps Script ของ E-MOD แล้วรัน `emodGetSheet_` จาก editor หนึ่งครั้งเพื่ออนุญาตสิทธิ์ จากนั้น Deploy → Manage deployments → Edit → **New version** โดยใช้ `/exec` เดิม
3. วางไฟล์ `Code.gs` ทั้งไฟล์ในโปรเจกต์ Exhibition รัน `setupSheets()` เพื่ออนุญาตสิทธิ์ Spreadsheet/UrlFetch แล้ว Deploy → **New version** โดยใช้ `/exec` เดิม หาก URL E-MOD เปลี่ยน ต้องเปลี่ยน `EMOD_API_URL` ในไฟล์นี้ และ `CONFIG.API_URL` ใน `../E-Mod-Script.js` ให้ตรงกัน
4. อัปเดตเว็บด้วย `js/api.js`, `js/form.js`, `../E-Mod.html`, `../E-Mod-Script.js`, `../E-Mod-Dashboard.js` และ `../notify-popup.js` แล้วโหลดหน้าใหม่
5. ทดลองบันทึกวันที่ทดสอบจาก Exhibition: ต้องมีรายงานวันที่เดียวกันใน `Exhibition_Data` ของ DBExhibition และ `EMod` ของ DBEMOD จากนั้นเปิดฟอร์ม E-MOD ด้วยวันนั้น กรอกรายได้และผู้บันทึก แล้วบันทึก ตรวจ Dashboard ด้วยปุ่มรีเฟรช

ยอดคน กรุ๊ป และกิจกรรมมาจาก Exhibition รวมถึงการแก้เป็นศูนย์/ลบรายการ ส่วนรายได้ ทีม MOD ผู้ลงชื่อ Evening Briefing และกิจกรรมพิเศษคงค่าที่กรอกใน E-MOD ผู้สูงอายุไม่มีใน Exhibition จึงกรอกเพิ่มใน E-MOD ได้ หลัง sync ช่องที่รับจาก Exhibition จะแสดงให้อ่าน โดยแก้จากต้นทางและกด “โหลดตามวันที่” ใน E-MOD เพื่อดูยอดใหม่

หน้า Exhibition อ่านผลตอบกลับจริง แยก “บันทึกต้นทางสำเร็จ” จาก “sync สำเร็จ” หาก sync ไม่สำเร็จ ข้อมูลต้นทางยังอยู่ และกดบันทึกอีกครั้งเพื่อลองส่งใหม่ได้ ไม่ได้เป็นธุรกรรมเดียวที่รับประกันว่าทั้งสองฐานสำเร็จพร้อมกัน

นำข้อมูลเก่าหรือวันที่ตกค้างมา sync: ใน Exhibition Apps Script ตั้ง `START_DATE` / `END_DATE` ใน `syncSavedExhibitionToEmod()` ให้ครอบคลุมไม่เกิน 30 วันที่มีข้อมูลต่อครั้ง แล้วรันฟังก์ชันจาก editor ทำซ้ำวันเดิมได้โดยไม่สร้างรายงานซ้ำและไม่ทับรายได้ ต้องใช้ข้อมูลจาก `Exhibition_Data` เท่านั้น ฟังก์ชันนี้ไม่ย้ายรายได้/ข้อมูล MOD จากแท็บ `EMod` เก่าที่อาจอยู่ผิดไฟล์

Dashboard E-MOD และแท็บการเงินของ Exhibition อ่าน DBEMOD ผ่าน Exhibition backend โดยยังใช้ login เดิม มี cache ฝั่ง server 120 วินาที กดรีเฟรชเพื่อข้าม cache ได้ ฟอร์ม E-MOD ที่เปิดอยู่ต้องกดโหลดตามวันที่เพื่อแสดงการ sync ครั้งใหม่

ตรวจโค้ดด้วยข้อมูลจำลองโดยไม่แตะชีทจริง: `node --test tests/emod-sync.test.cjs` จากโฟลเดอร์หลักของ repository

การส่งรายงานประจำวันสองแบบเข้ากลุ่ม LINE จากหน้า E-MOD ดู [LINE-SETUP.md](../LINE-SETUP.md) ต้องเพิ่ม `E-Mod-Line.gs` ในโปรเจกต์ E-MOD และตั้ง LINE token / groupId ฝั่ง Apps Script ก่อนใช้

## Login ของ Dashboard

Dashboard ต้องเข้าสู่ระบบด้วย **ชื่อผู้ใช้ + PIN** (ฟอร์มบันทึกไม่ต้อง) Apps Script ตรวจ token ทุกครั้งที่ดึงข้อมูล
ถึงจะรู้ URL `/exec` ก็ดึงข้อมูล Dashboard ไม่ได้ถ้าไม่ได้ login

แท็บ `Dashboard_Users` (สร้างให้เองตอนรัน `setupSheets()`):

| username | PIN ใหม่ | salt | pinHash | สถานะ | เข้าระบบล่าสุด |
|---|---|---|---|---|---|

- **เพิ่มผู้ใช้ / ตั้ง PIN ใหม่:** พิมพ์ `username` และ PIN ในช่อง `PIN ใหม่` แล้วรอให้มีคน login ครั้งถัดไป
  (หรือรัน `hashPendingPins()` จาก editor ทันที) ระบบจะเก็บเป็น salt + SHA-256 hash แล้วลบ PIN ตัวจริงทิ้ง
- **ระงับผู้ใช้:** ตั้ง `สถานะ` เป็น `ระงับ` (มีผลทันที แม้คนนั้น login ค้างไว้อยู่)
- ใส่ PIN ผิด 5 ครั้งติดกัน ชื่อนั้นจะถูกล็อก 15 นาที
- login ค้างได้ 12 ชั่วโมงต่อครั้ง
- แนะนำ PIN อย่างน้อย 6 หลัก และอย่าแชร์สิทธิ์แก้ไขชีตนี้กับคนที่ไม่ใช่ผู้ดูแล

## แท็บการเงิน

อ่านตาราง "รายได้" ของ E-Mod จากแท็บ `EMod` ใน DBEMOD (`EMOD_SPREADSHEET_ID`) แยกตามส่วนงาน (Inspire Lab, Camp, ...) และช่องทาง
(Walk-in / Group × On-site / Online) ถ้า E-Mod เพิ่มส่วนงานใหม่ ให้เพิ่มชื่อใน `FIN_SECTIONS` ของ `js/dashboard-views.js`
(ถ้าไม่เพิ่ม จะแสดงด้วยชื่อ key แทน)
