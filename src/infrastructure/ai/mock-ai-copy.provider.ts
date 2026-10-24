/**
 * @file mock-ai-copy.provider.ts
 * @description Proveedor simulado (Mock) para pruebas unitarias, CI/CD y desarrollo local offline.
 * Ofrece comportamiento determinista, control de fallos y generación conforme a Instagram
 * sin requerir conexión a internet ni GEMINI_API_KEY.
 */

import type {
  AICopyProviderAdapter,
  AdaptCopyInput,
  AdaptedCopyResult,
} from '@/domain/adapters/ai-copy-provider.interface';
import {
  AICopyError,
  AICopyRateLimitError,
  AICopyUnavailableError,
  AICopyTimeoutError,
  AICopyInvalidRequestError,
} from '@/domain/adapters/ai-copy-provider.interface';
import type { InstagramFormat } from '@/domain/models/post.types';

export class MockAICopyProvider implements AICopyProviderAdapter {
  readonly providerName = 'mock';

  public shouldFail = false;
  public failureStatus: number = 500;
  public failureMessage = 'Simulated AI copy error';
  public simulateDelayMs = 0;
  public history: AdaptCopyInput[] = [];

  async adaptCopy(input: AdaptCopyInput): Promise<AdaptedCopyResult> {
    this.history.push({ ...input });

    if (this.simulateDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.simulateDelayMs));
    }

    if (this.shouldFail) {
      if (this.failureStatus === 429) {
        throw new AICopyRateLimitError(this.failureMessage, 30);
      }
      if (this.failureStatus === 503 || this.failureStatus === 502) {
        throw new AICopyUnavailableError(this.failureMessage);
      }
      if (this.failureStatus === 504) {
        throw new AICopyTimeoutError(this.failureMessage);
      }
      if (this.failureStatus === 400 || this.failureStatus === 401 || this.failureStatus === 403) {
        throw new AICopyInvalidRequestError(this.failureMessage, this.failureStatus);
      }
      throw new AICopyError(this.failureMessage, false, this.failureStatus);
    }

    // Determinación del formato recomendado
    let formatRecommendation: InstagramFormat = 'feed_post';
    const lowerBriefing = input.briefing.toLowerCase();

    if (input.format) {
      formatRecommendation = input.format;
    } else if (
      lowerBriefing.includes('video') ||
      lowerBriefing.includes('reel') ||
      lowerBriefing.includes('audio') ||
      lowerBriefing.includes('tendencia')
    ) {
      formatRecommendation = 'reel';
    } else if (
      lowerBriefing.includes('carrusel') ||
      lowerBriefing.includes('pasos') ||
      lowerBriefing.includes('guía') ||
      lowerBriefing.includes('tips')
    ) {
      formatRecommendation = 'carousel';
    }

    // Generación de gancho de 2 líneas y micro-párrafos legibles
    const cleanBriefing = input.briefing.trim();
    const firstSentence = cleanBriefing.split(/[.\n]/)[0] || 'Aprende a transformar tu estrategia';
    const hook = `🔥 ${firstSentence.slice(0, 90)}...\n(No cometas el error común que todos ignoran 👇)`;

    const bodyParagraphs = [
      hook,
      'Cuando se trata de crear contenido que realmente conecte y convierta en Instagram, la estructura lo es todo.',
      `💡 Clave estratégica: ${cleanBriefing.slice(0, 140)}`,
      input.callToAction
        ? `👉 ${input.callToAction}`
        : 'Guarda esta publicación 📌 y compártela con quien necesite optimizar su contenido hoy mismo.',
    ];

    const caption = bodyParagraphs.join('\n\n');

    // Construcción de hashtags hiperrelevantes (5 a 15)
    const baseHashtags = [
      '#InstagramMarketing',
      '#ContentCreator',
      '#SocialMediaTips',
      '#EstrategiaDigital',
      '#EmprendedoresDigitales',
      '#MarketingDeContenidos',
      '#GrowthHacking',
    ];

    const preferred = (input.preferredHashtags || [])
      .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))
      .filter((tag) => tag.length > 1);

    const mergedTags = Array.from(new Set([...preferred, ...baseHashtags])).slice(0, 10);

    const firstComment =
      '💬 Cuéntanos en los comentarios: ¿cuál de estos puntos vas a aplicar en tu próximo post?\n\n' +
      mergedTags.slice(5).join(' ');

    const thoughtSignature =
      input.previousThoughtSignature ||
      `mock_sig_gemini38_${Buffer.from(cleanBriefing.slice(0, 16)).toString('hex')}`;

    return {
      caption,
      characterCount: caption.length,
      hashtags: mergedTags,
      firstComment,
      formatRecommendation,
      thoughtSignature,
    };
  }

  reset(): void {
    this.shouldFail = false;
    this.failureStatus = 500;
    this.failureMessage = 'Simulated AI copy error';
    this.simulateDelayMs = 0;
    this.history = [];
  }
}
