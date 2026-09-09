/**
 * Stand-in for `@techstark/opencv-js` in the demo build.
 *
 * OpenCV is 10.8 MB — more than the rest of the demo put together — and it
 * exists to auto-crop real extracted slides. The demo extracts nothing: its
 * slides are pre-rendered SVG data URLs seeded straight into IndexedDB by
 * `seedSlides.ts`. So the whole detector is dead weight in a build whose
 * entire point is to be a static demonstration.
 *
 * `vite.demo.config.ts` aliases the package here, which drops it from the
 * worker chunk without touching the worker itself or any production code.
 *
 * This is deliberately a function that throws. `autoCrop.worker.ts` calls the
 * module when it is callable (`ensureCvReady`'s `typeof candidate === 'function'`
 * branch), so throwing lands in that worker's own try/catch, which posts
 * `{ success: false, error }` back. Callers already read that as "no crop box
 * found" — the same answer OpenCV gives for an image it cannot fit a slide to.
 * The one visible difference is this message in the console instead of a box.
 */
export default function opencvUnavailableInDemo(): never {
  throw new Error(
    "AutoSlides demo: OpenCV is not bundled in the demo build, so auto-crop is unavailable.",
  );
}
