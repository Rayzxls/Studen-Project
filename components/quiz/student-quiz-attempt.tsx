"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Cloud,
  CloudOff,
  ListChecks,
  Send,
} from "lucide-react";
import type { StudentQuizAttemptView } from "@/lib/quiz";
import type { QuizAttemptActionResult } from "@/app/student/courses/[id]/quizzes/actions";

type Props = {
  initial: StudentQuizAttemptView;
  serverNowIso: string;
  saveAction: (formData: FormData) => Promise<QuizAttemptActionResult>;
  submitAction: (formData: FormData) => Promise<QuizAttemptActionResult>;
};

type SyncState = "SAVED" | "SAVING" | "ERROR";

export function StudentQuizAttempt({
  initial,
  serverNowIso,
  saveAction,
  submitAction,
}: Props) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState(initial.answers);
  const [revision, setRevision] = useState(initial.writeRevision);
  const [syncState, setSyncState] = useState<SyncState>("SAVED");
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<QuizAttemptActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [remainingMs, setRemainingMs] = useState(() =>
    remaining(initial.effectiveDeadline, serverNowIso)
  );
  const questions = initial.snapshot.questions;
  const current = questions[currentIndex];
  const answeredCount = useMemo(
    () =>
      questions.filter((question) => (answers[question.id]?.length ?? 0) > 0)
        .length,
    [answers, questions]
  );
  const unanswered = questions.length - answeredCount;

  useEffect(() => {
    if (!initial.effectiveDeadline || initial.status !== "IN_PROGRESS") return;
    const serverOffset =
      new Date(serverNowIso).getTime() - new Date().getTime();
    const tick = () => {
      const left = Math.max(
        0,
        initial.effectiveDeadline!.getTime() -
          (new Date().getTime() + serverOffset)
      );
      setRemainingMs(left);
      if (left === 0) router.refresh();
    };
    tick();
    const interval = window.setInterval(tick, 1_000);
    return () => window.clearInterval(interval);
  }, [initial.effectiveDeadline, initial.status, router, serverNowIso]);

  if (initial.status !== "IN_PROGRESS" || result?.ok) {
    const visibleScore = result?.scoreVisible ?? initial.scoreVisible;
    const score = result?.score ?? initial.finalScore ?? initial.autoScore ?? 0;
    return (
      <section className="mx-auto max-w-3xl py-12 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <p className="mt-5 text-sm font-medium text-green-700">ส่งคำตอบแล้ว</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink md:text-3xl">
          {initial.snapshot.title}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-ink-mute">
          {visibleScore
            ? `ได้ ${score} จาก ${initial.snapshot.totalPoints} คะแนน`
            : "ระบบบันทึกคำตอบเรียบร้อยแล้ว คะแนนจะแสดงเมื่อครูเผยแพร่"}
        </p>
        <button
          type="button"
          onClick={() =>
            router.push(
              `/student/courses/${initial.courseOfferingId}/lessons/${initial.lessonId}`
            )
          }
          className="btn-primary mt-7"
        >
          กลับไปบทเรียน
        </button>
      </section>
    );
  }

  if (!current) return null;

  function choose(optionId: string) {
    if (!initial.writable || pending || !current) return;
    const before = answers[current.id] ?? [];
    const selected =
      current.type === "MULTIPLE_SELECT"
        ? before.includes(optionId)
          ? before.filter((id) => id !== optionId)
          : [...before, optionId]
        : [optionId];
    setAnswers((value) => ({ ...value, [current.id]: selected }));
    setSyncState("SAVING");
    setMessage("");
    const formData = new FormData();
    formData.set("courseId", initial.courseOfferingId);
    formData.set("attemptId", initial.id);
    formData.set("questionId", current.id);
    formData.set("selectedOptionIds", JSON.stringify(selected));
    formData.set("expectedRevision", String(revision));
    formData.set("leaseVersion", String(initial.leaseVersion));
    formData.set(
      "idempotencyKey",
      `answer-${current.id}-${crypto.randomUUID()}`
    );
    startTransition(async () => {
      const response = await saveAction(formData);
      if (response.ok && response.revision !== undefined) {
        setRevision(response.revision);
        setSyncState("SAVED");
        setMessage(response.message);
      } else {
        setAnswers((value) => ({ ...value, [current.id]: before }));
        setSyncState("ERROR");
        setMessage(response.message);
      }
    });
  }

  function submit() {
    if (!initial.writable || pending) return;
    const formData = new FormData();
    formData.set("courseId", initial.courseOfferingId);
    formData.set("quizId", initial.quizId);
    formData.set("attemptId", initial.id);
    formData.set("expectedRevision", String(revision));
    formData.set("leaseVersion", String(initial.leaseVersion));
    formData.set("idempotencyKey", `submit-${crypto.randomUUID()}`);
    startTransition(async () => {
      const response = await submitAction(formData);
      setMessage(response.message);
      if (response.ok) setResult(response);
      else setSyncState("ERROR");
    });
  }

  return (
    <div className="mx-auto max-w-5xl pb-28">
      <header className="border-b border-hairline pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-blue-700">
              {initial.lessonTitle} · ครั้งที่ {initial.attemptNumber}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-ink md:text-3xl">
              {initial.snapshot.title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SyncBadge state={syncState} />
            {initial.effectiveDeadline && (
              <span
                className={`badge min-h-9 ${remainingMs <= 5 * 60_000 ? "text-red-700" : ""}`}
              >
                <Clock3 className="h-4 w-4" /> {formatRemaining(remainingMs)}
              </span>
            )}
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-hairline">
            <div
              className="h-full rounded-full bg-blue-500 transition-[width] duration-300"
              style={{
                width: `${((currentIndex + 1) / questions.length) * 100}%`,
              }}
            />
          </div>
          <span className="shrink-0 text-xs font-medium text-ink-mute">
            {currentIndex + 1}/{questions.length}
          </span>
        </div>
      </header>

      {!initial.writable && (
        <div className="mt-5 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          อุปกรณ์นี้ดูคำตอบได้อย่างเดียว กรุณากลับไปกด “ทำต่อ”
          เพื่อรับสิทธิ์แก้ไข
        </div>
      )}
      {message && (
        <p
          role="status"
          className={`mt-4 text-sm ${syncState === "ERROR" ? "text-red-700" : "text-ink-mute"}`}
        >
          {message}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)]">
        <nav aria-label="รายการคำถาม" className="order-2 lg:order-1">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <ListChecks className="h-4 w-4 text-blue-700" /> คำถาม
          </p>
          <div className="flex gap-2 overflow-x-auto pb-2 lg:grid lg:grid-cols-4">
            {questions.map((question, index) => {
              const answered = (answers[question.id]?.length ?? 0) > 0;
              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  className={`relative flex h-10 min-w-10 items-center justify-center rounded-md border text-sm font-semibold transition-colors ${
                    currentIndex === index
                      ? "border-blue-500 bg-blue-500 text-white"
                      : "border-hairline bg-surface text-ink hover:border-blue-300"
                  }`}
                  aria-label={`คำถามที่ ${index + 1}${answered ? " ตอบแล้ว" : " ยังไม่ตอบ"}`}
                >
                  {index + 1}
                  {answered && currentIndex !== index && (
                    <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-surface bg-green-500" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        <main className="order-1 min-w-0 lg:order-2">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-xs font-semibold text-blue-700">
                คำถามที่ {currentIndex + 1}
              </p>
              <h2 className="mt-2 text-lg font-semibold leading-8 text-ink md:text-xl">
                {current.prompt}
              </h2>
              {current.type === "MULTIPLE_SELECT" && (
                <p className="mt-2 text-sm text-ink-mute">
                  เลือกได้มากกว่าหนึ่งคำตอบ
                </p>
              )}
            </div>
            <span className="shrink-0 text-xs text-ink-mute">
              {current.points} คะแนน
            </span>
          </div>

          <div className="mt-6 grid gap-3">
            {current.options.map((option, index) => {
              const selected = (answers[current.id] ?? []).includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={!initial.writable || pending}
                  onClick={() => choose(option.id)}
                  className={`flex min-h-14 w-full items-center gap-4 rounded-lg border px-4 py-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                    selected
                      ? "border-blue-500 bg-blue-50 text-blue-900"
                      : "border-hairline bg-surface text-ink hover:border-blue-300 hover:bg-blue-50/40"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                      selected
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-hairline bg-bg text-ink-mute"
                    }`}
                  >
                    {selected ? <Check className="h-4 w-4" /> : letter(index)}
                  </span>
                  <span className="min-w-0 leading-6">{option.text}</span>
                </button>
              );
            })}
          </div>
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-hairline bg-surface/95 px-4 py-3 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))}
            className="btn-secondary btn-sm"
          >
            <ArrowLeft className="h-4 w-4" /> ก่อนหน้า
          </button>
          {currentIndex < questions.length - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentIndex((value) => value + 1)}
              className="btn-primary btn-sm"
            >
              ถัดไป <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={!initial.writable || pending || syncState === "SAVING"}
              onClick={() => setConfirming(true)}
              className="btn-primary btn-sm"
            >
              <Send className="h-4 w-4" /> ตรวจและส่ง
            </button>
          )}
        </div>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-quiz-title"
            className="w-full max-w-lg rounded-t-lg bg-surface p-6 shadow-card sm:rounded-lg"
          >
            <h2
              id="submit-quiz-title"
              className="text-lg font-semibold text-ink"
            >
              ตรวจคำตอบก่อนส่ง
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-mute">
              ตอบแล้ว {answeredCount} จาก {questions.length} ข้อ
              {unanswered > 0 && ` · ยังไม่ตอบ ${unanswered} ข้อ`}
            </p>
            {unanswered > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {questions.map((question, index) =>
                  (answers[question.id]?.length ?? 0) === 0 ? (
                    <button
                      key={question.id}
                      type="button"
                      onClick={() => {
                        setCurrentIndex(index);
                        setConfirming(false);
                      }}
                      className="badge hover:border-blue-300 hover:text-blue-700"
                    >
                      ข้อ {index + 1}
                    </button>
                  ) : null
                )}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="btn-secondary"
              >
                กลับไปตรวจ
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={submit}
                className="btn-primary"
              >
                <Send className="h-4 w-4" />{" "}
                {pending ? "กำลังส่ง..." : "ยืนยันส่ง"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function SyncBadge({ state }: { state: SyncState }) {
  if (state === "ERROR") {
    return (
      <span className="badge min-h-9 text-red-700">
        <CloudOff className="h-4 w-4" /> บันทึกไม่สำเร็จ
      </span>
    );
  }
  return (
    <span className="badge min-h-9 text-green-700">
      <Cloud className="h-4 w-4" />
      {state === "SAVING" ? "กำลังบันทึก..." : "บันทึกแล้ว"}
    </span>
  );
}

function remaining(deadline: Date | null, nowIso: string): number {
  if (!deadline) return 0;
  return Math.max(0, deadline.getTime() - new Date(nowIso).getTime());
}

function formatRemaining(value: number): string {
  const seconds = Math.ceil(value / 1_000);
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function letter(index: number): string {
  return String.fromCharCode(65 + index);
}
