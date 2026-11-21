import { describe, expect, it } from 'vitest';
import { coverCrop, nearestFormat } from './bannerFormat';

describe('banner format', () => {
  it('picks the nearer of 1:1 and 16:9', () => {
    expect(nearestFormat(1080, 1080)).toBe('square');
    expect(nearestFormat(1080, 1350)).toBe('square');
    expect(nearestFormat(1200, 800)).toBe('wide');
    expect(nearestFormat(1920, 1080)).toBe('wide');
    expect(nearestFormat(3000, 1000)).toBe('wide');
    expect(nearestFormat(0, 0)).toBe('square');
  });

  it('centre-crops a wide photo to a square', () => {
    expect(coverCrop(2000, 1000, 1080, 1080)).toEqual({ x: 500, y: 0, w: 1000, h: 1000 });
  });

  it('centre-crops a tall photo to 16:9', () => {
    expect(coverCrop(1080, 1350, 1920, 1080)).toEqual({ x: 0, y: 371, w: 1080, h: 608 });
  });
});
