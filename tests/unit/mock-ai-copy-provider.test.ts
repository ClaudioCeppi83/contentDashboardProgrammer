/**
 * @file mock-ai-copy-provider.test.ts
 * @description Pruebas unitarias para MockAICopyProvider.
 * Verifica la generación determinista de copies para Instagram, formato, hashtags y simulación de fallos.
 */

import { describe, it, expect } from 'vitest';
import { MockAICopyProvider } from '@/infrastructure/ai/mock-ai-copy.provider';
import {
  AICopyRateLimitError,
  AICopyUnavailableError,
  AICopyTimeoutError,
  AICopyInvalidRequestError,
} from '@/domain/adapters/ai-copy-provider.interface';

describe('MockAICopyProvider Unit Tests', () => {
  it('debe generar un copy determinista con gancho en las primeras 2 líneas', async () => {
    const provider = new MockAICopyProvider();
    const result = await provider.adaptCopy({
      briefing: 'Cómo crear contenido viral en Instagram utilizando ganchos psicológicos',
      callToAction: 'Guarda este post',
    });

    expect(result.caption).toContain('🔥 Cómo crear contenido viral');
    expect(result.caption).toContain('Guarda este post');
    expect(result.characterCount).toBe(result.caption.length);
    expect(result.hashtags.length).toBeGreaterThanOrEqual(5);
    expect(result.hashtags.length).toBeLessThanOrEqual(15);
    expect(result.firstComment).toBeDefined();
    expect(result.thoughtSignature).toBeDefined();
  });

  it('debe recomendar "reel" cuando el briefing menciona video o reels', async () => {
    const provider = new MockAICopyProvider();
    const result = await provider.adaptCopy({
      briefing: 'Guión de video dinámico con audio en tendencia sobre negocios',
    });

    expect(result.formatRecommendation).toBe('reel');
  });

  it('debe recomendar "carousel" cuando el briefing menciona carrusel, pasos o tips', async () => {
    const provider = new MockAICopyProvider();
    const result = await provider.adaptCopy({
      briefing: '5 pasos y tips clave para estructurar un carrusel de alta retención',
    });

    expect(result.formatRecommendation).toBe('carousel');
  });

  it('debe respetar el formato solicitado explícitamente en el input', async () => {
    const provider = new MockAICopyProvider();
    const result = await provider.adaptCopy({
      briefing: '5 pasos para mejorar tus finanzas',
      format: 'feed_post',
    });

    expect(result.formatRecommendation).toBe('feed_post');
  });

  it('debe simular errores configurables (429, 503, 504, 400)', async () => {
    const provider = new MockAICopyProvider();

    provider.shouldFail = true;
    provider.failureStatus = 429;
    await expect(provider.adaptCopy({ briefing: 'Test' })).rejects.toThrowError(
      AICopyRateLimitError
    );

    provider.failureStatus = 503;
    await expect(provider.adaptCopy({ briefing: 'Test' })).rejects.toThrowError(
      AICopyUnavailableError
    );

    provider.failureStatus = 504;
    await expect(provider.adaptCopy({ briefing: 'Test' })).rejects.toThrowError(
      AICopyTimeoutError
    );

    provider.failureStatus = 400;
    await expect(provider.adaptCopy({ briefing: 'Test' })).rejects.toThrowError(
      AICopyInvalidRequestError
    );
  });

  it('debe registrar el historial de invocaciones y permitir reseteo', async () => {
    const provider = new MockAICopyProvider();
    await provider.adaptCopy({ briefing: 'Briefing uno' });
    await provider.adaptCopy({ briefing: 'Briefing dos' });

    expect(provider.history).toHaveLength(2);
    expect(provider.history[0].briefing).toBe('Briefing uno');

    provider.reset();
    expect(provider.history).toHaveLength(0);
    expect(provider.shouldFail).toBe(false);
  });
});
