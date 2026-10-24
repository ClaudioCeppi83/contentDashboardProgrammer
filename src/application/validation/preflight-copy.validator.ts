/**
 * @file preflight-copy.validator.ts
 * @description Validaciones del texto de caption y hashtags para publicaciones de Instagram.
 */

import type {
  InstagramCopyData,
  PreflightValidationResult,
} from '@/domain/models/post.types';

const INSTAGRAM_MAX_CAPTION_LENGTH = 2200;

export function validateInstagramCopy(
  copy: InstagramCopyData | undefined | null
): PreflightValidationResult {
  const errors: string[] = [];

  if (!copy) {
    errors.push('El objeto de copy no está definido.');
    return { isValid: false, errors };
  }

  if (copy.characterCount > INSTAGRAM_MAX_CAPTION_LENGTH) {
    errors.push(
      `El texto supera el límite de 2,200 caracteres de Instagram (${copy.characterCount} caracteres).`
    );
  }

  if (!copy.isValid) {
    errors.push('El copy ha sido marcado como no válido (isValid: false).');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
