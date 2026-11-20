// What a Yanhekt lecture already has in the output folder (issue #45), as
// main reports it to the queues before they add a download or a task.

export interface LectureOutputQuery {
  /** Caller's key, echoed back. */
  key: string;
  courseId?: string;
  sessionId?: string;
  /** The finished file's name in the output folder (`<stem>.mp4` / `.aac`), when the query is about a download. */
  videoFile?: string;
}

export interface LectureSlidesState {
  /** Every `slides*` folder of this lecture (normally one). */
  folders: string[];
  /** The most complete of them. */
  folderPath: string;
  slideCount: number;
  /** A finished extraction: metadata.json records one and the folder has slides. */
  extracted: boolean;
  cropped: boolean;
  reviewed: boolean;
  edited: boolean;
  /** Slides uploaded to Drive whose record still matches the file. */
  uploaded: number;
  /** Share links recorded for the folder. */
  shares: number;
  /** A Make Video `<folder>.mp4` exists beside it. */
  slideVideo: boolean;
}

export interface LectureOutputState {
  key: string;
  videoExists: boolean;
  slides: LectureSlidesState | null;
}
