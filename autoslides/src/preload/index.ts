import { contextBridge } from 'electron';
import { auth, config, windowNs, shell, menu, powerManagement, cache, app, dialog } from './platform';
import { video, ffmpeg, compressLecture, download } from './video';
import { slideExtraction, offline, trash, crop, slideMetadata, autoCrop, mlClassifier, qtExtractor } from './extraction';
import { ai, copilot } from './ai';
import { pdfmaker, yuketang, noteExport } from './export';
import { api } from './course';
import { update, extractorInstaller } from './update';
import { tools, webCapture } from './tools';
import { intranet } from './intranet';
import { localRelay } from './localRelay';
import { cloudNotes } from './notes';

contextBridge.exposeInMainWorld('electronAPI', {
  // Demo mode flag: set by `npm run demo` (DEMO_MODE=1). The main process
  // forwards it as an `--demo-mode` argv entry (process.env is not reliable in
  // the Vite-built preload), and we read it here synchronously before mount.
  isDemoMode: process.argv.includes('--demo-mode'),
  auth,
  config,
  api,
  intranet,
  localRelay,
  video,
  ffmpeg,
  compressLecture,
  download,
  slideExtraction,
  dialog,
  window: windowNs,
  shell,
  menu,
  powerManagement,
  cache,
  app,
  ai,
  copilot,
  trash,
  crop,
  slideMetadata,
  pdfmaker,
  noteExport,
  tools,
  webCapture,
  yuketang,
  autoCrop,
  mlClassifier,
  offline,
  qtExtractor,
  extractorInstaller,
  update,
  cloudNotes,
});
