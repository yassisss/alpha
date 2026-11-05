import { NextResponse } from "next/server";
import { getMysqlDb, getLocalDb } from "@/lib/db";
import {
  getServerCoursesCache,
  setServerCoursesCache,
  getServerCourseDetailCache,
  setServerCourseDetailCache,
} from "@/lib/courseCache";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("id");

    // 1. Check fast in-memory server cache first
    if (courseId) {
      const cachedDetail = getServerCourseDetailCache(Number(courseId));
      if (cachedDetail) {
        return NextResponse.json(cachedDetail);
      }
    } else {
      const cachedList = getServerCoursesCache();
      if (cachedList) {
        return NextResponse.json({ courses: cachedList });
      }
    }

    const mysqlDb = await getMysqlDb();
    if (mysqlDb) {
      if (courseId) {
        const [courseRows]: any = await mysqlDb.query(
          `SELECT id, title, description, COALESCE(category, 'عام') AS category, grade, COALESCE(price, 'مفعل') AS price, COALESCE(lessons_count, 0) AS lessonsCount, COALESCE(hours, 'متاح الآن') AS hours, COALESCE(badge, 'كورس') AS badge, thumbnail, created_by FROM courses WHERE id = ? LIMIT 1`,
          [Number(courseId)]
        );
        if (courseRows.length === 0) {
          return NextResponse.json({ error: "الكورس غير موجود" }, { status: 404 });
        }
        const [lessons]: any = await mysqlDb.query(
          `SELECT id, course_id, title, video_url, duration, sort_order, created_at FROM course_lessons WHERE course_id = ? ORDER BY sort_order ASC, id ASC`,
          [Number(courseId)]
        );
        const courseObj = { ...courseRows[0], isUnlocked: true };
        setServerCourseDetailCache(Number(courseId), courseObj, lessons);
        return NextResponse.json({
          course: courseObj,
          lessons,
        });
      }

      const [rows]: any = await mysqlDb.query(
        `SELECT id, title, description, COALESCE(category, 'عام') AS category, grade, COALESCE(price, 'مفعل') AS price, COALESCE(lessons_count, 0) AS lessonsCount, COALESCE(hours, 'متاح الآن') AS hours, COALESCE(badge, 'كورس') AS badge, thumbnail, created_by FROM courses ORDER BY id DESC`
      );
      const formatted = rows.map((r: any) => ({ ...r, isUnlocked: true }));
      setServerCoursesCache(formatted);
      return NextResponse.json({ courses: formatted });
    }

    // Local DB Fallback
    const localDb = getLocalDb();
    const localCourses = localDb.courses || [];
    const localLessons = localDb.course_lessons || [];

    if (courseId) {
      const found = localCourses.find((c) => c.id === Number(courseId));
      if (!found) {
        return NextResponse.json({ error: "الكورس غير موجود" }, { status: 404 });
      }
      const courseLessons = localLessons
        .filter((l) => l.course_id === Number(courseId))
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

      return NextResponse.json({
        course: {
          ...found,
          lessonsCount: courseLessons.length,
          isUnlocked: true,
        },
        lessons: courseLessons,
      });
    }

    return NextResponse.json({
      courses: localCourses.map((c) => ({
        ...c,
        lessonsCount: c.lessons_count || 0,
        isUnlocked: true,
      })),
    });
  } catch {
    return NextResponse.json({ courses: [] });
  }
}
