/**
 * @file publisher.factory.ts
 * @description Fábrica e inyector de dependencias para SocialPublisherAdapter.
 * Selecciona InstagramGraphAdapter en producción o MockPublisherProvider
 * en desarrollo offline, tests y entornos sin credenciales de Meta.
 */

import type { SocialPublisherAdapter } from '@/domain/adapters/social-publisher.interface';
import { MockPublisherProvider } from './mock-publisher.provider';
import { InstagramGraphAdapter } from './instagram-graph.adapter';

export function getSocialPublisher(platform = 'instagram'): SocialPublisherAdapter {
  if (
    process.env.NODE_ENV === 'test' ||
    process.env.USE_MOCK_PUBLISHER === 'true' ||
    process.env.FIRESTORE_EMULATOR_HOST ||
    !process.env.INSTAGRAM_ACCESS_TOKEN
  ) {
    return new MockPublisherProvider();
  }

  if (platform === 'instagram') {
    return new InstagramGraphAdapter();
  }

  throw new Error(`Plataforma no soportada para publicación: ${platform}`);
}
