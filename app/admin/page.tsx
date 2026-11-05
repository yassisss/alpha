"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  UserCheck,
  KeyRound,
  Settings,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Plus,
  Trash2,
  Copy,
  ArrowRight,
  LogOut,
  ShieldCheck,
  Menu,
  Calendar,
  Clock,
  Loader2,
  BookOpen,
  PlayCircle,
  Film,
  ExternalLink,
  Upload,
  ImagePlus,
} from "lucide-react";
import CustomDateTimePicker from "@/components/CustomDateTimePicker";
import { clearClientCoursesCache } from "@/lib/clientCache";

type AdminTab = "students" | "requests" | "codes" | "courses" | "team" | "settings";

interface StudentRecord {
  id: number;
  full_name: string;
  phone: string;
  parent_phone: string | null;
  grade: string | null;
  role: string;
  is_active: number;
  attendance_code: string | null;
  activated_by?: string | null;
  created_at: string;
}

interface AdminRecord {
  id: number;
  full_name: string;
  phone: string;
  role: "ADMIN" | "TEAM";
  admin_code: string;
  created_at: string;
}

interface CodeRecord {
  id: number;
  code: string;
  course_id?: number | null;
  is_used: number;
  max_uses?: number;
  uses_count?: number;
  used_by_phone: string | null;
  created_by?: string | null;
  expires_at?: string | null;
}

interface CourseRecord {
  id: number;
  title: string;
  description: string;
  category: string;
  grade: string;
  thumbnail?: string | null;
  lessons_count: number;
  created_by?: string | null;
}

interface LessonRecord {
  id: number;
  course_id: number;
  title: string;
  video_url: string;
  duration: string;
  sort_order: number;
}

const GRADE_LABELS: Record<string, string> = {
  grade_3: "الصف الثالث الثانوي",
  grade_2: "الصف الثاني الثانوي",
  grade_1: "الصف الأول الثانوي",
};

function formatGrade(grade?: string | null): string {
  if (!grade) return "غير محدد";
  return GRADE_LABELS[grade] || grade;
}

function formatExpiryInfo(expiresAt?: string | null): {
  label: string;
  durationText: string;
  isExpired: boolean;
} {
  if (!expiresAt) {
    return {
      label: "مفتوح (بلا انتهاء)",
      durationText: "دائم",
      isExpired: false,
    };
  }

  const expDate = new Date(expiresAt);
  const diffMs = expDate.getTime() - Date.now();
  const formattedDate = expDate.toLocaleString("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (diffMs <= 0) {
    return {
      label: formattedDate,
      durationText: "منتهي الصلاحية",
      isExpired: true,
    };
  }

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;

  let durationText = "";
  if (days > 0) {
    durationText = `ساري لمدة ${days} يوم${remHours > 0 ? ` و ${remHours} س` : ""}`;
  } else if (remHours > 0) {
    durationText = `ساري لمدة ${remHours} ساعة`;
  } else {
    const mins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    durationText = `ساري لمدة ${mins} دقيقة`;
  }

  return {
    label: formattedDate,
    durationText,
    isExpired: false,
  };
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>("students");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [users, setUsers] = useState<StudentRecord[]>([]);
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [codes, setCodes] = useState<CodeRecord[]>([]);
  const [coursesList, setCoursesList] = useState<CourseRecord[]>([]);
  const [lessonsList, setLessonsList] = useState<LessonRecord[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Current Admin's Dedicated Code (ADM_1, ADM_2, ADM_3...)
  const [currentAdminCode, setCurrentAdminCode] = useState("ADM_1");

  // Code Generation Controls (Count + Max Uses per Code + Target Course + Exact Year/Month/Day/Hour/Minute)
  const [codesCountToGen, setCodesCountToGen] = useState(5);
  const [maxUsesPerCode, setMaxUsesPerCode] = useState(1);
  const [codeTargetCourseId, setCodeTargetCourseId] = useState<string>("all");
  const [expiryDateTime, setExpiryDateTime] = useState(() => {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });

  const [isDark, setIsDark] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [isClosingToast, setIsClosingToast] = useState(false);

  // Per-action loading state arrays so multiple simultaneous clicks all keep spinning independently
  const [togglingUserIds, setTogglingUserIds] = useState<number[]>([]);
  const [deletingUserIds, setDeletingUserIds] = useState<number[]>([]);
  const [deletingStaffIds, setDeletingStaffIds] = useState<number[]>([]);
  const [generatingCodes, setGeneratingCodes] = useState(false);
  const [deletingCodeIds, setDeletingCodeIds] = useState<number[]>([]);

  // Staff / Team Creation Controls
  const [staffName, setStaffName] = useState("");
  const [staffPhone, setStaffPhone] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffRole, setStaffRole] = useState<"ADMIN" | "TEAM">("TEAM");
  const [staffCustomCode, setStaffCustomCode] = useState("");
  const [creatingStaff, setCreatingStaff] = useState(false);

  // Course / Category & Lesson Upload Controls
  const [courseTitle, setCourseTitle] = useState("");
  const [courseCategory, setCourseCategory] = useState("المستوى الأول");
  const [courseGrade, setCourseGrade] = useState("grade_3");
  const [courseDescription, setCourseDescription] = useState("");
  const [courseThumbnailFile, setCourseThumbnailFile] = useState<File | null>(null);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [updatingThumbnailCourseIds, setUpdatingThumbnailCourseIds] = useState<number[]>([]);
  const [deletingCourseIds, setDeletingCourseIds] = useState<number[]>([]);

  const [lessonTitle, setLessonTitle] = useState("");
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lessonDuration, setLessonDuration] = useState("15 دقيقة");
  const [creatingLesson, setCreatingLesson] = useState(false);
  const [deletingLessonIds, setDeletingLessonIds] = useState<number[]>([]);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin");
      const data = await res.json();
      if (res.ok) {
        const fetchedUsers: StudentRecord[] = Array.isArray(data.users)
          ? data.users
          : [];
        const fetchedAdmins: AdminRecord[] = Array.isArray(data.admins)
          ? data.admins
          : [];
        const fetchedCourses: CourseRecord[] = Array.isArray(data.courses)
          ? data.courses
          : [];
        const fetchedLessons: LessonRecord[] = Array.isArray(data.lessons)
          ? data.lessons
          : [];
        setUsers(fetchedUsers);
        setAdmins(fetchedAdmins);
        setCodes(Array.isArray(data.codes) ? data.codes : []);
        setCoursesList(fetchedCourses);
        setLessonsList(fetchedLessons);
        if (fetchedCourses.length > 0 && selectedCourseId === null) {
          setSelectedCourseId(fetchedCourses[0].id);
        }

        try {
          localStorage.setItem(
            "alphateam-admin-cache-v1",
            JSON.stringify({
              users: fetchedUsers,
              admins: fetchedAdmins,
              codes: Array.isArray(data.codes) ? data.codes : [],
              courses: fetchedCourses,
              lessons: fetchedLessons,
            })
          );
        } catch {}

        // Sync current admin's code from the dedicated `admins` table
        try {
          const savedUser = localStorage.getItem("alphateam-user");
          if (savedUser) {
            const parsed = JSON.parse(savedUser);
            const matchingAdmin = fetchedAdmins.find(
              (a) => a.phone === parsed.phone || a.id === parsed.id
            );
            if (matchingAdmin?.admin_code) {
              setCurrentAdminCode(matchingAdmin.admin_code);
              parsed.attendance_code = matchingAdmin.admin_code;
              parsed.admin_code = matchingAdmin.admin_code;
              localStorage.setItem("alphateam-user", JSON.stringify(parsed));
            }
          }
        } catch {}
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem("alphateam-theme");
    setIsDark(savedTheme !== "light");

    try {
      const savedUser = localStorage.getItem("alphateam-user");
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed.phone === "01000000000") {
          parsed.attendance_code = "ADM_1";
          localStorage.setItem("alphateam-user", JSON.stringify(parsed));
          setCurrentAdminCode("ADM_1");
        } else if (
          parsed.attendance_code &&
          String(parsed.attendance_code).startsWith("ADM_")
        ) {
          setCurrentAdminCode(parsed.attendance_code);
        } else {
          const genAdm = `ADM_${parsed.id || "1"}`;
          parsed.attendance_code = genAdm;
          localStorage.setItem("alphateam-user", JSON.stringify(parsed));
          setCurrentAdminCode(genAdm);
        }
      }
    } catch {}

    try {
      const cachedAdmin = localStorage.getItem("alphateam-admin-cache-v1");
      if (cachedAdmin) {
        const parsedCache = JSON.parse(cachedAdmin);
        if (Array.isArray(parsedCache.users)) setUsers(parsedCache.users);
        if (Array.isArray(parsedCache.admins)) setAdmins(parsedCache.admins);
        if (Array.isArray(parsedCache.codes)) setCodes(parsedCache.codes);
        if (Array.isArray(parsedCache.courses)) {
          setCoursesList(parsedCache.courses);
          if (parsedCache.courses.length > 0) {
            setSelectedCourseId(parsedCache.courses[0].id);
          }
        }
        if (Array.isArray(parsedCache.lessons)) setLessonsList(parsedCache.lessons);
        setLoading(false);
      }
    } catch {}

    fetchData();
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
      const timer = setTimeout(() => closeToast(), 3800);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleToggleUser = async (userId: number, nextActive: boolean) => {
    setTogglingUserIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle-user",
          userId,
          isActive: nextActive,
          adminCode: currentAdminCode,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        clearClientCoursesCache();
        await fetchData();
        showToast(data.message, "success");
      } else {
        showToast(data.error || "فشل التحديث", "error");
      }
    } catch {
      showToast("تعذر الاتصال بالسيرفر", "error");
    } finally {
      setTogglingUserIds((prev) => prev.filter((id) => id !== userId));
    }
  };

  const handleDeleteUser = async (userId: number) => {
    setDeletingUserIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete-user", userId }),
      });
      const data = await res.json();
      if (res.ok) {
        clearClientCoursesCache();
        await fetchData();
        showToast(data.message, "success");
      } else {
        showToast(data.error || "تعذر حذف الحساب", "error");
      }
    } catch {
      showToast("تعذر حذف الحساب", "error");
    } finally {
      setDeletingUserIds((prev) => prev.filter((id) => id !== userId));
    }
  };

  const handleGenerateCodes = async () => {
    setGeneratingCodes(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-codes",
          count: codesCountToGen,
          maxUses: maxUsesPerCode,
          courseId: codeTargetCourseId === "all" ? null : Number(codeTargetCourseId),
          adminCode: currentAdminCode,
          expiresAt: expiryDateTime ? new Date(expiryDateTime).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        clearClientCoursesCache();
        await fetchData();
        showToast(data.message, "success");
      } else {
        showToast(data.error || "تعذر توليد الأكواد", "error");
      }
    } catch {
      showToast("تعذر توليد الأكواد", "error");
    } finally {
      setGeneratingCodes(false);
    }
  };

  const handleDeleteCode = async (codeId: number) => {
    setDeletingCodeIds((prev) => (prev.includes(codeId) ? prev : [...prev, codeId]));
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete-code", codeId }),
      });
      const data = await res.json();
      if (res.ok) {
        clearClientCoursesCache();
        await fetchData();
        showToast(data.message, "success");
      }
    } catch {
      showToast("تعذر حذف الكود", "error");
    } finally {
      setDeletingCodeIds((prev) => prev.filter((id) => id !== codeId));
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    showToast(`تم نسخ الكود: ${code}`, "success");
  };

  const toggleTheme = () => {
    const html = document.documentElement;
    const nextDark = !isDark;
    html.classList.add("theme-transition");
    setIsDark(nextDark);
    if (nextDark) {
      html.classList.add("dark");
      localStorage.setItem("alphateam-theme", "dark");
    } else {
      html.classList.remove("dark");
      localStorage.setItem("alphateam-theme", "light");
    }
    setTimeout(() => html.classList.remove("theme-transition"), 500);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
    } catch {}
    localStorage.removeItem("alphateam-user");
    router.replace("/");
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || !staffPhone.trim() || !staffPassword.trim()) {
      showToast("يرجى إدخال الاسم ورقم الهاتف وكلمة المرور", "error");
      return;
    }
    setCreatingStaff(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-staff",
          fullName: staffName,
          phone: staffPhone,
          password: staffPassword,
          role: staffRole,
          customAdminCode: staffCustomCode,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchData();
        setStaffName("");
        setStaffPhone("");
        setStaffPassword("");
        setStaffCustomCode("");
        showToast(data.message, "success");
      } else {
        showToast(data.error || "تعذر إضافة العضو", "error");
      }
    } catch {
      showToast("تعذر الاتصال بالسيرفر", "error");
    } finally {
      setCreatingStaff(false);
    }
  };

  const handleDeleteStaff = async (adminId: number) => {
    setDeletingStaffIds((prev) => (prev.includes(adminId) ? prev : [...prev, adminId]));
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete-staff", adminId }),
      });
      const data = await res.json();
      if (res.ok) {
        clearClientCoursesCache();
        await fetchData();
        showToast(data.message, "success");
      } else {
        showToast(data.error || "تعذر حذف العضو", "error");
      }
    } catch {
      showToast("تعذر حذف العضو", "error");
    } finally {
      setDeletingStaffIds((prev) => prev.filter((id) => id !== adminId));
    }
  };

  const uploadImageFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const upRes = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    const upData = await upRes.json();
    if (!upRes.ok || !upData.url) {
      throw new Error(upData.error || "فشل رفع صورة الكورس");
    }
    return upData.url;
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseTitle.trim()) {
      showToast("يرجى إدخال عنوان الكورس", "error");
      return;
    }
    setCreatingCourse(true);
    try {
      let uploadedThumbnail: string | null = null;
      if (courseThumbnailFile) {
        uploadedThumbnail = await uploadImageFile(courseThumbnailFile);
      }

      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-course",
          title: courseTitle,
          category: courseCategory,
          description: courseDescription,
          grade: courseGrade,
          thumbnail: uploadedThumbnail,
          adminCode: currentAdminCode,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        clearClientCoursesCache();
        await fetchData();
        setCourseTitle("");
        setCourseDescription("");
        setCourseThumbnailFile(null);
        showToast(data.message, "success");
      } else {
        showToast(data.error || "تعذر إنشاء الكورس", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "تعذر الاتصال بالسيرفر", "error");
    } finally {
      setCreatingCourse(false);
    }
  };

  const handleUpdateCourseThumbnail = async (courseId: number, file?: File) => {
    if (!file) return;
    setUpdatingThumbnailCourseIds((prev) =>
      prev.includes(courseId) ? prev : [...prev, courseId]
    );
    try {
      const uploadedUrl = await uploadImageFile(file);
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-course-thumbnail",
          courseId,
          thumbnail: uploadedUrl,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        clearClientCoursesCache();
        await fetchData();
        showToast(data.message || "تم تحديث صورة كارت الكورس بنجاح", "success");
      } else {
        showToast(data.error || "فشل تحديث صورة الكورس", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "فشل رفع صورة الكورس", "error");
    } finally {
      setUpdatingThumbnailCourseIds((prev) => prev.filter((id) => id !== courseId));
    }
  };

  const handleDeleteCourse = async (courseId: number) => {
    setDeletingCourseIds((prev) =>
      prev.includes(courseId) ? prev : [...prev, courseId]
    );
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete-course", courseId }),
      });
      const data = await res.json();
      if (res.ok) {
        clearClientCoursesCache();
        if (selectedCourseId === courseId) {
          setSelectedCourseId(null);
        }
        await fetchData();
        showToast(data.message, "success");
      }
    } catch {
      showToast("تعذر حذف الكورس", "error");
    } finally {
      setDeletingCourseIds((prev) => prev.filter((id) => id !== courseId));
    }
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedVideoFile(file);

    if (!lessonTitle.trim()) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      setLessonTitle(cleanName);
    }

    // Automatically detect exact video duration from the selected file
    try {
      const tempVideo = document.createElement("video");
      tempVideo.preload = "metadata";
      const objUrl = URL.createObjectURL(file);
      tempVideo.onloadedmetadata = () => {
        URL.revokeObjectURL(objUrl);
        const mins = Math.max(1, Math.round(tempVideo.duration / 60));
        if (mins === 1) {
          setLessonDuration("دقيقة");
        } else if (mins === 2) {
          setLessonDuration("دقيقتين");
        } else if (mins >= 3 && mins <= 10) {
          setLessonDuration(`${mins} دقائق`);
        } else {
          setLessonDuration(`${mins} دقيقة`);
        }
      };
      tempVideo.src = objUrl;
    } catch {}
  };

  const uploadFileWithProgress = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append("file", file);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const pct = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(pct);
        }
      };

      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && res.videoUrl) {
            resolve(res.videoUrl);
          } else {
            reject(new Error(res.error || "فشل رفع ملف الفيديو"));
          }
        } catch {
          reject(new Error("فشل رفع ملف الفيديو"));
        }
      };

      xhr.onerror = () => reject(new Error("تعذر الاتصال بالسيرفر أثناء الرفع"));
      xhr.open("POST", "/api/upload");
      xhr.send(formData);
    });
  };

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) {
      showToast("يرجى اختيار كورس أولاً لرفع الفيديو بداخله", "error");
      return;
    }
    if (!lessonTitle.trim()) {
      showToast("يرجى إدخال عنوان الدرس / الفيديو", "error");
      return;
    }
    if (!selectedVideoFile) {
      showToast("يرجى اختيار ملف الفيديو من جهازك أولاً", "error");
      return;
    }

    setCreatingLesson(true);
    setUploadProgress(0);
    try {
      const finalVideoUrl = await uploadFileWithProgress(selectedVideoFile);

      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-lesson",
          courseId: selectedCourseId,
          title: lessonTitle.trim(),
          videoUrl: finalVideoUrl,
          duration: lessonDuration,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        clearClientCoursesCache(selectedCourseId);
        await fetchData();
        setLessonTitle("");
        setSelectedVideoFile(null);
        setUploadProgress(0);
        showToast(data.message, "success");
      } else {
        showToast(data.error || "تعذر إضافة الفيديو للكورس", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "تعذر رفع الفيديو", "error");
    } finally {
      setCreatingLesson(false);
    }
  };

  const handleDeleteLesson = async (lessonId: number, courseId: number) => {
    setDeletingLessonIds((prev) =>
      prev.includes(lessonId) ? prev : [...prev, lessonId]
    );
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete-lesson", lessonId, courseId }),
      });
      const data = await res.json();
      if (res.ok) {
        clearClientCoursesCache();
        await fetchData();
        showToast(data.message, "success");
      }
    } catch {
      showToast("تعذر حذف الفيديو", "error");
    } finally {
      setDeletingLessonIds((prev) => prev.filter((id) => id !== lessonId));
    }
  };

  const allStudents = users;
  const staffMembers = admins;
  const activeStudents = allStudents.filter((u) => Boolean(u.is_active));
  const pendingStudents = allStudents.filter((u) => !u.is_active);

  const filterBySearch = (list: StudentRecord[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.phone.includes(q) ||
        (s.attendance_code && s.attendance_code.toLowerCase().includes(q)) ||
        (s.activated_by && s.activated_by.toLowerCase().includes(q))
    );
  };

  // Only ADM_1, ADM_2, and ADM_3 are allowed to view and manage the Team & Admin section
  const ALLOWED_TEAM_MANAGERS = ["ADM_1", "ADM_2", "ADM_3", "ADM_01", "ADM_02", "ADM_03"];
  const canManageTeam = ALLOWED_TEAM_MANAGERS.includes(
    currentAdminCode.trim().toUpperCase()
  );

  const SIDEBAR_ITEMS: Array<{
    id: AdminTab;
    label: string;
    icon: React.ElementType;
    badge?: number;
  }> = [
    {
      id: "students",
      label: "الطلاب",
      icon: Users,
      badge: activeStudents.length,
    },
    {
      id: "requests",
      label: "طلبات تفعيل الطلاب",
      icon: UserCheck,
      badge: pendingStudents.length,
    },
    {
      id: "codes",
      label: "أكواد التفعيل",
      icon: KeyRound,
      badge: codes.filter((c) => !c.is_used).length,
    },
    {
      id: "courses",
      label: "الكورسات والمحاضرات",
      icon: BookOpen,
      badge: coursesList.length,
    },
    ...(canManageTeam
      ? [
          {
            id: "team" as AdminTab,
            label: "التيم والأدمن",
            icon: ShieldCheck,
            badge: staffMembers.length,
          },
        ]
      : []),
    {
      id: "settings",
      label: "الإعدادات",
      icon: Settings,
    },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Top-Right Floating Toast */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 pointer-events-none">
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

      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* FLOATING GLASS SIDEBAR (Right Side in RTL - Compact Width) */}
      <aside
        className={`fixed lg:sticky top-4 right-4 z-40 h-[calc(100dvh-2rem)] w-56 lg:mr-4 lg:my-4 rounded-3xl bg-white/60 dark:bg-slate-900/50 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.45)] flex flex-col justify-between p-4 transition-all duration-300 ${
          sidebarOpen ? "translate-x-0" : "translate-x-[120%] lg:translate-x-0"
        }`}
      >
        <div className="space-y-6">
          {/* Brand Header inside Floating Glass Sidebar */}
          <div className="flex items-center justify-between px-1 pt-1 pb-4 border-b border-slate-200/70 dark:border-white/10">
            <Link href="/home" className="flex items-center gap-2.5 group">
              <img
                src="/alphateam.png"
                alt="ALPHA TEAM"
                className="w-11 h-11 object-contain group-hover:scale-105 transition"
              />
              <div>
                <h1 className="text-sm font-black tracking-tight text-slate-900 dark:text-white leading-none">
                  ALPHA TEAM
                </h1>
                <span
                  dir="ltr"
                  className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-mono font-black text-indigo-600 dark:text-indigo-400"
                >
                  <ShieldCheck className="w-3 h-3" />
                  <span>{currentAdminCode}</span>
                </span>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Sections */}
          <div className="space-y-2">
            <p className="px-2 text-[11px] font-bold text-slate-400 dark:text-slate-500">
              إدارة المنصة
            </p>
            <nav className="space-y-1.5">
              {SIDEBAR_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full group relative flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                        : "text-slate-600 dark:text-slate-300/90 hover:bg-slate-900/5 dark:hover:bg-white/5 hover:text-slate-950 dark:hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center transition ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-slate-200/70 dark:bg-white/5 text-slate-500 dark:text-slate-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span>{item.label}</span>
                    </div>

                    {typeof item.badge === "number" && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black transition ${
                          isActive
                            ? "bg-white text-indigo-600"
                            : "bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Actions inside Floating Glass Sidebar */}
        <div className="space-y-1.5 pt-4 border-t border-slate-200/70 dark:border-white/10">
          <Link
            href="/home"
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-900/5 dark:hover:bg-white/10 transition"
          >
            <span>الرجوع للموقع</span>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-bold text-rose-500 hover:bg-rose-500/10 transition"
          >
            <span>تسجيل خروج</span>
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 min-w-0 p-4 sm:p-8 space-y-6">
        {/* Mobile Sidebar Toggle Bar */}
        <div className="lg:hidden flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <img src="/alphateam.png" alt="Logo" className="w-9 h-9 object-contain" />
            <span className="text-sm font-black">لوحة تحكم الأدمن</span>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* ================================================================= */}
        {/* SECTION 1: STUDENTS (الطلاب المفعلين)                             */}
        {/* ================================================================= */}
        {activeTab === "students" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                  الطلاب المفعلين ({activeStudents.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  قائمة الطلاب المفعلين في المنصة مع كود الأدمن الذي قام بالتفعيل
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث بالاسم، الهاتف، أو الكود..."
                  className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4 font-bold">اسم الطالب</th>
                      <th className="py-3.5 px-4 font-bold">كود الحضور</th>
                      <th className="py-3.5 px-4 font-bold">هاتف الطالب</th>
                      <th className="py-3.5 px-4 font-bold">هاتف ولي الأمر</th>
                      <th className="py-3.5 px-4 font-bold">الصف الدراسي</th>
                      <th className="py-3.5 px-4 font-bold">تم التفعيل بواسطة</th>
                      <th className="py-3.5 px-4 font-bold text-left">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                    {loading ? (
                      [1, 2, 3].map((n) => (
                        <tr key={n}>
                          <td className="py-4 px-4"><div className="h-4 w-36 rounded shimmer-box" /></td>
                          <td className="py-4 px-4"><div className="h-4 w-16 rounded shimmer-box" /></td>
                          <td className="py-4 px-4"><div className="h-4 w-24 rounded shimmer-box" /></td>
                          <td className="py-4 px-4"><div className="h-4 w-24 rounded shimmer-box" /></td>
                          <td className="py-4 px-4"><div className="h-4 w-28 rounded shimmer-box" /></td>
                          <td className="py-4 px-4"><div className="h-4 w-20 rounded shimmer-box" /></td>
                          <td className="py-4 px-4"><div className="h-7 w-20 rounded shimmer-box mr-auto" /></td>
                        </tr>
                      ))
                    ) : filterBySearch(activeStudents).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-400 font-bold">
                          لا يوجد طلاب مفعلين مطابقين للبحث
                        </td>
                      </tr>
                    ) : (
                      filterBySearch(activeStudents).map((student) => (
                        <tr key={student.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                          <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                            {student.full_name}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              dir="ltr"
                              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-black text-indigo-600 dark:text-indigo-400"
                            >
                              {student.attendance_code || "---"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono">{student.phone}</td>
                          <td className="py-3.5 px-4 font-mono text-slate-500">
                            {student.parent_phone || "---"}
                          </td>
                          <td className="py-3.5 px-4 font-semibold">
                            {formatGrade(student.grade)}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              dir="ltr"
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/70 dark:border-indigo-800/60 text-[11px] font-mono font-black text-indigo-600 dark:text-indigo-400"
                            >
                              {student.activated_by || currentAdminCode}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-left space-x-2 space-x-reverse">
                            <button
                              type="button"
                              disabled={togglingUserIds.includes(student.id) || deletingUserIds.includes(student.id)}
                              onClick={() => handleToggleUser(student.id, false)}
                              className="px-3 py-1.5 rounded-lg font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-500 hover:text-white disabled:opacity-60 transition inline-flex items-center gap-1.5"
                            >
                              {togglingUserIds.includes(student.id) && (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              )}
                              <span>إيقاف التفعيل</span>
                            </button>
                            <button
                              type="button"
                              disabled={deletingUserIds.includes(student.id) || togglingUserIds.includes(student.id)}
                              onClick={() => handleDeleteUser(student.id)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 disabled:opacity-60 transition"
                              title="حذف الحساب"
                            >
                              {deletingUserIds.includes(student.id) ? (
                                <Loader2 className="w-4 h-4 inline animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4 inline" />
                              )}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* SECTION 2: ACTIVATION REQUESTS (طلبات تفعيل الطلاب)               */}
        {/* ================================================================= */}
        {activeTab === "requests" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                  طلبات تفعيل الطلاب ({pendingStudents.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  سيتم تسجيل التفعيل باسم كود الأدمن الخاص بك ({currentAdminCode})
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث في الطلبات..."
                  className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4 font-bold">اسم الطالب</th>
                      <th className="py-3.5 px-4 font-bold">هاتف الطالب</th>
                      <th className="py-3.5 px-4 font-bold">هاتف ولي الأمر</th>
                      <th className="py-3.5 px-4 font-bold">الصف الدراسي</th>
                      <th className="py-3.5 px-4 font-bold text-left">التحكم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                    {loading ? (
                      [1, 2].map((n) => (
                        <tr key={n}>
                          <td className="py-4 px-4"><div className="h-4 w-36 rounded shimmer-box" /></td>
                          <td className="py-4 px-4"><div className="h-4 w-24 rounded shimmer-box" /></td>
                          <td className="py-4 px-4"><div className="h-4 w-24 rounded shimmer-box" /></td>
                          <td className="py-4 px-4"><div className="h-4 w-28 rounded shimmer-box" /></td>
                          <td className="py-4 px-4"><div className="h-7 w-24 rounded shimmer-box mr-auto" /></td>
                        </tr>
                      ))
                    ) : filterBySearch(pendingStudents).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-400 font-bold">
                          لا توجد طلبات تفعيل معلقة حالياً
                        </td>
                      </tr>
                    ) : (
                      filterBySearch(pendingStudents).map((student) => (
                        <tr key={student.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                          <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                            {student.full_name}
                          </td>
                          <td className="py-3.5 px-4 font-mono">{student.phone}</td>
                          <td className="py-3.5 px-4 font-mono text-slate-500">
                            {student.parent_phone || "---"}
                          </td>
                          <td className="py-3.5 px-4 font-semibold">
                            {formatGrade(student.grade)}
                          </td>
                          <td className="py-3.5 px-4 text-left space-x-2 space-x-reverse">
                            <button
                              type="button"
                              disabled={togglingUserIds.includes(student.id) || deletingUserIds.includes(student.id)}
                              onClick={() => handleToggleUser(student.id, true)}
                              className="px-4 py-1.5 rounded-lg font-bold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60 transition inline-flex items-center gap-1.5"
                            >
                              {togglingUserIds.includes(student.id) && (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              )}
                              <span>تفعيل الحساب</span>
                            </button>
                            <button
                              type="button"
                              disabled={deletingUserIds.includes(student.id) || togglingUserIds.includes(student.id)}
                              onClick={() => handleDeleteUser(student.id)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 disabled:opacity-60 transition"
                              title="رفض وحذف"
                            >
                              {deletingUserIds.includes(student.id) ? (
                                <Loader2 className="w-4 h-4 inline animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4 inline" />
                              )}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* SECTION 3: ACTIVATION CODES (أكواد التفعيل مع تاريخ وساعة الانتهاء) */}
        {/* ================================================================= */}
        {activeTab === "codes" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                أكواد التفعيل ({codes.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                توليد أكواد تفعيل مخصصة بتاريخ وساعة انتهاء محددة (اليوم، الشهر، السنة، والساعة)
              </p>
            </div>

            {/* Code Generator Card with Custom Date & Time Picker + Max Allowed Users + Target Course */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm grid sm:grid-cols-12 gap-4 items-end">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  عدد الأكواد
                </label>
                <div className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() =>
                      setCodesCountToGen((prev) => Math.max(1, prev - 1))
                    }
                    className="w-7 h-7 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-600 text-slate-700 dark:text-slate-200 font-black text-sm flex items-center justify-center transition"
                  >
                    -
                  </button>
                  <span className="font-mono font-black text-sm text-indigo-600 dark:text-indigo-400">
                    {codesCountToGen}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCodesCountToGen((prev) => Math.min(50, prev + 1))
                    }
                    className="w-7 h-7 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-600 text-slate-700 dark:text-slate-200 font-black text-sm flex items-center justify-center transition"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>عدد الأشخاص</span>
                </label>
                <div className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() =>
                      setMaxUsesPerCode((prev) => Math.max(1, prev - 1))
                    }
                    className="w-7 h-7 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-600 text-slate-700 dark:text-slate-200 font-black text-sm flex items-center justify-center transition shrink-0"
                  >
                    -
                  </button>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={maxUsesPerCode}
                      onChange={(e) => {
                        const val = parseInt(e.target.value.replace(/\D/g, ""), 10);
                        setMaxUsesPerCode(isNaN(val) ? 1 : Math.min(1000, Math.max(1, val)));
                      }}
                      className="w-10 text-center bg-transparent font-mono font-black text-sm text-indigo-600 dark:text-indigo-400 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setMaxUsesPerCode((prev) => Math.min(1000, prev + 1))
                    }
                    className="w-7 h-7 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-600 text-slate-700 dark:text-slate-200 font-black text-sm flex items-center justify-center transition shrink-0"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="sm:col-span-3 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>يفتح كورس (مخصص لـ)</span>
                </label>
                <select
                  value={codeTargetCourseId}
                  onChange={(e) => setCodeTargetCourseId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-600"
                >
                  <option value="all">كل الكورسات (تفعيل شامل)</option>
                  {coursesList.map((course) => (
                    <option key={course.id} value={String(course.id)}>
                      {course.title} ({formatGrade(course.grade)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>ينتهي في</span>
                </label>
                <CustomDateTimePicker
                  value={expiryDateTime}
                  onChange={setExpiryDateTime}
                />
              </div>

              <div className="sm:col-span-2">
                <button
                  type="button"
                  disabled={generatingCodes}
                  onClick={handleGenerateCodes}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {generatingCodes ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>توليد الأكواد</span>
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4 font-bold">الكود</th>
                      <th className="py-3.5 px-4 font-bold">الكورس المخصص</th>
                      <th className="py-3.5 px-4 font-bold">تم الإنشاء بواسطة</th>
                      <th className="py-3.5 px-4 font-bold">الاستخدام المسموح</th>
                      <th className="py-3.5 px-4 font-bold">ساري لمدة / ينتهي في</th>
                      <th className="py-3.5 px-4 font-bold">الحالة</th>
                      <th className="py-3.5 px-4 font-bold">استُخدم بواسطة</th>
                      <th className="py-3.5 px-4 font-bold text-left">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                    {loading ? (
                      [1, 2].map((n) => (
                        <tr key={n}>
                          <td className="py-4 px-4"><div className="h-4 w-32 rounded shimmer-box" /></td>
                          <td className="py-4 px-4"><div className="h-4 w-28 rounded shimmer-box" /></td>
                          <td className="py-4 px-4"><div className="h-4 w-20 rounded shimmer-box" /></td>
                          <td className="py-4 px-4"><div className="h-4 w-24 rounded shimmer-box" /></td>
                          <td className="py-4 px-4"><div className="h-4 w-36 rounded shimmer-box" /></td>
                          <td className="py-4 px-4"><div className="h-4 w-24 rounded shimmer-box" /></td>
                          <td className="py-4 px-4"><div className="h-4 w-24 rounded shimmer-box" /></td>
                          <td className="py-4 px-4"><div className="h-7 w-16 rounded shimmer-box mr-auto" /></td>
                        </tr>
                      ))
                    ) : codes.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-slate-400 font-bold">
                          لا توجد أكواد تفعيل حالياً
                        </td>
                      </tr>
                    ) : (
                      codes.map((c) => {
                      const expInfo = formatExpiryInfo(c.expires_at);
                      const maxUses = Math.max(1, Number(c.max_uses) || 1);
                      const usesCount = Number(c.uses_count) || (c.is_used ? 1 : 0);
                      const isFull = Boolean(c.is_used) || usesCount >= maxUses;
                      const linkedCourse = c.course_id
                        ? coursesList.find((cr) => cr.id === Number(c.course_id))
                        : null;

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                          <td className="py-3.5 px-4">
                            <span
                              dir="ltr"
                              className="font-mono font-black text-sm text-slate-900 dark:text-white"
                            >
                              {c.code}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            {linkedCourse ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate max-w-[160px]">{linkedCourse.title}</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs">
                                شامل (كل الكورسات)
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              dir="ltr"
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/70 dark:border-indigo-800/60 text-[11px] font-mono font-black text-indigo-600 dark:text-indigo-400"
                            >
                              {c.created_by || currentAdminCode}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-800 dark:text-slate-200">
                              <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                              <span dir="ltr" className="font-mono font-black text-indigo-600 dark:text-indigo-400">
                                {usesCount} / {maxUses}
                              </span>
                              <span className="text-[11px] text-slate-500">شخص</span>
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <p
                                className={`text-xs font-bold flex items-center gap-1 ${
                                  expInfo.isExpired
                                    ? "text-rose-500"
                                    : "text-slate-800 dark:text-slate-200"
                                }`}
                              >
                                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                                <span>{expInfo.durationText}</span>
                              </p>
                              <p className="text-[11px] text-slate-400 font-mono">
                                {expInfo.label}
                              </p>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {isFull ? (
                              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold">
                                مكتمل ({usesCount}/{maxUses})
                              </span>
                            ) : expInfo.isExpired ? (
                              <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-500 font-bold">
                                منتهي
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold">
                                متاح (متبقي {maxUses - usesCount})
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 font-mono text-slate-500">
                            {c.used_by_phone || "---"}
                          </td>

                          <td className="py-3.5 px-4 text-left space-x-2 space-x-reverse">
                            <button
                              type="button"
                              onClick={() => handleCopyCode(c.code)}
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                              title="نسخ الكود"
                            >
                              <Copy className="w-4 h-4 inline" />
                            </button>
                            <button
                              type="button"
                              disabled={deletingCodeIds.includes(c.id)}
                              onClick={() => handleDeleteCode(c.id)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 disabled:opacity-60 transition"
                              title="حذف الكود"
                            >
                              {deletingCodeIds.includes(c.id) ? (
                                <Loader2 className="w-4 h-4 inline animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4 inline" />
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* SECTION 3B: COURSES & LESSONS (الكورسات والمحاضرات - رفع فيديوهات) */}
        {/* ================================================================= */}
        {activeTab === "courses" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                الكورسات والمحاضرات ({coursesList.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                إنشاء كاتجوري / كورس جديد لكل صف دراسي ورفع قائمة الفيديوهات والمحاضرات بداخله
              </p>
            </div>

            {/* Step 1: Create New Course / Category Form */}
            <form
              onSubmit={handleCreateCourse}
              className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm grid sm:grid-cols-12 gap-4 items-end"
            >
              <div className="sm:col-span-3 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  اسم الكورس (يظهر أعلى الفيديو)
                </label>
                <input
                  type="text"
                  required
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  placeholder="مثال: اللغة الإنجليزية - المستوى الأول"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  اسم الكاتجوري / القسم
                </label>
                <input
                  type="text"
                  value={courseCategory}
                  onChange={(e) => setCourseCategory(e.target.value)}
                  placeholder="مثال: المستوى الأول"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="sm:col-span-3 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  الصف الدراسي
                </label>
                <div className="grid grid-cols-3 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-black">
                  {[
                    { val: "grade_1", short: "أولى ثانوي" },
                    { val: "grade_2", short: "ثانية ثانوي" },
                    { val: "grade_3", short: "ثالثة ثانوي" },
                  ].map((g) => (
                    <button
                      key={g.val}
                      type="button"
                      onClick={() => setCourseGrade(g.val)}
                      className={`py-1.5 rounded-lg transition ${
                        courseGrade === g.val
                          ? "bg-indigo-600 text-white"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      }`}
                    >
                      {g.short}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  صورة كارت الكورس (من برا)
                </label>
                <label className="cursor-pointer w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-600 text-xs font-bold flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-300 transition truncate">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCourseThumbnailFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <ImagePlus className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                  <span className="truncate">
                    {courseThumbnailFile ? courseThumbnailFile.name : "اختيار صورة الكارت"}
                  </span>
                </label>
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={creatingCourse}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {creatingCourse ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>إنشاء كورس</span>
                </button>
              </div>
            </form>

            {/* Step 2: Split View -> Courses List (Right) + Upload Videos to Selected Course (Left) */}
            <div className="grid lg:grid-cols-12 gap-6 items-start">
              {/* Right Column: Courses / Categories List */}
              <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    قائمة الكاتجوري والكورسات
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">
                    اختر كورس لرفع الفيديوهات
                  </span>
                </div>

                <div className="divide-y divide-slate-200/70 dark:divide-slate-800 max-h-[520px] overflow-y-auto">
                  {loading ? (
                    [1, 2].map((n) => (
                      <div key={n} className="p-4 space-y-2">
                        <div className="h-4 w-44 rounded shimmer-box" />
                        <div className="h-3 w-28 rounded shimmer-box" />
                      </div>
                    ))
                  ) : coursesList.length === 0 ? (
                    <div className="py-12 px-4 text-center text-xs font-bold text-slate-400">
                      لا توجد كورسات حالياً — أنشئ أول كورس من الأعلى
                    </div>
                  ) : (
                    coursesList.map((course) => {
                      const isSelected = selectedCourseId === course.id;
                      const cLessonsCount = lessonsList.filter(
                        (l) => l.course_id === course.id
                      ).length;

                      return (
                        <div
                          key={course.id}
                          onClick={() => setSelectedCourseId(course.id)}
                          className={`p-4 cursor-pointer transition flex items-center justify-between gap-3 ${
                            isSelected
                              ? "bg-indigo-600/10 dark:bg-indigo-600/15 border-r-4 border-indigo-600"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-14 h-12 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 ${
                                course.thumbnail ? "bg-slate-900" : "shimmer-box"
                              }`}
                            >
                              {course.thumbnail && (
                                <img
                                  src={course.thumbnail}
                                  alt={course.title}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>

                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black">
                                  {course.category}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400">
                                  {formatGrade(course.grade)}
                                </span>
                              </div>
                              <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
                                {course.title}
                              </h3>
                              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                <Film className="w-3.5 h-3.5 text-indigo-500" />
                                <span>{cLessonsCount} فيديو مرفوع</span>
                              </p>
                            </div>
                          </div>

                          <div
                            className="flex items-center gap-1.5 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <label
                              className="cursor-pointer p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-600 hover:text-white transition"
                              title="تخصيص / تغيير صورة كارت الكورس من برا"
                            >
                              <input
                                type="file"
                                accept="image/*"
                                disabled={updatingThumbnailCourseIds.includes(course.id)}
                                onChange={(e) =>
                                  handleUpdateCourseThumbnail(
                                    course.id,
                                    e.target.files?.[0]
                                  )
                                }
                                className="hidden"
                              />
                              {updatingThumbnailCourseIds.includes(course.id) ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <ImagePlus className="w-3.5 h-3.5" />
                              )}
                            </label>

                            <Link
                              href={`/courses/${course.id}`}
                              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-600 hover:text-white transition"
                              title="معاينة صفحة الكورس"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>

                            <button
                              type="button"
                              disabled={deletingCourseIds.includes(course.id)}
                              onClick={() => handleDeleteCourse(course.id)}
                              className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 disabled:opacity-60 transition"
                              title="حذف الكورس"
                            >
                              {deletingCourseIds.includes(course.id) ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Left Column: Upload & Manage Videos Inside Selected Course */}
              <div className="lg:col-span-7 space-y-4">
                {selectedCourseId &&
                coursesList.some((c) => c.id === selectedCourseId) ? (
                  <>
                    {/* Upload Video Lesson Form */}
                    <form
                      onSubmit={handleCreateLesson}
                      className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800 pb-3">
                        <div>
                          <h3 className="text-sm font-black text-slate-900 dark:text-white">
                            رفع فيديو داخل:{" "}
                            <span className="text-indigo-600 dark:text-indigo-400">
                              {
                                coursesList.find((c) => c.id === selectedCourseId)
                                  ?.title
                              }
                            </span>
                          </h3>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            أضف الدروس بالترتيب (مثال: Introduction، Lesson 1، Lesson 2...)
                          </p>
                        </div>

                        <Link
                          href={`/courses/${selectedCourseId}`}
                          className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-indigo-600 hover:text-white transition"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          <span>فتح المشغل</span>
                        </Link>
                      </div>

                      <div className="grid sm:grid-cols-12 gap-3 items-end">
                        <div className="sm:col-span-8 space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            عنوان الفيديو / الدرس
                          </label>
                          <input
                            type="text"
                            required
                            value={lessonTitle}
                            onChange={(e) => setLessonTitle(e.target.value)}
                            placeholder="مثال: Lesson 1 - المحاضرة الأولى"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold focus:outline-none focus:border-indigo-600"
                          />
                        </div>

                        <div className="sm:col-span-4 space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            مدة الفيديو (تحسب تلقائياً)
                          </label>
                          <input
                            type="text"
                            value={lessonDuration}
                            onChange={(e) => setLessonDuration(e.target.value)}
                            placeholder="20 دقيقة"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold focus:outline-none focus:border-indigo-600"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="cursor-pointer block rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 bg-slate-50/70 dark:bg-slate-800/40 p-5 text-center transition">
                          <input
                            type="file"
                            accept="video/*"
                            onChange={handleVideoFileChange}
                            className="hidden"
                          />
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                              <Upload className="w-5 h-5" />
                            </div>
                            {selectedVideoFile ? (
                              <div className="space-y-0.5">
                                <p className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                                  {selectedVideoFile.name}
                                </p>
                                <p className="text-[11px] font-mono text-slate-400">
                                  {(selectedVideoFile.size / (1024 * 1024)).toFixed(1)} MB • المدة: {lessonDuration}
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                  اضغط لاختيار ملف الفيديو من جهازك
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  يدعم جميع صيغ الفيديو (MP4, WebM, MKV, MOV) ويحسب المدة تلقائياً
                                </p>
                              </div>
                            )}
                          </div>
                        </label>

                        {creatingLesson && uploadProgress > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                              <span>جاري رفع الفيديو إلى المنصة...</span>
                              <span className="font-mono">{uploadProgress}%</span>
                            </div>
                            <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                              <div
                                style={{ width: `${uploadProgress}%` }}
                                className="h-full bg-indigo-600 transition-all duration-200"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={creatingLesson}
                        className="w-full py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 transition flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        {creatingLesson ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        <span>
                          {creatingLesson
                            ? `جاري رفع الفيديو (${uploadProgress}%)...`
                            : "رفع وإضافة الفيديو لمحتوى الكورس"}
                        </span>
                      </button>
                    </form>

                    {/* Course Content Playlist Preview */}
                    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                      <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          محتوى الكورس (قائمة الفيديوهات)
                        </span>
                        <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                          {
                            lessonsList.filter(
                              (l) => l.course_id === selectedCourseId
                            ).length
                          }{" "}
                          فيديو
                        </span>
                      </div>

                      <div className="divide-y divide-slate-200/70 dark:divide-slate-800">
                        {lessonsList.filter(
                          (l) => l.course_id === selectedCourseId
                        ).length === 0 ? (
                          <div className="py-10 text-center text-xs font-bold text-slate-400">
                            لم يتم إضافة فيديوهات في هذا الكورس بعد
                          </div>
                        ) : (
                          lessonsList
                            .filter((l) => l.course_id === selectedCourseId)
                            .map((lesson, idx) => (
                              <div
                                key={lesson.id}
                                className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono text-[11px] font-black flex items-center justify-center shrink-0">
                                    {idx + 1}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                                      {lesson.title}
                                    </p>
                                    <p
                                      dir="ltr"
                                      className="text-[10px] font-mono text-slate-400 truncate max-w-xs"
                                    >
                                      {lesson.video_url}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-xs font-bold text-slate-400">
                                    {lesson.duration}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={deletingLessonIds.includes(lesson.id)}
                                    onClick={() =>
                                      handleDeleteLesson(
                                        lesson.id,
                                        selectedCourseId
                                      )
                                    }
                                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 disabled:opacity-60 transition"
                                    title="حذف الفيديو"
                                  >
                                    {deletingLessonIds.includes(lesson.id) ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-10 text-center text-slate-400 font-bold text-xs">
                    اختر كورس من القائمة الجانبية أو أنشئ كورس جديد للبدء في رفع الفيديوهات
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* SECTION 4: TEAM & ADMINS (إدارة التيم والأدمن - متاح لـ ADM_1,2,3) */}
        {/* ================================================================= */}
        {activeTab === "team" && canManageTeam && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                إدارة التيم والأدمن ({staffMembers.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                إضافة حسابات المساعدين والأدمن مع تخصيص كود خاص لكل أدمن ومتابعة إحصائيات تفعيله
              </p>
            </div>

            {/* Add New Staff / Admin Form Card */}
            <form
              onSubmit={handleCreateStaff}
              className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm grid sm:grid-cols-12 gap-4 items-end"
            >
              <div className="sm:col-span-3 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  اسم الأدمن / المساعد
                </label>
                <input
                  type="text"
                  required
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  placeholder="مثال: م. محمد طارق"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  رقم الهاتف
                </label>
                <input
                  type="tel"
                  required
                  value={staffPhone}
                  onChange={(e) => setStaffPhone(e.target.value)}
                  placeholder="010xxxxxxxx"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  كلمة المرور
                </label>
                <input
                  type="password"
                  required
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  كود الأدمن (اختياري)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={staffCustomCode}
                  onChange={(e) => setStaffCustomCode(e.target.value.toUpperCase())}
                  placeholder="ADM_25"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono font-black text-indigo-600 dark:text-indigo-400 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="sm:col-span-1 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  الصلاحية
                </label>
                <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-black">
                  <button
                    type="button"
                    onClick={() => setStaffRole("TEAM")}
                    className={`py-1.5 rounded-lg transition ${
                      staffRole === "TEAM"
                        ? "bg-indigo-600 text-white"
                        : "text-slate-500"
                    }`}
                  >
                    تيم
                  </button>
                  <button
                    type="button"
                    onClick={() => setStaffRole("ADMIN")}
                    className={`py-1.5 rounded-lg transition ${
                      staffRole === "ADMIN"
                        ? "bg-indigo-600 text-white"
                        : "text-slate-500"
                    }`}
                  >
                    أدمن
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={creatingStaff}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {creatingStaff ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>إضافة عضو</span>
                </button>
              </div>
            </form>

            {/* Staff Members Table */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4 font-bold">الاسم</th>
                      <th className="py-3.5 px-4 font-bold">كود الأدمن المخصص</th>
                      <th className="py-3.5 px-4 font-bold">رقم الهاتف</th>
                      <th className="py-3.5 px-4 font-bold">الصلاحية</th>
                      <th className="py-3.5 px-4 font-bold">إحصائيات التفعيل والأكواد</th>
                      <th className="py-3.5 px-4 font-bold text-left">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                    {loading ? (
                      [1, 2].map((n) => (
                        <tr key={n}>
                          <td className="py-4 px-4"><div className="h-4 w-36 rounded shimmer-box" /></td>
                          <td className="py-4 px-4"><div className="h-4 w-20 rounded shimmer-box" /></td>
                          <td className="py-4 px-4"><div className="h-4 w-24 rounded shimmer-box" /></td>
                          <td className="py-4 px-4"><div className="h-4 w-20 rounded shimmer-box" /></td>
                          <td className="py-4 px-4"><div className="h-4 w-40 rounded shimmer-box" /></td>
                          <td className="py-4 px-4"><div className="h-7 w-16 rounded shimmer-box mr-auto" /></td>
                        </tr>
                      ))
                    ) : staffMembers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-slate-400 font-bold">
                          لا يوجد أعضاء في التيم حالياً
                        </td>
                      </tr>
                    ) : (
                      staffMembers.map((staff) => {
                        const staffCode = staff.admin_code || `ADM_${staff.id}`;
                        const isPrimaryOwner =
                          staff.phone === "01000000000" || staffCode === "ADM_1";
                        const activatedCount = activeStudents.filter(
                          (st) =>
                            st.activated_by &&
                            st.activated_by.toUpperCase().includes(staffCode.toUpperCase())
                        ).length;
                        const generatedCodesCount = codes.filter(
                          (c) =>
                            c.created_by &&
                            c.created_by.toUpperCase() === staffCode.toUpperCase()
                        ).length;

                        return (
                          <tr
                            key={staff.id}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                          >
                            <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                              {staff.full_name}
                            </td>

                            <td className="py-3.5 px-4">
                              <span
                                dir="ltr"
                                className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/70 dark:border-indigo-800/60 text-[11px] font-mono font-black text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-1"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>{staffCode}</span>
                              </span>
                            </td>

                            <td className="py-3.5 px-4 font-mono">{staff.phone}</td>

                            <td className="py-3.5 px-4">
                              {isPrimaryOwner ? (
                                <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-[11px]">
                                  الأدمن الرئيسي
                                </span>
                              ) : staff.role === "ADMIN" ? (
                                <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold text-[11px]">
                                  أدمن (ADMIN)
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px]">
                                  تيم المساعدين (TEAM)
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-[11px] text-slate-700 dark:text-slate-300">
                                  فعّل <strong className="text-indigo-600 dark:text-indigo-400 font-mono">{activatedCount}</strong> طالب
                                </span>
                                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-[11px] text-slate-700 dark:text-slate-300">
                                  أنشأ <strong className="text-indigo-600 dark:text-indigo-400 font-mono">{generatedCodesCount}</strong> كود
                                </span>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-left">
                              {isPrimaryOwner ? (
                                <span className="text-[11px] font-bold text-slate-400">
                                  حساب أساسي
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={deletingStaffIds.includes(staff.id)}
                                  onClick={() => handleDeleteStaff(staff.id)}
                                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 disabled:opacity-60 transition"
                                  title="حذف العضو"
                                >
                                  {deletingStaffIds.includes(staff.id) ? (
                                    <Loader2 className="w-4 h-4 inline animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4 inline" />
                                  )}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* SECTION 5: SETTINGS (الإعدادات - فارغة حالياً)                    */}
        {/* ================================================================= */}
        {activeTab === "settings" && <div />}
      </div>
    </div>
  );
}
