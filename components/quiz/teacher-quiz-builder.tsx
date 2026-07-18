"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  CircleHelp,
  Clock3,
  Copy,
  Eye,
  GripVertical,
  ListChecks,
  Plus,
  Save,
  Send,
  Settings2,
  Shuffle,
  Trash2,
  X,
} from "lucide-react";
import {
  TeacherAttachmentUploader,
  type TeacherUploadedFile,
} from "@/components/attachment/teacher-attachment-uploader";
import { QuizAttachmentPreview } from "@/components/quiz/quiz-attachment-preview";

type QuestionType = "SINGLE_CHOICE" | "MULTIPLE_SELECT" | "TRUE_FALSE";

type BuilderOption = {
  id: string;
  text: string;
  isCorrect: boolean;
  attachments: TeacherUploadedFile[];
};

type BuilderQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  explanation: string;
  points: number;
  attachments: TeacherUploadedFile[];
  options: BuilderOption[];
};

export type QuizBuilderInitialData = {
  id: string;
  quizId?: string;
  courseOfferingId: string;
  lessonId: string;
  lessonTitle: string;
  title: string;
  description: string;
  mode: "PRACTICE" | "SCORED";
  required: boolean;
  opensAt: string;
  closesAt: string;
  timeLimitMinutes: number | null;
  maxAttempts: number | null;
  passThresholdPercent: number | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  hideExplanations: boolean;
  attachments: TeacherUploadedFile[];
  questions: BuilderQuestion[];
};

type Props = {
  initial: QuizBuilderInitialData;
  action: (formData: FormData) => void | Promise<void>;
  openAction?: (formData: FormData) => void | Promise<void>;
  autosaveAction?: (formData: FormData) => Promise<{
    ok: boolean;
    message: string;
    savedAt?: string;
  }>;
  notice?: string;
  locked?: boolean;
};

const typeLabels: Record<QuestionType, string> = {
  SINGLE_CHOICE: "เลือกคำตอบเดียว",
  MULTIPLE_SELECT: "เลือกหลายคำตอบ",
  TRUE_FALSE: "จริง / เท็จ",
};

export function TeacherQuizBuilder({
  initial,
  action,
  openAction,
  autosaveAction,
  notice,
  locked = false,
}: Props) {
  const [data, setData] = useState(initial);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saveMessage, setSaveMessage] = useState(
    initial.quizId ? "บันทึกแล้ว" : "ยังไม่ได้สร้างฉบับร่าง"
  );
  const [isSaving, startSaving] = useTransition();
  const initialPayload = useRef<string | null>(null);
  const selected = data.questions[selectedIndex] ?? data.questions[0];
  const totalPoints = useMemo(
    () => data.questions.reduce((sum, question) => sum + question.points, 0),
    [data.questions]
  );

  function updateQuestion(patch: Partial<BuilderQuestion>) {
    setData((current) => ({
      ...current,
      questions: current.questions.map((question, index) =>
        index === selectedIndex ? { ...question, ...patch } : question
      ),
    }));
  }

  function addQuestion() {
    const next = blankQuestion(data.courseOfferingId);
    setData((current) => ({
      ...current,
      questions: [...current.questions, next],
    }));
    setSelectedIndex(data.questions.length);
  }

  function duplicateQuestion() {
    const copy = {
      ...selected,
      id: newId(data.courseOfferingId),
      prompt: `${selected.prompt} (สำเนา)`,
      attachments: [],
      options: selected.options.map((option) => ({
        ...option,
        id: newId(data.courseOfferingId),
        attachments: [],
      })),
    };
    setData((current) => {
      const questions = [...current.questions];
      questions.splice(selectedIndex + 1, 0, copy);
      return { ...current, questions };
    });
    setSelectedIndex(selectedIndex + 1);
  }

  function removeQuestion() {
    if (data.questions.length === 1) return;
    setData((current) => ({
      ...current,
      questions: current.questions.filter(
        (_, index) => index !== selectedIndex
      ),
    }));
    setSelectedIndex(Math.max(0, selectedIndex - 1));
  }

  function moveQuestion(direction: -1 | 1) {
    const target = selectedIndex + direction;
    if (target < 0 || target >= data.questions.length) return;
    setData((current) => {
      const questions = [...current.questions];
      [questions[selectedIndex], questions[target]] = [
        questions[target],
        questions[selectedIndex],
      ];
      return { ...current, questions };
    });
    setSelectedIndex(target);
  }

  function changeType(type: QuestionType) {
    if (type === "TRUE_FALSE") {
      updateQuestion({
        type,
        options: [
          {
            id: newId(data.courseOfferingId),
            text: "จริง",
            isCorrect: true,
            attachments: [],
          },
          {
            id: newId(data.courseOfferingId),
            text: "เท็จ",
            isCorrect: false,
            attachments: [],
          },
        ],
      });
      return;
    }
    updateQuestion({
      type,
      options: selected.options.map((option, index) => ({
        ...option,
        isCorrect:
          type === "MULTIPLE_SELECT"
            ? index < 2
            : index ===
              Math.max(
                0,
                selected.options.findIndex((item) => item.isCorrect)
              ),
      })),
    });
  }

  function updateOption(index: number, patch: Partial<BuilderOption>) {
    updateQuestion({
      options: selected.options.map((option, optionIndex) =>
        optionIndex === index ? { ...option, ...patch } : option
      ),
    });
  }

  function markCorrect(index: number) {
    updateQuestion({
      options: selected.options.map((option, optionIndex) => ({
        ...option,
        isCorrect:
          selected.type === "MULTIPLE_SELECT"
            ? optionIndex === index
              ? !option.isCorrect
              : option.isCorrect
            : optionIndex === index,
      })),
    });
  }

  function addOption() {
    if (selected.options.length >= 10 || selected.type === "TRUE_FALSE") return;
    updateQuestion({
      options: [
        ...selected.options,
        {
          id: newId(data.courseOfferingId),
          text: "",
          isCorrect: false,
          attachments: [],
        },
      ],
    });
  }

  function removeOption(index: number) {
    if (selected.options.length <= 2 || selected.type === "TRUE_FALSE") return;
    updateQuestion({
      options: selected.options.filter(
        (_, optionIndex) => optionIndex !== index
      ),
    });
  }

  const payload = JSON.stringify({
    id: data.id,
    courseOfferingId: data.courseOfferingId,
    lessonId: data.lessonId,
    title: data.title,
    description: data.description,
    mode: data.mode,
    required: data.required,
    opensAt: toIsoOrNull(data.opensAt),
    closesAt: toIsoOrNull(data.closesAt),
    timeLimitMinutes: data.timeLimitMinutes,
    maxAttempts: data.mode === "SCORED" ? (data.maxAttempts ?? 1) : null,
    passThresholdPercent: data.passThresholdPercent,
    shuffleQuestions: data.shuffleQuestions,
    shuffleOptions: data.shuffleOptions,
    hideExplanations: data.hideExplanations,
    fileAttachmentIds: data.attachments.map((file) => file.id),
    questions: data.questions.map((question) => ({
      id: question.id,
      type: question.type,
      prompt: question.prompt,
      explanation: question.explanation,
      points: question.points,
      fileAttachmentIds: question.attachments.map((file) => file.id),
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
        isCorrect: option.isCorrect,
        fileAttachmentIds: option.attachments.map((file) => file.id),
      })),
    })),
  });

  useEffect(() => {
    if (!data.quizId || !autosaveAction || locked || isSaving) return;
    if (initialPayload.current === null) {
      initialPayload.current = payload;
      return;
    }
    if (initialPayload.current === payload) return;

    setSaveMessage("มีการเปลี่ยนแปลงที่ยังไม่บันทึก");
    const timeout = window.setTimeout(() => {
      const formData = new FormData();
      formData.set("courseId", data.courseOfferingId);
      formData.set("lessonId", data.lessonId);
      formData.set("quizId", data.quizId ?? "");
      formData.set("payload", payload);
      startSaving(async () => {
        const result = await autosaveAction(formData);
        setSaveMessage(result.message);
        if (result.ok) initialPayload.current = payload;
      });
    }, 1_200);
    return () => window.clearTimeout(timeout);
  }, [
    autosaveAction,
    data.courseOfferingId,
    data.lessonId,
    data.quizId,
    locked,
    payload,
    isSaving,
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/teacher/courses/${data.courseOfferingId}/lessons/${data.lessonId}`}
          className="btn-ghost btn-sm"
        >
          <ArrowLeft className="h-4 w-4" /> กลับบทเรียน
        </Link>
        <div className="flex items-center gap-2 text-sm text-ink-mute">
          <span>{data.questions.length} ข้อ</span>
          <span aria-hidden="true">·</span>
          <span>{totalPoints} คะแนน</span>
        </div>
      </div>

      {notice && (
        <p
          role="status"
          className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
        >
          {notice}
        </p>
      )}
      {locked && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          มีนักเรียนเริ่มทำแล้ว เนื้อหาจึงถูกล็อกเพื่อรักษาความยุติธรรม
        </p>
      )}

      <form
        action={action}
        className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-card"
      >
        <input type="hidden" name="courseId" value={data.courseOfferingId} />
        <input type="hidden" name="lessonId" value={data.lessonId} />
        <input type="hidden" name="quizId" value={data.quizId ?? ""} />
        <input type="hidden" name="payload" value={payload} />

        <header className="flex flex-col gap-4 border-b border-hairline px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-blue-700">
              <ListChecks className="h-4 w-4" /> {data.lessonTitle}
              <span className="badge">ฉบับร่าง</span>
            </div>
            <input
              aria-label="ชื่อแบบทดสอบ"
              value={data.title}
              disabled={locked || isSaving}
              onChange={(event) =>
                setData((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              maxLength={200}
              required
              className="w-full border-0 bg-transparent p-0 text-xl font-semibold text-ink outline-none placeholder:text-ink-faint md:text-2xl"
              placeholder="ตั้งชื่อแบบทดสอบ"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className="flex min-h-9 items-center px-2 text-xs text-ink-mute"
              aria-live="polite"
            >
              {isSaving ? "กำลังบันทึก..." : saveMessage}
            </span>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="btn-secondary btn-sm"
            >
              <Eye className="h-4 w-4" /> ดูตัวอย่าง
            </button>
            <button
              type="submit"
              disabled={locked || isSaving}
              className="btn-primary btn-sm"
            >
              <Save className="h-4 w-4" /> บันทึกฉบับร่าง
            </button>
            {data.quizId && openAction && !locked && (
              <button
                type="submit"
                formAction={openAction}
                disabled={isSaving}
                className="btn-primary btn-sm"
              >
                <Send className="h-4 w-4" /> บันทึกและเปิดทำ
              </button>
            )}
          </div>
        </header>

        <div className="grid min-h-[640px] lg:grid-cols-[240px_minmax(0,1fr)_280px]">
          <aside className="min-w-0 border-b border-hairline bg-black/[0.015] p-3 lg:border-b-0 lg:border-r">
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-ink">คำถาม</h2>
              <button
                type="button"
                onClick={addQuestion}
                disabled={locked || data.questions.length >= 100}
                className="icon-btn h-8 w-8"
                title="เพิ่มคำถาม"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-2 lg:overflow-visible">
              {data.questions.map((question, index) => (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => setSelectedIndex(index)}
                  className={`flex min-w-[210px] items-start gap-2 rounded-lg border p-3 text-left transition-colors lg:min-w-0 ${
                    selectedIndex === index
                      ? "border-blue-500 bg-blue-50"
                      : "border-hairline bg-surface hover:border-blue-300"
                  }`}
                >
                  <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-ink-mute" />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm font-medium text-ink">
                      {index + 1}. {question.prompt || "คำถามใหม่"}
                    </span>
                    <span className="mt-1 block text-xs text-ink-mute">
                      {typeLabels[question.type]} · {question.points} คะแนน
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={addQuestion}
              disabled={locked || data.questions.length >= 100}
              className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-blue-300 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> เพิ่มคำถาม
            </button>
          </aside>

          <main className="min-w-0 space-y-5 p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-ink">
                คำถามที่ {selectedIndex + 1}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => moveQuestion(-1)}
                  className="icon-btn"
                  title="เลื่อนขึ้น"
                  disabled={locked || selectedIndex === 0}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveQuestion(1)}
                  className="icon-btn"
                  title="เลื่อนลง"
                  disabled={
                    locked || selectedIndex === data.questions.length - 1
                  }
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={duplicateQuestion}
                  className="icon-btn"
                  title="ทำสำเนา"
                  disabled={locked || data.questions.length >= 100}
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={removeQuestion}
                  className="icon-btn text-red-600"
                  title="ลบคำถาม"
                  disabled={locked || data.questions.length === 1}
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
                value={selected.prompt}
                disabled={locked}
                onChange={(event) =>
                  updateQuestion({ prompt: event.target.value })
                }
                required
                maxLength={5000}
                className="input min-h-28 resize-y"
                placeholder="เขียนคำถามให้ชัดเจน"
              />
            </label>

            <div>
              <span className="mb-2 block text-sm font-medium text-ink">
                ไฟล์ประกอบคำถาม
              </span>
              <TeacherAttachmentUploader
                key={selected.id}
                ownerType="QUIZ_QUESTION"
                ownerId={selected.id}
                initialFiles={selected.attachments}
                disabled={locked}
                onChange={(attachments) => updateQuestion({ attachments })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">
                  รูปแบบคำถาม
                </span>
                <select
                  value={selected.type}
                  disabled={locked}
                  onChange={(event) =>
                    changeType(event.target.value as QuestionType)
                  }
                  className="input"
                >
                  {Object.entries(typeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">
                  คะแนน
                </span>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={selected.points}
                  disabled={locked}
                  onChange={(event) =>
                    updateQuestion({ points: Number(event.target.value) })
                  }
                  className="input"
                />
              </label>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">
                  ตัวเลือกคำตอบ
                </span>
                <span className="text-xs text-ink-mute">
                  กดวงกลมเพื่อกำหนดคำตอบที่ถูก
                </span>
              </div>
              <div className="space-y-2">
                {selected.options.map((option, index) => (
                  <div
                    key={option.id}
                    className="rounded-lg border border-hairline bg-bg/40 p-2"
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => markCorrect(index)}
                        disabled={locked}
                        title="กำหนดเป็นคำตอบที่ถูก"
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${option.isCorrect ? "border-emerald-600 bg-emerald-600 text-white" : "border-hairline text-transparent"}`}
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <input
                        value={option.text}
                        disabled={locked || selected.type === "TRUE_FALSE"}
                        onChange={(event) =>
                          updateOption(index, { text: event.target.value })
                        }
                        required
                        maxLength={5000}
                        className="min-w-0 flex-1 border-0 bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
                        placeholder={`ตัวเลือก ${index + 1}`}
                      />
                      {selected.type !== "TRUE_FALSE" && (
                        <button
                          type="button"
                          onClick={() => removeOption(index)}
                          disabled={locked || selected.options.length <= 2}
                          className="icon-btn h-8 w-8 text-red-600"
                          title="ลบตัวเลือก"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="mt-2 border-t border-hairline pt-2">
                      <TeacherAttachmentUploader
                        key={option.id}
                        ownerType="QUIZ_OPTION"
                        ownerId={option.id}
                        initialFiles={option.attachments}
                        maxFiles={5}
                        disabled={locked}
                        onChange={(attachments) =>
                          updateOption(index, { attachments })
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
              {selected.type !== "TRUE_FALSE" && (
                <button
                  type="button"
                  onClick={addOption}
                  disabled={locked || selected.options.length >= 10}
                  className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-blue-700 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" /> เพิ่มตัวเลือก
                </button>
              )}
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">
                คำอธิบายหลังตอบ
              </span>
              <textarea
                value={selected.explanation}
                disabled={locked}
                onChange={(event) =>
                  updateQuestion({ explanation: event.target.value })
                }
                maxLength={5000}
                className="input min-h-24 resize-y"
                placeholder="อธิบายเหตุผลหรือแนวคิดของคำตอบ (ไม่บังคับ)"
              />
            </label>
          </main>

          <aside className="space-y-5 border-t border-hairline bg-black/[0.015] p-4 lg:border-l lg:border-t-0">
            <div className="flex items-center gap-2 font-semibold text-ink">
              <Settings2 className="h-4 w-4 text-blue-700" /> การตั้งค่า
            </div>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-ink">
                คำอธิบายแบบทดสอบ
              </span>
              <textarea
                value={data.description}
                disabled={locked}
                onChange={(event) =>
                  setData((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                maxLength={5000}
                rows={3}
                className="input resize-y text-sm"
                placeholder="สิ่งที่นักเรียนควรรู้ก่อนเริ่ม"
              />
            </label>
            <div>
              <span className="mb-2 block text-xs font-medium text-ink">
                โหมด
              </span>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-black/[0.04] p-1">
                {(["PRACTICE", "SCORED"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    disabled={locked}
                    onClick={() => setData((current) => ({ ...current, mode }))}
                    className={`min-h-9 rounded-md px-2 text-xs font-medium ${data.mode === mode ? "bg-surface text-blue-700 shadow-sm" : "text-ink-mute"}`}
                  >
                    {mode === "PRACTICE" ? "ฝึกทำ" : "มีคะแนน"}
                  </button>
                ))}
              </div>
            </div>
            <SettingToggle
              label="บังคับทำ"
              checked={data.required}
              disabled={locked}
              onChange={(required) =>
                setData((current) => ({ ...current, required }))
              }
            />
            <SettingToggle
              label="สุ่มลำดับคำถาม"
              icon={Shuffle}
              checked={data.shuffleQuestions}
              disabled={locked}
              onChange={(shuffleQuestions) =>
                setData((current) => ({ ...current, shuffleQuestions }))
              }
            />
            <SettingToggle
              label="สุ่มตัวเลือก"
              checked={data.shuffleOptions}
              disabled={locked}
              onChange={(shuffleOptions) =>
                setData((current) => ({ ...current, shuffleOptions }))
              }
            />
            <SettingToggle
              label="ซ่อนคำอธิบาย"
              checked={data.hideExplanations}
              disabled={locked}
              onChange={(hideExplanations) =>
                setData((current) => ({ ...current, hideExplanations }))
              }
            />
            <div className="grid grid-cols-2 gap-2">
              <NumberSetting
                label="เวลาทำ (นาที)"
                value={data.timeLimitMinutes}
                disabled={locked}
                onChange={(timeLimitMinutes) =>
                  setData((current) => ({ ...current, timeLimitMinutes }))
                }
              />
              <NumberSetting
                label="ผ่านขั้นต่ำ %"
                value={data.passThresholdPercent}
                disabled={locked}
                min={0}
                max={100}
                onChange={(passThresholdPercent) =>
                  setData((current) => ({ ...current, passThresholdPercent }))
                }
              />
            </div>
            {data.mode === "SCORED" && (
              <NumberSetting
                label="ทำได้สูงสุด (ครั้ง)"
                value={data.maxAttempts ?? 1}
                disabled={locked}
                min={1}
                max={10}
                onChange={(maxAttempts) =>
                  setData((current) => ({ ...current, maxAttempts }))
                }
              />
            )}
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1 text-xs font-medium text-ink">
                <Clock3 className="h-3.5 w-3.5" /> เปิดทำ
              </span>
              <input
                type="datetime-local"
                value={data.opensAt}
                disabled={locked}
                onChange={(event) =>
                  setData((current) => ({
                    ...current,
                    opensAt: event.target.value,
                  }))
                }
                className="input text-xs"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink">
                ปิดทำ
              </span>
              <input
                type="datetime-local"
                value={data.closesAt}
                disabled={locked}
                onChange={(event) =>
                  setData((current) => ({
                    ...current,
                    closesAt: event.target.value,
                  }))
                }
                className="input text-xs"
              />
            </label>
            <div>
              <span className="mb-2 block text-xs font-medium text-ink">
                ไฟล์ประกอบแบบทดสอบ
              </span>
              <TeacherAttachmentUploader
                key={data.id}
                ownerType="QUIZ"
                ownerId={data.id}
                initialFiles={data.attachments}
                disabled={locked}
                onChange={(attachments) =>
                  setData((current) => ({ ...current, attachments }))
                }
              />
            </div>
          </aside>
        </div>
      </form>

      {previewOpen && (
        <StudentPreview data={data} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  );
}

function SettingToggle({
  label,
  checked,
  onChange,
  disabled,
  icon: Icon = CircleHelp,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  icon?: typeof CircleHelp;
}) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-hairline bg-surface px-3 text-xs font-medium text-ink">
      <span className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-ink-mute" />
        {label}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-blue-600"
      />
    </label>
  );
}

function NumberSetting({
  label,
  value,
  onChange,
  disabled,
  min = 1,
  max = 1440,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) =>
          onChange(
            event.target.value === "" ? null : Number(event.target.value)
          )
        }
        className="input text-sm"
        placeholder="ไม่กำหนด"
      />
    </label>
  );
}

function StudentPreview({
  data,
  onClose,
}: {
  data: QuizBuilderInitialData;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const question = data.questions[index];
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div className="mx-auto my-6 max-w-3xl overflow-hidden rounded-lg border border-hairline bg-bg shadow-lift">
        <header className="flex items-start justify-between gap-4 border-b border-hairline bg-surface p-5">
          <div>
            <span className="badge">ตัวอย่างสำหรับนักเรียน</span>
            <h2 className="mt-2 text-xl font-semibold text-ink">
              {data.title || "แบบทดสอบไม่มีชื่อ"}
            </h2>
            <p className="mt-1 text-sm text-ink-mute">
              {data.lessonTitle} · ตัวอย่างนี้ไม่สร้าง Attempt
            </p>
          </div>
          <div className="flex items-center gap-2">
            {data.quizId && (
              <Link
                href={`/teacher/courses/${data.courseOfferingId}/quizzes/${data.quizId}/preview`}
                className="btn-secondary btn-sm"
              >
                ดูเต็มหน้า
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              className="icon-btn"
              title="ปิดตัวอย่าง"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>
        <div className="grid md:grid-cols-[180px_minmax(0,1fr)]">
          <nav className="flex gap-2 overflow-x-auto border-b border-hairline bg-surface p-3 md:block md:space-y-2 md:border-b-0 md:border-r">
            {data.questions.map((item, questionIndex) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setIndex(questionIndex)}
                className={`grid h-10 min-w-10 place-items-center rounded-lg border text-sm font-semibold ${questionIndex === index ? "border-blue-600 bg-blue-600 text-white" : "border-hairline text-ink"}`}
              >
                {questionIndex + 1}
              </button>
            ))}
          </nav>
          <section className="min-h-[420px] p-5 md:p-8">
            <div className="flex items-center justify-between gap-3 text-xs text-ink-mute">
              <span>
                คำถามที่ {index + 1} จาก {data.questions.length}
              </span>
              <span>{question.points} คะแนน</span>
            </div>
            <h3 className="mt-5 text-lg font-semibold leading-8 text-ink">
              {question.prompt || "ยังไม่ได้เขียนโจทย์"}
            </h3>
            <QuizAttachmentPreview
              attachments={previewFiles(question.attachments)}
            />
            <div className="mt-6 space-y-3">
              {question.options.map((option) => (
                <div
                  key={option.id}
                  className="rounded-lg border border-hairline bg-surface p-3 text-sm text-ink"
                >
                  <div className="flex min-h-8 items-center gap-3">
                    <span className="h-4 w-4 rounded-full border border-hairline" />
                    {option.text || "ตัวเลือกที่ยังไม่มีข้อความ"}
                  </div>
                  <QuizAttachmentPreview
                    attachments={previewFiles(option.attachments)}
                    compact
                  />
                </div>
              ))}
            </div>
            <div className="mt-8 flex justify-between">
              <button
                type="button"
                onClick={() => setIndex(Math.max(0, index - 1))}
                disabled={index === 0}
                className="btn-secondary btn-sm"
              >
                ย้อนกลับ
              </button>
              <button
                type="button"
                onClick={() =>
                  setIndex(Math.min(data.questions.length - 1, index + 1))
                }
                disabled={index === data.questions.length - 1}
                className="btn-primary btn-sm"
              >
                ข้อต่อไป
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function createBlankQuizData(input: {
  courseOfferingId: string;
  lessonId: string;
  lessonTitle: string;
}): QuizBuilderInitialData {
  return {
    ...input,
    id: newId(input.courseOfferingId),
    title: "",
    description: "",
    mode: "PRACTICE",
    required: false,
    opensAt: "",
    closesAt: "",
    timeLimitMinutes: null,
    maxAttempts: null,
    passThresholdPercent: null,
    shuffleQuestions: false,
    shuffleOptions: false,
    hideExplanations: false,
    attachments: [],
    questions: [blankQuestion(input.courseOfferingId)],
  };
}

function blankQuestion(courseOfferingId: string): BuilderQuestion {
  return {
    id: newId(courseOfferingId),
    type: "SINGLE_CHOICE",
    prompt: "",
    explanation: "",
    points: 1,
    attachments: [],
    options: [
      {
        id: newId(courseOfferingId),
        text: "",
        isCorrect: true,
        attachments: [],
      },
      {
        id: newId(courseOfferingId),
        text: "",
        isCorrect: false,
        attachments: [],
      },
    ],
  };
}

function newId(courseOfferingId: string): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const nonce = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return `${courseOfferingId}_d_${nonce}`;
}

function previewFiles(files: TeacherUploadedFile[]) {
  return files.map((file) => ({
    id: file.id,
    originalFilename: file.name,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
  }));
}

function toIsoOrNull(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
