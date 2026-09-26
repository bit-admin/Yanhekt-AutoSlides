import { describe, it, expect } from 'vitest';
import {
  ONBOARDING_CATALOG,
  isConfigOnboardingStep,
  onboardingStepOf,
  resolveOnboarding,
  type OnboardingStep,
} from './onboarding';

const BASELINE_IDS = ONBOARDING_CATALOG.map(s => s.id);
const SETUP_IDS = BASELINE_IDS.filter(id => id !== 'legal');

const WITH_511: readonly OnboardingStep[] = [
  ...ONBOARDING_CATALOG,
  { id: 'newIn511', since: '5.1.1' },
];

describe('resolveOnboarding', () => {
  it('fresh 5.1.0 → first-run: legal notice, then every setup step', () => {
    const d = resolveOnboarding({
      onboardingCompleted: false,
      lastOnboardingVersion: null,
      appVersion: '5.1.0',
    });
    expect(d.kind).toBe('first-run');
    expect(d.steps.map(s => s.id)).toEqual(BASELINE_IDS);
    expect(BASELINE_IDS[0]).toBe('legal');
    expect(BASELINE_IDS.slice(-4)).toEqual(['signIn', 'notesProvider', 'notes', 'done']);
  });

  it('fresh 5.1.0 ignores future catalog rows', () => {
    const d = resolveOnboarding(
      {
        onboardingCompleted: false,
        lastOnboardingVersion: null,
        appVersion: '5.1.0',
      },
      WITH_511
    );
    expect(d.steps.map(s => s.id)).toEqual(BASELINE_IDS);
  });

  it('v4 upgrade (completed, no version) on 5.1.0 → whats-new with everything', () => {
    const d = resolveOnboarding({
      onboardingCompleted: true,
      lastOnboardingVersion: null,
      appVersion: '5.1.0',
    });
    expect(d.kind).toBe('whats-new');
    expect(d.steps.map(s => s.id)).toEqual(BASELINE_IDS);
  });

  it('5.0.0 → 5.1.0 → whats-new: legal notice, then the two notes add-ons pages', () => {
    const d = resolveOnboarding({
      onboardingCompleted: true,
      lastOnboardingVersion: '5.0.0',
      appVersion: '5.1.0',
    });
    expect(d.kind).toBe('whats-new');
    expect(d.steps.map(s => s.id)).toEqual(['legal', 'notesProvider', 'notes']);
  });

  it('already seen 5.1.0 on 5.1.0 → none', () => {
    const d = resolveOnboarding({
      onboardingCompleted: true,
      lastOnboardingVersion: '5.1.0',
      appVersion: '5.1.0',
    });
    expect(d).toEqual({ kind: 'none', steps: [] });
  });

  it('5.1.0 → 5.1.1 with a new catalog step → legal notice leads the new step', () => {
    const d = resolveOnboarding(
      {
        onboardingCompleted: true,
        lastOnboardingVersion: '5.1.0',
        appVersion: '5.1.1',
      },
      WITH_511
    );
    expect(d.kind).toBe('whats-new');
    expect(d.steps.map(s => s.id)).toEqual(['legal', 'newIn511']);
  });

  it('5.1.0 → 5.1.1 with no new steps → none (legal alone never triggers)', () => {
    const d = resolveOnboarding({
      onboardingCompleted: true,
      lastOnboardingVersion: '5.1.0',
      appVersion: '5.1.1',
    });
    expect(d).toEqual({ kind: 'none', steps: [] });
  });

  it('fresh 5.1.1 → first-run with baseline + 5.1.1 steps', () => {
    const d = resolveOnboarding(
      {
        onboardingCompleted: false,
        lastOnboardingVersion: null,
        appVersion: '5.1.1',
      },
      WITH_511
    );
    expect(d.kind).toBe('first-run');
    expect(d.steps.map(s => s.id)).toEqual([...BASELINE_IDS, 'newIn511']);
  });

  it('v4 jumping to 5.1.1 → whats-new with all steps since <= 5.1.1', () => {
    const d = resolveOnboarding(
      {
        onboardingCompleted: true,
        lastOnboardingVersion: null,
        appVersion: '5.1.1',
      },
      WITH_511
    );
    expect(d.kind).toBe('whats-new');
    expect(d.steps.map(s => s.id)).toEqual([...BASELINE_IDS, 'newIn511']);
  });

  it('downgrade (last > app) → none', () => {
    const d = resolveOnboarding({
      onboardingCompleted: true,
      lastOnboardingVersion: '5.1.1',
      appVersion: '5.1.0',
    });
    expect(d).toEqual({ kind: 'none', steps: [] });
  });

  it('treats empty / whitespace last version like missing (v4)', () => {
    for (const last of [undefined, null, '', '   ']) {
      const d = resolveOnboarding({
        onboardingCompleted: true,
        lastOnboardingVersion: last,
        appVersion: '5.1.0',
      });
      expect(d.kind).toBe('whats-new');
      expect(d.steps.map(s => s.id)).toEqual(BASELINE_IDS);
    }
  });

  it('junk last version does not throw and is treated as 0.0.0', () => {
    const d = resolveOnboarding({
      onboardingCompleted: true,
      lastOnboardingVersion: 'nope',
      appVersion: '5.1.0',
    });
    expect(d.kind).toBe('whats-new');
    expect(d.steps.map(s => s.id)).toEqual(BASELINE_IDS);
  });

  it('leading v on versions still compares', () => {
    const d = resolveOnboarding({
      onboardingCompleted: true,
      lastOnboardingVersion: 'v5.1.0',
      appVersion: 'v5.1.0',
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

describe('isConfigOnboardingStep', () => {
  it('only the legal notice and the all-set page are standalone', () => {
    expect(BASELINE_IDS.filter(id => !isConfigOnboardingStep(id))).toEqual(['legal', 'done']);
    expect(SETUP_IDS.slice(0, -1).every(isConfigOnboardingStep)).toBe(true);
  });
});

describe('onboardingStepOf', () => {
  it('the notes page is page 2 of the notes-provider step', () => {
    expect(onboardingStepOf('notes')).toBe('notesProvider');
    expect(onboardingStepOf('notesProvider')).toBe('notesProvider');
    expect(onboardingStepOf('signIn')).toBe('signIn');
  });

  it('first run counts six numbered setup steps', () => {
    const numbered = new Set(
      BASELINE_IDS.filter(isConfigOnboardingStep).map(onboardingStepOf)
    );
    expect(numbered.size).toBe(6);
  });
});
