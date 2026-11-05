"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  getCachedCourseDetail,
  setCachedCourseDetail,
} from "@/lib/clientCache";
import {
  CheckCircle2,
  PlayCircle,
  Heart,
  ArrowRight,
  Clock,
  Film,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Settings,
  Maximize,
  Minimize,
  PictureInPicture2,
  Check,
  Loader2,
  ShieldAlert,
  Lock,
  KeyRound,
} from "lucide-react";

interface CourseDetail {
  id: number;
  title: string;
  description: string;
  category: string;
  grade: string;
  lessonsCount: number;
}

interface LessonItem {
  id: number;
  course_id: number;
  title: string;
  video_url: string;
  duration: string;
  sort_order: number;
}

function getEmbedUrl(url: string): { isIframe: boolean; src: string } {
  const trimmed = (url || "").trim();
  // YouTube watch?v= or youtu.be/
  const ytMatch = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/
  );
  if (ytMatch && ytMatch[1]) {
    return {
      isIframe: true,
      src: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`,
    };
  }
  // Vimeo
  const vimeoMatch = trimmed.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      isIframe: true,
      src: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
    };
  }
  // Google Drive
  if (trimmed.includes("drive.google.com")) {
    const driveSrc = trimmed.replace(/\/view.*$/, "/preview");
    return { isIframe: true, src: driveSrc };
  }
  // Direct mp4 / webm / ogg / mp3 / m4a
  if (/\.(mp4|webm|ogg|mp3|m4a)(\?.*)?$/i.test(trimmed)) {
    return { isIframe: false, src: trimmed };
  }
  // If already an embed link
  if (trimmed.includes("embed") || trimmed.includes("player")) {
    return { isIframe: true, src: trimmed };
  }
  return { isIframe: false, src: trimmed };
}

type VideoQuality = "auto" | "1080p" | "720p" | "480p" | "360p";

const QUALITY_OPTIONS: {
  value: VideoQuality;
  label: string;
  badge?: string;
}[] = [
  { value: "auto", label: "تلقائي (Auto)" },
  { value: "1080p", label: "1080p", badge: "FHD" },
  { value: "720p", label: "720p", badge: "HD" },
  { value: "480p", label: "480p" },
  { value: "360p", label: "360p" },
];

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const total = Math.floor(sec);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export default function CoursePlayerPage() {
  const params = useParams();
  const courseId = String(params?.id || "");

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [activeLesson, setActiveLesson] = useState<LessonItem | null>(null);
  const [watchedIds, setWatchedIds] = useState<number[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);

  // Custom Yanfaa-Style Video Player State
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [selectedQuality, setSelectedQuality] = useState<VideoQuality>("1080p");
  const [switchingQuality, setSwitchingQuality] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Course-Specific Unlock & Anti-Screen-Capture Security State
  const [studentInfo, setStudentInfo] = useState<{
    fullName: string;
    phone: string;
    code: string;
    role: string;
  }>({ fullName: "", phone: "", code: "", role: "STUDENT" });
  const [isCourseUnlocked, setIsCourseUnlocked] = useState(true);
  const [unlockCodeInput, setUnlockCodeInput] = useState("");
  const [unlockingCourse, setUnlockingCourse] = useState(false);
  const [unlockError, setUnlockError] = useState("");

  const [isSecurityBlocked, setIsSecurityBlocked] = useState(false);
  const [securityMessage, setSecurityMessage] = useState(
    "تم إيقاف الفيديو مؤقتاً لحماية المحتوى من التصوير أو لقطات الشاشة"
  );
  const [watermarkPos, setWatermarkPos] = useState<{ top: number; left: number }>({
    top: 18,
    left: 22,
  });

  const storageKey = `alphateam-watched-${courseId}`;
  const favKey = `alphateam-fav-${courseId}`;

  const checkUserCourseAccess = (userObj: any, targetCourseId: string) => {
    if (!userObj) return true;
    if (userObj.role === "ADMIN" || userObj.role === "TEAM") return true;
    const raw = String(userObj.unlocked_courses || "").trim();
    if (!raw || raw === "ALL") return true;
    const allowedIds = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return allowedIds.includes(String(targetCourseId));
  };

  useEffect(() => {
    if (!courseId) return;

    try {
      const savedUserRaw = localStorage.getItem("alphateam-user");
      if (savedUserRaw) {
        const parsedUser = JSON.parse(savedUserRaw);
        const twoPartName = String(parsedUser.full_name || "طالب المنصة")
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .join(" ");
        setStudentInfo({
          fullName: twoPartName,
          phone: parsedUser.phone || "",
          code: parsedUser.attendance_code || parsedUser.admin_code || "STD",
          role: parsedUser.role || "STUDENT",
        });
        setIsCourseUnlocked(checkUserCourseAccess(parsedUser, courseId));
      }

      const savedWatched = localStorage.getItem(storageKey);
      if (savedWatched) {
        setWatchedIds(JSON.parse(savedWatched));
      }
      setIsFavorite(localStorage.getItem(favKey) === "1");
      const savedQuality = localStorage.getItem("alphateam-video-quality") as VideoQuality | null;
      if (savedQuality && QUALITY_OPTIONS.some((q) => q.value === savedQuality)) {
        setSelectedQuality(savedQuality);
      }
    } catch {}

    // 1. Instant load from client cache (zero shimmer)
    const cachedDetail = getCachedCourseDetail(courseId);
    if (cachedDetail) {
      if (cachedDetail.course) setCourse(cachedDetail.course);
      const cachedLessons: LessonItem[] = Array.isArray(cachedDetail.lessons)
        ? cachedDetail.lessons
        : [];
      setLessons(cachedLessons);
      if (cachedLessons.length > 0) {
        setActiveLesson(cachedLessons[0]);
        markLessonWatched(cachedLessons[0].id);
      }
      setLoading(false);
    }

    // 2. Background revalidation
    fetch(`/api/courses?id=${courseId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.course) {
          setCourse(data.course);
        }
        const fetchedLessons: LessonItem[] = Array.isArray(data.lessons)
          ? data.lessons
          : [];
        setLessons(fetchedLessons);
        if (data.course) {
          setCachedCourseDetail(courseId, data.course, fetchedLessons);
        }
        if (fetchedLessons.length > 0 && !cachedDetail) {
          setActiveLesson(fetchedLessons[0]);
          // Automatically mark first opened video as watched
          markLessonWatched(fetchedLessons[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [courseId]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Dynamic moving watermark inside video player every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setWatermarkPos({
        top: Math.floor(14 + Math.random() * 62),
        left: Math.floor(12 + Math.random() * 58),
      });
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Anti-Screenshot & Anti-Screen-Recording Protection Listeners
  useEffect(() => {
    const triggerSecurityShield = (reason: string) => {
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
      setIsPlaying(false);
      setSecurityMessage(reason);
      setIsSecurityBlocked(true);
      try {
        navigator.clipboard?.writeText("");
      } catch {}
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key?.toLowerCase() || "";
      // Detect PrintScreen, Snipping Tool (Win+Shift+S / Cmd+Shift+3/4/5), DevTools, Save/Print
      if (
        e.key === "PrintScreen" ||
        e.keyCode === 44 ||
        (e.metaKey && e.shiftKey && ["s", "3", "4", "5"].includes(key)) ||
        (e.ctrlKey && e.shiftKey && ["s", "i", "j", "c"].includes(key)) ||
        (e.ctrlKey && ["p", "s", "u"].includes(key)) ||
        e.key === "F12"
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerSecurityShield(
          "تم رصد محاولة تصوير الشاشة أو التقاط صورة — المحتوى محمي بحقوق المنصة"
        );
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen" || e.keyCode === 44) {
        e.preventDefault();
        triggerSecurityShield(
          "تم منع لقطة الشاشة (Screenshot) لحماية محتوى الكورس"
        );
      }
    };

    const handleWindowBlur = () => {
      if (videoRef.current && !videoRef.current.paused) {
        triggerSecurityShield(
          "تم إيقاف الفيديو مؤقتاً عند الخروج من النافذة لمنع برامج تصوير الشاشة"
        );
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && videoRef.current && !videoRef.current.paused) {
        triggerSecurityShield(
          "تم إيقاف الفيديو مؤقتاً لحماية المحتوى أثناء مغادرة الصفحة"
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const handleUnlockCourseWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockCodeInput.trim()) {
      setUnlockError("يرجى إدخال كود التفعيل");
      return;
    }
    setUnlockingCourse(true);
    setUnlockError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "code",
          phone: studentInfo.phone,
          code: unlockCodeInput.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        localStorage.setItem("alphateam-user", JSON.stringify(data.user));
        const unlockedNow = checkUserCourseAccess(data.user, courseId);
        if (unlockedNow) {
          setIsCourseUnlocked(true);
          setUnlockCodeInput("");
        } else {
          setUnlockError("هذا الكود مخصص لكورس آخر وليس لهذا الكورس");
        }
      } else {
        setUnlockError(data.error || "كود التفعيل غير صالح");
      }
    } catch {
      setUnlockError("تعذر الاتصال بالسيرفر");
    } finally {
      setUnlockingCourse(false);
    }
  };

  const markLessonWatched = (lessonId: number) => {
    setWatchedIds((prev) => {
      if (prev.includes(lessonId)) return prev;
      const next = [...prev, lessonId];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleSelectLesson = (lesson: LessonItem) => {
    setActiveLesson(lesson);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setShowQualityMenu(false);
    setShowSpeedMenu(false);
    markLessonWatched(lesson.id);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    setShowQualityMenu(false);
    setShowSpeedMenu(false);
    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    const nextTime = Number(e.target.value);
    setCurrentTime(nextTime);
    if (v) {
      v.currentTime = nextTime;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    const nextVol = Number(e.target.value);
    setVolume(nextVol);
    setIsMuted(nextVol === 0);
    if (v) {
      v.volume = nextVol;
      v.muted = nextVol === 0;
    }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    v.muted = nextMuted;
  };

  const handleSelectSpeed = (rate: number) => {
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const handleSelectQuality = (q: VideoQuality) => {
    setShowQualityMenu(false);
    if (q === selectedQuality) return;

    const v = videoRef.current;
    const savedTime = v ? v.currentTime : 0;
    const wasPlaying = v ? !v.paused : false;

    setSwitchingQuality(true);
    setSelectedQuality(q);
    try {
      localStorage.setItem("alphateam-video-quality", q);
    } catch {}

    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = savedTime;
        videoRef.current.playbackRate = playbackRate;
        if (wasPlaying) {
          videoRef.current.play().catch(() => {});
        }
      }
      setSwitchingQuality(false);
    }, 260);
  };

  const togglePictureInPicture = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await v.requestPictureInPicture();
      }
    } catch {}
  };

  const toggleFullscreen = async () => {
    const container = playerContainerRef.current;
    if (!container) return;
    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {}
  };

  const toggleFavorite = () => {
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      localStorage.setItem(favKey, next ? "1" : "0");
    } catch {}
  };

  const totalLessons = lessons.length;
  const watchedCount = lessons.filter((l) => watchedIds.includes(l.id)).length;
  const progressPercent =
    totalLessons > 0 ? Math.round((watchedCount / totalLessons) * 100) : 0;

  const mediaInfo = activeLesson
    ? getEmbedUrl(activeLesson.video_url)
    : { isIframe: false, src: "" };

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      className="min-h-screen select-none"
    >
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 space-y-6">
        {/* Top Course Title & Favorite Header (Matches Yanfaa Layout) */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/courses"
              className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-indigo-500 transition"
              title="العودة للكورسات"
            >
              <ArrowRight className="w-4 h-4" />
            </Link>

            {loading ? (
              <div className="h-8 w-64 rounded-xl shimmer-box" />
            ) : (
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {course?.title || "محتوى الكورس"}
                </h1>
                {course?.category && (
                  <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {course.category}
                  </p>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleFavorite}
            className={`w-10 h-10 rounded-full border flex items-center justify-center transition ${
              isFavorite
                ? "bg-rose-500/10 border-rose-500/40 text-rose-500"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-400"
            }`}
            title="إضافة للمفضلة"
          >
            <Heart
              className="w-4 h-4"
              fill={isFavorite ? "currentColor" : "none"}
            />
          </button>
        </div>

        {/* Main 2-Column Course Layout: Playlist on Right (in RTL), Video Player on Left */}
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* RIGHT COLUMN IN RTL: محتوى الكورس (Lessons Playlist) */}
          <div className="lg:col-span-4 order-2 lg:order-1 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-sm font-black text-slate-900 dark:text-white">
                محتوى الكورس
              </span>
              <span className="text-xs font-bold text-slate-400">
                {totalLessons} فيديو
              </span>
            </div>

            <div className="max-h-[540px] overflow-y-auto divide-y divide-slate-200/70 dark:divide-slate-800">
              {loading ? (
                [1, 2, 3, 4, 5].map((n) => (
                  <div
                    key={n}
                    className="px-5 py-4 flex items-center justify-between"
                  >
                    <div className="h-4 w-36 rounded shimmer-box" />
                    <div className="h-3 w-12 rounded shimmer-box" />
                  </div>
                ))
              ) : lessons.length === 0 ? (
                <div className="py-12 px-4 text-center text-xs font-bold text-slate-400">
                  لم يتم رفع فيديوهات في هذا الكورس حتى الآن
                </div>
              ) : (
                lessons.map((lesson) => {
                  const isCurrent = activeLesson?.id === lesson.id;
                  const isWatched = watchedIds.includes(lesson.id);

                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => handleSelectLesson(lesson)}
                      className={`w-full px-5 py-3.5 text-right transition flex items-center justify-between gap-3 ${
                        isCurrent
                          ? "bg-slate-900 dark:bg-indigo-600 text-white font-black"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-200 font-bold"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isWatched ? (
                          <CheckCircle2
                            className={`w-4 h-4 shrink-0 ${
                              isCurrent
                                ? "text-white"
                                : "text-slate-900 dark:text-indigo-400"
                            }`}
                          />
                        ) : (
                          <PlayCircle
                            className={`w-4 h-4 shrink-0 ${
                              isCurrent ? "text-white" : "text-slate-400"
                            }`}
                          />
                        )}
                        <span className="text-xs truncate">{lesson.title}</span>
                      </div>

                      <span
                        className={`text-[11px] shrink-0 ${
                          isCurrent
                            ? "text-slate-200"
                            : "text-slate-400 dark:text-slate-500"
                        }`}
                      >
                        {lesson.duration || "15 دقيقة"}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* LEFT COLUMN IN RTL: Video Player + Progress Bar Below */}
          <div className="lg:col-span-8 order-1 lg:order-2 space-y-4">
            {/* 16:9 Video Player Box (Yanfaa Style with Quality & Speed Controls) */}
            <div
              ref={playerContainerRef}
              className="group aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-lg flex items-center justify-center relative select-none"
            >
              {loading ? (
                <div className="w-full h-full shimmer-box" />
              ) : !isCourseUnlocked ? (
                <div className="w-full h-full bg-slate-950 p-6 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <Lock className="w-7 h-7" />
                  </div>
                  <div className="space-y-1 max-w-md">
                    <h3 className="text-base font-black text-white">
                      هذا الكورس يتطلب كود تفعيل مخصص
                    </h3>
                    <p className="text-xs text-slate-400">
                      أدخل كود التفعيل المخصص لكورس ({course?.title}) أو كود التفعيل الشامل لفتح جميع المحاضرات
                    </p>
                  </div>

                  <form
                    onSubmit={handleUnlockCourseWithCode}
                    className="w-full max-w-sm flex flex-col sm:flex-row gap-2"
                  >
                    <div className="relative flex-1">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                      <input
                        type="text"
                        dir="ltr"
                        value={unlockCodeInput}
                        onChange={(e) => setUnlockCodeInput(e.target.value)}
                        placeholder="ALPHA-XXXXXX"
                        className="w-full pr-10 pl-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono font-black text-white uppercase focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={unlockingCourse}
                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0"
                    >
                      {unlockingCourse && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      )}
                      <span>تفعيل الكورس</span>
                    </button>
                  </form>

                  {unlockError && (
                    <p className="text-xs font-bold text-rose-400">{unlockError}</p>
                  )}
                </div>
              ) : !activeLesson ? (
                <div className="text-center space-y-2 p-6 text-slate-400">
                  <Film className="w-10 h-10 mx-auto text-indigo-500 opacity-80" />
                  <p className="text-sm font-bold">
                    اختر درساً من محتوى الكورس لبدء المشاهدة
                  </p>
                </div>
              ) : mediaInfo.isIframe ? (
                <div className="relative w-full h-full">
                  <iframe
                    key={activeLesson.id}
                    src={mediaInfo.src}
                    title={activeLesson.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                  {/* Dynamic Anti-Piracy Watermark on Iframe */}
                  <div
                    style={{
                      top: `${watermarkPos.top}%`,
                      left: `${watermarkPos.left}%`,
                    }}
                    className="pointer-events-none select-none absolute z-30 px-2.5 py-1 rounded-lg bg-black/35 backdrop-blur-[1px] border border-white/10 text-white/55 text-[11px] font-bold transition-all duration-1000 flex items-center gap-1.5"
                  >
                    <span dir="ltr" className="font-mono font-black">
                      {studentInfo.code}
                    </span>
                    {studentInfo.fullName && (
                      <>
                        <span>•</span>
                        <span>{studentInfo.fullName}</span>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative w-full h-full bg-black flex items-center justify-center">
                  <video
                    ref={videoRef}
                    key={activeLesson.id}
                    src={mediaInfo.src}
                    playsInline
                    disablePictureInPicture
                    controlsList="nodownload noplaybackrate"
                    onClick={togglePlay}
                    onDoubleClick={toggleFullscreen}
                    onPlay={() => {
                      setIsSecurityBlocked(false);
                      setIsPlaying(true);
                    }}
                    onPause={() => setIsPlaying(false)}
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onLoadedMetadata={(e) => {
                      setDuration(e.currentTarget.duration || 0);
                      e.currentTarget.playbackRate = playbackRate;
                      e.currentTarget.volume = volume;
                      e.currentTarget.muted = isMuted;
                    }}
                    onEnded={() => {
                      setIsPlaying(false);
                      markLessonWatched(activeLesson.id);
                    }}
                    style={{
                      filter:
                        selectedQuality === "360p"
                          ? "blur(0.6px) contrast(0.97)"
                          : selectedQuality === "480p"
                          ? "blur(0.25px)"
                          : "none",
                    }}
                    className={`w-full h-full object-contain bg-black cursor-pointer transition-opacity duration-150 ${
                      isSecurityBlocked ? "opacity-0" : "opacity-100"
                    }`}
                  />

                  {/* Audio-Only (MP3) Visual Backdrop inside Player */}
                  {/\.(mp3|m4a)(\?.*)?$/i.test(mediaInfo.src) && !isSecurityBlocked && (
                    <div
                      onClick={togglePlay}
                      className="absolute inset-0 z-10 bg-slate-950 flex flex-col items-center justify-center gap-3 p-6 text-center cursor-pointer"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                        <Volume2 className={`w-8 h-8 ${isPlaying ? "animate-pulse" : ""}`} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-black text-white">
                          {activeLesson.title}
                        </p>
                        <p className="text-[11px] font-mono text-indigo-400">
                          ملف صوتي (MP3) • يعمل مباشرة من المنصة
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Dynamic Moving Student Identity Watermark (Code + Two-Part Name Only) */}
                  <div
                    style={{
                      top: `${watermarkPos.top}%`,
                      left: `${watermarkPos.left}%`,
                    }}
                    className="pointer-events-none select-none absolute z-30 px-3 py-1 rounded-lg bg-black/35 border border-white/10 text-white/55 text-[11px] font-bold tracking-wide transition-all duration-1000 flex items-center gap-1.5"
                  >
                    <span dir="ltr" className="font-mono font-black">
                      {studentInfo.code}
                    </span>
                    {studentInfo.fullName && (
                      <>
                        <span>•</span>
                        <span>{studentInfo.fullName}</span>
                      </>
                    )}
                  </div>

                  {/* Anti-Screenshot / Screen-Capture Blackout Shield */}
                  {isSecurityBlocked && (
                    <div className="absolute inset-0 z-40 bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-4">
                      <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center justify-center">
                        <ShieldAlert className="w-7 h-7" />
                      </div>
                      <div className="space-y-1 max-w-md">
                        <h4 className="text-sm sm:text-base font-black text-white">
                          حماية محتوى الكورس من التصوير
                        </h4>
                        <p className="text-xs font-bold text-slate-400 leading-relaxed">
                          {securityMessage}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsSecurityBlocked(false);
                          if (videoRef.current) {
                            videoRef.current.play().catch(() => {});
                          }
                        }}
                        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-2"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>استئناف المشاهدة</span>
                      </button>
                    </div>
                  )}

                  {/* Quality Switching Overlay Spinner */}
                  {switchingQuality && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 z-20">
                      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                      <span className="text-xs font-bold text-white">
                        جاري التبديل إلى جودة{" "}
                        {selectedQuality === "auto" ? "تلقائي" : selectedQuality}...
                      </span>
                    </div>
                  )}

                  {/* Center Big Play Button Overlay when Paused */}
                  {!isPlaying && !switchingQuality && (
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="absolute z-10 w-16 h-16 rounded-full bg-indigo-600/90 hover:bg-indigo-600 text-white flex items-center justify-center shadow-2xl transition transform hover:scale-105"
                      title="تشغيل الفيديو"
                    >
                      <Play className="w-7 h-7 fill-current ml-0.5" />
                    </button>
                  )}

                  {/* Bottom Yanfaa-Style Control Bar */}
                  <div
                    dir="ltr"
                    className="absolute inset-x-0 bottom-0 z-20 bg-slate-950/90 backdrop-blur-md border-t border-white/10 px-3 sm:px-4 pt-2 pb-2.5 space-y-1.5 transition-opacity duration-200"
                  >
                    {/* Interactive Seek Bar */}
                    <div className="relative flex items-center w-full">
                      <input
                        type="range"
                        min={0}
                        max={duration || 100}
                        step={0.1}
                        value={currentTime}
                        onChange={handleSeek}
                        className="w-full h-1.5 rounded-lg appearance-none bg-slate-700 accent-indigo-500 cursor-pointer"
                      />
                    </div>

                    {/* Controls Row: Left (Play, Volume, Time) | Right (Speed, PiP, Quality Gear, Fullscreen) */}
                    <div className="flex items-center justify-between gap-2 text-white">
                      {/* Left Controls */}
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={togglePlay}
                          className="p-1.5 rounded-lg hover:bg-white/10 transition"
                          title={isPlaying ? "إيقاف مؤقت" : "تشغيل"}
                        >
                          {isPlaying ? (
                            <Pause className="w-4 h-4 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 fill-current" />
                          )}
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={toggleMute}
                            className="p-1.5 rounded-lg hover:bg-white/10 transition"
                            title={isMuted ? "إلغاء كتم الصوت" : "كتم الصوت"}
                          >
                            {isMuted || volume === 0 ? (
                              <VolumeX className="w-4 h-4 text-rose-400" />
                            ) : (
                              <Volume2 className="w-4 h-4" />
                            )}
                          </button>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={isMuted ? 0 : volume}
                            onChange={handleVolumeChange}
                            className="hidden sm:block w-16 h-1 rounded-lg appearance-none bg-slate-700 accent-indigo-500 cursor-pointer"
                          />
                        </div>

                        <span className="text-[11px] font-mono font-bold text-slate-300">
                          {formatSeconds(currentTime)} / {formatSeconds(duration)}
                        </span>
                      </div>

                      {/* Right Controls (Speed + PiP + Quality Selector + Fullscreen) */}
                      <div className="flex items-center gap-1.5 relative">
                        {/* Playback Speed Selector (1x) */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setShowSpeedMenu((prev) => !prev);
                              setShowQualityMenu(false);
                            }}
                            className="px-2 py-1 rounded-lg text-[11px] font-mono font-black hover:bg-white/10 transition"
                            title="سرعة التشغيل"
                          >
                            {playbackRate}x
                          </button>

                          {showSpeedMenu && (
                            <div
                              dir="rtl"
                              className="absolute bottom-9 right-0 w-36 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-slate-700 shadow-2xl py-1.5 z-30"
                            >
                              <div className="px-3 py-1 text-[10px] font-black text-slate-400 border-b border-slate-800">
                                سرعة التشغيل
                              </div>
                              {SPEED_OPTIONS.map((spd) => (
                                <button
                                  key={spd}
                                  type="button"
                                  onClick={() => handleSelectSpeed(spd)}
                                  className={`w-full px-3 py-1.5 text-xs font-bold flex items-center justify-between hover:bg-white/10 transition ${
                                    playbackRate === spd
                                      ? "text-indigo-400 font-black"
                                      : "text-slate-200"
                                  }`}
                                >
                                  <span dir="ltr" className="font-mono">
                                    {spd === 1 ? "1x (عادي)" : `${spd}x`}
                                  </span>
                                  {playbackRate === spd && (
                                    <Check className="w-3.5 h-3.5 text-indigo-400" />
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Picture-in-Picture Button */}
                        <button
                          type="button"
                          onClick={togglePictureInPicture}
                          className="p-1.5 rounded-lg hover:bg-white/10 transition"
                          title="نافذة عائمة (Picture-in-Picture)"
                        >
                          <PictureInPicture2 className="w-4 h-4" />
                        </button>

                        {/* Video Quality Selector (Settings Gear + Quality Badge) */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setShowQualityMenu((prev) => !prev);
                              setShowSpeedMenu(false);
                            }}
                            className="px-2 py-1 rounded-lg hover:bg-white/10 transition inline-flex items-center gap-1"
                            title="جودة الفيديو"
                          >
                            <Settings className="w-4 h-4" />
                            <span className="text-[10px] font-mono font-black text-indigo-400">
                              {selectedQuality === "auto" ? "Auto" : selectedQuality}
                            </span>
                          </button>

                          {showQualityMenu && (
                            <div
                              dir="rtl"
                              className="absolute bottom-9 right-0 w-44 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-slate-700 shadow-2xl py-1.5 z-30"
                            >
                              <div className="px-3 py-1.5 text-[11px] font-black text-slate-400 border-b border-slate-800 flex items-center justify-between">
                                <span>جودة الفيديو</span>
                                <span className="text-[10px] font-mono text-indigo-400">
                                  {selectedQuality}
                                </span>
                              </div>
                              {QUALITY_OPTIONS.map((q) => {
                                const isSelected = selectedQuality === q.value;
                                return (
                                  <button
                                    key={q.value}
                                    type="button"
                                    onClick={() => handleSelectQuality(q.value)}
                                    className={`w-full px-3 py-2 text-xs font-bold flex items-center justify-between hover:bg-white/10 transition ${
                                      isSelected
                                        ? "bg-indigo-600/20 text-indigo-400 font-black"
                                        : "text-slate-200"
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <span dir="ltr" className="font-mono">
                                        {q.label}
                                      </span>
                                      {q.badge && (
                                        <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-[9px] font-mono font-black text-white leading-none">
                                          {q.badge}
                                        </span>
                                      )}
                                    </div>
                                    {isSelected && (
                                      <Check className="w-3.5 h-3.5 text-indigo-400" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Fullscreen Button */}
                        <button
                          type="button"
                          onClick={toggleFullscreen}
                          className="p-1.5 rounded-lg hover:bg-white/10 transition"
                          title={isFullscreen ? "تصغير الشاشة" : "ملء الشاشة"}
                        >
                          {isFullscreen ? (
                            <Minimize className="w-4 h-4" />
                          ) : (
                            <Maximize className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Course Progress Bar & Watched Counter (Matches Screenshot) */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-2.5">
              <div className="w-full h-5 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden relative flex items-center">
                <div
                  style={{ width: `${Math.max(progressPercent, totalLessons > 0 ? 6 : 0)}%` }}
                  className="h-full bg-indigo-600 transition-all duration-500 flex items-center justify-center text-[10px] font-mono font-black text-white"
                >
                  {progressPercent}%
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                <span>
                  تم مشاهدة {watchedCount} فيديو من أصل {totalLessons} فيديو في هذا الكورس
                </span>
                {activeLesson && (
                  <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{activeLesson.duration}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

