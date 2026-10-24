/**
 * @file client-portal.test.ts
 * @description Suite de pruebas unitarias para la lógica del Portal de Aprobación de Cliente.
 * Valida:
 * 1. Resolución de perfiles de cliente (conocidos y fallbacks dinámicos).
 * 2. Mapeo canónico de estados FSM por pestaña de aprobación.
 * 3. Formateo amigable de fechas para la vista de cliente.
 * 4. Aislamiento multicliente y transiciones FSM desde el rol de cliente.
 */

import { describe, it, expect } from 'vitest';
import {
  getClientProfile,
  formatPortalDate,
  TAB_STATES,
} from '@/components/client-portal/client-portal-types';
import { PostFsmService } from '@/application/services/post-fsm.service';
import type { PostDocument } from '@/domain/models/post.types';

describe('Client Portal Logic & Types', () => {
  describe('getClientProfile', () => {
    it('debe devolver el perfil verificado y completo para client-lumina', () => {
      const profile = getClientProfile('client-lumina');
      expect(profile.id).toBe('client-lumina');
      expect(profile.name).toBe('Lumina Brand');
      expect(profile.handle).toBe('lumina_official');
      expect(profile.verified).toBe(true);
      expect(profile.industry).toBe('Moda Sostenible & Vanguardia');
    });

    it('debe devolver el perfil registrado para client-acme', () => {
      const profile = getClientProfile('client-acme');
      expect(profile.id).toBe('client-acme');
      expect(profile.name).toBe('Acme Studio');
      expect(profile.handle).toBe('acme_studio');
      expect(profile.verified).toBe(true);
    });

    it('debe generar un fallback elegante y profesional para un cliente desconocido', () => {
      const profile = getClientProfile('client-nordic-living');
      expect(profile.id).toBe('client-nordic-living');
      expect(profile.name).toBe('Nordic Living Brand');
      expect(profile.handle).toBe('nordic_living_official');
      expect(profile.verified).toBe(true);
    });
  });

  describe('TAB_STATES canonical mapping', () => {
    it('la pestaña pending debe incluir exclusivamente in_review', () => {
      expect(TAB_STATES.pending).toEqual(['in_review']);
    });

    it('la pestaña approved_scheduled debe incluir approved y scheduled', () => {
      expect(TAB_STATES.approved_scheduled).toEqual(['approved', 'scheduled']);
    });

    it('la pestaña history_changes debe incluir published y changes_requested', () => {
      expect(TAB_STATES.history_changes).toEqual(['published', 'changes_requested']);
    });
  });

  describe('formatPortalDate', () => {
    it('debe manejar valores nulos o indefinidos con fallback legible', () => {
      expect(formatPortalDate(null)).toBe('Sin fecha agendada');
      expect(formatPortalDate(undefined)).toBe('Sin fecha agendada');
    });

    it('debe formatear una fecha ISO válida', () => {
      const result = formatPortalDate('2026-10-24T16:00:00.000Z');
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(5);
    });
  });

  describe('Client approval FSM interactions', () => {
    const mockPostInReview: PostDocument = {
      id: 'post-test-review',
      clientId: 'client-lumina',
      authorId: 'cm-clara',
      title: 'Post para Aprobación de Cliente',
      state: 'in_review',
      platform: 'instagram',
      format: 'feed_post',
      copy: {
        caption: 'Copy de prueba para revisión de cliente #test',
        characterCount: 46,
        characterLimit: 2200,
        hashtags: ['#test'],
        isValid: true,
      },
      media: [
        {
          id: 'media-test-1',
          storagePath: 'posts/test/img.jpg',
          downloadUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1080',
          mimeType: 'image/jpeg',
          sizeBytes: 1024 * 1024,
          width: 1080,
          height: 1080,
          aspectRatio: '1:1',
          validationPassed: true,
        },
      ],
      scheduledAt: null,
      cloudTaskName: null,
      idempotencyKey: null,
      comments: [],
      createdAt: '2026-10-24T10:00:00.000Z',
      updatedAt: '2026-10-24T10:00:00.000Z',
    };

    it('debe transicionar exitosamente a approved cuando el cliente aprueba la publicación', () => {
      const fsmService = new PostFsmService();
      const updated = fsmService.transition(mockPostInReview, 'approved', {
        comment: {
          authorRole: 'client',
          authorId: 'client-lumina',
          content: 'Aprobado por el cliente desde el portal.',
        },
      });

      expect(updated.state).toBe('approved');
      expect(updated.comments.length).toBe(1);
      expect(updated.comments[0].authorRole).toBe('client');
      expect(updated.comments[0].content).toBe('Aprobado por el cliente desde el portal.');
      expect(updated.comments[0].statusChangeTo).toBe('approved');
    });

    it('debe transicionar exitosamente a changes_requested cuando el cliente solicita cambios con motivo', () => {
      const fsmService = new PostFsmService();
      const feedback = 'Ajustar contraste en la imagen de portada y corregir hashtag';
      const updated = fsmService.transition(mockPostInReview, 'changes_requested', {
        feedback,
        comment: {
          authorRole: 'client',
          authorId: 'client-lumina',
          content: feedback,
        },
      });

      expect(updated.state).toBe('changes_requested');
      expect(updated.comments.length).toBe(1);
      expect(updated.comments[0].authorRole).toBe('client');
      expect(updated.comments[0].content).toBe(feedback);
      expect(updated.comments[0].statusChangeTo).toBe('changes_requested');
    });

    it('debe rechazar la solicitud de cambios si no se aporta un motivo textual (guarda FSM)', () => {
      const fsmService = new PostFsmService();
      expect(() => {
        fsmService.transition(mockPostInReview, 'changes_requested');
      }).toThrowError(/feedback\/comentario es obligatorio/);
    });
  });
});
