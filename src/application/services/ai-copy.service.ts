/**
 * @file ai-copy.service.ts
 * @description Servicio de aplicación para la adaptación de copy orientada a Instagram.
 * Aplica validación y sanitización con Zod, detección de inyecciones de prompt,
 * orquestación con el proveedor de IA (Gemini 3.8 Flash / Mock) y post-procesamiento defensivo.
 */

import { z } from 'zod';
import type {
  AICopyProviderAdapter,
  AdaptCopyInput,
  AdaptedCopyResult,
} from '@/domain/adapters/ai-copy-provider.interface';
import { AICopyValidationError } from '@/domain/adapters/ai-copy-provider.interface';
import type { InstagramFormat } from '@/domain/models/post.types';

// Expresiones regulares para detección de inyecciones de prompt y ataques de elusión
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions/i,
  /disregard\s+(?:all\s+)?(?:previous|prior|above)\s+instructions/i,
  /you\s+are\s+now\s+(?:a|an|in|the)\b/i,
  /system\s*prompt\s*:/i,
  /(?:jailbreak|dan\s+mode)/i,
  /(?:reveal|output|print|show)\s+(?:the\s+)?(?:(?:system|api|secret|hidden)\s+)*(?:key|prompt|token|credential)/i,
  /bypass\s+(?:security|safety|filter|guardrail)/i,
  /pretend\s+(?:you\s+are|to\s+be)\b/i,
  /(?:do\s+anything\s+now|override\s+system)/i,
];

// Caracteres de control no imprimibles y espacios invisibles de ofuscación
const NON_PRINTABLE_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200B\u200C\u200D\uFEFF]/g;

// Expresiones regulares para sanitización de salida contra XSS y scripts maliciosos
const SCRIPT_TAG_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const HTML_TAG_REGEX = /<\/?[a-zA-Z][^>]*>/g;
const JAVASCRIPT_URI_REGEX = /javascript\s*:/gi;
const DANGEROUS_DOM_EVENTS = /\bon\w+\s*=/gi;

const MAX_BRIEFING_LENGTH = 4000;
const MIN_BRIEFING_LENGTH = 5;
const INSTAGRAM_MAX_CAPTION_LENGTH = 2200;

export const AdaptCopyInputSchema = z
  .object({
    briefing: z
      .string()
      .min(MIN_BRIEFING_LENGTH, `El briefing debe contener al menos ${MIN_BRIEFING_LENGTH} caracteres`)
      .max(MAX_BRIEFING_LENGTH, `El briefing no puede exceder los ${MAX_BRIEFING_LENGTH} caracteres`),
    format: z.enum(['feed_post', 'carousel', 'reel'] as const).optional(),
    tone: z.string().max(100, 'El tono no puede exceder 100 caracteres').optional(),
    targetAudience: z
      .string()
      .max(300, 'La audiencia objetivo no puede exceder 300 caracteres')
      .optional(),
    brandVoice: z
      .string()
      .max(300, 'La voz de marca no puede exceder 300 caracteres')
      .optional(),
    preferredHashtags: z
      .array(z.string().max(50, 'Cada hashtag no puede superar 50 caracteres'))
      .max(15, 'No se pueden especificar más de 15 hashtags preferidos')
      .optional(),
    callToAction: z
      .string()
      .max(200, 'La llamada a la acción no puede exceder 200 caracteres')
      .optional(),
    language: z.string().max(20, 'El código de idioma no puede exceder 20 caracteres').optional(),
    previousThoughtSignature: z
      .string()
      .max(4000, 'La firma de pensamiento no puede exceder 4,000 caracteres')
      .optional(),
  })
  .strict();

export class AICopyService {
  constructor(private readonly aiProvider: AICopyProviderAdapter) {}

  /**
   * Sanitiza cadenas eliminando caracteres no imprimibles y secuencias nulas.
   */
  public sanitizeText(text: string): string {
    return text.replace(NON_PRINTABLE_REGEX, '').trim();
  }

  /**
   * Sanitiza el texto generado por la IA eliminando scripts, etiquetas HTML y pseudo-protocolos javascript:
   * Protege contra ataques XSS en previsualización de feed, paneles de clientes y renderizado web.
   */
  public sanitizeOutputText(text: string): string {
    if (!text) return '';
    return text
      .replace(SCRIPT_TAG_REGEX, '')
      .replace(HTML_TAG_REGEX, '')
      .replace(JAVASCRIPT_URI_REGEX, '')
      .replace(DANGEROUS_DOM_EVENTS, '')
      .trim();
  }

  /**
   * Analiza si el texto contiene patrones maliciosos conocidos de inyección de prompt.
   */
  public checkPromptInjection(text: string): boolean {
    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Valida, sanitiza y ejecuta la adaptación de copy mediante el proveedor de IA configurado.
   */
  async adaptCopy(rawInput: unknown): Promise<AdaptedCopyResult> {
    // 1. Validación de esquema Zod (Parameter Tampering Protection)
    const parseResult = AdaptCopyInputSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const errorDetails = parseResult.error.issues.map((i) => i.message).join(', ');
      throw new AICopyValidationError(`Validación de entrada fallida: ${errorDetails}`);
    }

    const validated = parseResult.data;

    // 2. Sanitización de caracteres no imprimibles
    const cleanBriefing = this.sanitizeText(validated.briefing);
    if (cleanBriefing.length < MIN_BRIEFING_LENGTH) {
      throw new AICopyValidationError(
        `El briefing contiene únicamente caracteres inválidos o es inferior a ${MIN_BRIEFING_LENGTH} caracteres útiles.`
      );
    }

    // 3. Inspección contra inyecciones de prompt
    const fieldsToInspect = [
      cleanBriefing,
      validated.tone,
      validated.targetAudience,
      validated.brandVoice,
      validated.callToAction,
    ].filter(Boolean) as string[];

    for (const field of fieldsToInspect) {
      if (this.checkPromptInjection(field)) {
        throw new AICopyValidationError(
          'Intento de inyección de prompt o instrucción no permitida detectada en los parámetros de entrada.'
        );
      }
    }

    // 4. Preparación de la entrada limpia para el proveedor
    const sanitizedInput: AdaptCopyInput = {
      ...validated,
      briefing: cleanBriefing,
      tone: validated.tone ? this.sanitizeText(validated.tone) : undefined,
      targetAudience: validated.targetAudience
        ? this.sanitizeText(validated.targetAudience)
        : undefined,
      brandVoice: validated.brandVoice ? this.sanitizeText(validated.brandVoice) : undefined,
      callToAction: validated.callToAction ? this.sanitizeText(validated.callToAction) : undefined,
      preferredHashtags: validated.preferredHashtags?.map((t) => this.sanitizeText(t)),
    };

    // 5. Invocación al adaptador de IA
    const result = await this.aiProvider.adaptCopy(sanitizedInput);

    // 6. Post-procesamiento y garantías de calidad para Instagram
    return this.postProcessResult(result, sanitizedInput.format);
  }

  private postProcessResult(
    result: AdaptedCopyResult,
    requestedFormat?: InstagramFormat
  ): AdaptedCopyResult {
    let caption = this.sanitizeOutputText(result.caption);

    // Garantizar límite estricto de Instagram (2,200 caracteres)
    if (caption.length > INSTAGRAM_MAX_CAPTION_LENGTH) {
      caption = caption.slice(0, INSTAGRAM_MAX_CAPTION_LENGTH - 3).trim() + '...';
    }

    const characterCount = caption.length;

    // Normalizar y sanitizar hashtags (entre 5 y 15 con prefijo '#')
    const cleanedTags = (result.hashtags || [])
      .map((tag) => this.sanitizeOutputText(tag))
      .map((tag) => (tag.startsWith('#') ? tag : `#${tag.trim()}`))
      .filter((tag) => tag.length > 1 && !tag.includes('<') && !tag.includes('>'));

    const uniqueTags = Array.from(new Set(cleanedTags));

    let hashtags = uniqueTags.slice(0, 15);
    if (hashtags.length < 5) {
      const defaultTags = ['#InstagramMarketing', '#SocialMediaTips', '#ContentCreator', '#EstrategiaDigital', '#Growth'];
      for (const def of defaultTags) {
        if (hashtags.length >= 5) break;
        if (!hashtags.includes(def)) {
          hashtags.push(def);
        }
      }
    }

    const validFormats: InstagramFormat[] = ['feed_post', 'carousel', 'reel'];
    const formatRecommendation = validFormats.includes(result.formatRecommendation)
      ? result.formatRecommendation
      : requestedFormat || 'feed_post';

    const firstComment = this.sanitizeOutputText(result.firstComment);

    return {
      caption,
      characterCount,
      hashtags,
      firstComment,
      formatRecommendation,
      thoughtSignature: result.thoughtSignature,
    };
  }
}
