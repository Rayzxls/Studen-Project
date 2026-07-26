import { describe, expect, it } from "vitest";
import {
  courseAcademicPeriod,
  courseLearnerGroup,
  courseMetadataParts,
  courseVisualKey,
} from "@/lib/course/display";
import { CreateCourseSchema } from "@/lib/validation/course";

describe("CreateCourseSchema", () => {
  it("allows a teacher to create a course with only a name", () => {
    const parsed = CreateCourseSchema.parse({ name: "English Conversation" });

    expect(parsed).toEqual({ name: "English Conversation" });
  });

  it("accepts optional teacher-owned display metadata", () => {
    const parsed = CreateCourseSchema.parse({
      name: "English Conversation",
      subjectCode: "ENG-101",
      learnerGroupLabel: "ม.4/3",
      academicPeriodLabel: "ภาคเรียนที่ 1 ปี 2569",
      creditHours: 1.5,
    });

    expect(parsed.learnerGroupLabel).toBe("ม.4/3");
    expect(parsed.academicPeriodLabel).toBe("ภาคเรียนที่ 1 ปี 2569");
    expect(parsed.creditHours).toBe(1.5);
  });

  it("keeps blank optional labels valid", () => {
    expect(
      CreateCourseSchema.safeParse({
        name: "English Conversation",
        subjectCode: "",
        learnerGroupLabel: "",
        academicPeriodLabel: "",
      }).success
    ).toBe(true);
  });

  it("rejects invalid credit hours", () => {
    expect(
      CreateCourseSchema.safeParse({
        name: "English Conversation",
        creditHours: -1,
      }).success
    ).toBe(false);
    expect(
      CreateCourseSchema.safeParse({
        name: "English Conversation",
        creditHours: 11,
      }).success
    ).toBe(false);
    expect(
      CreateCourseSchema.safeParse({
        name: "English Conversation",
        creditHours: Number.NaN,
      }).success
    ).toBe(false);
  });
});

describe("course display metadata", () => {
  const legacyCourse = {
    id: "course-legacy",
    learnerGroupLabel: null,
    academicPeriodLabel: null,
    gradeLevel: "ม.4",
    creditHours: 1.5,
    class: { id: "class-legacy", name: "ม.4/3" },
    term: { name: "ภาคเรียนที่ 1 ปี 2569" },
  };

  it("prefers teacher-owned metadata over legacy relations", () => {
    const course = {
      ...legacyCourse,
      learnerGroupLabel: "กลุ่มสนทนาภาษาอังกฤษ",
      academicPeriodLabel: "คอร์สฤดูร้อน 2569",
    };

    expect(courseLearnerGroup(course)).toBe("กลุ่มสนทนาภาษาอังกฤษ");
    expect(courseAcademicPeriod(course)).toBe("คอร์สฤดูร้อน 2569");
  });

  it("falls back to legacy display values during the additive rollout", () => {
    expect(courseLearnerGroup(legacyCourse)).toBe("ม.4/3");
    expect(courseAcademicPeriod(legacyCourse)).toBe("ภาคเรียนที่ 1 ปี 2569");
    expect(courseVisualKey(legacyCourse)).toBe("class-legacy");
  });

  it("omits blank optional metadata instead of rendering placeholders", () => {
    const course = {
      id: "course-new",
      learnerGroupLabel: " ",
      academicPeriodLabel: "",
      gradeLevel: null,
      creditHours: null,
      class: null,
      term: null,
    };

    expect(courseMetadataParts(course)).toEqual([]);
    expect(courseVisualKey(course)).toBe("course-new");
  });
});
