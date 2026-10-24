/**
 * @file gemini-copy-adapter.test.ts
 * @description Pruebas unitarias para GeminiCopyAdapter.
 * Valida la gobernanza de modelos (Gemini 3.8 Flash, prohibición de gemini-2.5-*),
 * structured output, captura de thought signatures y manejo de errores clasificados.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiCopyAdapter } from '@/infrastructure/ai/gemini-copy.adapter';
import {
  AICopyRateLimitError,
  AICopyUnavailableError,
  AICopyTimeoutError,
  AICopyInvalidRequestError,
} from '@/domain/adapters/ai-copy-provider.interface';

describe('GeminiCopyAdapter Unit Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.GEMINI_API_KEY = 'test-gemini-key-12345';
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('debe inicializarse con el modelo predeterminado gemini-3.8-flash', () => {
    delete process.env.GEMINI_MODEL;
    const adapter = new GeminiCopyAdapter();
    expect((adapter as any).model).toBe('gemini-3.8-flash');
  });

  it('debe permitir parametrizar dinámicamente el modelo mediante GEMINI_MODEL', () => {
    process.env.GEMINI_MODEL = 'gemini-3.7-flash';
    const adapter = new GeminiCopyAdapter();
    expect((adapter as any).model).toBe('gemini-3.7-flash');
  });

  it('debe rechazar terminantemente familias de modelos prohibidas (gemini-2.5-*, gemini-1.5-*) según Sección 12 GEMINI.md', () => {
    expect(() => new GeminiCopyAdapter({ model: 'gemini-2.5-pro' })).toThrowError(
      AICopyInvalidRequestError
    );
    expect(() => new GeminiCopyAdapter({ model: 'gemini-2.5-flash' })).toThrowError(
      /prohibido por la política de gobernanza/
    );
    expect(() => new GeminiCopyAdapter({ model: 'gemini-1.5-pro' })).toThrowError(
      AICopyInvalidRequestError
    );
    expect(() => new GeminiCopyAdapter({ model: 'gemini-1.0-ultra' })).toThrowError(
      AICopyInvalidRequestError
    );
  });

  it('debe lanzar AICopyInvalidRequestError si GEMINI_API_KEY no está configurada', async () => {
    delete process.env.GEMINI_API_KEY;
    const adapter = new GeminiCopyAdapter({ apiKey: '' });
    await expect(
      adapter.adaptCopy({ briefing: 'Briefing de prueba para Instagram' })
    ).rejects.toThrowError(AICopyInvalidRequestError);
  });

  it('debe generar copy estructurado y extraer thought signature de la respuesta', async () => {
    const mockGeminiResponse = {
      candidates: [
        {
          thoughtSignature: 'sig_gemini_38_thought_abc123',
          content: {
            parts: [
              {
                text: 'Pensando en los mejores ganchos...',
                thought: true,
              },
              {
                text: JSON.stringify({
                  caption:
                    '🚀 Descubre el nuevo método para escalar en redes.\n(El último truco te volará la cabeza 👇)\n\nAplicar consistencia estratégica es la clave.',
                  characterCount: 145,
                  hashtags: ['#MarketingDigital', '#Estrategia', '#SocialMedia', '#Emprender', '#Growth'],
                  firstComment: '💬 Déjanos tu opinión abajo y síguenos para más consejos diarios.',
                  formatRecommendation: 'carousel',
                }),
              },
            ],
          },
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockGeminiResponse,
    });

    const adapter = new GeminiCopyAdapter({ fetchFn: mockFetch as any });
    const result = await adapter.adaptCopy({
      briefing: 'Nuevo método para escalar en redes sociales usando consistencia estratégica',
      tone: 'inspirational',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.caption).toContain('🚀 Descubre el nuevo método');
    expect(result.characterCount).toBe(result.caption.length);
    expect(result.hashtags.length).toBeGreaterThanOrEqual(5);
    expect(result.formatRecommendation).toBe('carousel');
    expect(result.thoughtSignature).toBe('sig_gemini_38_thought_abc123');
  });

  it('debe capturar thoughtSignature desde un part si candidate.thoughtSignature no viene presente', async () => {
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                thought: true,
                text: 'Razonamiento interno sobre la audiencia de Instagram',
                thoughtSignature: 'sig_from_part_xyz789',
              },
              {
                text: JSON.stringify({
                  caption: 'Gancho directo.\n\nContenido de alto valor para emprendedores.',
                  characterCount: 50,
                  hashtags: ['#Tip1', '#Tip2', '#Tip3', '#Tip4', '#Tip5'],
                  firstComment: 'Comenta aquí',
                  formatRecommendation: 'feed_post',
                }),
              },
            ],
          },
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockGeminiResponse,
    });

    const adapter = new GeminiCopyAdapter({ fetchFn: mockFetch as any });
    const result = await adapter.adaptCopy({ briefing: 'Consejos para emprendedores' });

    expect(result.thoughtSignature).toBe('sig_from_part_xyz789');
  });

  it('debe clasificar error HTTP 429 como AICopyRateLimitError con header Retry-After', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ 'retry-after': '45' }),
      json: async () => ({
        error: { message: 'Resource has been exhausted (e.g. check quota).' },
      }),
    });

    const adapter = new GeminiCopyAdapter({ fetchFn: mockFetch as any });

    try {
      await adapter.adaptCopy({ briefing: 'Test briefing' });
      expect.fail('Debería haber lanzado AICopyRateLimitError');
    } catch (err) {
      expect(err).toBeInstanceOf(AICopyRateLimitError);
      const rateLimitErr = err as AICopyRateLimitError;
      expect(rateLimitErr.retryAfterSeconds).toBe(45);
      expect(rateLimitErr.isTransient).toBe(true);
      expect(rateLimitErr.statusCode).toBe(429);
    }
  });

  it('debe clasificar error HTTP 503 como AICopyUnavailableError', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        error: { message: 'The model is currently overloaded. Please try again later.' },
      }),
    });

    const adapter = new GeminiCopyAdapter({ fetchFn: mockFetch as any });

    await expect(adapter.adaptCopy({ briefing: 'Test briefing' })).rejects.toThrowError(
      AICopyUnavailableError
    );
  });

  it('debe clasificar timeout por AbortError como AICopyTimeoutError', async () => {
    const mockFetch = vi.fn().mockImplementation(() => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });

    const adapter = new GeminiCopyAdapter({ fetchFn: mockFetch as any });

    await expect(adapter.adaptCopy({ briefing: 'Test briefing' })).rejects.toThrowError(
      AICopyTimeoutError
    );
  });

  it('debe manejar fallback de JSON markdown ```json ... ``` si el modelo incluye delimitadores', async () => {
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text:
                  '```json\n{\n' +
                  '  "caption": "Gancho envuelto en markdown.\\n\\nCuerpo del post.",\n' +
                  '  "characterCount": 42,\n' +
                  '  "hashtags": ["#TagA", "#TagB", "#TagC", "#TagD", "#TagE"],\n' +
                  '  "firstComment": "Comentario",\n' +
                  '  "formatRecommendation": "reel"\n' +
                  '}\n```',
              },
            ],
          },
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockGeminiResponse,
    });

    const adapter = new GeminiCopyAdapter({ fetchFn: mockFetch as any });
    const result = await adapter.adaptCopy({ briefing: 'Guión para reel' });

    expect(result.caption).toContain('Gancho envuelto en markdown');
    expect(result.formatRecommendation).toBe('reel');
  });

  it('debe construir el prompt delimitando los campos del usuario con etiquetas XML (<user_briefing>) para mitigar Prompt Injection', async () => {
    let capturedBody: any;
    const mockFetch = vi.fn().mockImplementation(async (_url, options) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      caption: 'Gancho limpio.\n\nContenido.',
                      characterCount: 25,
                      hashtags: ['#Uno', '#Dos', '#Tres', '#Cuatro', '#Cinco'],
                      firstComment: 'Comentario',
                      formatRecommendation: 'feed_post',
                    }),
                  },
                ],
              },
            },
          ],
        }),
      };
    });

    const adapter = new GeminiCopyAdapter({ fetchFn: mockFetch as any });
    await adapter.adaptCopy({
      briefing: 'Texto de prueba sin comandos.',
      tone: 'inspirador',
      targetAudience: 'emprendedores',
    });

    const userText = capturedBody.contents[0].parts[0].text;
    expect(userText).toContain('<user_briefing>\nTexto de prueba sin comandos.\n</user_briefing>');
    expect(userText).toContain('<tone>inspirador</tone>');
    expect(userText).toContain('<target_audience>emprendedores</target_audience>');

    const systemText = capturedBody.systemInstruction.parts[0].text;
    expect(systemText).toContain('DIRECTIVAS DE SEGURIDAD Y DELIMITACIÓN DE CONTEXTO (OWASP LLM01)');
    expect(systemText).toContain('Todo el contenido delimitado en bloques de usuario');
  });

  it('debe anonimizar cualquier clave API de Google que aparezca en respuestas de error de la API', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          code: 400,
          message: 'Invalid API key provided: AIzaSyB1234567890abcdef1234567890abcdef. Please check credentials.',
          status: 'INVALID_ARGUMENT',
        },
      }),
    });

    const adapter = new GeminiCopyAdapter({ fetchFn: mockFetch as any });
    try {
      await adapter.adaptCopy({ briefing: 'Briefing válido' });
      expect.fail('Debería haber lanzado error');
    } catch (err: any) {
      expect(err.message).not.toContain('AIzaSyB1234567890abcdef1234567890abcdef');
      expect(err.message).toContain('[REDACTED_API_KEY]');
    }
  });
});
