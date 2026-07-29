export const TEACHER_CREATED_FLASH_COOKIE = "admin_teacher_created_flash";

export interface CreateTeacherState {
  fieldErrors?: Record<string, string>;
  error?: string;
}

export interface TeacherCreatedFlash {
  userId: string;
  teacherName: string;
  email: string;
  tempPassword: string;
}
