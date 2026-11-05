"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Phone,
  Lock,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ChevronDown,
  Check,
  Loader2,
  X,
} from "lucide-react";

type AuthTab = "login" | "register" | "code";

const GRADES = [
  { value: "grade_3", label: "الصف الثالث الثانوي" },
  { value: "grade_2", label: "الصف الثاني الثانوي" },
  { value: "grade_1", label: "الصف الأول الثانوي" },
];

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AuthTab>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isClosingToast, setIsClosingToast] = useState(false);

  // Form states
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [fullName, setFullName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const [codePhone, setCodePhone] = useState("");
  const [activationCode, setActivationCode] = useState("");

  // Custom Select Dropdown State
  const [selectedGrade, setSelectedGrade] = useState(GRADES[0]);
  const [isGradeOpen, setIsGradeOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsGradeOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const closeToastWithAnimation = () => {
    setIsClosingToast(true);
    setTimeout(() => {
      setSubmittedMessage(null);
      setErrorMessage(null);
      setIsClosingToast(false);
    }, 280);
  };

  useEffect(() => {
    if (submittedMessage || errorMessage) {
      setIsClosingToast(false);
      const timer = setTimeout(() => {
        closeToastWithAnimation();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [submittedMessage, errorMessage]);

  const resetMessages = () => {
    setSubmittedMessage(null);
    setErrorMessage(null);
    setIsClosingToast(false);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          phone: loginPhone,
          password: loginPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "فشل تسجيل الدخول");
      } else {
        if (data.user) {
          localStorage.setItem("alphateam-user", JSON.stringify(data.user));
        }
        router.push("/home");
      }
    } catch {
      setErrorMessage("تعذر الاتصال بالسيرفر");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          fullName,
          phone: regPhone,
          parentPhone,
          grade: selectedGrade.value,
          password: regPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "فشل إنشاء الحساب");
      } else {
        setSubmittedMessage(data.message);
      }
    } catch {
      setErrorMessage("تعذر الاتصال بالسيرفر");
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "code",
          phone: codePhone,
          code: activationCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "فشل تفعيل الكود");
      } else {
        if (data.user) {
          localStorage.setItem("alphateam-user", JSON.stringify(data.user));
        }
        router.push("/home");
      }
    } catch {
      setErrorMessage("تعذر الاتصال بالسيرفر");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-10 sm:py-12 relative transition-colors duration-200 overflow-x-hidden">
      {/* Top-Right Floating Toast Notifications (Fit to text content + Slide in/out) */}
      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50 flex flex-col items-end gap-2.5 pointer-events-none">
        {submittedMessage && (
          <div
            className={`${
              isClosingToast ? "animate-slide-out-right" : "animate-slide-in-right"
            } pointer-events-auto w-fit max-w-[calc(100vw-4.5rem)] sm:max-w-md px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 shadow-2xl text-slate-900 dark:text-slate-100 text-xs font-bold inline-flex items-center gap-2.5 sm:gap-3 leading-relaxed`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <span>{submittedMessage}</span>
            <button
              type="button"
              onClick={closeToastWithAnimation}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition mr-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {errorMessage && (
          <div
            className={`${
              isClosingToast ? "animate-slide-out-right" : "animate-slide-in-right"
            } pointer-events-auto w-fit max-w-[calc(100vw-4.5rem)] sm:max-w-md px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800/80 shadow-2xl text-slate-900 dark:text-slate-100 text-xs font-bold inline-flex items-center gap-2.5 sm:gap-3 leading-relaxed`}
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={closeToastWithAnimation}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition mr-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg p-5 sm:p-8 space-y-5 sm:space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <img
            src="/alphateam.png"
            alt="ALPHA TEAM Logo"
            className="w-20 h-20 mx-auto object-contain"
          />
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            ALPHA TEAM
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            سجل دخولك إلى حسابك للمتابعة إلى المنصة
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setActiveTab("login");
              resetMessages();
            }}
            className={`py-2.5 rounded-lg transition ${
              activeTab === "login"
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            تسجيل دخول
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("register");
              resetMessages();
            }}
            className={`py-2.5 rounded-lg transition ${
              activeTab === "register"
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            حساب جديد
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("code");
              resetMessages();
            }}
            className={`py-2.5 rounded-lg transition ${
              activeTab === "code"
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            كود تفعيل
          </button>
        </div>

        {/* TAB 1: LOGIN */}
        {activeTab === "login" && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                رقم الهاتف
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  required
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  placeholder="010xxxxxxxx أو admin"
                  className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-500 transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                كلمة المرور
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pr-10 pl-10 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 transition shadow-sm flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>تسجيل الدخول</span>
            </button>
          </form>
        )}

        {/* TAB 2: REGISTER */}
        {activeTab === "register" && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <span>بعد التسجيل، يتم تفعيل حسابك لفتح الكورسات الخاصة بك.</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                الاسم رباعي
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="مثال: أحمد محمد علي حسن"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-500 transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  رقم الهاتف (واتساب)
                </label>
                <input
                  type="tel"
                  required
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="010xxxxxxxx أو admin"
                  className="w-full px-3.5 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-500 transition"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  رقم هاتف ولي الأمر
                </label>
                <input
                  type="tel"
                  required
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  placeholder="011xxxxxxxx"
                  className="w-full px-3.5 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-500 transition"
                />
              </div>
            </div>

            {/* Custom Styled Select Dropdown */}
            <div className="space-y-1.5" ref={dropdownRef}>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                الصف الدراسي
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsGradeOpen(!isGradeOpen)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border text-sm text-slate-900 dark:text-slate-100 transition ${
                    isGradeOpen
                      ? "border-indigo-600 dark:border-indigo-500 ring-2 ring-indigo-500/15"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <span className="font-semibold">{selectedGrade.label}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                      isGradeOpen ? "rotate-180 text-indigo-500" : ""
                    }`}
                  />
                </button>

                {isGradeOpen && (
                  <div className="absolute z-30 mt-2 w-full rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl py-1.5 overflow-hidden">
                    {GRADES.map((grade) => {
                      const isSelected = selectedGrade.value === grade.value;
                      return (
                        <button
                          key={grade.value}
                          type="button"
                          onClick={() => {
                            setSelectedGrade(grade);
                            setIsGradeOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold transition ${
                            isSelected
                              ? "bg-indigo-600 text-white"
                              : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70"
                          }`}
                        >
                          <span>{grade.label}</span>
                          {isSelected && <Check className="w-4 h-4" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                كلمة المرور
              </label>
              <input
                type="password"
                required
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="اختر كلمة مرور قوية"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 transition shadow-sm flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>إنشاء حساب جديد</span>
            </button>
          </form>
        )}

        {/* TAB 3: ACTIVATION CODE */}
        {activeTab === "code" && (
          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
              أدخل كود التفعيل الخاص بك لفتح الكورس في حسابك مباشرة.
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                رقم الهاتف المسجل
              </label>
              <input
                type="tel"
                required
                value={codePhone}
                onChange={(e) => setCodePhone(e.target.value)}
                placeholder="010xxxxxxxx"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                كود التفعيل
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  required
                  value={activationCode}
                  onChange={(e) => setActivationCode(e.target.value)}
                  placeholder="***************"
                  className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm font-mono uppercase tracking-wider text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 transition shadow-sm flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>تفعيل الكورس الآن</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
