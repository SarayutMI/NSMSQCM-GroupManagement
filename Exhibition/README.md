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

ใช้ Spreadsheet เดียวกับระบบ Group Management (จองห้อง) และรายชื่ออ้างอิงชุดเดียวกัน

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
2. ใส่ ID ของ Spreadsheet Group Management ที่ `DATA_SPREADSHEET_ID` (จาก URL `.../spreadsheets/d/<ID>/edit`)
3. รัน `setupSheets()` หนึ่งครั้ง (อนุญาตสิทธิ์ Spreadsheet + เรียก URL ภายนอก) จะสร้างแท็บ `Exhibition_*` ครบพร้อม dropdown
4. ย้ายข้อมูลเก่า (ถ้ามี): คัดลอกแท็บ `Data` เดิมมาวางเป็น `Exhibition_Data`, `Rooms` เป็น `Exhibition_Rooms`, และชื่ออาสาจากแท็บ `Staff` เดิมลง `Exhibition_Volunteers`
5. Deploy > Manage deployments > Edit > **New version** (URL `/exec` เดิม) หรือ New deployment ถ้าเป็นโปรเจกต์ใหม่
6. ใส่ URL ใน `WEBAPP_URL` ที่ `js/config.js`

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

อ่านตาราง "รายได้" ของ E-Mod จากแท็บ `EMod` ใน Spreadsheet เดียวกัน แยกตามส่วนงาน (Inspire Lab, Camp, ...) และช่องทาง
(Walk-in / Group × On-site / Online) ถ้า E-Mod เพิ่มส่วนงานใหม่ ให้เพิ่มชื่อใน `FIN_SECTIONS` ของ `js/dashboard-views.js`
(ถ้าไม่เพิ่ม จะแสดงด้วยชื่อ key แทน)
