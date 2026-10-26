/**
 * Pinned courses, kept in step with both sites: Yanhekt's course
 * subscriptions and Yanhe 2.0's bookmarks (「我的收藏」).
 *
 * Main is the only writer of the stored pin list. The renderer asks it to pin,
 * unpin or sync; every change is written here at once (so the sidebar updates)
 * and then sent to the sites by a sync. A send that fails is not rolled back:
 * the next sync sees the difference and sends it again (`pinSyncPlan.ts`).
 *
 * All saved accounts share the one stored list; each pin carries its
 * account's badge (`owner`). A pin without one predates that and goes to the
 * next account that syncs.
 */
import { belongsTo, yanhe2PinKey, yanhektIdOf, type PinRequest } from '@common/pins';
import { termKeyOf } from '@common/searchSources';
import type { PinnedCourse } from '@common/types';
import type { CourseData, SubscriptionCourseRow } from '@common/apiTypes';
import type { Yanhe2Course } from '@common/yanhe2Curriculum';
import type { ApiClient } from '../apiClient';
import type { ConfigService } from '../configService';
import type { CourseLookup } from '../courseIndex/courseLookup';
import type { Yanhe2Service } from '../yanhe2/yanhe2Service';
import type { Yanhe2TwinResolver } from '../yanhe2/yanhe2TwinResolver';
import { createLogger } from '@main/infra/logger';
import { planPinSync, type PinEntry, type PinSite, type PinSiteState } from './pinSyncPlan';
import { mergePin, pinFromCourseData, pinFromSubscriptionRow, pinFromYanhe2Course, plainPin } from './pinSnapshots';

const log = createLogger('PinSync');

const SUBSCRIPTION_PAGE_SIZE = 100;
const MAX_SUBSCRIPTION_PAGES = 50;
/** Twin lookups one sync makes at most; the rest wait for the next sync. */
const MAX_TWIN_LOOKUPS = 12;
/** A course the other site did not have is looked for again after this long. */
const MISSING_RECHECK_MS = 7 * 24 * 60 * 60 * 1000;

type Lookup<T> = { kind: 'found'; data: T } | { kind: 'missing' } | { kind: 'unknown' };

export class PinSyncService {
  /** The sync running per account, and whether another was asked for meanwhile. */
  private running = new Map<string, { promise: Promise<void>; again: boolean }>();

  constructor(
    private readonly configService: ConfigService,
    private readonly apiClient: ApiClient,
    private readonly yanhe2Service: Yanhe2Service,
    private readonly twinResolver: Yanhe2TwinResolver,
    private readonly courseLookup: CourseLookup,
    /** Called after the stored list changed, to broadcast config. */
    private readonly onChange: () => void,
  ) {}

  // ---------- local changes ----------

  /** Pin the course, or unpin it when the account has it pinned. */
  toggle(owner: string, request: unknown): { pinned: boolean } {
    const req = this.checkRequest(request);
    if (!req) return { pinned: false };
    const all = this.stored();
    const index = all.findIndex((p) => belongsTo(p, owner || null) && this.sameCourse(p, req));
    let pinned: boolean;
    if (index >= 0) {
      all.splice(index, 1);
      pinned = false;
    } else {
      const key = req.id || yanhe2PinKey(req.yanhe2Id ?? '');
      all.push(plainPin({ ...req, id: key, owner: owner || undefined }));
      pinned = true;
    }
    this.write(all);
    if (owner) void this.sync(owner);
    return { pinned };
  }

  /** Unpin by the pin's key (sidebar and Home). */
  remove(owner: string, key: unknown): void {
    if (typeof key !== 'string' || !key) return;
    const all = this.stored();
    const next = all.filter((p) => !(belongsTo(p, owner || null) && p.id === key));
    if (next.length === all.length) return;
    this.write(next);
    if (owner) void this.sync(owner);
  }

  /**
   * Fill a pin's snapshot with richer fields from an opened course
   * (classrooms, registrar number, term). No-op when it is not pinned or
   * nothing changed. Sends nothing.
   */
  upgrade(owner: string, request: unknown): void {
    const req = this.checkRequest(request);
    if (!req) return;
    const all = this.stored();
    const index = all.findIndex((p) => belongsTo(p, owner || null) && this.sameCourse(p, req));
    if (index < 0) return;
    const old = all[index];
    const merged = plainPin({ ...mergePin(old, { ...req, id: old.id }), id: old.id, owner: old.owner });
    if (JSON.stringify(merged) === JSON.stringify(plainPin(old))) return;
    all[index] = merged;
    this.write(all);
  }

  // ---------- sync ----------

  /**
   * Bring the account's pins and both sites into step. One at a time per
   * account; asked again while running, it runs once more afterwards.
   */
  sync(owner: string): Promise<void> {
    if (!owner) return Promise.resolve();
    const current = this.running.get(owner);
    if (current) {
      current.again = true;
      return current.promise;
    }
    const state = { promise: Promise.resolve(), again: false };
    state.promise = (async () => {
      try {
        do {
          state.again = false;
          try {
            await this.syncOnce(owner);
          } catch (error) {
            log.warn('Pin sync failed:', error instanceof Error ? error.message : error);
          }
        } while (state.again);
      } finally {
        this.running.delete(owner);
      }
    })();
    this.running.set(owner, state);
    return state.promise;
  }

  private async syncOnce(owner: string): Promise<void> {
    const token = this.configService.getAccountToken(owner);
    const yanhe2On = this.yanhe2Service.isSignedIn(owner);

    const startPins = this.stored().filter((p) => belongsTo(p, owner)).map((p) => plainPin({ ...p, owner }));
    const startKeys = new Set(startPins.map((p) => p.id));

    const [yanhektRows, bookmarks, currentTerm] = await Promise.all([
      token ? this.fetchSubscriptions(token) : Promise.resolve(null),
      yanhe2On ? this.fetchBookmarks(owner) : Promise.resolve(null),
      this.currentTerm(),
    ]);

    // Every course from here and from both lists, one entry each.
    const entries: PinEntry[] = startPins.map((pin) => ({ pin, local: true, originKeys: [pin.id] }));
    for (const row of yanhektRows ?? []) {
      const fresh = pinFromSubscriptionRow(row);
      const found = entries.find((e) => yanhektIdOf(e.pin) === fresh.id);
      if (found) found.pin = this.refresh(found.pin, fresh);
      else entries.push({ pin: plainPin({ ...fresh, owner }), local: false, originKeys: [] });
    }
    for (const bookmark of bookmarks ?? []) {
      if (entries.some((e) => e.pin.yanhe2Id === bookmark.courseId)) continue;
      entries.push({
        pin: plainPin({
          id: yanhe2PinKey(bookmark.courseId),
          yanhe2Id: bookmark.courseId,
          title: bookmark.title,
          professors: bookmark.teachers.length ? bookmark.teachers : undefined,
          instructor: bookmark.teachers.length ? bookmark.teachers.join(', ') : undefined,
          owner,
        }),
        local: false,
        originKeys: [],
      });
    }

    await this.findTwins(owner, entries, token, yanhe2On);
    const joined = this.joinTwins(entries);

    const sites: Record<PinSite, PinSiteState> = {
      yanhekt: this.siteState(yanhektRows?.map((r) => String(r.id)) ?? null, owner, 'yanhekt'),
      yanhe2: this.siteState(bookmarks?.map((b) => b.courseId) ?? null, owner, 'yanhe2'),
    };
    const plan = planPinSync(joined, sites, currentTerm);

    // Write, keeping any pin or unpin made while this sync was reading.
    const all = this.stored();
    const nowOwn = all.filter((p) => belongsTo(p, owner));
    const nowKeys = new Set(nowOwn.map((p) => p.id));
    const removedMeanwhile = new Set([...startKeys].filter((k) => !nowKeys.has(k)));
    const addedMeanwhile = nowOwn.filter((p) => !startKeys.has(p.id));
    const touched = new Set<string>([...removedMeanwhile, ...addedMeanwhile.map((p) => p.id)]);

    const result: PinnedCourse[] = [];
    for (const entry of plan.kept) {
      if (entry.originKeys.some((k) => removedMeanwhile.has(k))) {
        touched.add(entry.pin.id);
        continue;
      }
      const latest = nowOwn.find((p) => entry.originKeys.includes(p.id));
      const pin = latest ? mergePin(latest, entry.pin) : entry.pin;
      result.push(plainPin({ ...pin, id: entry.pin.id, owner }));
    }
    for (const pin of addedMeanwhile) {
      if (!result.some((p) => p.id === pin.id)) result.push(plainPin({ ...pin, owner }));
    }
    const others = all.filter((p) => !belongsTo(p, owner));
    const next = [...result, ...others];
    if (JSON.stringify(next) !== JSON.stringify(all.map(plainPin))) this.write(next);

    // Send the differences; a failure is sent again next time.
    const ok: Record<PinSite, { on: Set<string>; off: Set<string> }> = {
      yanhekt: { on: new Set(), off: new Set() },
      yanhe2: { on: new Set(), off: new Set() },
    };
    for (const push of plan.pushes) {
      if (touched.has(push.key)) continue;
      if (await this.send(owner, token, push.site, push.courseId, push.on)) {
        ok[push.site][push.on ? 'on' : 'off'].add(push.courseId);
      }
    }

    // What each site holds now becomes its base.
    const stored = this.configService.getPinSyncBase(owner) ?? { yanhekt: null, yanhe2: null };
    const baseOf = (site: PinSite): string[] | null => {
      const remote = sites[site].remote;
      if (!remote) return stored[site];
      const held = new Set(remote);
      ok[site].on.forEach((id) => held.add(id));
      ok[site].off.forEach((id) => held.delete(id));
      return [...held];
    };
    this.configService.setPinSyncBase(owner, { yanhekt: baseOf('yanhekt'), yanhe2: baseOf('yanhe2') });

    if (touched.size) void this.sync(owner);
  }

  // ---------- twins ----------

  /** Look up the other site's id for courses that lack one, within budget. */
  private async findTwins(owner: string, entries: PinEntry[], token: string | null, yanhe2On: boolean): Promise<void> {
    let budget = MAX_TWIN_LOOKUPS;
    const now = Date.now();
    const stale = (at?: number) => !at || now - at > MISSING_RECHECK_MS;

    for (const entry of entries) {
      if (budget <= 0) break;
      const pin = entry.pin;
      const yanhektId = yanhektIdOf(pin);
      if (yanhektId && !pin.yanhe2Id && yanhe2On && stale(pin.yanhe2MissingAt)) {
        budget--;
        const found = await this.findOnYanhe2(owner, pin);
        if (found.kind === 'found') entry.pin = { ...pin, yanhe2Id: found.data, yanhe2MissingAt: undefined };
        else if (found.kind === 'missing') entry.pin = { ...pin, yanhe2MissingAt: now };
      } else if (!yanhektId && pin.yanhe2Id && yanhe2On && stale(pin.yanhektMissingAt)) {
        // Also fills in the course's details, which a bookmark row lacks.
        budget--;
        const found = await this.findOnYanhekt(owner, pin.yanhe2Id, token);
        if (found.kind === 'found') {
          const { course, yanhekt } = found.data;
          const base = mergePin(pin, pinFromYanhe2Course(course, pin.professors ?? []));
          entry.pin = yanhekt
            ? { ...mergePin(base, pinFromCourseData(yanhekt)), id: String(yanhekt.id), yanhektMissingAt: undefined }
            : { ...base, id: pin.id, yanhektMissingAt: now };
        }
      }
    }
  }

  /**
   * Join entries that turned out to be one course (an aita-only pin whose
   * Yanhekt twin is pinned too, or a bookmark that is a subscribed course).
   */
  private joinTwins(entries: PinEntry[]): PinEntry[] {
    const out: PinEntry[] = [];
    for (const entry of entries) {
      const yanhektId = yanhektIdOf(entry.pin);
      const twin = out.find((e) =>
        (yanhektId && yanhektIdOf(e.pin) === yanhektId) ||
        (entry.pin.yanhe2Id && e.pin.yanhe2Id === entry.pin.yanhe2Id));
      if (!twin) {
        out.push(entry);
        continue;
      }
      const key = yanhektIdOf(twin.pin) || yanhektId || twin.pin.id;
      twin.pin = { ...mergePin(twin.pin, entry.pin), id: key };
      twin.local = twin.local || entry.local;
      twin.originKeys = [...twin.originKeys, ...entry.originKeys];
    }
    return out;
  }

  private async findOnYanhe2(owner: string, pin: PinnedCourse): Promise<Lookup<string>> {
    // With the number, name and term at hand, search Yanhe 2.0 directly;
    // otherwise let the resolver read them from Yanhekt first.
    const term = pin.school_year && pin.semester ? `${pin.school_year}-${pin.semester}` : '';
    const result = pin.number && pin.title && term
      ? await this.yanhe2Service.findCourseByCode(owner, {
        courseCode: pin.number,
        title: pin.title,
        teachers: pin.professors ?? [],
        termName: term,
      })
      : await this.twinResolver.findYanhe2Course(owner, { courseId: yanhektIdOf(pin) });
    if (result.kind === 'ok') return result.data ? { kind: 'found', data: result.data.courseId } : { kind: 'missing' };
    return result.kind === 'no_match' ? { kind: 'missing' } : { kind: 'unknown' };
  }

  private async findOnYanhekt(
    owner: string,
    yanhe2Id: string,
    token: string | null,
  ): Promise<Lookup<{ course: Yanhe2Course; yanhekt: CourseData | null }>> {
    const detail = await this.yanhe2Service.getCourseDetail(owner, { courseId: yanhe2Id });
    if (detail.kind !== 'ok') return { kind: 'unknown' };
    const course = detail.data;
    // Without a number Yanhekt cannot have it; without a sign-in we cannot tell.
    if (!course.courseCode) return { kind: 'found', data: { course, yanhekt: null } };
    if (!token) return { kind: 'unknown' };
    try {
      const yanhekt = await this.courseLookup.findCourse(
        { number: course.courseCode },
        termKeyOf(course.schoolYear, course.semester),
        token,
      );
      return { kind: 'found', data: { course, yanhekt } };
    } catch {
      return { kind: 'unknown' };
    }
  }

  // ---------- sites ----------

  private async fetchSubscriptions(token: string): Promise<SubscriptionCourseRow[] | null> {
    try {
      const rows: SubscriptionCourseRow[] = [];
      for (let page = 1; page <= MAX_SUBSCRIPTION_PAGES; page++) {
        const result = await this.apiClient.getSubscriptionList(token, { page, pageSize: SUBSCRIPTION_PAGE_SIZE });
        rows.push(...(result?.data ?? []));
        if (page >= (Number(result?.last_page) || 1)) break;
      }
      return rows;
    } catch {
      return null;
    }
  }

  private async fetchBookmarks(owner: string) {
    const result = await this.yanhe2Service.getBookmarks(owner);
    return result.kind === 'ok' ? result.data : null;
  }

  private async currentTerm(): Promise<string | null> {
    try {
      const [current] = await this.apiClient.getAvailableSemesters();
      return current ? termKeyOf(current.schoolYear, current.semester) : null;
    } catch {
      return null;
    }
  }

  private siteState(remote: string[] | null, owner: string, site: PinSite): PinSiteState {
    const base = this.configService.getPinSyncBase(owner)?.[site] ?? null;
    return { remote: remote ? new Set(remote) : null, base: base ? new Set(base) : null };
  }

  private async send(owner: string, token: string | null, site: PinSite, courseId: string, on: boolean): Promise<boolean> {
    try {
      if (site === 'yanhe2') {
        return (await this.yanhe2Service.setBookmark(owner, courseId, on)).kind === 'ok';
      }
      if (!token) return false;
      if (on) await this.apiClient.subscribeCourse(token, courseId);
      else await this.apiClient.unsubscribeCourse(token, courseId);
      return true;
    } catch {
      return false;
    }
  }

  // ---------- storage ----------

  private stored(): PinnedCourse[] {
    return this.configService.getPinnedRecordedCourses().map(plainPin);
  }

  private write(pins: PinnedCourse[]): void {
    this.configService.setPinnedRecordedCourses(pins.map(plainPin));
    this.onChange();
  }

  /** Same course: by Yanhekt id, or by Yanhe 2.0 id. */
  private sameCourse(pin: PinnedCourse, req: PinRequest): boolean {
    const yanhektId = yanhektIdOf(pin);
    if (req.id && yanhektId === req.id) return true;
    return !!req.yanhe2Id && (pin.yanhe2Id === req.yanhe2Id || pin.id === yanhe2PinKey(req.yanhe2Id));
  }

  /** A subscription row over the stored pin: list fields win, twin state stays. */
  private refresh(pin: PinnedCourse, fresh: PinnedCourse): PinnedCourse {
    return { ...mergePin(pin, fresh), id: pin.id };
  }

  /** The renderer's pin request, checked: ids are digit strings, fields are plain. */
  private checkRequest(request: unknown): PinRequest | null {
    if (!request || typeof request !== 'object') return null;
    const r = request as Record<string, unknown>;
    const id = typeof r.id === 'string' && /^\d{1,12}$/.test(r.id) ? r.id : '';
    const yanhe2Id = typeof r.yanhe2Id === 'string' && /^\d{1,12}$/.test(r.yanhe2Id) ? r.yanhe2Id : undefined;
    if (!id && !yanhe2Id) return null;
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);
    const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined);
    return {
      id,
      yanhe2Id,
      title: typeof r.title === 'string' ? r.title : '',
      titleEn: str(r.titleEn),
      number: str(r.number),
      instructor: str(r.instructor),
      time: str(r.time),
      classrooms: Array.isArray(r.classrooms)
        ? r.classrooms
          .map((c) => (c && typeof c === 'object' ? String((c as { name?: unknown }).name ?? '') : ''))
          .filter(Boolean)
          .map((name) => ({ name }))
        : undefined,
      participant_count: typeof r.participant_count === 'number' ? r.participant_count : undefined,
      college_name: str(r.college_name),
      professors: strs(r.professors),
      school_year: str(r.school_year) ?? (typeof r.school_year === 'number' ? String(r.school_year) : undefined),
      semester: str(r.semester) ?? (typeof r.semester === 'number' ? String(r.semester) : undefined),
      imageUrl: str(r.imageUrl),
    };
  }
}
