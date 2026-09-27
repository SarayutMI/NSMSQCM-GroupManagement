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

| แท็บ | คอลัมน์ | ใช้ทำอะไร |
| --- | --- | --- |
| `Rooms` | รหัส · ชื่อห้อง · จำนวนรอบ · สี · สถานะ | ห้องกิจกรรม เพิ่มแถว = เพิ่มห้องในฟอร์ม + Dashboard |
| `Staff` | ชื่อ · ประเภท (อาสา/เจ้าหน้าที่) · สถานะ | รายชื่อผู้ดำเนินกิจกรรม |
| `Activities` | ห้อง · ชื่อกิจกรรม · สถานะ | รายการกิจกรรมของแต่ละห้อง |
| `Data` | (สร้างอัตโนมัติพร้อมหัวคอลัมน์ตอนรัน `setupSheets()`) | หนึ่งแถวต่อหนึ่งฟอร์มที่บันทึก |

- สถานะ `ซ่อน` = ไม่แสดงใน dropdown ของฟอร์ม แต่ยังอยู่ใน Dashboard ของข้อมูลเก่า
- `รหัส` ของห้อง (a-z, 0-9) ห้ามเปลี่ยนหลังมีข้อมูลแล้ว; `ชื่อห้อง` เปลี่ยนได้ (แก้คอลัมน์ `ห้อง` ใน `Activities` ให้ตรงด้วย)
- ห้ามเปลี่ยนชื่อคน/กิจกรรมที่มีประวัติแล้ว เพราะ `Data` เก็บชื่อเป็นข้อความ

## ติดตั้ง / อัปเดต Code.gs

1. วาง `Code.gs` ทั้งไฟล์ใน Extensions > Apps Script ของ Sheet
2. รัน `setupSheets()` หนึ่งครั้ง (สร้างครบทั้ง 4 แท็บ `Rooms`/`Staff`/`Activities`/`Data` พร้อมหัวคอลัมน์ และตั้ง dropdown ใหม่)
3. Deploy > Manage deployments > Edit > **New version** (URL `/exec` เดิม)
4. ใส่ URL ใน `WEBAPP_URL` ที่ `js/config.js`
