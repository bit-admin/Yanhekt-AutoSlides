import { contextBridge } from 'electron';
import type { ElectronAPI } from './electronApi';
import { auth, config, windowNs, shell, menu, powerManagement, cache, app, dialog } from './platform';
import { video, compressLecture, download } from './video';
import { slideExtraction, trash, crop, slideMetadata, slideTimeline, autoCrop, mlClassifier, qtExtractor } from './extraction';
import { ai, copilot } from './ai';
import { pdfmaker, yuketang, noteExport } from './export';
import { api } from './course';
import { update, extractorInstaller } from './update';
import { tools, webCapture } from './tools';
import { intranet } from './intranet';
import { localRelay } from './localRelay';
import { cloudNotes } from './notes';
import { lectures } from './lectures';

const electronAPI: ElectronAPI = {
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
  slideTimeline,
  pdfmaker,
  noteExport,
  tools,
  webCapture,
  yuketang,
  autoCrop,
  mlClassifier,
  qtExtractor,
  extractorInstaller,
  update,
  cloudNotes,
  lectures,
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
