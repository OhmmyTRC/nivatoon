# NIVATOON Flutter & Mobile PWA Integration Guide (`FLUTTER_API_GUIDE.md`)

คู่มือเชื่อมแอปมือถือ **Flutter** และติดตั้งเว็บแอปเป็น **PWA บนมือถือ (Android / iOS)**

---

## 1. การยืนยันตัวตนจาก Flutter ด้วย Bearer Token

API ของ NIVATOON รองรับทั้ง Cookie (สำหรับเว็บ/PWA) และ **`Authorization: Bearer <token>`** (สำหรับ Flutter):

1. **เข้าสู่ระบบ / สมัครสมาชิก**
   - `POST /api/auth/login` body `{ "email": "...", "password": "..." }` → ตอบกลับ `{ "ok": true, "token": "<session_token>", "user": { ... }, "requiresSecurityGate": true }`
   - `POST /api/auth/register` body `{ "email": "...", "password": "...", "displayName": "...", "pin": "123456" }` → คืน `token` ใหม่ที่เริ่มต้น `0 เหรียญ` และ `3 ตั๋วอ่านฟรี`
2. **ปลดล็อก PIN / ลายนิ้วมือ**
   - `POST /api/auth/security` header `Authorization: Bearer <token>` body `{ "action": "verify_pin", "pin": "123456" }` → ตอบกลับ `{ "ok": true, "unlocked": true, "token": "<unlocked_token>" }`
   - บันทึก `unlocked_token` ลงใน `flutter_secure_storage` และส่ง `Authorization: Bearer <unlocked_token>` ในทุก Request ถัดไป
3. **กู้คืนรหัสผ่านด้วย OTP 6 หลัก**
   - `POST /api/auth/forgot-password` `{ "email": "..." }`
   - `POST /api/auth/reset-password` `{ "email": "...", "code": "123456", "newPassword": "..." }`

---

## 2. Mobile Bootstrap API (โหลดข้อมูลหลักใน 1 Request)

- **`GET /api/mobile/bootstrap`** (`Authorization: Bearer <token>`)
  - คืนข้อมูลครบในครั้งเดียว:
    - `authenticated`, `unlocked`, `user` (รวม `coinBalance`, `freePassTickets`, `checkinDay`, `themeMode`, `role`)
    - `series` (แคตตาล็อกเรื่องทั้งหมด + รายการตอน + URL ภาพ `/comics/...`)
    - `notifications` (ประกาศ / โปรโมชั่นที่เปิดอยู่)
    - `paymentConfig` (`promptpayId: "1709700341765"`, `truemoneyId: "0997353282"`, `accountName: "ธีรชาติ เครือวัลย์"`, `packages`)
    - `bundle` (รายการติดตาม, ตอนที่ซื้อแล้ว, ประวัติการอ่าน, ประวัติเติมเงิน)

---

## 3. ตัวอย่าง Endpoint สำคัญสำหรับ Flutter (`http` / `dio`)

| หน้าที่ | Method & Path | หมายเหตุ |
| :--- | :--- | :--- |
| เช็กอินรับตั๋วอ่านฟรี | `POST /api/user-action` | `{ "action": "daily_checkin" }` (วันที่ 1-6 ได้ +1, วันที่ 7 ได้ +3) |
| สแกนสลิปดึงเลขอ้างอิง | `POST /api/wallet/scan-slip` | `multipart/form-data` field `slip` (File) |
| ยืนยันชำระเงิน & เติมเหรียญ/Plus | `POST /api/wallet/verify-topup` | `multipart/form-data`: `packageId`, `provider`, `slip` (File), `reference` |
| ขอสิทธิ์ครีเอเตอร์พร้อมงานตัวอย่าง | `POST /api/creator-request` | `multipart/form-data`: `penName`, `sampleTitle`, `portfolioNote`, `cover`, `pages` |
| แก้ไขโปรไฟล์ & อัปโหลดรูป | `POST /api/profile` | `multipart/form-data`: `displayName`, `bio`, `avatarFrame`, `bannerTheme`, `avatar` |
| ตั้งค่าธีม (Light/Dark) | `POST /api/settings` | `{ "themeMode": "light" \| "dark" }` |
| เปลี่ยนรหัสผ่าน | `POST /api/auth/change-password` | `{ "currentPassword": "...", "newPassword": "..." }` |
| เปลี่ยนรหัส PIN 6 หลัก | `POST /api/auth/change-pin` | `{ "currentPin": "123456" \| "currentPassword": "...", "newPin": "654321" }` |
| แจ้งปัญหาการใช้งาน | `GET / POST /api/issues` | ส่งหัวข้อ หมวดหมู่ รายละเอียด ดูสถานะและการตอบกลับจาก Admin |
| การแจ้งเตือน & โปรโมชั่น | `GET / POST /api/notifications` | `GET` รับรายการ + `unreadCount`, `POST { "markAll": true }` ทำเครื่องหมายอ่านแล้ว |

---

## 4. ติดตั้งเป็นแอปมือถือทันที (PWA Install)

เว็บแอปนี้ติดตั้ง `manifest.webmanifest`, `sw.js`, และไอคอน 192px / 512px แล้ว:
- **Android (Chrome / Edge):** กดเมนูมุมขวาบน → **"ติดตั้งแอป (Install app)"** หรือกดปุ่ม **"ติดตั้งแอปมือถือ"** ในหน้าโปรไฟล์/ตั้งค่า
- **iOS (Safari):** กดปุ่ม **Share (แชร์)** ด้านล่าง → เลือก **"เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)"**
