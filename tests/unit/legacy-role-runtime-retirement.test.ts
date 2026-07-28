import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(path), "utf8");
}

const retiredTeacherRelation = ["home", "roomOf"].join("");
const retiredTeacherLabel = ["ครู", "ประจำชั้น"].join("");
const retiredClassField = ["class", "Id"].join("");

describe("D0.1 legacy role runtime retirement", () => {
  it("does not project retired role relations on dashboards", () => {
    const dashboard = source("app/dashboard/page.tsx");

    expect(dashboard).not.toContain(retiredTeacherRelation);
    expect(dashboard).not.toContain(["home", "roomName"].join(""));
    expect(dashboard).not.toContain("user.student?.class");
    expect(dashboard).not.toContain(retiredTeacherLabel);
  });

  it("keeps Admin people lists independent from shared Class identity", () => {
    const studentsPage = source("app/admin/students/page.tsx");
    const studentsQuery = source("lib/admin/students-list.ts");
    const teachersPage = source("app/admin/teachers/page.tsx");
    const teachersQuery = source("lib/admin/teachers-list.ts");

    expect(studentsPage).not.toContain(`name="${retiredClassField}"`);
    expect(studentsPage).not.toContain("ห้องประจำ");
    expect(studentsQuery).not.toContain(retiredClassField);
    expect(studentsQuery).not.toContain("className");
    expect(teachersPage).not.toContain(retiredTeacherLabel);
    expect(teachersQuery).not.toContain(retiredTeacherRelation);
  });

  it("does not assign retired teacher relations in bootstrap or seed", () => {
    const bootstrap = source("prisma/bootstrap.ts");
    const seed = source("prisma/seed.ts");

    expect(bootstrap).not.toContain(`${retiredTeacherRelation}Id`);
    expect(seed).not.toContain(`${retiredTeacherRelation}Id`);
  });
});
