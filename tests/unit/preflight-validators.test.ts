import { describe, it, expect } from 'vitest';
import type { InstagramMediaAsset, InstagramCopyData } from '@/domain/models/post.types';
import { validateInstagramMedia } from '@/application/validation/preflight-media.validator';
import { validateInstagramCopy } from '@/application/validation/preflight-copy.validator';

describe('Preflight Media Validator', () => {
  const validReelAsset: InstagramMediaAsset = {
    id: 'asset-1',
    storagePath: 'clients/client-1/reel.mp4',
    downloadUrl: 'https://storage.googleapis.com/test/reel.mp4',
    mimeType: 'video/mp4',
    sizeBytes: 45 * 1024 * 1024, // 45 MB
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    durationSeconds: 30,
    validationPassed: true,
  };

  const validFeedPostAsset: InstagramMediaAsset = {
    id: 'asset-2',
    storagePath: 'clients/client-1/feed.jpg',
    downloadUrl: 'https://storage.googleapis.com/test/feed.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 4 * 1024 * 1024, // 4 MB
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    validationPassed: true,
  };

  it('validates a valid reel', () => {
    const result = validateInstagramMedia('reel', [validReelAsset]);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects reel with duration under 3 seconds or over 90 seconds', () => {
    const tooShort = { ...validReelAsset, durationSeconds: 2 };
    const tooLong = { ...validReelAsset, durationSeconds: 95 };

    expect(validateInstagramMedia('reel', [tooShort]).isValid).toBe(false);
    expect(validateInstagramMedia('reel', [tooLong]).isValid).toBe(false);
  });

  it('rejects reel exceeding 100 MB', () => {
    const tooLarge = { ...validReelAsset, sizeBytes: 105 * 1024 * 1024 };
    const result = validateInstagramMedia('reel', [tooLarge]);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('100 MB');
  });

  it('rejects reel with aspect ratio other than 9:16', () => {
    const wrongRatio = { ...validReelAsset, aspectRatio: '1:1' };
    const result = validateInstagramMedia('reel', [wrongRatio]);
    expect(result.isValid).toBe(false);
  });

  it('validates a valid feed post with 1:1 or 4:5', () => {
    const square = validateInstagramMedia('feed_post', [validFeedPostAsset]);
    expect(square.isValid).toBe(true);

    const portrait = validateInstagramMedia('feed_post', [{ ...validFeedPostAsset, aspectRatio: '4:5' }]);
    expect(portrait.isValid).toBe(true);
  });

  it('rejects feed post exceeding 8 MB or invalid mimeType', () => {
    const tooLarge = { ...validFeedPostAsset, sizeBytes: 9 * 1024 * 1024 };
    expect(validateInstagramMedia('feed_post', [tooLarge]).isValid).toBe(false);

    const wrongMime = { ...validFeedPostAsset, mimeType: 'video/mp4' as const };
    expect(validateInstagramMedia('feed_post', [wrongMime]).isValid).toBe(false);
  });

  it('validates a valid carousel between 2 and 10 assets sharing ratio', () => {
    const assets = [
      validFeedPostAsset,
      { ...validFeedPostAsset, id: 'asset-3' },
      { ...validFeedPostAsset, id: 'asset-4' },
    ];
    const result = validateInstagramMedia('carousel', assets);
    expect(result.isValid).toBe(true);
  });

  it('rejects carousel with mismatched ratios', () => {
    const assets = [
      validFeedPostAsset, // 1:1
      { ...validFeedPostAsset, id: 'asset-3', aspectRatio: '4:5' },
    ];
    const result = validateInstagramMedia('carousel', assets);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('compartir el mismo ratio'))).toBe(true);
  });

  it('rejects carousel with fewer than 2 or more than 10 items', () => {
    expect(validateInstagramMedia('carousel', [validFeedPostAsset]).isValid).toBe(false);

    const elevenAssets = Array.from({ length: 11 }, (_, i) => ({
      ...validFeedPostAsset,
      id: `asset-${i}`,
    }));
    expect(validateInstagramMedia('carousel', elevenAssets).isValid).toBe(false);
  });

  it('rejects any media when validationPassed is false', () => {
    const unvalidated = { ...validFeedPostAsset, validationPassed: false };
    const result = validateInstagramMedia('feed_post', [unvalidated]);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('no ha pasado la validación técnica previa'))).toBe(true);
  });
});

describe('Preflight Copy Validator', () => {
  it('validates copy under 2200 characters and isValid true', () => {
    const copy: InstagramCopyData = {
      caption: 'Test caption with #hashtags',
      characterCount: 27,
      characterLimit: 2200,
      hashtags: ['#hashtags'],
      isValid: true,
    };
    const result = validateInstagramCopy(copy);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects copy with characterCount > 2200', () => {
    const copy: InstagramCopyData = {
      caption: 'a'.repeat(2201),
      characterCount: 2201,
      characterLimit: 2200,
      hashtags: [],
      isValid: true,
    };
    const result = validateInstagramCopy(copy);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('2,200 caracteres');
  });

  it('rejects copy with isValid = false', () => {
    const copy: InstagramCopyData = {
      caption: 'Valid text length',
      characterCount: 17,
      characterLimit: 2200,
      hashtags: [],
      isValid: false,
    };
    const result = validateInstagramCopy(copy);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('isValid: false');
  });

  it('rejects null or undefined copy', () => {
    expect(validateInstagramCopy(undefined).isValid).toBe(false);
    expect(validateInstagramCopy(null).isValid).toBe(false);
  });
});
