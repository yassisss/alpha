"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  getCachedCoursesList,
  setCachedCoursesList,
} from "@/lib/clientCache";
import {
  PlayCircle,
  BookOpen,
  Clock,
  CheckCircle2,
  Lock,
  QrCode,
  User,
  GraduationCap,
  ArrowLeft,
  Bell,
} from "lucide-react";

interface CourseItem {
  id: number;
  title: string;
  description: string;
  grade: string;
  price: string;
  lessonsCount: number;
  hours: string;
  badge: string;
  thumbnail?: string | null;
  isUnlocked?: boolean;
}

interface UserProfile {
  id?: number;
  full_name: string;
  phone: string;
  grade?: string | null;
  attendance_code?: string | null;
  role?: string;
}

const GRADE_LABELS: Record<string, string> = {
  grade_3: "الصف الثالث الثانوي",
  grade_2: "الصف الثاني الثانوي",
  grade_1: "الصف الأول الثانوي",
};

function formatGrade(grade?: string | null): string {
  if (!grade) return "";
  return GRADE_LABELS[grade] || grade;
}

export default function HomePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    let gradeFilter: string | null = null;
    try {
      const saved = localStorage.getItem("alphateam-user");
      if (saved) {
        const parsed = JSON.parse(saved);
        gradeFilter = parsed.grade || null;
        setUser(parsed);
        setLoadingUser(false);
      }
    } catch {}

    const applyFilter = (list: CourseItem[]) => {
      if (gradeFilter) {
        return list.filter(
          (c) =>
            c.grade === gradeFilter || c.grade === formatGrade(gradeFilter)
        );
      }
      return list;
    };

    const cached = getCachedCoursesList();
    if (cached && cached.length > 0) {
      setCourses(applyFilter(cached));
    }

    fetch("/api/courses")
      .then((res) => res.json())
      .then((data) => {
        const allCourses: CourseItem[] = Array.isArray(data.courses)
          ? data.courses
          : [];
        setCachedCoursesList(allCourses);
        setCourses(applyFilter(allCourses));
      })
      .catch(() => {});
  }, []);

  const showUserShimmer = loadingUser || !user;

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-28 pb-16 space-y-8">
        {/* Welcome Hero Banner */}
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3 text-center md:text-right w-full md:w-auto">
            {showUserShimmer ? (
              <div className="space-y-2.5 flex flex-col items-center md:items-start">
                <div className="h-5 w-28 rounded-lg shimmer-box" />
                <div className="h-8 w-64 rounded-xl shimmer-box" />
                <div className="h-4 w-48 rounded-md shimmer-box" />
              </div>
            ) : (
              <>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/70 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                  <GraduationCap className="w-4 h-4" />
                  <span>{formatGrade(user.grade) || "ALPHA TEAM"}</span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  أهلاً بك، {user.full_name.split(" ")[0]}
                </h1>

                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  تابع محاضراتك، المراجعات، وكود الحضور الخاص بك من مكان واحد.
                </p>
              </>
            )}
          </div>

          {/* Quick Actions inside Banner */}
          <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
            <Link
              href="/courses"
              className="px-5 py-3 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-sm flex items-center gap-2"
            >
              <PlayCircle className="w-4 h-4" />
              <span>محاضراتي</span>
            </Link>

            <Link
              href="/profile"
              className="px-5 py-3 rounded-xl font-bold text-xs text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition flex items-center gap-2"
            >
              <QrCode className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>كود الحضور QR</span>
            </Link>
          </div>
        </div>

        {/* Quick Info Cards Row */}
        <div className="grid sm:grid-cols-3 gap-4">
          {/* Card 1: Attendance Code */}
          <Link
            href="/profile"
            className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:border-indigo-500/60 transition flex items-center justify-between"
          >
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                كود الحضور الخاص بك
              </p>
              {showUserShimmer ? (
                <div className="h-6 w-20 rounded-lg shimmer-box mt-1" />
              ) : (
                <p
                  dir="ltr"
                  className="text-lg font-black font-mono text-slate-900 dark:text-white text-right"
                >
                  {user.attendance_code || "---"}
                </p>
              )}
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <QrCode className="w-5 h-5" />
            </div>
          </Link>

          {/* Card 2: Student Grade */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                الصف الدراسي
              </p>
              {showUserShimmer ? (
                <div className="h-6 w-32 rounded-lg shimmer-box mt-1" />
              ) : (
                <p className="text-sm font-black text-slate-900 dark:text-white">
                  {formatGrade(user.grade) || "غير محدد"}
                </p>
              )}
            </div>
            <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: Account Settings */}
          <Link
            href="/profile"
            className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:border-indigo-500/60 transition flex items-center justify-between"
          >
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                إعدادات الحساب
              </p>
              <p className="text-sm font-black text-slate-900 dark:text-white">
                بياناتي وكلمة المرور
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <User className="w-5 h-5" />
            </div>
          </Link>
        </div>

        {/* Student's Assigned Courses Section (if any exist in DB for this student) */}
        {courses.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                كورساتك الحالية
              </h2>
              <Link
                href="/courses"
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>عرض الكل</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col justify-between hover:border-indigo-500/60 transition shadow-sm"
                >
                  <div>
                    <div
                      className={`relative h-40 overflow-hidden p-5 flex items-start justify-between border-b border-slate-200 dark:border-slate-800 ${
                        course.thumbnail ? "bg-slate-900" : "shimmer-box"
                      }`}
                    >
                      {course.thumbnail && (
                        <img
                          src={course.thumbnail}
                          alt={course.title}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      )}
                      <span className="relative z-10 px-3 py-1 rounded-lg text-xs font-bold bg-slate-900/80 text-white backdrop-blur-sm">
                        {formatGrade(course.grade)}
                      </span>
                      <span className="relative z-10 px-3 py-1 rounded-lg text-xs font-bold bg-indigo-600 text-white shadow-sm">
                        {course.badge}
                      </span>
                    </div>

                    <div className="p-5 space-y-2.5">
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                        {course.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        {course.description}
                      </p>
                    </div>
                  </div>

                  <div className="p-5 pt-0">
                    <Link
                      href={`/courses/${course.id}`}
                      className="w-full py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2 transition"
                    >
                      <PlayCircle className="w-4 h-4" />
                      <span>مشاهدة المحاضرات</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

