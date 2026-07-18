"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Eye,
  FileImage,
  GripVertical,
  ImagePlus,
  ListChecks,
  Paperclip,
  Plus,
  Save,
  Settings2,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";

type View = "builder" | "attempt" | "results";
type Theme = "light" | "dark" | "cream";

const questions = [
  { title: "เลือกคำตอบที่ถูกต้อง", type: "เลือกหนึ่งข้อ", points: 2 },
  {
    title: "เลือกประโยคที่เป็น Present Simple",
    type: "เลือกได้หลายข้อ",
    points: 3,
  },
  { title: "She go to school every day.", type: "ถูก / ผิด", points: 1 },
];

const views: Array<{ id: View; label: string; icon: typeof Settings2 }> = [
  { id: "builder", label: "ครูสร้างข้อสอบ", icon: Settings2 },
  { id: "attempt", label: "นักเรียนทำข้อสอบ", icon: ListChecks },
  { id: "results", label: "ครูดูผล", icon: BarChart3 },
];

const themes: Array<{ id: Theme; label: string }> = [
  { id: "light", label: "สว่าง" },
  { id: "dark", label: "มืด" },
  { id: "cream", label: "ครีม" },
];

export function QuizWorkspacePrototype({
  courseId,
  initialView,
  initialTheme,
}: {
  courseId: string;
  initialView: View;
  initialTheme: Theme;
}) {
  const [view, setView] = useState<View>(initialView);
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function update(nextView: View, nextTheme = theme) {
    setView(nextView);
    const url = new URL(window.location.href);
    url.searchParams.set("view", nextView);
    url.searchParams.set("theme", nextTheme);
    window.history.replaceState({}, "", url);
  }

  function changeTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    url.searchParams.set("theme", nextTheme);
    window.history.replaceState({}, "", url);
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-hairline bg-surface p-1">
          {themes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => changeTheme(item.id)}
              className={`min-h-9 rounded-md px-3 text-xs font-medium transition-colors ${
                theme === item.id
                  ? "bg-blue-600 text-white"
                  : "text-ink-mute hover:bg-black/[0.04]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-mute">
          <Sparkles className="h-3.5 w-3.5 text-blue-600" />{" "}
          ข้อมูลจำลองเพื่อทดสอบ UX เท่านั้น
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          {view === "builder" && <BuilderView />}
          {view === "attempt" && <AttemptView />}
          {view === "results" && <ResultsView />}
        </motion.div>
      </AnimatePresence>

      <nav className="fixed bottom-4 left-1/2 z-30 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 gap-1 rounded-xl border border-hairline bg-surface/95 p-1.5 shadow-lift backdrop-blur-md">
        {views.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => update(item.id)}
              className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-2 text-xs font-medium transition-colors sm:text-sm ${
                view === item.id
                  ? "bg-blue-600 text-white"
                  : "text-ink-mute hover:bg-black/[0.04]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          );
        })}
      </nav>
      <span className="sr-only">Course {courseId}</span>
    </div>
  );
}

function BuilderView() {
  const [selected, setSelected] = useState(0);

  return (
    <section className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-soft">
      <div className="flex flex-col gap-3 border-b border-hairline px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-ink">
              Grammar checkpoint
            </h2>
            <span className="badge">ฉบับร่าง</span>
          </div>
          <p className="mt-1 text-sm text-ink-mute">
            บท Grammar essentials · 3 ข้อ · 6 คะแนน
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="icon-btn" title="ดูตัวอย่าง">
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="btn-primary inline-flex min-h-10 items-center gap-2 px-4 text-sm"
          >
            <Save className="h-4 w-4" /> บันทึกฉบับร่าง
          </button>
        </div>
      </div>

      <div className="grid min-h-[620px] lg:grid-cols-[240px_minmax(0,1fr)_280px]">
        <aside className="min-w-0 border-b border-hairline bg-black/[0.015] p-3 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold text-ink">คำถาม</h3>
            <button
              type="button"
              className="icon-btn h-8 w-8"
              title="เพิ่มคำถาม"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-2 lg:overflow-visible">
            {questions.map((question, index) => (
              <button
                key={question.title}
                type="button"
                onClick={() => setSelected(index)}
                className={`flex min-w-[210px] items-start gap-2 rounded-lg border p-3 text-left transition-colors lg:min-w-0 ${
                  selected === index
                    ? "border-blue-500 bg-blue-50/80"
                    : "border-hairline bg-surface hover:border-blue-300"
                }`}
              >
                <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-ink-mute" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">
                    {index + 1}. {question.title}
                  </span>
                  <span className="mt-1 block text-xs text-ink-mute">
                    {question.type} · {question.points} คะแนน
                  </span>
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-blue-300 text-sm font-medium text-blue-700 hover:bg-blue-50"
          >
            <Plus className="h-4 w-4" /> เพิ่มคำถาม
          </button>
        </aside>

        <div className="min-w-0 space-y-5 p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-ink">
              คำถามที่ {selected + 1}
            </span>
            <div className="flex gap-1">
              <button type="button" className="icon-btn" title="ทำสำเนา">
                <Copy className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="icon-btn text-red-600"
                title="ลบคำถาม"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">
              โจทย์
            </span>
            <textarea
              className="input-field min-h-28 w-full resize-y"
              defaultValue={questions[selected].title}
            />
          </label>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button
              type="button"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-hairline px-3 text-sm text-ink hover:bg-black/[0.03]"
            >
              <ImagePlus className="h-4 w-4" /> รูปภาพ
            </button>
            <button
              type="button"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-hairline px-3 text-sm text-ink hover:bg-black/[0.03]"
            >
              <Paperclip className="h-4 w-4" /> ไฟล์
            </button>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-ink">
                ตัวเลือกคำตอบ
              </span>
              <span className="text-xs text-ink-mute">
                เลือก ✓ เพื่อกำหนดคำตอบถูก
              </span>
            </div>
            <div className="space-y-2">
              {["go", "goes", "going", "gone"].map((option, index) => (
                <div
                  key={option}
                  className="flex items-center gap-2 rounded-lg border border-hairline bg-bg/40 p-2"
                >
                  <button
                    type="button"
                    title="คำตอบที่ถูก"
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${index === 1 ? "border-emerald-500 bg-emerald-500 text-white" : "border-hairline text-transparent"}`}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <input
                    className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
                    defaultValue={option}
                  />
                  <button
                    type="button"
                    className="icon-btn h-8 w-8 text-ink-mute"
                    title="แนบรูปกับตัวเลือก"
                  >
                    <FileImage className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="min-w-0 border-t border-hairline bg-black/[0.015] p-4 lg:border-l lg:border-t-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Settings2 className="h-4 w-4 text-blue-600" /> ตั้งค่าแบบทดสอบ
          </h3>
          <div className="mt-4 space-y-4">
            <Field label="รูปแบบ">
              <select className="input-field w-full text-sm">
                <option>แบบเก็บคะแนน</option>
                <option>แบบฝึกหัด</option>
              </select>
            </Field>
            <Field label="คะแนนข้อนี้">
              <input
                className="input-field w-full text-sm"
                type="number"
                defaultValue={questions[selected].points}
              />
            </Field>
            <Field label="จำนวนครั้งที่ทำได้">
              <input
                className="input-field w-full text-sm"
                type="number"
                defaultValue={1}
              />
            </Field>
            <Field label="เวลาทำ">
              <div className="relative">
                <Clock3 className="absolute left-3 top-3 h-4 w-4 text-ink-mute" />
                <input
                  className="input-field w-full pl-9 text-sm"
                  defaultValue="20 นาที"
                />
              </div>
            </Field>
          </div>
          <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <div className="flex items-center gap-2 font-semibold">
              <Check className="h-4 w-4" /> พร้อมบันทึก
            </div>
            <p className="mt-1 text-xs leading-5">
              ครบ 3 ข้อ คะแนนรวมตรงกับ 6 คะแนน และทุกข้อมีคำตอบแล้ว
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function AttemptView() {
  const [current, setCurrent] = useState(1);
  const [answers, setAnswers] = useState<Record<number, string>>({ 1: "goes" });
  const options = ["go", "goes", "going", "gone"];

  return (
    <section className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-xs font-medium text-blue-700">
            Grammar essentials
          </span>
          <h2 className="mt-1 text-xl font-semibold text-ink">
            Grammar checkpoint
          </h2>
          <p className="mt-1 text-sm text-ink-mute">
            ครั้งที่ 1 จาก 1 · ระบบบันทึกคำตอบอัตโนมัติ
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-amber-900">
          <Clock3 className="h-4 w-4" />
          <span className="font-mono text-lg font-semibold">18:42</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="rounded-lg border border-hairline bg-surface p-5 shadow-soft md:p-7">
          <div className="flex items-center justify-between gap-3">
            <span className="badge">ข้อ {current} จาก 3</span>
            <span className="text-sm text-ink-mute">
              {questions[current - 1].points} คะแนน
            </span>
          </div>
          <h3 className="mt-6 text-xl font-semibold leading-8 text-ink md:text-2xl">
            {questions[current - 1].title}
          </h3>
          {current === 1 ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAnswers({ ...answers, 1: option })}
                  className={`min-h-14 rounded-lg border px-4 text-left text-base font-medium transition-colors ${answers[1] === option ? "border-blue-500 bg-blue-50 text-blue-900" : "border-hairline text-ink hover:border-blue-300"}`}
                >
                  <span className="mr-3 inline-grid h-7 w-7 place-items-center rounded-full border border-current text-xs">
                    {String.fromCharCode(65 + options.indexOf(option))}
                  </span>
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-lg border border-dashed border-hairline p-8 text-center text-sm text-ink-mute">
              ตัวอย่างพื้นที่ตอบสำหรับประเภท {questions[current - 1].type}
            </div>
          )}
          <div className="mt-8 flex items-center justify-between border-t border-hairline pt-4">
            <button
              type="button"
              disabled={current === 1}
              onClick={() => setCurrent(current - 1)}
              className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm font-medium text-ink disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" /> ก่อนหน้า
            </button>
            {current < 3 ? (
              <button
                type="button"
                onClick={() => setCurrent(current + 1)}
                className="btn-primary inline-flex min-h-10 items-center gap-1 px-4 text-sm"
              >
                ถัดไป <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary min-h-10 px-4 text-sm"
              >
                ตรวจคำตอบก่อนส่ง
              </button>
            )}
          </div>
        </div>

        <aside className="rounded-lg border border-hairline bg-surface p-4 shadow-soft">
          <h3 className="text-sm font-semibold text-ink">แผนผังข้อสอบ</h3>
          <div className="mt-3 grid grid-cols-5 gap-2 md:grid-cols-3">
            {questions.map((_, index) => {
              const number = index + 1;
              const answered = Boolean(answers[number]);
              return (
                <button
                  key={number}
                  type="button"
                  onClick={() => setCurrent(number)}
                  className={`aspect-square rounded-md border text-sm font-semibold ${current === number ? "border-blue-600 bg-blue-600 text-white" : answered ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-hairline text-ink-mute"}`}
                >
                  {number}
                </button>
              );
            })}
          </div>
          <div className="mt-4 space-y-2 border-t border-hairline pt-4 text-xs text-ink-mute">
            <p className="flex justify-between">
              <span>ตอบแล้ว</span>
              <strong className="text-ink">1/3</strong>
            </p>
            <p className="flex justify-between">
              <span>บันทึกล่าสุด</span>
              <strong className="text-emerald-700">เมื่อสักครู่</strong>
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function ResultsView() {
  const students = [
    { name: "ธนภัทร พิลาดี", score: "5/6", attempts: 1, status: "ส่งแล้ว" },
    { name: "วรินทร์ แก้วใส", score: "4/6", attempts: 1, status: "ส่งแล้ว" },
    { name: "คณิตธนก มีสุข", score: "-", attempts: 0, status: "ยังไม่ส่ง" },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="badge">ปิดรับคำตอบแล้ว</span>
          <h2 className="mt-3 text-xl font-semibold text-ink">
            ผล Grammar checkpoint
          </h2>
          <p className="mt-1 text-sm text-ink-mute">
            3 นักเรียน · คะแนนเต็ม 6 · ยังไม่เผยแพร่คะแนน
          </p>
        </div>
        <button type="button" className="btn-primary min-h-10 px-4 text-sm">
          ตรวจความพร้อมและเผยแพร่
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={Users} label="ส่งแล้ว" value="2/3" />
        <Metric icon={BarChart3} label="คะแนนเฉลี่ย" value="4.5" />
        <Metric icon={Clock3} label="เวลาเฉลี่ย" value="08:24" />
        <Metric icon={Check} label="ผ่านเกณฑ์" value="2 คน" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-soft">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-4">
            <h3 className="font-semibold text-ink">รายชื่อนักเรียน</h3>
            <button type="button" className="text-sm font-medium text-blue-700">
              ส่งออก CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-black/[0.02] text-xs text-ink-mute">
                <tr>
                  <th className="px-4 py-3 font-medium">นักเรียน</th>
                  <th className="px-4 py-3 font-medium">สถานะ</th>
                  <th className="px-4 py-3 font-medium">ครั้ง</th>
                  <th className="px-4 py-3 font-medium">คะแนน</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.name} className="border-t border-hairline">
                    <td className="px-4 py-4 font-medium text-ink">
                      {student.name}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={
                          student.status === "ส่งแล้ว"
                            ? "text-emerald-700"
                            : "text-amber-700"
                        }
                      >
                        {student.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-ink-mute">
                      {student.attempts}
                    </td>
                    <td className="px-4 py-4 font-semibold text-ink">
                      {student.score}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        className="text-sm font-medium text-blue-700"
                      >
                        ดูคำตอบ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="rounded-lg border border-hairline bg-surface p-5 shadow-soft">
          <h3 className="font-semibold text-ink">วิเคราะห์รายข้อ</h3>
          <p className="mt-1 text-xs text-ink-mute">สัดส่วนนักเรียนที่ตอบถูก</p>
          <div className="mt-5 space-y-5">
            {[67, 100, 50].map((value, index) => (
              <div key={value + index}>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="text-ink">ข้อ {index + 1}</span>
                  <strong className="text-ink">{value}%</strong>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-black/[0.07]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ delay: index * 0.08, duration: 0.45 }}
                    className={`h-full rounded-full ${value < 60 ? "bg-amber-500" : "bg-blue-600"}`}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            <strong>ข้อที่ควรทบทวน:</strong> ข้อ 3 มีผู้ตอบถูกเพียงครึ่งหนึ่ง
            ตรวจโจทย์ก่อนเผยแพร่คะแนน
          </div>
        </aside>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-mute">
        {label}
      </span>
      {children}
    </label>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-surface p-4 shadow-soft">
      <Icon className="h-4 w-4 text-blue-600" />
      <p className="mt-3 text-xs text-ink-mute">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}
