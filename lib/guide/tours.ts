/**
 * Guided walkthrough content, kept as data so the overlay component stays a
 * renderer and the copy can be reviewed in one place.
 *
 * A tour is scoped to a role and a surface. Selectors address `data-guide`
 * attributes rather than class names, so restyling cannot silently unanchor a
 * step, and a step whose target is absent is skipped at runtime — which surface
 * shows which controls depends on feature flags and on whether the person has
 * any courses yet.
 */

export const TOUR_IDS = [
  "student-dashboard",
  "student-course",
  "teacher-dashboard",
  "teacher-course",
] as const;

export type TourId = (typeof TOUR_IDS)[number];

export type TourStep = {
  selector: string;
  title: string;
  body: string;
};

export type Tour = {
  id: TourId;
  steps: readonly TourStep[];
};

const STUDENT_DASHBOARD: Tour = {
  id: "student-dashboard",
  steps: [
    {
      selector: '[data-guide-nav="/student/courses"]',
      title: "ห้องเรียนทั้งหมดของคุณอยู่ที่นี่",
      body: "วิชาที่คุณเข้าร่วมแล้วจะมารวมกันตรงนี้ เปิดวิชาไหนก็ได้เพื่อดูงาน คะแนน และการเข้าเรียนของวิชานั้น",
    },
    {
      selector: '[data-guide="student-join"]',
      title: "เข้าห้องเรียนใหม่ด้วยรหัสจากครู",
      body: "ครูจะให้รหัสห้องหรือ QR มา ใช้ปุ่มนี้กรอกรหัสเพื่อเข้าร่วม แล้ววิชาจะขึ้นในห้องเรียนของคุณทันที",
    },
    {
      selector: '[data-guide-nav="/student/terms"]',
      title: "ผลการเรียนรวมทุกวิชา",
      body: "ดูคะแนนรวมและเกรดของแต่ละวิชาที่ครูประกาศแล้ว สั่งพิมพ์หรือบันทึกเป็น PDF จากหน้านี้ได้",
    },
    {
      selector: '[data-guide-nav="/student/timetable"]',
      title: "ตารางเรียนของคุณ",
      body: "คาบเรียนของทุกวิชาที่ครูตั้งเวลาไว้ จะมาเรียงเป็นตารางให้อัตโนมัติ",
    },
    {
      selector: '[data-guide-nav="/profile"]',
      title: "โปรไฟล์และธีม",
      body: "เปลี่ยนรูปโปรไฟล์ ตั้งรหัสผ่าน และสลับธีมสว่าง/มืด/ครีมได้ที่นี่",
    },
  ],
};

const STUDENT_COURSE: Tour = {
  id: "student-course",
  steps: [
    {
      selector: '[data-guide="course-tabs"]',
      title: "ทุกอย่างของวิชานี้อยู่ในแถบนี้",
      body: "ฟีดคือประกาศและความเคลื่อนไหวล่าสุด ส่วนแท็บอื่นคืองาน คะแนน การเข้าเรียน และเพื่อนร่วมห้อง",
    },
    {
      selector: '[data-guide-tab="assignments"]',
      title: "งานที่ต้องส่ง",
      body: "ดูกำหนดส่ง ส่งงานเป็นข้อความ ไฟล์ หรือลิงก์ และกลับมาแก้ก่อนถึงกำหนดได้ เมื่อครูตรวจแล้วจะเห็นคะแนนและคำติชมที่นี่",
    },
    {
      selector: '[data-guide-tab="scores"]',
      title: "คะแนนของคุณ",
      body: "เห็นเฉพาะคะแนนที่ครูประกาศแล้ว และเป็นคะแนนของคุณคนเดียว — ระบบไม่แสดงคะแนนของเพื่อนให้ใครนอกจากครู",
    },
    {
      selector: '[data-guide-tab="attendance"]',
      title: "การเข้าเรียนของคุณ",
      body: "สรุปว่ามา สาย ลา หรือขาดกี่คาบ ถ้าเห็นว่าไม่ตรงกับความจริง ให้แจ้งครูผู้สอนแก้ไข",
    },
    {
      selector: '[data-guide-tab="members"]',
      title: "เพื่อนร่วมห้อง",
      body: "ดูว่าใครเรียนวิชานี้บ้าง รายชื่อนี้แสดงแค่ชื่อ ไม่มีคะแนนหรือข้อมูลส่วนตัวของใคร",
    },
  ],
};

const TEACHER_DASHBOARD: Tour = {
  id: "teacher-dashboard",
  steps: [
    {
      selector: '[data-guide-nav="/teacher/courses"]',
      title: "วิชาที่คุณสอน",
      body: "วิชาทั้งหมดรวมอยู่ที่นี่ พร้อมจำนวนนักเรียน งานที่รอตรวจ และคะแนนที่ยังเป็นร่าง",
    },
    {
      selector: '[data-guide-nav="/teacher/courses/new"]',
      title: "สร้างวิชาใหม่",
      body: "ตั้งชื่อวิชาแล้วระบบจะสร้างรหัสเข้าห้องให้อัตโนมัติ เอารหัสหรือ QR ไปให้นักเรียนเข้าร่วม",
    },
    {
      selector: '[data-guide-nav="/teacher/timetable"]',
      title: "ตารางสอนรวมทุกวิชา",
      body: "คาบเรียนที่ตั้งไว้ในแต่ละวิชาจะมาเรียงรวมกันที่นี่ ใช้ดูว่าชนกันหรือเปล่า",
    },
    {
      selector: '[data-guide-nav="/profile"]',
      title: "โปรไฟล์และธีม",
      body: "เปลี่ยนรูปโปรไฟล์ อีเมล รหัสผ่าน และสลับธีมได้ที่นี่",
    },
  ],
};

const TEACHER_COURSE: Tour = {
  id: "teacher-course",
  steps: [
    {
      selector: '[data-guide="course-tabs"]',
      title: "ทุกอย่างของวิชาอยู่ในแถบนี้",
      body: "แต่ละแท็บคือส่วนหนึ่งของการสอน — โพสต์ในฟีด สั่งงาน เช็กชื่อ ให้คะแนน และดูรายชื่อสมาชิก",
    },
    {
      selector: '[data-guide="course-composer"]',
      title: "โพสต์และสั่งงานจากปุ่มนี้",
      body: "ใช้ปุ่มเดียวสำหรับประกาศ แจกเอกสาร และสั่งงาน นักเรียนจะเห็นในฟีดของวิชาทันที",
    },
    {
      selector: '[data-guide-tab="assignments"]',
      title: "ตรวจงานที่นักเรียนส่ง",
      body: "เปิดงานแต่ละชิ้นเพื่อดูว่าใครส่งแล้ว ให้คะแนนพร้อมคำติชม หรือส่งคืนให้แก้ ทุกครั้งที่แก้คะแนนหลังประกาศ ระบบจะขอเหตุผลและบันทึกไว้",
    },
    {
      selector: '[data-guide-tab="attendance"]',
      title: "เช็กชื่อตามคาบ",
      body: "เลือกคาบแล้วบันทึกว่ามา สาย ลา หรือขาด ต้องตั้งเวลาเรียนในหน้าตั้งค่าก่อน คาบถึงจะขึ้นให้เลือก",
    },
    {
      selector: '[data-guide-tab="scores"]',
      title: "สมุดคะแนนและการประกาศ",
      body: "สร้างรายการคะแนน กรอกคะแนน แล้วประกาศเมื่อพร้อม นักเรียนจะเห็นเฉพาะรายการที่ประกาศแล้ว และเห็นแค่ของตัวเอง",
    },
    {
      selector: '[data-guide-tab="settings"]',
      title: "รหัสเข้าห้อง เวลาเรียน และการยกเลิกวิชา",
      body: "แชร์หรือปิดรหัสเข้าห้อง ตั้งคาบเรียน ปรับเกณฑ์เกรด และยกเลิกวิชาเมื่อจบเทอม โดยไม่ลบคะแนนหรืองานที่ผ่านมา",
    },
  ],
};

const BY_ID: Record<TourId, Tour> = {
  "student-dashboard": STUDENT_DASHBOARD,
  "student-course": STUDENT_COURSE,
  "teacher-dashboard": TEACHER_DASHBOARD,
  "teacher-course": TEACHER_COURSE,
};

export function tourById(id: TourId): Tour {
  return BY_ID[id];
}
