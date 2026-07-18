import { ChevronDown, HelpCircle } from "lucide-react";

/**
 * LandingFaq — Section 7 of the Beagle Classroom landing.
 *
 * Plain-language answers to what schools actually ask, weighted toward the
 * privacy/permission questions that are this product's reason to exist.
 * Built on native <details>/<summary> — fully keyboard-accessible, works
 * with no JavaScript, and the marker rotation is a CSS-only group state.
 */

const FAQS: { q: string; a: string }[] = [
  {
    q: "นักเรียนเห็นคะแนนหรืองานของเพื่อนได้ไหม?",
    a: "ไม่ได้ — นักเรียนเห็นเฉพาะข้อมูลของตัวเอง บวกกับข้อมูลห้อง (รายชื่อสมาชิก ประกาศ ตารางเรียน) เท่านั้น คะแนน การเข้าเรียน และงานที่ส่งของคนอื่น ถูกกั้นในระดับสิทธิ์ มองไม่เห็นเด็ดขาด",
  },
  {
    q: "ครูแก้คะแนนหลังประกาศไปแล้วได้ไหม?",
    a: "ได้ แต่ต้องระบุเหตุผลทุกครั้ง และระบบจะบันทึกการแก้ไขลง audit log โรงเรียนสามารถย้อนดูได้ว่าใครแก้อะไร เมื่อไร และเพราะอะไร",
  },
  {
    q: "ข้อมูลปลอดภัยและตรงตาม PDPA ไหม?",
    a: "ระบบออกแบบตามแนวทาง PDPA: เก็บเฉพาะข้อมูลที่จำเป็น ไฟล์แนบเข้าถึงผ่านลิงก์ที่มีอายุจำกัด รหัสผ่านเข้ารหัสเสมอ และนักเรียนที่ถูกถอดออกจะถูก anonymize โดยไม่ลบคะแนนของเทอมก่อน",
  },
  {
    q: "ใช้บนมือถือได้ไหม ต้องติดตั้งแอปหรือเปล่า?",
    a: "ใช้ได้ทุกอุปกรณ์ผ่านเว็บเบราว์เซอร์ ไม่ต้องติดตั้งอะไร หน้าฝั่งนักเรียนออกแบบมาเพื่อมือถือโดยเฉพาะ ส่งงานและดูคะแนนได้จากในมือ",
  },
  {
    q: "ผู้ดูแลระบบใส่คะแนนหรือเช็คชื่อแทนครูได้ไหม?",
    a: "ไม่ได้ตามการออกแบบ — ผู้ดูแลดูภาพรวม ตรวจ audit log นำเข้า CSV และรีเซ็ตรหัสผ่านได้ แต่ไม่มีสิทธิ์ใส่ข้อมูลของนักเรียนแทนครู เพื่อให้ความรับผิดชอบของข้อมูลอยู่ที่ครูเจ้าของวิชาเสมอ",
  },
];

export function LandingFaq() {
  return (
    <section id="faq" className="px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            <HelpCircle className="h-3.5 w-3.5" />
            คำถามที่พบบ่อย
          </span>
          <h2
            className="mt-4 text-4xl font-semibold text-black md:text-5xl"
            style={{ letterSpacing: "-0.03em", lineHeight: 1.35 }}
          >
            เรื่องที่โรงเรียนมักถาม
          </h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((item) => (
            <details
              key={item.q}
              className="card group overflow-hidden p-0 shadow-card"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 [&::-webkit-details-marker]:hidden">
                <span
                  className="text-base font-medium text-black"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {item.q}
                </span>
                <ChevronDown className="faq-chevron h-5 w-5 shrink-0 text-black/40" />
              </summary>
              <p className="px-6 pb-5 text-sm leading-relaxed text-black/60">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
