import { describe, expect, it } from 'vitest';
import { indexReviewFlags } from './review';

describe('indexReviewFlags', () => {
  it('does not treat an automated crop as an edit', () => {
    expect(indexReviewFlags({ reviewed: false, edited: false, cropped: true })).toEqual({
      reviewed: false,
      edited: false,
    });
  });

  it('edited implies reviewed', () => {
    expect(indexReviewFlags({ reviewed: false, edited: true, cropped: true })).toEqual({
      reviewed: true,
      edited: true,
    });
  });

  it('keeps reviewed-only folders unedited', () => {
    expect(indexReviewFlags({ reviewed: true, edited: false, cropped: false })).toEqual({
      reviewed: true,
      edited: false,
    });
  });

  it('treats missing metadata as neither', () => {
    expect(indexReviewFlags(null)).toEqual({ reviewed: false, edited: false });
    expect(indexReviewFlags(undefined)).toEqual({ reviewed: false, edited: false });
  });
});
