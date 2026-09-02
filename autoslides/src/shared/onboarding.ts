/**
 * Versioned onboarding catalog + resolver.
 *
 * `onboardingCompleted` still distinguishes first-run from returning users.
 * `lastOnboardingVersion` is the app version stamped when the user finishes or
 * skips the wizard. Missing version + completed is a pre-5.0.0 (v4) upgrade.
 *
 * Add new What's New rows with `since` set to the release that introduces them.
 * Do not bump `since` on existing rows — that would re-show them to everyone.
 */
import { compareSemver } from './semver';

export const ONBOARDING_STEP_IDS = [
  'welcome',
  'output',
  'connection',
  'audio',
  'ai',
  'signIn',
  'cloud',
  'done',
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

export interface OnboardingStep {
  /** Catalog id; production rows use OnboardingStepId. Tests may pass extras. */
  id: string;
  /** First app version that includes this step. */
  since: string;
}

export const ONBOARDING_CATALOG: readonly OnboardingStep[] = [
  { id: 'welcome', since: '5.0.0' },
  { id: 'output', since: '5.0.0' },
  { id: 'connection', since: '5.0.0' },
  { id: 'audio', since: '5.0.0' },
  { id: 'ai', since: '5.0.0' },
  { id: 'signIn', since: '5.0.0' },
  { id: 'cloud', since: '5.0.0' },
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

/** Config-style steps (progress dots). Welcome and the all-set page are standalone. */
export function isConfigOnboardingStep(id: string): boolean {
  return id !== 'welcome' && id !== 'done';
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

  const news = available.filter(step => compareSemver(last, step.since) < 0);
  if (news.length === 0) {
    return { kind: 'none', steps: [] };
  }
  return { kind: 'whats-new', steps: news };
}
