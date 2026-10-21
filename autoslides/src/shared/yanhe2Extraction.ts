/**
 * Extracting slides from a Yanhe 2.0 recording, in the player (watch mode) or
 * as a task. The video is aita's screen recording; the slides go into the
 * `slides_*` folder of the same lecture on Yanhekt, exactly where a Yanhekt
 * extraction of it (or Save Slides) would put them, and `metadata.json` holds
 * that lecture's fields plus the registrar's number (`kcwybm`). What Yanhekt
 * does not have drops out, as everywhere else (owner ruling 2026-10-21).
 */
import type { SlideMetadataSource } from './sidecars/metadata';
import type { Yanhe2SubtitleTarget } from './yanhe2Subtitles';

export interface Yanhe2ExtractionQuery {
  /** aita course id. */
  courseId: string;
  /** aita session id (`sub_id`). */
  subId: string;
}

/** The Yanhekt lecture the slides are filed under (ids '' where Yanhekt has none). */
export type Yanhe2ExtractionTarget = Yanhe2SubtitleTarget;

export type Yanhe2ExtractionRefusal = 'signed_out' | 'network' | 'failed';

export type Yanhe2ExtractionPrepared =
  | { kind: 'ok'; target: Yanhe2ExtractionTarget; /** For `metadata.json`. */ source: SlideMetadataSource }
  | { kind: Yanhe2ExtractionRefusal };
