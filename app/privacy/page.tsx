import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="mesh-bg min-h-screen">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white">
              S
            </div>
            <span className="font-semibold">Studennnn</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 animate-fade-in">
        <div className="badge-gold mb-4">
          นโยบายความเป็นส่วนตัว · เวอร์ชัน 1.0
        </div>
        <h1 className="text-4xl font-bold tracking-tight">
          <span className="text-gradient-ink">นโยบายความเป็นส่วนตัว</span>
        </h1>
        <p className="mt-3 text-sm text-ink-soft">
          อัปเดตล่าสุด: 31 พฤษภาคม 2569 · สอดคล้องตาม{" "}
          <strong>พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)</strong>
        </p>

        <article className="prose prose-slate mt-8 max-w-none space-y-6 text-sm leading-relaxed text-ink-soft">
          <section>
            <h2 className="font-semibold tracking-tight text-ink">
              1. ข้อมูลที่เราเก็บ
            </h2>
            <ul className="mt-2 list-inside list-disc">
              <li>ชื่อ - นามสกุล</li>
              <li>
                เลขประจำตัวนักเรียน (สำหรับนักเรียน) หรือ อีเมล (ครู / Admin)
              </li>
              <li>ห้องเรียนที่สังกัด</li>
              <li>ข้อมูลการเข้าเรียน คะแนน และการบ้านที่ส่ง</li>
              <li>
                IP address และ User-Agent ในเหตุการณ์สำคัญ
                (เพื่อตรวจสอบความปลอดภัย)
              </li>
            </ul>
            <p className="mt-2">
              เราไม่เก็บเลขบัตรประชาชน, วันเกิด, ที่อยู่, หรือข้อมูลสุขภาพ
            </p>
          </section>

          <section>
            <h2 className="font-semibold tracking-tight text-ink">
              2. วัตถุประสงค์
            </h2>
            <p>
              ข้อมูลถูกใช้เพื่อให้บริการระบบจัดการห้องเรียนเท่านั้น
              ไม่นำไปขายหรือเปิดเผยให้บุคคลที่สาม
            </p>
          </section>

          <section>
            <h2 className="font-semibold tracking-tight text-ink">
              3. ผู้ที่เข้าถึงข้อมูล
            </h2>
            <ul className="mt-2 list-inside list-disc">
              <li>
                <strong>นักเรียน:</strong> เห็นเฉพาะข้อมูลของตนเอง
              </li>
              <li>
                <strong>ครู:</strong> เห็นข้อมูลนักเรียนเฉพาะในห้องที่ตนเองสอน
              </li>
              <li>
                <strong>ผู้ดูแลระบบ (Admin):</strong> เข้าถึงข้อมูลเพื่อตรวจสอบ
                — ทุกการเข้าดูถูกบันทึก
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold tracking-tight text-ink">
              4. ระยะเวลาเก็บข้อมูล
            </h2>
            <p>
              เก็บไว้ตลอดระยะเวลาการศึกษาบวก <strong>2 ปีการศึกษา</strong>{" "}
              หลังจบ จากนั้นจะลบข้อมูลส่วนบุคคล (anonymize) —
              เก็บแค่สถิติชั้นเรียน
            </p>
          </section>

          <section>
            <h2 className="font-semibold tracking-tight text-ink">
              5. สิทธิ์ของเจ้าของข้อมูล
            </h2>
            <ul className="mt-2 list-inside list-disc">
              <li>
                สิทธิ์ในการเข้าถึง — ดาวน์โหลดข้อมูลของตนเองได้ที่หน้า Profile
              </li>
              <li>สิทธิ์ในการแก้ไข — แก้ชื่อ / อีเมลของตนเองได้</li>
              <li>สิทธิ์ในการลบ — ขอให้ลบบัญชีได้ (anonymize ภายใน 30 วัน)</li>
              <li>สิทธิ์ในการคัดค้านการประมวลผล</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold tracking-tight text-ink">
              6. ความปลอดภัย
            </h2>
            <ul className="mt-2 list-inside list-disc">
              <li>รหัสผ่านเข้ารหัสด้วย bcrypt</li>
              <li>การเชื่อมต่อทั้งหมดผ่าน HTTPS</li>
              <li>ข้อมูลเข้ารหัสขณะจัดเก็บ (encryption at rest)</li>
              <li>ทุกการแก้ไขสำคัญถูกบันทึกใน audit log</li>
            </ul>
          </section>

          <section id="contact">
            <h2 className="font-semibold tracking-tight text-ink">
              7. ติดต่อเจ้าหน้าที่คุ้มครองข้อมูล (DPO)
            </h2>
            <p>
              อีเมล:{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5">
                dpo@studennnn.local
              </code>
              <br />
              เราจะตอบกลับภายใน 30 วัน
            </p>
          </section>

          <section>
            <h2 className="font-semibold tracking-tight text-ink">
              8. การเปลี่ยนแปลงนโยบาย
            </h2>
            <p>
              เราอาจปรับปรุงนโยบายนี้เป็นครั้งคราว —
              ผู้ใช้จะถูกแจ้งให้ยอมรับเวอร์ชันใหม่ ก่อนใช้งานต่อ
            </p>
          </section>
        </article>

        <div className="mt-12 flex gap-3">
          <Link href="/signup" className="btn-primary">
            กลับไปสมัครสมาชิก
          </Link>
          <Link href="/" className="btn-ghost">
            หน้าแรก
          </Link>
        </div>
      </main>
    </div>
  );
}
