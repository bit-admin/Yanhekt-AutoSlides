import { describe, it, expect } from 'vitest';
import {
  ONBOARDING_CATALOG,
  resolveOnboarding,
  type OnboardingStep,
} from './onboarding';

const BASELINE_IDS = ONBOARDING_CATALOG.map(s => s.id);

const WITH_501: readonly OnboardingStep[] = [
  ...ONBOARDING_CATALOG,
  { id: 'newIn501', since: '5.0.1' },
];

describe('resolveOnboarding', () => {
  it('fresh 5.0.0 → first-run with all baseline steps', () => {
    const d = resolveOnboarding({
      onboardingCompleted: false,
      lastOnboardingVersion: null,
      appVersion: '5.0.0',
    });
    expect(d.kind).toBe('first-run');
    expect(d.steps.map(s => s.id)).toEqual(BASELINE_IDS);
    expect(BASELINE_IDS.slice(-3)).toEqual(['signIn', 'cloud', 'done']);
  });

  it('fresh 5.0.0 ignores future catalog rows', () => {
    const d = resolveOnboarding(
      {
        onboardingCompleted: false,
        lastOnboardingVersion: null,
        appVersion: '5.0.0',
      },
      WITH_501
    );
    expect(d.steps.map(s => s.id)).toEqual(BASELINE_IDS);
  });

  it('v4 upgrade (completed, no version) on 5.0.0 → whats-new with all baseline steps', () => {
    const d = resolveOnboarding({
      onboardingCompleted: true,
      lastOnboardingVersion: null,
      appVersion: '5.0.0',
    });
    expect(d.kind).toBe('whats-new');
    expect(d.steps.map(s => s.id)).toEqual(BASELINE_IDS);
  });

  it('already seen 5.0.0 on 5.0.0 → none', () => {
    const d = resolveOnboarding({
      onboardingCompleted: true,
      lastOnboardingVersion: '5.0.0',
      appVersion: '5.0.0',
    });
    expect(d).toEqual({ kind: 'none', steps: [] });
  });

  it('5.0.0 → 5.0.1 with a new catalog step → whats-new with only that step', () => {
    const d = resolveOnboarding(
      {
        onboardingCompleted: true,
        lastOnboardingVersion: '5.0.0',
        appVersion: '5.0.1',
      },
      WITH_501
    );
    expect(d.kind).toBe('whats-new');
    expect(d.steps.map(s => s.id)).toEqual(['newIn501']);
  });

  it('5.0.0 → 5.0.1 with no new steps → none', () => {
    const d = resolveOnboarding({
      onboardingCompleted: true,
      lastOnboardingVersion: '5.0.0',
      appVersion: '5.0.1',
    });
    expect(d).toEqual({ kind: 'none', steps: [] });
  });

  it('fresh 5.0.1 → first-run with baseline + 5.0.1 steps', () => {
    const d = resolveOnboarding(
      {
        onboardingCompleted: false,
        lastOnboardingVersion: null,
        appVersion: '5.0.1',
      },
      WITH_501
    );
    expect(d.kind).toBe('first-run');
    expect(d.steps.map(s => s.id)).toEqual([...BASELINE_IDS, 'newIn501']);
  });

  it('v4 jumping to 5.0.1 → whats-new with all steps since <= 5.0.1', () => {
    const d = resolveOnboarding(
      {
        onboardingCompleted: true,
        lastOnboardingVersion: null,
        appVersion: '5.0.1',
      },
      WITH_501
    );
    expect(d.kind).toBe('whats-new');
    expect(d.steps.map(s => s.id)).toEqual([...BASELINE_IDS, 'newIn501']);
  });

  it('downgrade (last > app) → none', () => {
    const d = resolveOnboarding({
      onboardingCompleted: true,
      lastOnboardingVersion: '5.0.1',
      appVersion: '5.0.0',
    });
    expect(d).toEqual({ kind: 'none', steps: [] });
  });

  it('treats empty / whitespace last version like missing (v4)', () => {
    for (const last of [undefined, null, '', '   ']) {
      const d = resolveOnboarding({
        onboardingCompleted: true,
        lastOnboardingVersion: last,
        appVersion: '5.0.0',
      });
      expect(d.kind).toBe('whats-new');
      expect(d.steps.map(s => s.id)).toEqual(BASELINE_IDS);
    }
  });

  it('junk last version does not throw and is treated as 0.0.0', () => {
    const d = resolveOnboarding({
      onboardingCompleted: true,
      lastOnboardingVersion: 'nope',
      appVersion: '5.0.0',
    });
    expect(d.kind).toBe('whats-new');
    expect(d.steps.map(s => s.id)).toEqual(BASELINE_IDS);
  });

  it('leading v on versions still compares', () => {
    const d = resolveOnboarding({
      onboardingCompleted: true,
      lastOnboardingVersion: 'v5.0.0',
      appVersion: 'v5.0.0',
    });
    expect(d.kind).toBe('none');
  });

  it('empty appVersion does not throw and still yields first-run catalog', () => {
    const d = resolveOnboarding({
      onboardingCompleted: false,
      lastOnboardingVersion: null,
      appVersion: '',
    });
    expect(d.kind).toBe('first-run');
    expect(d.steps.map(s => s.id)).toEqual(BASELINE_IDS);
  });
});
