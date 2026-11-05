import { NextResponse } from "next/server";
import { getMysqlDb, getLocalDb, saveLocalDb } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { invalidateServerCoursesCache } from "@/lib/courseCache";

export const dynamic = "force-dynamic";

function generateCouponCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let part = "";
  for (let i = 0; i < 6; i++) {
    part += chars[Math.floor(Math.random() * chars.length)];
  }
  return `ALPHA-${part}`;
}

export async function GET() {
  try {
    const mysqlDb = await getMysqlDb();

    if (mysqlDb) {
      const [users]: any = await mysqlDb.query(
        `SELECT id, full_name, phone, parent_phone, grade, role, is_active, attendance_code, activated_by, unlocked_courses, activated_at, created_at FROM users ORDER BY id DESC`
      );
      const [admins]: any = await mysqlDb.query(
        `SELECT id, full_name, phone, role, admin_code, created_at FROM admins ORDER BY id ASC`
      );
      const [codes]: any = await mysqlDb.query(
        `SELECT id, code, course_id, is_used, COALESCE(max_uses, 1) AS max_uses, COALESCE(uses_count, 0) AS uses_count, used_by_phone, created_by, expires_at, created_at FROM activation_codes ORDER BY id DESC`
      );
      const [courses]: any = await mysqlDb.query(
        `SELECT id, title, description, COALESCE(category, 'عام') AS category, grade, COALESCE(lessons_count, 0) AS lessons_count, thumbnail, created_by, created_at FROM courses ORDER BY id DESC`
      );
      const [lessons]: any = await mysqlDb.query(
        `SELECT id, course_id, title, video_url, duration, sort_order, created_at FROM course_lessons ORDER BY sort_order ASC, id ASC`
      );
      return NextResponse.json({ users, admins, codes, courses, lessons });
    }

    const localDb = getLocalDb();
    const safeUsers = localDb.users.map(({ password, ...rest }) => rest);
    const safeAdmins = (localDb.admins || []).map(({ password, ...rest }) => rest);
    return NextResponse.json({
      users: safeUsers,
      admins: safeAdmins,
      codes: localDb.activation_codes,
      courses: localDb.courses || [],
      lessons: localDb.course_lessons || [],
    });
  } catch {
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب بيانات لوحة التحكم" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;
    const mysqlDb = await getMysqlDb();

    if (mysqlDb) {
      // 1. Toggle Student Activation Status (saves admin's custom code in activated_by)
      if (action === "toggle-user") {
        const { userId, isActive, adminCode } = body;
        if (isActive) {
          await mysqlDb.query(
            `UPDATE users SET is_active = 1, activated_at = COALESCE(activated_at, NOW()), activated_by = ?, unlocked_courses = COALESCE(unlocked_courses, 'ALL') WHERE id = ?`,
            [adminCode || "ADM_1", userId]
          );
        } else {
          await mysqlDb.query(
            `UPDATE users SET is_active = 0 WHERE id = ?`,
            [userId]
          );
        }
        return NextResponse.json({
          success: true,
          message: isActive ? "تم تفعيل حساب الطالب بنجاح" : "تم إيقاف تفعيل الحساب",
        });
      }

      // 2. Delete Student from `users`
      if (action === "delete-user") {
        const { userId } = body;
        await mysqlDb.query(`DELETE FROM users WHERE id = ?`, [userId]);
        return NextResponse.json({
          success: true,
          message: "تم حذف حساب الطالب بنجاح",
        });
      }

      // 3. Create Staff Member in Dedicated `admins` Table
      if (action === "create-staff") {
        const { fullName, phone, password, role, customAdminCode } = body;
        if (!fullName?.trim() || !phone?.trim() || !password?.trim()) {
          return NextResponse.json(
            { error: "يرجى إدخال الاسم ورقم الهاتف وكلمة المرور" },
            { status: 400 }
          );
        }
        const [existsAdm]: any = await mysqlDb.query(
          `SELECT id FROM admins WHERE phone = ? LIMIT 1`,
          [phone.trim()]
        );
        const [existsUsr]: any = await mysqlDb.query(
          `SELECT id FROM users WHERE phone = ? LIMIT 1`,
          [phone.trim()]
        );
        if (existsAdm.length > 0 || existsUsr.length > 0) {
          return NextResponse.json(
            { error: "رقم الهاتف مسجل بالفعل في المنصة" },
            { status: 400 }
          );
        }

        const staffRole = role === "ADMIN" ? "ADMIN" : "TEAM";
        let finalCode = (customAdminCode || "").trim().toUpperCase();
        if (!finalCode) {
          const [staffRows]: any = await mysqlDb.query(
            `SELECT COUNT(*) AS cnt FROM admins`
          );
          const nextNum = (Number(staffRows[0]?.cnt) || 1) + 1;
          finalCode = `ADM_${nextNum}`;
        } else if (!finalCode.startsWith("ADM_")) {
          finalCode = `ADM_${finalCode.replace(/^ADM_?/i, "")}`;
        }

        const [codeDup]: any = await mysqlDb.query(
          `SELECT id FROM admins WHERE admin_code = ? LIMIT 1`,
          [finalCode]
        );
        if (codeDup.length > 0) {
          return NextResponse.json(
            { error: `الكود (${finalCode}) مستخدم بالفعل لأدمن آخر` },
            { status: 400 }
          );
        }

        const hashedPwd = hashPassword(password);
        await mysqlDb.query(
          `INSERT INTO admins (full_name, phone, password, role, admin_code)
           VALUES (?, ?, ?, ?, ?)`,
          [fullName.trim(), phone.trim(), hashedPwd, staffRole, finalCode]
        );
        return NextResponse.json({
          success: true,
          message: `تم إضافة ${fullName.trim()} في جدول الأدمن بكود (${finalCode})`,
        });
      }

      // 4. Delete Staff Member from Dedicated `admins` Table
      if (action === "delete-staff") {
        const { adminId } = body;
        const [target]: any = await mysqlDb.query(
          `SELECT phone, admin_code FROM admins WHERE id = ? LIMIT 1`,
          [adminId]
        );
        if (
          target.length > 0 &&
          (target[0].phone === "01000000000" || target[0].admin_code === "ADM_1")
        ) {
          return NextResponse.json(
            { error: "لا يمكن حذف حساب الأدمن الرئيسي للمنصة" },
            { status: 400 }
          );
        }
        await mysqlDb.query(`DELETE FROM admins WHERE id = ?`, [adminId]);
        return NextResponse.json({
          success: true,
          message: "تم حذف عضو التيم بنجاح",
        });
      }

      // 5. Generate Activation Codes with Custom Expiry Date/Time, Max Uses, Course ID & Creator Admin Code
      if (action === "generate-codes") {
        const count = Math.min(Math.max(Number(body.count) || 1, 1), 50);
        const maxUses = Math.min(Math.max(Number(body.maxUses) || 1, 1), 1000);
        const courseId = body.courseId ? Number(body.courseId) : null;
        const adminCode = body.adminCode || "ADM_1";
        const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

        const created: string[] = [];
        for (let i = 0; i < count; i++) {
          const code = generateCouponCode();
          await mysqlDb.query(
            `INSERT IGNORE INTO activation_codes (code, course_id, is_used, max_uses, uses_count, created_by, expires_at) VALUES (?, ?, 0, ?, 0, ?, ?)`,
            [code, courseId, maxUses, adminCode, expiresAt]
          );
          created.push(code);
        }
        return NextResponse.json({
          success: true,
          message: `تم توليد ${created.length} كود تفعيل (مسموح لـ ${maxUses} شخص لكل كود)`,
        });
      }

      // 6. Delete Activation Code
      if (action === "delete-code") {
        const { codeId } = body;
        await mysqlDb.query(`DELETE FROM activation_codes WHERE id = ?`, [codeId]);
        return NextResponse.json({
          success: true,
          message: "تم حذف الكود بنجاح",
        });
      }

      // 7. Create Course / Category
      if (action === "create-course") {
        const { title, category, description, grade, thumbnail, adminCode } = body;
        if (!title?.trim()) {
          return NextResponse.json(
            { error: "يرجى إدخال عنوان الكورس" },
            { status: 400 }
          );
        }
        await mysqlDb.query(
          `INSERT INTO courses (title, description, category, grade, price, lessons_count, hours, badge, thumbnail, created_by)
           VALUES (?, ?, ?, ?, 'مفعل', 0, 'متاح الآن', ?, ?, ?)`,
          [
            title.trim(),
            description?.trim() || "كورس شامل مع جميع المحاضرات والتدريبات",
            category?.trim() || "المستوى الأول",
            grade || "grade_3",
            category?.trim() || "كورس",
            thumbnail?.trim() || null,
            adminCode || "ADM_1",
          ]
        );
        invalidateServerCoursesCache();
        return NextResponse.json({
          success: true,
          message: "تم إنشاء الكورس بنجاح، يمكنك الآن رفع الفيديوهات بداخله",
        });
      }

      // 7b. Update Course Cover Image (Thumbnail)
      if (action === "update-course-thumbnail") {
        const { courseId, thumbnail } = body;
        await mysqlDb.query(
          `UPDATE courses SET thumbnail = ? WHERE id = ?`,
          [thumbnail?.trim() || null, courseId]
        );
        invalidateServerCoursesCache(Number(courseId));
        return NextResponse.json({
          success: true,
          message: "تم تحديث صورة كارت الكورس بنجاح",
        });
      }

      // 8. Delete Course / Category + its lessons
      if (action === "delete-course") {
        const { courseId } = body;
        await mysqlDb.query(`DELETE FROM course_lessons WHERE course_id = ?`, [
          courseId,
        ]);
        await mysqlDb.query(`DELETE FROM courses WHERE id = ?`, [courseId]);
        invalidateServerCoursesCache(Number(courseId));
        return NextResponse.json({
          success: true,
          message: "تم حذف الكورس وجميع محاضراته بنجاح",
        });
      }

      // 9. Add Video Lesson inside a Course
      if (action === "create-lesson") {
        const { courseId, title, videoUrl, duration } = body;
        if (!courseId || !title?.trim() || !videoUrl?.trim()) {
          return NextResponse.json(
            { error: "يرجى إدخال عنوان الفيديو ورابط الفيديو" },
            { status: 400 }
          );
        }
        const [cntRows]: any = await mysqlDb.query(
          `SELECT COUNT(*) AS cnt FROM course_lessons WHERE course_id = ?`,
          [courseId]
        );
        const nextOrder = (Number(cntRows[0]?.cnt) || 0) + 1;

        await mysqlDb.query(
          `INSERT INTO course_lessons (course_id, title, video_url, duration, sort_order)
           VALUES (?, ?, ?, ?, ?)`,
          [
            courseId,
            title.trim(),
            videoUrl.trim(),
            duration?.trim() || "15 دقيقة",
            nextOrder,
          ]
        );
        await mysqlDb.query(
          `UPDATE courses SET lessons_count = ? WHERE id = ?`,
          [nextOrder, courseId]
        );
        invalidateServerCoursesCache(Number(courseId));
        return NextResponse.json({
          success: true,
          message: `تم إضافة الفيديو (${title.trim()}) داخل الكورس بنجاح`,
        });
      }

      // 10. Delete Video Lesson from a Course
      if (action === "delete-lesson") {
        const { lessonId, courseId } = body;
        await mysqlDb.query(`DELETE FROM course_lessons WHERE id = ?`, [
          lessonId,
        ]);
        if (courseId) {
          const [cntRows]: any = await mysqlDb.query(
            `SELECT COUNT(*) AS cnt FROM course_lessons WHERE course_id = ?`,
            [courseId]
          );
          await mysqlDb.query(
            `UPDATE courses SET lessons_count = ? WHERE id = ?`,
            [Number(cntRows[0]?.cnt) || 0, courseId]
          );
        }
        invalidateServerCoursesCache(Number(courseId));
        return NextResponse.json({
          success: true,
          message: "تم حذف الفيديو من الكورس بنجاح",
        });
      }
    }

    // Local DB Fallback
    const localDb = getLocalDb();

    if (action === "toggle-user") {
      const { userId, isActive, adminCode } = body;
      const user = localDb.users.find((u) => u.id === userId);
      if (user) {
        user.is_active = isActive ? 1 : 0;
        if (isActive) {
          user.activated_by = adminCode || "ADM_1";
          if (!user.activated_at) {
            user.activated_at = new Date().toISOString();
          }
        }
        saveLocalDb(localDb);
      }
      return NextResponse.json({
        success: true,
        message: isActive ? "تم تفعيل حساب الطالب بنجاح" : "تم إيقاف تفعيل الحساب",
      });
    }

    if (action === "delete-user") {
      const { userId } = body;
      localDb.users = localDb.users.filter((u) => u.id !== userId);
      saveLocalDb(localDb);
      return NextResponse.json({
        success: true,
        message: "تم حذف حساب الطالب بنجاح",
      });
    }

    if (action === "create-staff") {
      const { fullName, phone, password, role, customAdminCode } = body;
      if (!fullName?.trim() || !phone?.trim() || !password?.trim()) {
        return NextResponse.json(
          { error: "يرجى إدخال الاسم ورقم الهاتف وكلمة المرور" },
          { status: 400 }
        );
      }
      if (
        (localDb.admins || []).some((a) => a.phone === phone.trim()) ||
        localDb.users.some((u) => u.phone === phone.trim())
      ) {
        return NextResponse.json(
          { error: "رقم الهاتف مسجل بالفعل في المنصة" },
          { status: 400 }
        );
      }
      const staffRole = role === "ADMIN" ? "ADMIN" : "TEAM";
      let finalCode = (customAdminCode || "").trim().toUpperCase();
      if (!finalCode) {
        const nextNum = (localDb.admins?.length || 1) + 1;
        finalCode = `ADM_${nextNum}`;
      } else if (!finalCode.startsWith("ADM_")) {
        finalCode = `ADM_${finalCode.replace(/^ADM_?/i, "")}`;
      }

      if ((localDb.admins || []).some((a) => a.admin_code === finalCode)) {
        return NextResponse.json(
          { error: `الكود (${finalCode}) مستخدم بالفعل لأدمن آخر` },
          { status: 400 }
        );
      }

      localDb.admins.push({
        id: Date.now(),
        full_name: fullName.trim(),
        phone: phone.trim(),
        password: hashPassword(password),
        role: staffRole,
        admin_code: finalCode,
        created_at: new Date().toISOString(),
      });
      saveLocalDb(localDb);
      return NextResponse.json({
        success: true,
        message: `تم إضافة ${fullName.trim()} في جدول الأدمن بكود (${finalCode})`,
      });
    }

    if (action === "delete-staff") {
      const { adminId } = body;
      const target = (localDb.admins || []).find((a) => a.id === adminId);
      if (
        target &&
        (target.phone === "01000000000" || target.admin_code === "ADM_1")
      ) {
        return NextResponse.json(
          { error: "لا يمكن حذف حساب الأدمن الرئيسي للمنصة" },
          { status: 400 }
        );
      }
      localDb.admins = (localDb.admins || []).filter((a) => a.id !== adminId);
      saveLocalDb(localDb);
      return NextResponse.json({
        success: true,
        message: "تم حذف عضو التيم بنجاح",
      });
    }

    if (action === "generate-codes") {
      const count = Math.min(Math.max(Number(body.count) || 1, 1), 50);
      const maxUses = Math.min(Math.max(Number(body.maxUses) || 1, 1), 1000);
      const courseId = body.courseId ? Number(body.courseId) : null;
      const adminCode = body.adminCode || "ADM_1";
      const expiresAt = body.expiresAt
        ? new Date(body.expiresAt).toISOString()
        : null;

      for (let i = 0; i < count; i++) {
        localDb.activation_codes.push({
          id: Date.now() + i,
          code: generateCouponCode(),
          course_id: courseId,
          is_used: 0,
          max_uses: maxUses,
          uses_count: 0,
          used_by_phone: null,
          created_by: adminCode,
          expires_at: expiresAt,
          created_at: new Date().toISOString(),
        });
      }
      saveLocalDb(localDb);
      return NextResponse.json({
        success: true,
        message: `تم توليد ${count} كود تفعيل (مسموح لـ ${maxUses} شخص لكل كود)`,
      });
    }

    if (action === "delete-code") {
      const { codeId } = body;
      localDb.activation_codes = localDb.activation_codes.filter(
        (c) => c.id !== codeId
      );
      saveLocalDb(localDb);
      return NextResponse.json({
        success: true,
        message: "تم حذف الكود بنجاح",
      });
    }

    if (action === "create-course") {
      const { title, category, description, grade, thumbnail, adminCode } = body;
      if (!title?.trim()) {
        return NextResponse.json(
          { error: "يرجى إدخال عنوان الكورس" },
          { status: 400 }
        );
      }
      if (!Array.isArray(localDb.courses)) localDb.courses = [];
      localDb.courses.push({
        id: Date.now(),
        title: title.trim(),
        description:
          description?.trim() || "كورس شامل مع جميع المحاضرات والتدريبات",
        category: category?.trim() || "المستوى الأول",
        grade: grade || "grade_3",
        price: "مفعل",
        lessons_count: 0,
        hours: "متاح الآن",
        badge: category?.trim() || "كورس",
        thumbnail: thumbnail?.trim() || null,
        created_by: adminCode || "ADM_1",
        created_at: new Date().toISOString(),
      });
      saveLocalDb(localDb);
      return NextResponse.json({
        success: true,
        message: "تم إنشاء الكورس بنجاح، يمكنك الآن رفع الفيديوهات بداخله",
      });
    }

    if (action === "update-course-thumbnail") {
      const { courseId, thumbnail } = body;
      const targetCourse = (localDb.courses || []).find(
        (c) => c.id === Number(courseId)
      );
      if (targetCourse) {
        targetCourse.thumbnail = thumbnail?.trim() || null;
        saveLocalDb(localDb);
      }
      return NextResponse.json({
        success: true,
        message: "تم تحديث صورة كارت الكورس بنجاح",
      });
    }

    if (action === "delete-course") {
      const { courseId } = body;
      localDb.courses = (localDb.courses || []).filter((c) => c.id !== courseId);
      localDb.course_lessons = (localDb.course_lessons || []).filter(
        (l) => l.course_id !== courseId
      );
      saveLocalDb(localDb);
      return NextResponse.json({
        success: true,
        message: "تم حذف الكورس وجميع محاضراته بنجاح",
      });
    }

    if (action === "create-lesson") {
      const { courseId, title, videoUrl, duration } = body;
      if (!courseId || !title?.trim() || !videoUrl?.trim()) {
        return NextResponse.json(
          { error: "يرجى إدخال عنوان الفيديو ورابط الفيديو" },
          { status: 400 }
        );
      }
      if (!Array.isArray(localDb.course_lessons)) localDb.course_lessons = [];
      const courseLessons = localDb.course_lessons.filter(
        (l) => l.course_id === Number(courseId)
      );
      const nextOrder = courseLessons.length + 1;
      localDb.course_lessons.push({
        id: Date.now(),
        course_id: Number(courseId),
        title: title.trim(),
        video_url: videoUrl.trim(),
        duration: duration?.trim() || "15 دقيقة",
        sort_order: nextOrder,
        created_at: new Date().toISOString(),
      });
      const targetCourse = (localDb.courses || []).find(
        (c) => c.id === Number(courseId)
      );
      if (targetCourse) targetCourse.lessons_count = nextOrder;
      saveLocalDb(localDb);
      return NextResponse.json({
        success: true,
        message: `تم إضافة الفيديو (${title.trim()}) داخل الكورس بنجاح`,
      });
    }

    if (action === "delete-lesson") {
      const { lessonId, courseId } = body;
      localDb.course_lessons = (localDb.course_lessons || []).filter(
        (l) => l.id !== lessonId
      );
      const targetCourse = (localDb.courses || []).find(
        (c) => c.id === Number(courseId)
      );
      if (targetCourse) {
        targetCourse.lessons_count = (localDb.course_lessons || []).filter(
          (l) => l.course_id === Number(courseId)
        ).length;
      }
      saveLocalDb(localDb);
      return NextResponse.json({
        success: true,
        message: "تم حذف الفيديو من الكورس بنجاح",
      });
    }

    return NextResponse.json({ error: "طلب غير معروف" }, { status: 400 });
  } catch {
    return NextResponse.json(
      { error: "حدث خطأ في السيرفر" },
      { status: 500 }
    );
  }
}
