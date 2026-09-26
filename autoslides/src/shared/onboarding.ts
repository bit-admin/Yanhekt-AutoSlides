/**
 * Versioned onboarding catalog + resolver.
 *
 * `onboardingCompleted` still distinguishes first-run from returning users.
 * `lastOnboardingVersion` is the app version stamped when the user finishes or
 * skips the wizard. Missing version + completed is a pre-5.0.0 (v4) upgrade.
 *
 * Add new What's New rows with `since` set to the release that introduces them.
 * Do not bump `since` on existing rows — that would re-show them to everyone.
 *
 * `always` rows (the legal notice) lead every first-run and What's New run, but
 * only trigger one on their own when their `since` is new to the user.
 */
import { compareSemver } from './semver';

export const ONBOARDING_STEP_IDS = [
  'legal',
  'output',
  'connection',
  'audio',
  'ai',
  'signIn',
  'notesProvider',
  'notes',
  'done',
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

export interface OnboardingStep {
  /** Catalog id; production rows use OnboardingStepId. Tests may pass extras. */
  id: string;
  /** First app version that includes this step. */
  since: string;
  /** Shown whenever onboarding shows at all, not only when new. */
  always?: boolean;
}

export const ONBOARDING_CATALOG: readonly OnboardingStep[] = [
  { id: 'legal', since: '5.1.0', always: true },
  { id: 'output', since: '5.0.0' },
  { id: 'connection', since: '5.0.0' },
  { id: 'audio', since: '5.0.0' },
  { id: 'ai', since: '5.0.0' },
  { id: 'signIn', since: '5.0.0' },
  // Notes add-ons: pick Yanhekt / Obsidian / Notion, then that provider's page
  // (Yanhekt's is the old 5.0.0 `cloud` step).
  { id: 'notesProvider', since: '5.1.0' },
  { id: 'notes', since: '5.1.0' },
  { id: 'done', since: '5.0.0' },
];

export type OnboardingKind = 'first-run' | 'whats-new' | 'none';

export interface OnboardingDecision {
  kind: OnboardingKind;
  steps: OnboardingStep[];
}

export interface ResolveOnboardingInput {
  onboardingCompleted: boolean;
  lastOnboardingVersion?: string | null;
  appVersion: string;
}

/** Config-style steps (progress dots). The legal notice and the all-set page are standalone. */
export function isConfigOnboardingStep(id: string): boolean {
  return id !== 'legal' && id !== 'done';
}

/**
 * Catalog rows that are a later page of an earlier step rather than a step of
 * their own: they share that step's number and progress dot.
 */
const STEP_PAGE_OF: Readonly<Record<string, string>> = {
  notes: 'notesProvider',
};

/** The step a page belongs to (itself unless it is a later page). */
export function onboardingStepOf(id: string): string {
  return STEP_PAGE_OF[id] ?? id;
}

function availableSteps(
  catalog: readonly OnboardingStep[],
  appVersion: string
): OnboardingStep[] {
  const ver = appVersion.trim();
  if (!ver) return [...catalog];
  return catalog.filter(step => compareSemver(step.since, ver) <= 0);
}

function normalizedLastVersion(
  lastOnboardingVersion: string | null | undefined
): string {
  const trimmed = lastOnboardingVersion?.trim();
  return trimmed ? trimmed : '0.0.0';
}

/**
 * Decide whether to show first-run, What's New, or nothing.
 * Optional `catalog` is for tests; production uses ONBOARDING_CATALOG.
 */
export function resolveOnboarding(
  input: ResolveOnboardingInput,
  catalog: readonly OnboardingStep[] = ONBOARDING_CATALOG
): OnboardingDecision {
  const available = availableSteps(catalog, input.appVersion);

  if (!input.onboardingCompleted) {
    return { kind: 'first-run', steps: available };
  }

  const last = normalizedLastVersion(input.lastOnboardingVersion);
  if (input.appVersion.trim() && compareSemver(last, input.appVersion) >= 0) {
    return { kind: 'none', steps: [] };
  }

  const isNew = (step: OnboardingStep) => compareSemver(last, step.since) < 0;
  if (!available.some(isNew)) {
    return { kind: 'none', steps: [] };
  }
  return { kind: 'whats-new', steps: available.filter(step => step.always || isNew(step)) };
}
