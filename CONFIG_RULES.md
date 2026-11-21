# NIVATOON System Configuration & Governance Rules (`CONFIG_RULES.md`)

เอกสารมาตรฐานการตั้งค่า API, กฎระบบเหรียญ/ตั๋วอ่านฟรี, กฎความปลอดภัย AI และสิทธิ์การใช้งานของแพลตฟอร์ม **NIVATOON**

---

## 1. กฎการเข้าสู่ระบบและความปลอดภัย (Auth & Security Gate)
- **บังคับเข้าสู่ระบบ:** ผู้ใช้งานต้องเข้าสู่ระบบด้วยอีเมลและรหัสผ่านก่อนเข้าถึงหน้าหลัก (`/`) และหน้าอ่านมังฮวา (`/read/*`, `/series/*`, `/schedule`, `/discover`)
- **PIN / Biometric Security Gate (`/security-gate`):** หลังเข้าสู่ระบบทุกครั้งต้องปลดล็อกด้วยรหัส PIN 6 หลัก หรือ Passkey / ลายนิ้วมือ (WebAuthn) และสามารถเปลี่ยน PIN ได้ในหน้า `/settings` (`POST /api/auth/change-pin`) หรือยืนยันด้วยรหัสผ่านบัญชี
- **รหัสกู้คืน 6 หลัก (Password Reset OTP):** ระบบสร้างรหัส OTP 6 หลักหมดอายุใน 15 นาที ส่งไปยังอีเมลที่ลงทะเบียนผ่าน SMTP (Gmail ต้องใช้ **App Password 16 หลัก** จาก Google 2-Step Verification ไม่สามารถใช้รหัสผ่านบัญชี Gmail ปกติได้)
- **สิทธิ์ 3 ระดับ (RBAC):**
  - `user`: อ่านเรื่อง ซื้อตอน/เติมเหรียญ ขอสิทธิ์ลงผลงาน แต่งโปรไฟล์ แจ้งปัญหา
  - `creator`: ได้รับอนุมัติจาก Admin แล้วจึงเปิดใช้งาน Creator Studio (`/studio`)
  - `admin`: เข้าถึงหลังบ้าน (`/dashboard`), อนุมัติคำขอครีเอเตอร์, จัดการสมาชิก, ตั้งค่า AI/SMTP, ดู Log, จัดการแจ้งเตือน/ปัญหา

---

## 2. กฎพอยน์เริ่มต้น และตารางเช็กอินรับตั๋วอ่านฟรี 7 วัน
- **บัญชีสมัครใหม่:** เริ่มต้นด้วย **0 เหรียญ (Coins)** และ **ตั๋วอ่านฟรี 3 ใบ (Free Pass Tickets)**
- **ระบบเช็กอินรายวัน (7-Day Cycle):**
  - วันที่ **1 – 6**: รับ **+1 ตั๋วอ่านฟรี** ต่อวัน
  - วันที่ **7**: รับโบนัสพิเศษ **+3 ตั๋วอ่านฟรี** (เมื่อครบวันที่ 7 รอบใหม่จะเริ่มนับวันที่ 1 อีกครั้ง)

---

## 3. กฎการชำระเงินและตรวจสลิปจริง (PromptPay & TrueMoney)
- **บัญชีรับชำระอย่างเป็นทางการ:**
  - **PromptPay ID:** `1709700341765`
  - **TrueMoney Wallet:** `0997353282`
  - **ชื่อบัญชีรับเงิน (ทั้งสองช่องทาง):** `ธีรชาติ เครือวัลย์`
- **กติกาการตรวจสอบ:**
  1. ห้ามเปิดใช้งานแพ็กเกจ (รวมถึง NIVATOON PLUS ฿129) หรือเติมเหรียญโดยไม่ผ่านการชำระเงินและแนบหลักฐานสลิปจริง
  2. เมื่ออัปโหลดสลิป ระบบใช้ Gemini Vision (`apiVersion: 'v1beta'`) สแกนสลิปเพื่อดึงเลขอ้างอิงอัตโนมัติ ตรวจความแท้ของสลิป ตรวจยอดเงิน (`>= ราคาแพ็กเกจ`) และตรวจชื่อผู้รับ/บัญชี (`ธีรชาติ เครือวัลย์` / `1709700341765` / `0997353282`)
  3. ป้องกันการใช้สลิปซ้ำด้วยทั้ง **SHA-256 Slip Hash** และ **Transaction Reference** (หากซ้ำปฏิเสธด้วย HTTP `409`)

---

## 4. การตั้งค่า Gemini AI API (Configurable via Admin & `.env.local`)
- **ลำดับความสำคัญ (Priority):** ค่าที่ Admin บันทึกในฐานข้อมูล (`system_settings`) → Fallback ไปยัง Environment Variables (`.env.local`)
- **API Version Requirement:**
  - ฟีเจอร์วิเคราะห์ภาพ (`translateComicPanelWithGemini`, `verifyPaymentSlipWithGemini`, `generateVoiceDramaFromPanel` แบบมีภาพ) ใช้ **`apiVersion: 'v1beta'`** เพื่อให้ Interactions API รองรับ `input[].type = 'image'` อย่างถูกต้อง (หลีกเลี่ยง error 400 ใน `v1`)
  - `gemini-decision-1` ใช้ `v1beta` (`ai.decisions.create`) สำหรับตรวจสปอยล์ในคอมเมนต์
- **โมเดลมาตรฐานแนะนำ (2026 Current SDK `@google/genai`):**
  - Multimodal / Text / OCR / Slip Check: `gemini-4-hydrogen`
  - Voice Drama TTS: `gemini-3.8-flash-tts`
  - Cover / Panel Art: `gemini-nano-banana-2.1`
  - Comment Moderation: `gemini-decision-1`

---

## 5. ระบบ Log และแจ้งปัญหา
- ทุกเหตุการณ์สำคัญ (การเข้าสู่ระบบ, การรีเซ็ตรหัส OTP, การตรวจสลิปสำเร็จ/ไม่ผ่าน, การเรียก AI, การเปลี่ยนยศ/อนุมัติครีเอเตอร์, การเปลี่ยนค่า Admin Settings) จะบันทึกใน `system_logs` และซิงค์ขึ้น Cloud Firestore เมื่อเชื่อมต่อ Admin SDK แล้ว
