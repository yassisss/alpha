import { NextResponse } from "next/server";
import { getMysqlDb, getLocalDb, saveLocalDb, generateAttendanceCode } from "@/lib/db";
import { hashPassword, verifyPassword, isPasswordHashed } from "@/lib/password";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function attachSessionCookie(res: NextResponse, user: { id: number; phone: string; role: string }) {
  const token = createSessionToken(user);
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
  return res;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "logout") {
      const res = NextResponse.json({ success: true });
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }

    const mysqlDb = await getMysqlDb();

    // =========================================================================
    // MODE A: Remote MySQL is Online
    // =========================================================================
    if (mysqlDb) {
      if (action === "login") {
        const { phone, password } = body;

        // 1. Check dedicated `admins` table first
        const [adminRows]: any = await mysqlDb.query(
          `SELECT id, full_name, phone, password, role, admin_code, created_at FROM admins WHERE phone = ? LIMIT 1`,
          [phone]
        );
        if (adminRows.length > 0) {
          const adm = adminRows[0];
          const isValidAdm = verifyPassword(password, adm.password);
          if (!isValidAdm) {
            return NextResponse.json(
              { error: "رقم الهاتف أو كلمة المرور غير صحيحة" },
              { status: 401 }
            );
          }
          if (!isPasswordHashed(adm.password)) {
            await mysqlDb.query(`UPDATE admins SET password = ? WHERE id = ?`, [
              hashPassword(password),
              adm.id,
            ]);
          }
          const safeAdmin = {
            id: adm.id,
            full_name: adm.full_name,
            phone: adm.phone,
            parent_phone: null,
            grade: null,
            role: adm.role || "ADMIN",
            is_active: 1,
            attendance_code: adm.admin_code,
            admin_code: adm.admin_code,
            activated_at: adm.created_at,
            created_at: adm.created_at,
          };
          const res = NextResponse.json({ success: true, user: safeAdmin });
          return attachSessionCookie(res, {
            id: safeAdmin.id,
            phone: safeAdmin.phone,
            role: safeAdmin.role,
          });
        }

        // 2. Otherwise check `users` table (students)
        const [rows]: any = await mysqlDb.query(
          `SELECT * FROM users WHERE phone = ? LIMIT 1`,
          [phone]
        );
        if (rows.length === 0) {
          return NextResponse.json(
            { error: "رقم الهاتف أو كلمة المرور غير صحيحة" },
            { status: 401 }
          );
        }

        const user = rows[0];
        const isValid = verifyPassword(password, user.password);
        if (!isValid) {
          return NextResponse.json(
            { error: "رقم الهاتف أو كلمة المرور غير صحيحة" },
            { status: 401 }
          );
        }

        if (!isPasswordHashed(user.password)) {
          const newHash = hashPassword(password);
          await mysqlDb.query(`UPDATE users SET password = ? WHERE id = ?`, [
            newHash,
            user.id,
          ]);
        }

        if (!user.attendance_code || !user.attendance_code.includes("_")) {
          const newAttCode = generateAttendanceCode("STUDENT");
          user.attendance_code = newAttCode;
          await mysqlDb.query(
            `UPDATE users SET attendance_code = ? WHERE id = ?`,
            [newAttCode, user.id]
          );
        }

        if (!user.is_active) {
          return NextResponse.json(
            {
              error:
                "حسابك مسجل ولكن بانتظار التفعيل من قِبل المدرس أو التيم (أو استخدم كود تفعيل).",
            },
            { status: 403 }
          );
        }

        const { password: _, ...safeUser } = user;
        const res = NextResponse.json({ success: true, user: safeUser });
        return attachSessionCookie(res, {
          id: safeUser.id,
          phone: safeUser.phone,
          role: "STUDENT",
        });
      }

      if (action === "register") {
        const { fullName, phone, parentPhone, grade, password } = body;
        const [existingAdm]: any = await mysqlDb.query(
          `SELECT id FROM admins WHERE phone = ? LIMIT 1`,
          [phone]
        );
        const [existing]: any = await mysqlDb.query(
          `SELECT id FROM users WHERE phone = ? LIMIT 1`,
          [phone]
        );
        if (existingAdm.length > 0 || existing.length > 0) {
          return NextResponse.json(
            { error: "رقم الهاتف مسجل بالفعل في المنصة" },
            { status: 400 }
          );
        }

        const hashedPwd = hashPassword(password);
        const attCode = generateAttendanceCode();

        await mysqlDb.query(
          `INSERT INTO users (full_name, phone, parent_phone, grade, password, role, is_active, attendance_code)
           VALUES (?, ?, ?, ?, ?, 'STUDENT', 0, ?)`,
          [fullName, phone, parentPhone, grade, hashedPwd, attCode]
        );
        return NextResponse.json({
          success: true,
          message:
            "تم إنشاء حسابك بنجاح! حالة الحساب الآن: (بانتظار التفعيل).",
        });
      }

      if (action === "code") {
        const { phone, code } = body;
        const normalizedCode = code.trim().toUpperCase();
        const [codeRows]: any = await mysqlDb.query(
          `SELECT id, course_id, is_used, COALESCE(max_uses, 1) AS max_uses, COALESCE(uses_count, 0) AS uses_count, used_by_phone, created_by, expires_at FROM activation_codes WHERE code = ? LIMIT 1`,
          [normalizedCode]
        );
        if (codeRows.length === 0) {
          return NextResponse.json(
            { error: "كود التفعيل غير صحيح" },
            { status: 404 }
          );
        }
        const codeRow = codeRows[0];
        const maxUses = Math.max(1, Number(codeRow.max_uses) || 1);
        const usesCount = Number(codeRow.uses_count) || 0;

        if (codeRow.is_used || usesCount >= maxUses) {
          return NextResponse.json(
            { error: "تم استنفاد الحد الأقصى لاستخدام هذا الكود" },
            { status: 400 }
          );
        }
        if (
          codeRow.expires_at &&
          Date.now() > new Date(codeRow.expires_at).getTime()
        ) {
          return NextResponse.json(
            { error: "انتهت صلاحية كود التفعيل هذا" },
            { status: 400 }
          );
        }
        const [userRows]: any = await mysqlDb.query(
          `SELECT id, full_name, phone, parent_phone, grade, role, attendance_code, unlocked_courses, created_at FROM users WHERE phone = ? LIMIT 1`,
          [phone]
        );
        if (userRows.length === 0) {
          return NextResponse.json(
            { error: "رقم الهاتف غير مسجل، يرجى إنشاء حساب أولاً ثم تفعيل الكود" },
            { status: 404 }
          );
        }

        const existingPhones = codeRow.used_by_phone
          ? String(codeRow.used_by_phone)
              .split(",")
              .map((p: string) => p.trim())
              .filter(Boolean)
          : [];

        if (!existingPhones.includes(phone)) {
          existingPhones.push(phone);
        }
        const nextUsesCount = existingPhones.length;
        const nextIsUsed = nextUsesCount >= maxUses ? 1 : 0;
        const nextUsedByPhone = existingPhones.join(", ");

        // Calculate unlocked_courses for this student
        const currentUnlockedRaw = String(userRows[0].unlocked_courses || "").trim();
        let nextUnlockedCourses = "ALL";
        if (codeRow.course_id) {
          if (currentUnlockedRaw === "ALL") {
            nextUnlockedCourses = "ALL";
          } else {
            const currentIds = currentUnlockedRaw
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            const targetIdStr = String(codeRow.course_id);
            if (!currentIds.includes(targetIdStr)) {
              currentIds.push(targetIdStr);
            }
            nextUnlockedCourses = currentIds.join(",");
          }
        }

        const nowIso = new Date().toISOString();
        const attCode = userRows[0].attendance_code || generateAttendanceCode();
        const creatorAdmin = codeRow.created_by || "ADM_01";
        const activatedByLabel = `${creatorAdmin} (${normalizedCode})`;
        try {
          await mysqlDb.query(
            `UPDATE users SET is_active = 1, activated_at = NOW(), attendance_code = ?, activated_by = ?, unlocked_courses = ? WHERE phone = ?`,
            [attCode, activatedByLabel, nextUnlockedCourses, phone]
          );
        } catch {
          await mysqlDb.query(
            `UPDATE users SET is_active = 1, activated_at = NOW(), attendance_code = ?, activated_by = ? WHERE phone = ?`,
            [attCode, activatedByLabel, phone]
          );
        }
        await mysqlDb.query(
          `UPDATE activation_codes SET is_used = ?, uses_count = ?, used_by_phone = ? WHERE id = ?`,
          [nextIsUsed, nextUsesCount, nextUsedByPhone, codeRow.id]
        );
        const updatedUser = {
          ...userRows[0],
          is_active: 1,
          activated_at: nowIso,
          attendance_code: attCode,
          unlocked_courses: nextUnlockedCourses,
        };
        const res = NextResponse.json({
          success: true,
          user: updatedUser,
        });
        return attachSessionCookie(res, {
          id: updatedUser.id,
          phone: updatedUser.phone,
          role: updatedUser.role || "STUDENT",
        });
      }

      if (action === "change-password") {
        const { phone, currentPassword, newPassword } = body;

        // Check `admins` first
        const [admRows]: any = await mysqlDb.query(
          `SELECT id, password FROM admins WHERE phone = ? LIMIT 1`,
          [phone]
        );
        if (admRows.length > 0) {
          const adm = admRows[0];
          if (!verifyPassword(currentPassword, adm.password)) {
            return NextResponse.json(
              { error: "كلمة المرور الحالية غير صحيحة" },
              { status: 400 }
            );
          }
          const hashedNewPwd = hashPassword(newPassword);
          await mysqlDb.query(`UPDATE admins SET password = ? WHERE id = ?`, [
            hashedNewPwd,
            adm.id,
          ]);
          return NextResponse.json({
            success: true,
            message: "تم تحديث كلمة المرور بنجاح",
          });
        }

        const [rows]: any = await mysqlDb.query(
          `SELECT id, password, activated_at, created_at FROM users WHERE phone = ? LIMIT 1`,
          [phone]
        );
        if (rows.length === 0) {
          return NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 });
        }
        const user = rows[0];
        if (!verifyPassword(currentPassword, user.password)) {
          return NextResponse.json(
            { error: "كلمة المرور الحالية غير صحيحة" },
            { status: 400 }
          );
        }
        const baseDate = new Date(user.activated_at || user.created_at).getTime();
        if (Date.now() - baseDate < THREE_DAYS_MS) {
          return NextResponse.json(
            { error: "لا يمكن تغيير كلمة المرور إلا بعد مرور 3 أيام من تاريخ تفعيل الحساب" },
            { status: 403 }
          );
        }
        const hashedNewPwd = hashPassword(newPassword);
        await mysqlDb.query(`UPDATE users SET password = ? WHERE phone = ?`, [
          hashedNewPwd,
          phone,
        ]);
        return NextResponse.json({
          success: true,
          message: "تم تحديث كلمة المرور بنجاح",
        });
      }
    }
    const localDb = getLocalDb();

    if (action === "login") {
      const { phone, password } = body;

      // 1. Check local `admins` first
      const adm = (localDb.admins || []).find((a) => a.phone === phone);
      if (adm) {
        if (!verifyPassword(password, adm.password)) {
          return NextResponse.json(
            { error: "رقم الهاتف أو كلمة المرور غير صحيحة" },
            { status: 401 }
          );
        }
        if (!isPasswordHashed(adm.password)) {
          adm.password = hashPassword(password);
          saveLocalDb(localDb);
        }
        const safeAdmin = {
          id: adm.id,
          full_name: adm.full_name,
          phone: adm.phone,
          parent_phone: null,
          grade: null,
          role: adm.role || "ADMIN",
          is_active: 1,
          attendance_code: adm.admin_code,
          admin_code: adm.admin_code,
          activated_at: adm.created_at,
          created_at: adm.created_at,
        };
        const res = NextResponse.json({ success: true, user: safeAdmin });
        return attachSessionCookie(res, {
          id: safeAdmin.id,
          phone: safeAdmin.phone,
          role: safeAdmin.role,
        });
      }

      // 2. Otherwise check local `users` (students)
      const user = localDb.users.find((u) => u.phone === phone);
      if (!user || !verifyPassword(password, user.password)) {
        return NextResponse.json(
          { error: "رقم الهاتف أو كلمة المرور غير صحيحة" },
          { status: 401 }
        );
      }

      if (!isPasswordHashed(user.password)) {
        user.password = hashPassword(password);
        saveLocalDb(localDb);
      }

      if (!user.attendance_code || !user.attendance_code.includes("_")) {
        user.attendance_code = generateAttendanceCode("STUDENT");
        saveLocalDb(localDb);
      }

      if (!user.is_active) {
        return NextResponse.json(
          {
            error:
              "حسابك مسجل ولكن بانتظار التفعيل من قِبل المدرس أو التيم (أو استخدم كود تفعيل).",
          },
          { status: 403 }
        );
      }

      const { password: _, ...safeUser } = user;
      const res = NextResponse.json({ success: true, user: safeUser });
      return attachSessionCookie(res, {
        id: safeUser.id,
        phone: safeUser.phone,
        role: "STUDENT",
      });
    }

    if (action === "register") {
      const { fullName, phone, parentPhone, grade, password } = body;
      const exists =
        (localDb.admins || []).some((a) => a.phone === phone) ||
        localDb.users.some((u) => u.phone === phone);
      if (exists) {
        return NextResponse.json(
          { error: "رقم الهاتف مسجل بالفعل في المنصة" },
          { status: 400 }
        );
      }
      localDb.users.push({
        id: localDb.users.length + 1,
        full_name: fullName,
        phone,
        parent_phone: parentPhone,
        grade,
        password: hashPassword(password),
        role: "STUDENT",
        is_active: 0,
        attendance_code: generateAttendanceCode(),
        activated_at: null,
        created_at: new Date().toISOString(),
      });
      saveLocalDb(localDb);
      return NextResponse.json({
        success: true,
        message: "تم إنشاء حسابك بنجاح! حالة الحساب الآن: (بانتظار التفعيل).",
      });
    }

    if (action === "code") {
      const { phone, code } = body;
      const normalizedCode = code.trim().toUpperCase();
      const foundCode = localDb.activation_codes.find(
        (c) => c.code === normalizedCode
      );
      if (!foundCode) {
        return NextResponse.json(
          { error: "كود التفعيل غير صحيح" },
          { status: 404 }
        );
      }
      const maxUses = Math.max(1, Number(foundCode.max_uses) || 1);
      const usesCount = Number(foundCode.uses_count) || 0;
      if (foundCode.is_used || usesCount >= maxUses) {
        return NextResponse.json(
          { error: "تم استنفاد الحد الأقصى لاستخدام هذا الكود" },
          { status: 400 }
        );
      }
      if (
        foundCode.expires_at &&
        Date.now() > new Date(foundCode.expires_at).getTime()
      ) {
        return NextResponse.json(
          { error: "انتهت صلاحية كود التفعيل هذا" },
          { status: 400 }
        );
      }
      const user = localDb.users.find((u) => u.phone === phone);
      if (!user) {
        return NextResponse.json(
          { error: "رقم الهاتف غير مسجل، يرجى إنشاء حساب أولاً ثم تفعيل الكود" },
          { status: 404 }
        );
      }
      const existingPhones = foundCode.used_by_phone
        ? String(foundCode.used_by_phone)
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean)
        : [];
      if (!existingPhones.includes(phone)) {
        existingPhones.push(phone);
      }
      const nextUsesCount = existingPhones.length;
      foundCode.uses_count = nextUsesCount;
      foundCode.is_used = nextUsesCount >= maxUses ? 1 : 0;
      foundCode.used_by_phone = existingPhones.join(", ");

      const currentUnlockedRaw = String(user.unlocked_courses || "").trim();
      let nextUnlockedCourses = "ALL";
      if (foundCode.course_id) {
        if (currentUnlockedRaw === "ALL") {
          nextUnlockedCourses = "ALL";
        } else {
          const currentIds = currentUnlockedRaw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          const targetIdStr = String(foundCode.course_id);
          if (!currentIds.includes(targetIdStr)) {
            currentIds.push(targetIdStr);
          }
          nextUnlockedCourses = currentIds.join(",");
        }
      }

      user.is_active = 1;
      user.activated_at = new Date().toISOString();
      const creatorAdmin = foundCode.created_by || "ADM_01";
      user.activated_by = `${creatorAdmin} (${normalizedCode})`;
      user.unlocked_courses = nextUnlockedCourses;
      if (!user.attendance_code) {
        user.attendance_code = generateAttendanceCode();
      }
      saveLocalDb(localDb);

      const { password: _, ...safeUser } = user;
      const res = NextResponse.json({
        success: true,
        user: safeUser,
      });
      return attachSessionCookie(res, {
        id: safeUser.id,
        phone: safeUser.phone,
        role: safeUser.role || "STUDENT",
      });
    }

    if (action === "change-password") {
      const { phone, currentPassword, newPassword } = body;
      const user = localDb.users.find((u) => u.phone === phone);
      if (!user) {
        return NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 });
      }
      if (!verifyPassword(currentPassword, user.password)) {
        return NextResponse.json(
          { error: "كلمة المرور الحالية غير صحيحة" },
          { status: 400 }
        );
      }
      const baseDate = new Date(user.activated_at || user.created_at).getTime();
      if (Date.now() - baseDate < THREE_DAYS_MS) {
        return NextResponse.json(
          { error: "لا يمكن تغيير كلمة المرور إلا بعد مرور 3 أيام من تاريخ تفعيل الحساب" },
          { status: 403 }
        );
      }
      user.password = hashPassword(newPassword);
      saveLocalDb(localDb);
      return NextResponse.json({
        success: true,
        message: "تم تحديث كلمة المرور بنجاح",
      });
    }

    return NextResponse.json({ error: "طلب غير معروف" }, { status: 400 });
  } catch (err: any) {
    console.error("Auth Error:", err);
    return NextResponse.json(
      { error: err?.message || "حدث خطأ في السيرفر، يرجى المحاولة مرة أخرى" },
      { status: 500 }
    );
  }
}
