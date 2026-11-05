"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import {
  User,
  Phone,
  GraduationCap,
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertCircle,
  Clock,
  QrCode,
  Download,
  X,
} from "lucide-react";

interface UserProfile {
  id?: number;
  full_name: string;
  phone: string;
  parent_phone?: string | null;
  grade?: string | null;
  role?: string;
  is_active?: number;
  attendance_code?: string | null;
  activated_at?: string | null;
  created_at?: string | null;
}

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

const GRADE_LABELS: Record<string, string> = {
  grade_3: "الصف الثالث الثانوي",
  grade_2: "الصف الثاني الثانوي",
  grade_1: "الصف الأول الثانوي",
};

function formatGrade(grade?: string | null): string {
  if (!grade) return "";
  return GRADE_LABELS[grade] || grade;
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submittingPwd, setSubmittingPwd] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [isClosingToast, setIsClosingToast] = useState(false);

  useEffect(() => {
    // Trigger DB migration & password hashing on page load
    fetch("/api/courses").catch(() => {});

    try {
      const saved = localStorage.getItem("alphateam-user");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.attendance_code || !String(parsed.attendance_code).includes("_")) {
          const prefixes = ["S", "W", "A", "M", "K"];
          const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
          const num = Math.floor(10 + Math.random() * 989);
          parsed.attendance_code = `${prefix}_${num}`;
          localStorage.setItem("alphateam-user", JSON.stringify(parsed));
        }
        setUser(parsed);
        setLoading(false);
      }
    } catch {}
  }, []);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setIsClosingToast(false);
    setToastType(type);
    setToastMessage(msg);
  };

  const closeToast = () => {
    setIsClosingToast(true);
    setTimeout(() => {
      setToastMessage(null);
      setIsClosingToast(false);
    }, 280);
  };

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => closeToast(), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Calculate 3-day lock status from activation date (or creation date fallback)
  const getPasswordLockStatus = () => {
    if (!user) return { canChange: false, remainingDays: 3 };
    const dateStr = user.activated_at || user.created_at;
    if (!dateStr) return { canChange: false, remainingDays: 3 };

    const activatedTime = new Date(dateStr).getTime();
    const elapsed = Date.now() - activatedTime;

    if (elapsed >= THREE_DAYS_MS) {
      return { canChange: true, remainingDays: 0 };
    }

    const remainingMs = THREE_DAYS_MS - elapsed;
    const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
    return { canChange: false, remainingDays };
  };

  const { canChange, remainingDays } = getPasswordLockStatus();

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canChange) {
      showToast(
        `لا يمكن تغيير كلمة المرور إلا بعد مرور 3 أيام من تاريخ التفعيل (متبقي ${remainingDays} يوم)`,
        "error"
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast("كلمة المرور الجديدة وتأكيد كلمة المرور غير متطابقين", "error");
      return;
    }

    if (!user) return;

    setSubmittingPwd(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change-password",
          phone: user.phone,
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "فشل تحديث كلمة المرور", "error");
      } else {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        showToast("تم تحديث كلمة المرور بنجاح", "success");
      }
    } catch {
      showToast("تعذر الاتصال بالسيرفر", "error");
    } finally {
      setSubmittingPwd(false);
    }
  };

  // Show Shimmer when loading or when no real user data is loaded
  const showShimmer = loading || !user;

  // Short 6-digit random attendance code without any personal account data
  const studentAttendanceId = user?.attendance_code || "";

  const qrCodeUrl = studentAttendanceId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&ecc=M&margin=8&color=000000&bgcolor=ffffff&data=${encodeURIComponent(
        studentAttendanceId
      )}`
    : "";

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Top-Right Floating Toast */}
      {toastMessage && (
        <div className="fixed top-24 right-6 z-50 pointer-events-none">
          <div
            className={`${
              isClosingToast ? "animate-slide-out-right" : "animate-slide-in-right"
            } pointer-events-auto w-fit max-w-[90vw] px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border ${
              toastType === "error"
                ? "border-rose-200 dark:border-rose-800/80"
                : "border-indigo-200 dark:border-indigo-800"
            } shadow-2xl text-slate-900 dark:text-slate-100 text-xs font-bold inline-flex items-center gap-3`}
          >
            {toastType === "error" ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
            )}
            <span>{toastMessage}</span>
            <button
              type="button"
              onClick={closeToast}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition mr-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 space-y-6">
        {/* Top Profile Header Card */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-right w-full sm:w-auto">
            {showShimmer ? (
              <div className="w-20 h-20 rounded-full shimmer-box shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-indigo-500/40 flex items-center justify-center shrink-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-11 h-11 text-slate-500 dark:text-slate-300 translate-y-0.5"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}

            <div className="space-y-2 w-full sm:w-auto flex flex-col items-center sm:items-start">
              {showShimmer ? (
                <>
                  <div className="h-6 w-48 rounded-lg shimmer-box" />
                  <div className="h-4 w-64 rounded-md shimmer-box" />
                </>
              ) : (
                <>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    {user.full_name}
                  </h1>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {user.grade ? `${formatGrade(user.grade)} — ` : ""}رقم الهاتف: {user.phone}
                  </p>
                </>
              )}
            </div>
          </div>

          {showShimmer ? (
            <div className="h-9 w-28 rounded-xl shimmer-box shrink-0" />
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/70 text-indigo-600 dark:text-indigo-400 text-xs font-bold shrink-0">
              <ShieldCheck className="w-4 h-4" />
              <span>حساب مفعل</span>
            </div>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid md:grid-cols-12 gap-6 items-start">
          {/* Personal Information (Read-Only or Shimmer - Fit to content height) */}
          <div className="md:col-span-7 h-fit rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  البيانات الشخصية
                </h2>
              </div>
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                للعرض فقط
              </span>
            </div>

            <div className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  الاسم رباعي
                </label>
                {showShimmer ? (
                  <div className="h-11 w-full rounded-xl shimmer-box" />
                ) : (
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={user.full_name}
                    className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/70 text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed select-none"
                  />
                )}
              </div>

              {/* Phones */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    رقم الهاتف المسجل
                  </label>
                  {showShimmer ? (
                    <div className="h-11 w-full rounded-xl shimmer-box" />
                  ) : (
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400" />
                      <input
                        type="tel"
                        readOnly
                        disabled
                        value={user.phone}
                        className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/70 text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed select-none"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    رقم هاتف ولي الأمر
                  </label>
                  {showShimmer ? (
                    <div className="h-11 w-full rounded-xl shimmer-box" />
                  ) : user.parent_phone ? (
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400" />
                      <input
                        type="tel"
                        readOnly
                        disabled
                        value={user.parent_phone}
                        className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/70 text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed select-none"
                      />
                    </div>
                  ) : (
                    <div className="h-11 w-full rounded-xl shimmer-box" />
                  )}
                </div>
              </div>

              {/* Grade */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  الصف الدراسي
                </label>
                {showShimmer ? (
                  <div className="h-11 w-full rounded-xl shimmer-box" />
                ) : user.grade ? (
                  <div className="relative">
                    <GraduationCap className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400" />
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={formatGrade(user.grade)}
                      className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/70 text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed select-none"
                    />
                  </div>
                ) : (
                  <div className="h-11 w-full rounded-xl shimmer-box" />
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Attendance QR Code & Password Card */}
          <div className="md:col-span-5 space-y-6">
            {/* Permanent Student Attendance QR Code Card */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                <QrCode className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  كود الحضور (QR Code)
                </h2>
              </div>

              {showShimmer ? (
                <div className="flex flex-col items-center space-y-3 py-2">
                  <div className="w-44 h-44 rounded-xl shimmer-box" />
                  <div className="h-8 w-24 rounded-xl shimmer-box" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-3 pt-1">
                  <img
                    src={qrCodeUrl}
                    alt="كود الحضور QR"
                    className="w-44 h-44 object-contain rounded-xl"
                  />
                  <div
                    dir="ltr"
                    className="px-4 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-black font-mono text-slate-900 dark:text-slate-100 tracking-wider"
                  >
                    {studentAttendanceId}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    تغيير كلمة المرور
                  </h2>
                </div>
              </div>

              {/* 3-Day Activation Restriction Notice */}
              {!showShimmer && !canChange && (
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs flex items-start gap-2 leading-relaxed">
                  <Clock className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
                  <span>
                    متاح تغيير كلمة المرور بعد مرور <strong>3 أيام</strong> من تاريخ تفعيل الحساب (متبقي {remainingDays} يوم).
                  </span>
                </div>
              )}

              <form onSubmit={handlePasswordChange} className="space-y-3">
                <input
                  type="password"
                  required
                  disabled={showShimmer || !canChange}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="كلمة المرور الحالية"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                />
                <input
                  type="password"
                  required
                  disabled={showShimmer || !canChange}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="كلمة المرور الجديدة"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                />
                <input
                  type="password"
                  required
                  disabled={showShimmer || !canChange}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="تأكيد كلمة المرور الجديدة"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                />
                <button
                  type="submit"
                  disabled={showShimmer || !canChange || submittingPwd}
                  className="w-full py-2.5 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
                >
                  تحديث كلمة المرور
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
