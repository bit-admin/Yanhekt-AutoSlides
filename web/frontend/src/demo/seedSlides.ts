/**
 * Fill the demo's IndexedDB with a few lectures' worth of slides.
 *
 * This is deliberately not a stub: it writes through `slideStore`'s own
 * exported writers, so the Slides workspace, the crop editor, trash/restore,
 * PDF and ZIP export all run their real code against real rows. Only the
 * pixels are invented.
 *
 * Storage is already namespaced by `isolateStorage()` before this runs, so
 * nothing here can reach a real user's `autoslides-web` database.
 */

import {
  applyCropToSlide,
  listFolders,
  markFolderReviewed,
  moveToTrash,
  recordWatchExtraction,
  saveSlideBlob,
  setFolderPostProcessing,
  slideId,
} from "../lib/slideStore";
import { buildLectureIdSuffix } from "../lib/toolFolders";
import { DEMO_FOLDERS, demoDeck, demoSessionId, findCourse, sessionTitle } from "./demoData";

/** Rasterize an SVG data URI to PNG bytes, the way a real capture arrives. */
async function toPngBlob(dataUrl: string, width = 1280, height = 720): Promise<Blob | null> {
  const image = new Image();
  image.decoding = "sync";
  const loaded = new Promise<boolean>((resolve) => {
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
  });
  image.src = dataUrl;
  if (!(await loaded)) return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, width, height);

  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
}

/**
 * Folder name for one lecture, in the desktop demo's form:
 * `slides_<Course> - Lecture <n>__c<course>s<session>`.
 *
 * The " - Lecture n" shape is what `parseSessionInfo` recognises for an
 * English-titled course, so the Slides sidebar reads "Functional Analysis /
 * Lecture 9" rather than one long underscored string.
 */
export function demoFolderName(courseId: string, week: number): string {
  const title = findCourse(courseId)?.title ?? "Course";
  return (
    `slides_${title} - Lecture ${week}` +
    buildLectureIdSuffix({ courseId, sessionId: demoSessionId(courseId, week) })
  );
}

async function seedFolder(courseId: string, week: number, reviewed: boolean): Promise<void> {
  const course = findCourse(courseId);
  const folder = demoFolderName(courseId, week);

  await recordWatchExtraction({
    folder,
    kind: "recorded",
    ssimThreshold: 0.999,
    source: {
      courseId,
      courseTitle: course?.title,
      sessionId: demoSessionId(courseId, week),
      sessionTitle: sessionTitle(courseId, week),
      instructor: course?.professor,
      professors: course ? [course.professor] : undefined,
      semester: String(course?.semester ?? 1),
      schoolYear: "2025-2026",
      college: "School of Mathematical Sciences",
      classrooms: course ? [course.room] : undefined,
      weekNumber: week,
      day: 2,
    },
  });

  for (const slide of demoDeck(courseId)) {
    const blob = await toPngBlob(slide.dataUrl);
    if (!blob) continue;
    await saveSlideBlob(folder, slide.filename, blob);
    if (slide.trash) {
      await moveToTrash(folder, slide.filename, slide.trash.reason, slide.trash.details);
    }
  }

  await setFolderPostProcessing(folder, {
    ran: true,
    duplicateRemoval: true,
    exclusionList: false,
    aiFiltering: true,
    aiClassifierMode: "distinguish",
    completedAt: new Date().toISOString(),
  });
  if (reviewed) await markFolderReviewed(folder);
}

/**
 * Seed once. Idempotent: a page that already has the demo folders (a route
 * change, a hot reload) leaves them alone, so seeding never duplicates work.
 */
export async function seedSlides(): Promise<void> {
  const existing = new Set((await listFolders()).map((f) => f.name));
  const wanted = DEMO_FOLDERS.map((f) => demoFolderName(f.courseId, f.week));
  if (wanted.every((name) => existing.has(name))) return;

  for (const [index, folder] of DEMO_FOLDERS.entries()) {
    if (existing.has(demoFolderName(folder.courseId, folder.week))) continue;
    await seedFolder(folder.courseId, folder.week, index === 0);
  }

  // One cropped slide, so the Cropped badge and Restore Crop have something to
  // act on — the same state a user reaches through the crop editor.
  const first = DEMO_FOLDERS[0];
  await applyCropToSlide(
    slideId(demoFolderName(first.courseId, first.week), "Slide_004.png"),
    { x: 96, y: 108, width: 1088, height: 504 },
    false,
  );
}
