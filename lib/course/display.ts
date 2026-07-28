type CourseDisplaySource = {
  id: string;
  learnerGroupLabel?: string | null;
  academicPeriodLabel?: string | null;
  creditHours?: number | null;
};

function clean(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function courseLearnerGroup(course: CourseDisplaySource): string | null {
  return clean(course.learnerGroupLabel);
}

export function courseAcademicPeriod(
  course: CourseDisplaySource
): string | null {
  return clean(course.academicPeriodLabel);
}

export function courseVisualKey(course: CourseDisplaySource): string {
  return course.id;
}

export function courseMetadataParts(course: CourseDisplaySource): string[] {
  const parts = [
    courseLearnerGroup(course),
    courseAcademicPeriod(course),
    course.creditHours == null ? null : `${course.creditHours} หน่วยกิต`,
  ];
  return parts.filter((part): part is string => Boolean(part));
}
