/**
 * Shared route table for the AutoSlides Web Worker.
 *
 * Mounts the CORS policy and every real API route. Any deployment built on
 * top of this (extra routes, different bindings) calls createApp() to get a
 * fully-wired app, mounts its own routes, then calls finalizeApp() — keeping
 * the catch-all 404 and the static-asset fallback registered last so they
 * don't shadow routes added afterwards.
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env";
import { loginRouter } from "./routes/login";
import { yanhektProxyRouter } from "./routes/yanhektProxy";

export function createApp<TEnv extends Env = Env>() {
  const app = new Hono<{ Bindings: TEnv }>();

  app.use(
    "/api/*",
    cors({ origin: "*", allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], allowHeaders: ["Content-Type", "Authorization"], maxAge: 86400 }),
  );

  app.route("/api/yanhekt", yanhektProxyRouter);
  app.route("/api", loginRouter);

  return app;
}

/**
 * Attach the trailing catch-alls: a JSON 404 for unmatched API paths, then
 * the static-asset fallback for everything else. Call this last, after any
 * extra routes have been mounted on top of createApp().
 */
export function finalizeApp<TEnv extends Env>(app: Hono<{ Bindings: TEnv }>) {
  app.all("/api/*", (c) => c.json({ success: false, error: "Not Found" }, 404));
  app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));
  return app;
}
