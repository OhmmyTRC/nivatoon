# NIVATOON Cloud Architecture & Mobile App Guide (`FLUTTER_API_GUIDE.md`)

คู่มือสถาปัตยกรรมระบบ **NIVATOON** ฉบับสมบูรณ์:
- **คลังเก็บไฟล์ภาพ (File Storage):** GitHub Repository [`OhmmyTRC/nivatoon`](https://github.com/OhmmyTRC/nivatoon)
- **ฐานข้อมูลคลาวด์ (Cloud Database):** Firebase Project `niva-421c2` (Cloud Firestore & Realtime Database)
- **แอปพลิเคชันแสดงผล (Exported Android App):** `nivatoon-release.apk` (และ `public/nivatoon-release.apk`)

---

## 1. สถาปัตยกรรม GitHub File Storage (`OhmmyTRC/nivatoon`)

ไฟล์ภาพการ์ตูนทั้งหมด ปกเรื่อง หน้าตอน (`001.jpg`..`034.jpg`) และผลงานตัวอย่างถูกจัดเก็บไว้บน GitHub:

- **Manifest ดัชนีการ์ตูนทั้งหมด:**
  `https://raw.githubusercontent.com/OhmmyTRC/nivatoon/main/public/comics/manifest.json`
- **โครงสร้างไฟล์การ์ตูนบน GitHub (`public/comics/`):**
  - `public/comics/01-moonlit-sword/` (`cover.jpg`, `meta.json`, `ep-01/001.jpg`..`004.jpg`, `ep-02/`, `ep-03/`)
  - `public/comics/02-palace-bloom/` .. `public/comics/10-duchess-contract/`
  - `public/comics/11Absolute-Regression-หวนคืนนิรันดร์กาล/` (`cover.jpg`, `meta.json`, `ep-01/Absolute-Regression-ep1-1.jpg`..`34.jpg` ครบ 34 หน้าเต็ม)
- **การอัปโหลดไฟล์ใหม่ขึ้น GitHub อัตโนมัติ (`src/lib/github-storage.ts`):**
  - เมื่อครีเอเตอร์อัปโหลดเรื่อง/ตอนใหม่ในหน้า Studio (`POST /api/studio/upload`) หรือผู้ใช้ส่งผลงานตัวอย่างขอสิทธิ์ครีเอเตอร์ (`POST /api/creator-request`) ระบบจะสร้าง `public/comics/manifest.json` ใหม่ และอัปโหลดไฟล์ขึ้น GitHub ทั้งผ่าน **GitHub Contents REST API** (เมื่อใส่ `GITHUB_TOKEN`) และ **Git CLI Push (`git push origin main`)**

---

## 2. สถาปัตยกรรมฐานข้อมูล Firebase (`niva-421c2`)

ระบบเชื่อมต่อฐานข้อมูล Firebase ทั้ง **Cloud Firestore (`niva-421c2`)** และ **Firebase Realtime Database (`https://niva-421c2-default-rtdb.asia-southeast1.firebasedatabase.app/nivatoon_cloud`)**:

- **Collections ที่ซิงก์แบบสองทาง (Two-Way Sync ระหว่างเว็บและแอป Android):**
  - `series` & `series_stats` (ข้อมูลเรื่อง รายการตอน ลิงก์ภาพ GitHub Raw URL ยอดวิว เรตติ้ง)
  - `users` & `users_public` (บัญชีผู้ใช้ ยศ `user`/`creator`/`admin` เหรียญเริ่มต้น `0` ตั๋วอ่านฟรี `3` ใบ เช็กอิน 7 วัน รายการติดตาม ตอนที่ปลดล็อกแล้ว ประวัติการอ่าน)
  - `creator_requests` (คำขอสิทธิ์ครีเอเตอร์พร้อมลิงก์ภาพผลงานตัวอย่างบน GitHub)
  - `wallet_transactions` (ธุรกรรมเติมเหรียญและสมัคร NIVATOON PLUS ฿129 ผ่าน PromptPay `1709700341765` / TrueMoney `0997353282` ชื่อบัญชี `ธีรชาติ เครือวัลย์`)
  - `comments` (ความคิดเห็นรายตอน)
  - `issue_reports` (แจ้งปัญหาและการตอบกลับจากแอดมิน)
  - `notifications` (ประกาศแจ้งเตือนและโปรโมชั่น)
  - `system_logs` (บันทึกการทำงานของระบบ)
- **API ซิงก์ข้อมูลคลาวด์ทันที:**
  - `GET /api/cloud/sync` — ตรวจสอบสถานะการเชื่อมต่อ GitHub Storage & Firebase Database พร้อมดึงข้อมูลล่าสุดจาก Firebase
  - `POST /api/cloud/sync` — สร้าง `manifest.json` ซิงก์ฐานข้อมูลทั้งหมดขึ้น Firebase และ Push ไฟล์ขึ้น GitHub

---

## 3. การส่งออกและติดตั้งแอปพลิเคชัน (`nivatoon-release.apk`)

แอปพลิเคชัน Android (`mobile_app`) ถูกพัฒนาด้วย Flutter (Native Dart UI) เชื่อมต่อตรงกับ **GitHub Raw Storage (`OhmmyTRC/nivatoon`)** และ **Firebase Database (`niva-421c2`)**:

1. **ไฟล์ APK ที่ส่งออกแล้วพร้อมติดตั้ง:**
   - ไฟล์ในโฟลเดอร์โปรเจกต์: `nivatoon-release.apk` และ `public/nivatoon-release.apk`
   - ดาวน์โหลดจากหน้าเว็บแอป: กดปุ่ม **"📱 ดาวน์โหลดแอป Android (.APK)"** ที่แถบด้านล่างของเว็บหรือในหน้า Admin Backoffice (`/nivatoon-release.apk`)
   - ดาวน์โหลดตรงจาก GitHub: `https://raw.githubusercontent.com/OhmmyTRC/nivatoon/main/nivatoon-release.apk`
2. **ฟีเจอร์เด่นในแอป Android (`nivatoon-release.apk`):**
   - โหลดภาพปกและหน้าการ์ตูนทุกเรื่อง (รวมถึง *หวนคืนนิรันดร์กาล Absolute Regression* ครบ 34 หน้าเต็ม) จากคลังไฟล์ **GitHub (`OhmmyTRC/nivatoon`)**
   - ซิงก์ข้อมูลบัญชี เหรียญ ตั๋วอ่านฟรี เช็กอิน 7 วัน คอมเมนต์ คำขอสิทธิ์ครีเอเตอร์ และการตรวจสลิป PromptPay / TrueMoney กับฐานข้อมูล **Firebase (`niva-421c2`)** แบบเรียลไทม์
   - มีแถบแสดงสถานะ **GitHub Storage • Firebase DB** บนหน้าหลักพร้อมปุ่ม **"🔄 ซิงก์"** ทันที
