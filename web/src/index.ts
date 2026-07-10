/**
 * AutoSlides Web — Cloudflare Worker entry point.
 */
import type { Env } from "./env";
import { createApp, finalizeApp } from "./app";

export default finalizeApp(createApp<Env>());
