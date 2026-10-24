/**
 * @file ai-copy.factory.ts
 * @description Fábrica e inyector de dependencias para AICopyProviderAdapter.
 * Selecciona GeminiCopyAdapter cuando existe GEMINI_API_KEY o MockAICopyProvider
 * en desarrollo offline, tests y entornos sin credenciales.
 */

import type { AICopyProviderAdapter } from '@/domain/adapters/ai-copy-provider.interface';
import { GeminiCopyAdapter } from './gemini-copy.adapter';
import { MockAICopyProvider } from './mock-ai-copy.provider';

export function getAICopyProvider(forcedProvider?: string): AICopyProviderAdapter {
  const provider = forcedProvider || process.env.AI_PROVIDER;

  if (
    provider === 'mock' ||
    process.env.NODE_ENV === 'test' ||
    process.env.USE_MOCK_AI === 'true' ||
    !process.env.GEMINI_API_KEY
  ) {
    return new MockAICopyProvider();
  }

  return new GeminiCopyAdapter();
}
