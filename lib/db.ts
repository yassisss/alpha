import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { hashPassword, isPasswordHashed } from "@/lib/password";

function getCleanMysqlUri(): string {
  const raw = process.env.MYSQL_URL || process.env.DATABASE_URL || "";
  if (!raw) return "";
  const dbName = process.env.MYSQL_DB_NAME || "alphateam";
  try {
    const parsed = new URL(raw);
    if (!parsed.pathname || parsed.pathname === "/" || parsed.pathname === "") {
      parsed.pathname = `/${dbName}`;
    }
    return parsed.toString();
  } catch {
    if (raw.endsWith(`/${dbName}`)) return raw;
    return raw.endsWith("/") ? `${raw}${dbName}` : `${raw}/${dbName}`;
  }
}

declare global {
  // Prevent Next.js HMR from creating multiple MySQL pools and hitting "Too many connections"
  var __alphaMysqlPool: mysql.Pool | undefined;
  var __alphaMysqlInitialized: boolean | undefined;
  var __alphaMysqlInitPromise: Promise<void> | undefined;
}

// Local JSON database fallback when remote MySQL host is offline
// In cloud/Vercel serverless environments, file system outside /tmp is read-only
const isServerless =
  Boolean(process.env.VERCEL) ||
  Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
  (typeof process.cwd === "function" && process.cwd().startsWith("/var/task"));

const LOCAL_DB_PATH = isServerless
  ? path.join("/tmp", "local-db.json")
  : path.join(process.cwd(), "data", "local-db.json");

let inMemoryFallbackDb: LocalDbSchema | null = null;

export interface LocalDbSchema {
  admins: Array<{
    id: number;
    full_name: string;
    phone: string;
    password: string;
    role: "ADMIN" | "TEAM";
    admin_code: string;
    created_at: string;
  }>;
  users: Array<{
    id: number;
    full_name: string;
    phone: string;
    parent_phone: string | null;
    grade: string | null;
    password: string;
    role: "STUDENT" | "ADMIN" | "TEAM";
    is_active: number;
    attendance_code?: string;
    activated_by?: string | null;
    unlocked_courses?: string | null;
    activated_at?: string | null;
    created_at: string;
  }>;
  activation_codes: Array<{
    id: number;
    code: string;
    course_id?: number | null;
    is_used: number;
    max_uses?: number;
    uses_count?: number;
    used_by_phone: string | null;
    created_by?: string | null;
    expires_at?: string | null;
    created_at?: string;
  }>;
  courses?: Array<{
    id: number;
    title: string;
    description: string;
    category: string;
    grade: string;
    price: string;
    lessons_count: number;
    hours: string;
    badge: string;
    thumbnail?: string | null;
    created_by?: string | null;
    created_at?: string;
  }>;
  course_lessons?: Array<{
    id: number;
    course_id: number;
    title: string;
    video_url: string;
    duration: string;
    sort_order: number;
    created_at?: string;
  }>;
}

export function generateAttendanceCode(role: string = "STUDENT"): string {
  if (role === "ADMIN" || role === "TEAM") {
    const num = Math.floor(10 + Math.random() * 89);
    return `ADM_${num}`;
  }
  const prefixes = ["S", "W", "A", "M", "K"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const num = Math.floor(10 + Math.random() * 989);
  return `${prefix}_${num}`;
}

export function getLocalDb(): LocalDbSchema {
  if (inMemoryFallbackDb) {
    return inMemoryFallbackDb;
  }
  const defaultData: LocalDbSchema = {
    admins: [
      {
        id: 1,
        full_name: "المدرس المسؤول",
        phone: "01000000000",
        password: hashPassword("admin123"),
        role: "ADMIN",
        admin_code: "ADM_1",
        created_at: new Date().toISOString(),
      },
      {
        id: 2,
        full_name: "مدير النظام التجريبي",
        phone: "admin",
        password: hashPassword("admin"),
        role: "ADMIN",
        admin_code: "ADM_ADMIN",
        created_at: new Date().toISOString(),
      },
    ],
    users: [],
    activation_codes: [],
  };

  try {
    const dir = path.dirname(LOCAL_DB_PATH);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {}
    }
    if (!fs.existsSync(LOCAL_DB_PATH)) {
      try {
        fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(defaultData, null, 2), "utf8");
      } catch {}
      inMemoryFallbackDb = defaultData;
      return defaultData;
    }

    const parsed: LocalDbSchema = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, "utf8"));
    if (!parsed.admins) parsed.admins = [];
    const existingAdmin = parsed.admins.find((a) => a.phone === "admin");
    if (!existingAdmin) {
      parsed.admins.push({
        id: parsed.admins.length + 1,
        full_name: "مدير النظام التجريبي",
        phone: "admin",
        password: hashPassword("admin"),
        role: "ADMIN",
        admin_code: "ADM_ADMIN",
        created_at: new Date().toISOString(),
      });
      try {
        fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(parsed, null, 2), "utf8");
      } catch {}
    } else {
      existingAdmin.password = hashPassword("admin");
    }
    inMemoryFallbackDb = parsed;
    return parsed;
  } catch {
    inMemoryFallbackDb = defaultData;
    return defaultData;
  }
}

export function saveLocalDb(data: LocalDbSchema) {
  inMemoryFallbackDb = data;
  try {
    const dir = path.dirname(LOCAL_DB_PATH);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {}
    }
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch {}
}

export async function getDb() {
  return getMysqlDb();
}

export async function getMysqlDb(): Promise<mysql.Pool | null> {
  const connectionUri = getCleanMysqlUri();
  if (!connectionUri) {
    return null;
  }
  try {
    if (!globalThis.__alphaMysqlPool) {
      globalThis.__alphaMysqlPool = mysql.createPool({
        uri: connectionUri,
        waitForConnections: true,
        connectionLimit: 2,
        maxIdle: 1,
        idleTimeout: 5000,
        queueLimit: 0,
        connectTimeout: 10000,
      });
    }

    const activePool = globalThis.__alphaMysqlPool;

    if (activePool && !globalThis.__alphaMysqlInitialized) {
      if (!globalThis.__alphaMysqlInitPromise) {
        globalThis.__alphaMysqlInitPromise = initTables(activePool)
          .then(() => {
            globalThis.__alphaMysqlInitialized = true;
          })
          .catch((err) => {
            globalThis.__alphaMysqlInitPromise = undefined;
            throw err;
          });
      }
      await globalThis.__alphaMysqlInitPromise;
    }

    return activePool;
  } catch (err) {
    console.error("MySQL connection error:", err);
    return null;
  }
}

async function ensureColumn(
  db: mysql.Pool,
  table: string,
  column: string,
  alterSql: string
) {
  try {
    const [cols]: any = await db.query(
      `SHOW COLUMNS FROM \`${table}\` LIKE ?`,
      [column]
    );
    if (cols.length === 0) {
      await db.query(alterSql);
    }
  } catch {}
}

async function initTables(db: mysql.Pool) {
  // Clean up any stale sleeping connections from previous dev hot-reloads to prevent "Too many connections"
  try {
    await db.query(`SET SESSION wait_timeout = 30`);
    const [procs]: any = await db.query(
      `SELECT ID FROM information_schema.PROCESSLIST WHERE COMMAND = 'Sleep' AND TIME > 5 AND ID != CONNECTION_ID()`
    );
    for (const p of procs || []) {
      if (p.ID) {
        try {
          await db.query(`KILL ?`, [p.ID]);
        } catch {}
      }
    }
  } catch {}

  // 1. Dedicated ADMINS Table (separate from students)
  await db.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      phone VARCHAR(30) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role ENUM('ADMIN', 'TEAM') DEFAULT 'ADMIN',
      admin_code VARCHAR(30) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 2. USERS Table (dedicated for students)
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      phone VARCHAR(30) NOT NULL UNIQUE,
      parent_phone VARCHAR(30) DEFAULT NULL,
      grade VARCHAR(50) DEFAULT NULL,
      password VARCHAR(255) NOT NULL,
      role ENUM('STUDENT', 'ADMIN', 'TEAM') DEFAULT 'STUDENT',
      is_active TINYINT(1) DEFAULT 0,
      attendance_code VARCHAR(20) DEFAULT NULL,
      activated_by VARCHAR(150) DEFAULT NULL,
      activated_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await ensureColumn(
    db,
    "users",
    "activated_at",
    `ALTER TABLE users ADD COLUMN activated_at TIMESTAMP NULL DEFAULT NULL AFTER is_active`
  );
  await ensureColumn(
    db,
    "users",
    "attendance_code",
    `ALTER TABLE users ADD COLUMN attendance_code VARCHAR(20) DEFAULT NULL AFTER is_active`
  );
  await ensureColumn(
    db,
    "users",
    "activated_by",
    `ALTER TABLE users ADD COLUMN activated_by VARCHAR(150) DEFAULT NULL AFTER attendance_code`
  );
  await ensureColumn(
    db,
    "users",
    "unlocked_courses",
    `ALTER TABLE users ADD COLUMN unlocked_courses TEXT DEFAULT NULL AFTER activated_by`
  );

  try {
    // Migrate any ADMIN / TEAM rows from `users` into the dedicated `admins` table, then delete them from `users`
    const [legacyStaff]: any = await db.query(
      `SELECT id, full_name, phone, password, role, attendance_code FROM users WHERE role IN ('ADMIN', 'TEAM') ORDER BY id ASC`
    );
    for (const staff of legacyStaff) {
      const hashedPwd = isPasswordHashed(staff.password)
        ? staff.password
        : hashPassword(staff.password);
      const [existingAdm]: any = await db.query(
        `SELECT id FROM admins WHERE phone = ? LIMIT 1`,
        [staff.phone]
      );
      if (existingAdm.length === 0) {
        const [cntRows]: any = await db.query(
          `SELECT COUNT(*) AS cnt FROM admins`
        );
        const nextIdx = (Number(cntRows[0]?.cnt) || 0) + 1;
        const codeToUse =
          staff.phone === "01000000000"
            ? "ADM_1"
            : staff.attendance_code && staff.attendance_code.startsWith("ADM_")
            ? staff.attendance_code
            : `ADM_${nextIdx}`;
        await db.query(
          `INSERT IGNORE INTO admins (full_name, phone, password, role, admin_code)
           VALUES (?, ?, ?, ?, ?)`,
          [
            staff.full_name,
            staff.phone,
            hashedPwd,
            staff.role === "ADMIN" ? "ADMIN" : "TEAM",
            codeToUse,
          ]
        );
      }
      await db.query(`DELETE FROM users WHERE id = ?`, [staff.id]);
    }

    // Ensure primary admin exists in `admins` with code ADM_1
    const [primaryAdmins]: any = await db.query(
      `SELECT id, password, admin_code FROM admins WHERE phone = '01000000000' LIMIT 1`
    );
    if (primaryAdmins.length === 0) {
      const hashedAdminPwd = hashPassword("admin123");
      await db.query(
        `INSERT IGNORE INTO admins (full_name, phone, password, role, admin_code)
         VALUES ('المدرس المسؤول', '01000000000', ?, 'ADMIN', 'ADM_1')`,
        [hashedAdminPwd]
      );
    } else {
      if (primaryAdmins[0].admin_code !== "ADM_1") {
        await db.query(
          `UPDATE admins SET admin_code = 'ADM_1' WHERE id = ?`,
          [primaryAdmins[0].id]
        );
      }
    }

    // Ensure test admin exists (username: admin / password: admin)
    const [demoAdmins]: any = await db.query(
      `SELECT id FROM admins WHERE phone = 'admin' LIMIT 1`
    );
    const hashedDemoPwd = hashPassword("admin");
    if (demoAdmins.length === 0) {
      await db.query(
        `INSERT IGNORE INTO admins (full_name, phone, password, role, admin_code)
         VALUES ('مدير تجريبي', 'admin', ?, 'ADMIN', 'ADM_ADMIN')`,
        [hashedDemoPwd]
      );
    } else {
      await db.query(
        `UPDATE admins SET password = ? WHERE phone = 'admin'`,
        [hashedDemoPwd]
      );
    }

    // Ensure all passwords in `admins` are hashed
    const [allAdmins]: any = await db.query(
      `SELECT id, password FROM admins`
    );
    for (const adm of allAdmins) {
      if (adm.password && !isPasswordHashed(adm.password)) {
        await db.query(`UPDATE admins SET password = ? WHERE id = ?`, [
          hashPassword(adm.password),
          adm.id,
        ]);
      }
    }

    // Normalize students in `users`
    const [allStudents]: any = await db.query(
      `SELECT id, password, attendance_code, grade FROM users`
    );
    const gradeMap: Record<string, string> = {
      "الصف الثالث الثانوي": "grade_3",
      "الصف الثاني الثانوي": "grade_2",
      "الصف الأول الثانوي": "grade_1",
      "3sec": "grade_3",
      "2sec": "grade_2",
      "1sec": "grade_1",
    };
    for (const u of allStudents) {
      if (u.password && !isPasswordHashed(u.password)) {
        await db.query(`UPDATE users SET password = ? WHERE id = ?`, [
          hashPassword(u.password),
          u.id,
        ]);
      }
      if (!u.attendance_code || !u.attendance_code.includes("_")) {
        await db.query(`UPDATE users SET attendance_code = ? WHERE id = ?`, [
          generateAttendanceCode("STUDENT"),
          u.id,
        ]);
      }
      if (u.grade && gradeMap[u.grade]) {
        await db.query(`UPDATE users SET grade = ? WHERE id = ?`, [
          gradeMap[u.grade],
          u.id,
        ]);
      }
    }
  } catch {}

  // 3. ACTIVATION CODES Table
  await db.query(`
    CREATE TABLE IF NOT EXISTS activation_codes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(100) NOT NULL UNIQUE,
      course_id INT DEFAULT NULL,
      is_used TINYINT(1) DEFAULT 0,
      max_uses INT DEFAULT 1,
      uses_count INT DEFAULT 0,
      used_by_phone TEXT DEFAULT NULL,
      created_by VARCHAR(150) DEFAULT NULL,
      expires_at DATETIME DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await ensureColumn(
    db,
    "activation_codes",
    "course_id",
    `ALTER TABLE activation_codes ADD COLUMN course_id INT DEFAULT NULL AFTER code`
  );
  await ensureColumn(
    db,
    "activation_codes",
    "max_uses",
    `ALTER TABLE activation_codes ADD COLUMN max_uses INT DEFAULT 1 AFTER is_used`
  );
  await ensureColumn(
    db,
    "activation_codes",
    "uses_count",
    `ALTER TABLE activation_codes ADD COLUMN uses_count INT DEFAULT 0 AFTER max_uses`
  );
  await ensureColumn(
    db,
    "activation_codes",
    "created_by",
    `ALTER TABLE activation_codes ADD COLUMN created_by VARCHAR(150) DEFAULT NULL AFTER used_by_phone`
  );
  await ensureColumn(
    db,
    "activation_codes",
    "expires_at",
    `ALTER TABLE activation_codes ADD COLUMN expires_at DATETIME DEFAULT NULL AFTER created_by`
  );

  try {
    await db.query(
      `ALTER TABLE activation_codes MODIFY COLUMN used_by_phone TEXT DEFAULT NULL`
    );
  } catch {}

  await db.query(
    `DELETE FROM activation_codes WHERE code = 'ALPHA-2026-FREE'`
  );

  // 4. COURSES (Categories / Courses) & COURSE_LESSONS (Videos inside each course)
  await db.query(`
    CREATE TABLE IF NOT EXISTS courses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      category VARCHAR(150) DEFAULT 'عام',
      grade VARCHAR(50) NOT NULL DEFAULT 'grade_3',
      price VARCHAR(100) DEFAULT 'مفعل',
      lessons_count INT DEFAULT 0,
      hours VARCHAR(100) DEFAULT 'متاح الآن',
      badge VARCHAR(100) DEFAULT 'كورس',
      thumbnail TEXT DEFAULT NULL,
      created_by VARCHAR(50) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await ensureColumn(
    db,
    "courses",
    "category",
    `ALTER TABLE courses ADD COLUMN category VARCHAR(150) DEFAULT 'عام' AFTER description`
  );
  await ensureColumn(
    db,
    "courses",
    "thumbnail",
    `ALTER TABLE courses ADD COLUMN thumbnail TEXT DEFAULT NULL AFTER badge`
  );
  await ensureColumn(
    db,
    "courses",
    "created_by",
    `ALTER TABLE courses ADD COLUMN created_by VARCHAR(50) DEFAULT NULL AFTER thumbnail`
  );

  await db.query(`
    CREATE TABLE IF NOT EXISTS course_lessons (
      id INT AUTO_INCREMENT PRIMARY KEY,
      course_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      video_url TEXT NOT NULL,
      duration VARCHAR(100) DEFAULT '15 دقيقة',
      sort_order INT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}
