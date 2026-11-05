const COURSES_LIST_KEY = "alphateam-cache-courses-v1";
const COURSE_DETAIL_PREFIX = "alphateam-cache-course-detail-v1-";

let memoryCoursesList: any[] | null = null;
const memoryCourseDetails = new Map<string, { course: any; lessons: any[] }>();

export function getCachedCoursesList(): any[] | null {
  if (memoryCoursesList && memoryCoursesList.length > 0) {
    return memoryCoursesList;
  }
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COURSES_LIST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      memoryCoursesList = parsed;
      return parsed;
    }
  } catch {}
  return null;
}

export function setCachedCoursesList(courses: any[]) {
  memoryCoursesList = courses;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COURSES_LIST_KEY, JSON.stringify(courses));
  } catch {}
}

export function getCachedCourseDetail(
  courseId: string
): { course: any; lessons: any[] } | null {
  const mem = memoryCourseDetails.get(courseId);
  if (mem) return mem;
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${COURSE_DETAIL_PREFIX}${courseId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.course && Array.isArray(parsed.lessons)) {
      memoryCourseDetails.set(courseId, parsed);
      return parsed;
    }
  } catch {}
  return null;
}

export function setCachedCourseDetail(
  courseId: string,
  course: any,
  lessons: any[]
) {
  const payload = { course, lessons };
  memoryCourseDetails.set(courseId, payload);
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${COURSE_DETAIL_PREFIX}${courseId}`,
      JSON.stringify(payload)
    );
  } catch {}
}

export function clearClientCoursesCache(courseId?: number | string) {
  memoryCoursesList = null;
  if (courseId) {
    memoryCourseDetails.delete(String(courseId));
  } else {
    memoryCourseDetails.clear();
  }
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(COURSES_LIST_KEY);
    if (courseId) {
      localStorage.removeItem(`${COURSE_DETAIL_PREFIX}${courseId}`);
    }
  } catch {}
}

