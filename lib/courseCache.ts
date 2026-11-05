// Server-side in-memory cache for courses & lessons to avoid repeated remote MySQL round-trips

interface CachedCourseDetail {
  course: any;
  lessons: any[];
  timestamp: number;
}

const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL (also invalidated immediately on any admin change)

let allCoursesCache: { data: any[]; timestamp: number } | null = null;
const courseDetailCache = new Map<number, CachedCourseDetail>();

export function getServerCoursesCache(): any[] | null {
  if (!allCoursesCache) return null;
  if (Date.now() - allCoursesCache.timestamp > CACHE_TTL_MS) {
    allCoursesCache = null;
    return null;
  }
  return allCoursesCache.data;
}

export function setServerCoursesCache(courses: any[]) {
  allCoursesCache = {
    data: courses,
    timestamp: Date.now(),
  };
}

export function getServerCourseDetailCache(courseId: number): { course: any; lessons: any[] } | null {
  const entry = courseDetailCache.get(courseId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    courseDetailCache.delete(courseId);
    return null;
  }
  return { course: entry.course, lessons: entry.lessons };
}

export function setServerCourseDetailCache(courseId: number, course: any, lessons: any[]) {
  courseDetailCache.set(courseId, {
    course,
    lessons,
    timestamp: Date.now(),
  });
}

export function invalidateServerCoursesCache(courseId?: number) {
  allCoursesCache = null;
  if (courseId) {
    courseDetailCache.delete(Number(courseId));
  } else {
    courseDetailCache.clear();
  }
}

