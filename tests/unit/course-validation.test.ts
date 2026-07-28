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
  const course = {
    id: "course-standalone",
    learnerGroupLabel: "กลุ่มสนทนาภาษาอังกฤษ",
    academicPeriodLabel: "คอร์สฤดูร้อน 2569",
    creditHours: 1.5,
  };

  it("uses teacher-owned metadata", () => {
    expect(courseLearnerGroup(course)).toBe("กลุ่มสนทนาภาษาอังกฤษ");
    expect(courseAcademicPeriod(course)).toBe("คอร์สฤดูร้อน 2569");
    expect(courseVisualKey(course)).toBe("course-standalone");
  });

  it("omits blank optional metadata instead of rendering placeholders", () => {
    const course = {
      id: "course-new",
      learnerGroupLabel: " ",
      academicPeriodLabel: "",
      creditHours: null,
    };

    expect(courseMetadataParts(course)).toEqual([]);
    expect(courseVisualKey(course)).toBe("course-new");
  });
});
