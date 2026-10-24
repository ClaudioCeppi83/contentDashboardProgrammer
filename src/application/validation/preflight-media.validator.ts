/**
 * @file preflight-media.validator.ts
 * @description Validaciones técnicas de assets multimedia según especificaciones de Instagram.
 */

import type {
  InstagramFormat,
  InstagramMediaAsset,
  PreflightValidationResult,
} from '@/domain/models/post.types';

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
const VALID_CAROUSEL_RATIOS = ['1:1', '4:5'] as const;

export function validateReelMedia(media: InstagramMediaAsset[]): string[] {
  const errors: string[] = [];
  if (media.length !== 1) {
    errors.push(`Reel debe contener exactamente 1 asset multimedia (recibidos: ${media.length}).`);
    return errors;
  }

  const asset = media[0];
  if (asset.mimeType !== 'video/mp4') {
    errors.push(`Reel debe ser formato video/mp4 (recibido: ${asset.mimeType}).`);
  }
  if (asset.aspectRatio !== '9:16') {
    errors.push(`Reel debe tener relación de aspecto 9:16 (recibido: ${asset.aspectRatio}).`);
  }
  if (
    asset.durationSeconds === undefined ||
    asset.durationSeconds < 3 ||
    asset.durationSeconds > 90
  ) {
    errors.push(
      `Reel debe tener una duración de entre 3 y 90 segundos (recibido: ${asset.durationSeconds ?? 'indefinido'}).`
    );
  }
  if (asset.sizeBytes > MAX_VIDEO_SIZE_BYTES) {
    errors.push(
      `El video del Reel no debe superar 100 MB (tamaño actual: ${(asset.sizeBytes / (1024 * 1024)).toFixed(2)} MB).`
    );
  }
  return errors;
}

export function validateFeedPostMedia(media: InstagramMediaAsset[]): string[] {
  const errors: string[] = [];
  if (media.length !== 1) {
    errors.push(`Feed post debe contener exactamente 1 asset multimedia (recibidos: ${media.length}).`);
    return errors;
  }

  const asset = media[0];
  if (asset.mimeType !== 'image/jpeg' && asset.mimeType !== 'image/png') {
    errors.push(`Feed post debe ser imagen JPEG o PNG (recibido: ${asset.mimeType}).`);
  }
  if (asset.aspectRatio !== '1:1' && asset.aspectRatio !== '4:5') {
    errors.push(`Feed post debe tener relación de aspecto 1:1 o 4:5 (recibido: ${asset.aspectRatio}).`);
  }
  if (asset.sizeBytes > MAX_IMAGE_SIZE_BYTES) {
    errors.push(
      `La imagen del Feed post no debe superar 8 MB (tamaño actual: ${(asset.sizeBytes / (1024 * 1024)).toFixed(2)} MB).`
    );
  }
  return errors;
}

export function validateCarouselMedia(media: InstagramMediaAsset[]): string[] {
  const errors: string[] = [];
  if (media.length < 2 || media.length > 10) {
    errors.push(`Carousel debe contener entre 2 y 10 assets multimedia (recibidos: ${media.length}).`);
    return errors;
  }

  const primaryRatio = media[0].aspectRatio;
  if (!VALID_CAROUSEL_RATIOS.includes(primaryRatio as (typeof VALID_CAROUSEL_RATIOS)[number])) {
    errors.push(`Carousel debe utilizar una relación de aspecto 1:1 o 4:5 (recibido: ${primaryRatio}).`);
  }

  for (let i = 0; i < media.length; i++) {
    const asset = media[i];
    if (asset.aspectRatio !== primaryRatio) {
      errors.push(
        `Todos los assets del carrusel deben compartir el mismo ratio ('${primaryRatio}'). Asset #${i + 1} tiene '${asset.aspectRatio}'.`
      );
    }
    if ((asset.mimeType === 'image/jpeg' || asset.mimeType === 'image/png') && asset.sizeBytes > MAX_IMAGE_SIZE_BYTES) {
      errors.push(
        `Asset #${i + 1} de carrusel supera el límite de 8 MB para imágenes (${(asset.sizeBytes / (1024 * 1024)).toFixed(2)} MB).`
      );
    }
  }
  return errors;
}

export function validateInstagramMedia(
  format: InstagramFormat,
  media: InstagramMediaAsset[]
): PreflightValidationResult {
  const errors: string[] = [];

  for (let i = 0; i < media.length; i++) {
    const asset = media[i];
    if (!asset.validationPassed) {
      errors.push(
        `Asset #${i + 1} ('${asset.id}') no ha pasado la validación técnica previa: ${asset.validationError || 'validationPassed es false'}.`
      );
    }
  }

  if (format === 'reel') {
    errors.push(...validateReelMedia(media));
  } else if (format === 'feed_post') {
    errors.push(...validateFeedPostMedia(media));
  } else if (format === 'carousel') {
    errors.push(...validateCarouselMedia(media));
  } else {
    errors.push(`Formato no soportado para Instagram: ${format as string}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
