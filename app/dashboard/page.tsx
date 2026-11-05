"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { PlayCircle, BookOpen, Clock, Lock } from "lucide-react";
import {
  getCachedCoursesList,
  setCachedCoursesList,
} from "@/lib/clientCache";

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

const GRADE_LABELS: Record<string, string> = {
  grade_3: "الصف الثالث الثانوي",
  grade_2: "الصف الثاني الثانوي",
  grade_1: "الصف الأول الثانوي",
};

function formatGrade(grade?: string | null): string {
  if (!grade) return "";
  return GRADE_LABELS[grade] || grade;
}

export default function DashboardPage() {
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [userGrade, setUserGrade] = useState<string | null>(null);
  const [unlockedCoursesRaw, setUnlockedCoursesRaw] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let gradeFilter: string | null = null;
    try {
      const saved = localStorage.getItem("alphateam-user");
      if (saved) {
        const parsed = JSON.parse(saved);
        gradeFilter = parsed.grade || null;
        setUserGrade(gradeFilter);
        if (parsed.role === "ADMIN" || parsed.role === "TEAM") {
          setUnlockedCoursesRaw("ALL");
        } else if (parsed.unlocked_courses) {
          setUnlockedCoursesRaw(String(parsed.unlocked_courses));
        }
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

    // 1. Instant render from client cache (zero shimmer)
    const cached = getCachedCoursesList();
    if (cached && cached.length > 0) {
      setCourses(applyFilter(cached));
      setLoading(false);
    }

    // 2. Background revalidation
    fetch("/api/courses")
      .then((res) => res.json())
      .then((data) => {
        const allCourses: CourseItem[] = Array.isArray(data.courses)
          ? data.courses
          : [];
        setCachedCoursesList(allCourses);
        setCourses(applyFilter(allCourses));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const showShimmerCards = loading || courses.length === 0;

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            كورساتي
          </h1>
          {userGrade && (
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
              {formatGrade(userGrade)}
            </p>
          )}
        </div>

        {showShimmerCards ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col justify-between shadow-sm"
              >
                <div>
                  <div className="h-44 w-full shimmer-box border-b border-slate-200 dark:border-slate-800 p-5 flex items-start justify-between">
                    <div className="h-6 w-28 rounded-lg bg-white/20 dark:bg-slate-900/30" />
                    <div className="h-6 w-20 rounded-lg bg-white/20 dark:bg-slate-900/30" />
                  </div>
                  <div className="p-6 space-y-3">
                    <div className="h-6 w-3/4 rounded-lg shimmer-box" />
                    <div className="h-4 w-full rounded-md shimmer-box" />
                    <div className="h-4 w-2/3 rounded-md shimmer-box" />
                    <div className="flex items-center gap-4 pt-2">
                      <div className="h-4 w-20 rounded shimmer-box" />
                      <div className="h-4 w-20 rounded shimmer-box" />
                    </div>
                  </div>
                </div>
                <div className="p-6 pt-0">
                  <div className="h-11 w-full rounded-xl shimmer-box" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <div
                key={course.id}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col justify-between hover:border-indigo-500/60 transition shadow-sm"
              >
                <div>
                  <div
                    className={`h-44 p-5 flex items-start justify-between relative overflow-hidden border-b border-slate-200 dark:border-slate-800 ${
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

                  <div className="p-6 space-y-3">
                    <h3 className="text-lg font-extrabold leading-snug text-slate-900 dark:text-white">
                      {course.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {course.description}
                    </p>

                    <div className="flex items-center gap-4 pt-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        {course.lessonsCount} فيديو
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        {course.hours}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-6 pt-0">
                  {(() => {
                    const isUnlocked =
                      !unlockedCoursesRaw ||
                      unlockedCoursesRaw === "ALL" ||
                      unlockedCoursesRaw
                        .split(",")
                        .map((s) => s.trim())
                        .includes(String(course.id));
                    return (
                      <Link
                        href={`/courses/${course.id}`}
                        className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition ${
                          isUnlocked
                            ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                            : "bg-slate-900 dark:bg-slate-800 hover:bg-indigo-600 text-white border border-slate-700"
                        }`}
                      >
                        {isUnlocked ? (
                          <>
                            <PlayCircle className="w-4 h-4" />
                            <span>مشاهدة المحاضرات الآن</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-4 h-4 text-indigo-400" />
                            <span>تفعيل الكورس بكود</span>
                          </>
                        )}
                      </Link>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
