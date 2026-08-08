import { describe, it, expect } from 'vitest';
import { compareSemver, semverGte, semverLt } from './semver';
import { qtSupportsWriteTimeline } from './qtExtractorFeatures';

describe('compareSemver', () => {
  it('orders major.minor.patch', () => {
    expect(compareSemver('1.0.0', '2.0.0')).toBe(-1);
    expect(compareSemver('2.0.0', '1.9.9')).toBe(1);
    expect(compareSemver('2.0.0', '2.0.0')).toBe(0);
    expect(compareSemver('2.0.1', '2.0.0')).toBe(1);
  });

  it('accepts leading v', () => {
    expect(compareSemver('v2.0.0', '2.0.0')).toBe(0);
    expect(semverGte('v2.0.0', '2.0.0')).toBe(true);
  });

  it('treats missing as zero', () => {
    expect(semverGte('', '2.0.0')).toBe(false);
    expect(semverLt(undefined, '2.0.0')).toBe(true);
  });
});

describe('qtSupportsWriteTimeline', () => {
  it('requires >= 2.0.0', () => {
    expect(qtSupportsWriteTimeline('1.9.0')).toBe(false);
    expect(qtSupportsWriteTimeline('2.0.0')).toBe(true);
    expect(qtSupportsWriteTimeline('2.1.0')).toBe(true);
    expect(qtSupportsWriteTimeline(null)).toBe(false);
  });
});
