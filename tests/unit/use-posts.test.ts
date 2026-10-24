/**
 * @file use-posts.test.ts
 * @description Suite de pruebas unitarias exhaustivas para el hook `usePosts` del Social Ops Dashboard.
 * Cubre:
 * 1. Inicialización y métricas agregadas por defecto.
 * 2. Filtrado multidimensional (por estado FSM y por formato de Instagram).
 * 3. Búsqueda reactiva por texto (título, caption, hashtags) insensible a mayúsculas/minúsculas.
 * 4. Mutación optimista en transiciones FSM: éxito en caminos válidos y rollback estricto ante violaciones FSM o guardas.
 * 5. Ciclo de vida CRUD: creación, actualización y eliminación reactiva de posts.
 * 6. Reprogramación de fechas (`reschedulePost` para Drag & Drop del Calendario Editorial).
 * 7. Gestión de errores y reseteo del toast.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { usePosts } from '@/application/hooks/use-posts';
import type { PostState, InstagramFormat } from '@/domain/models/post.types';

/**
 * Test harness de alto rendimiento para ejecutar custom hooks de React 19 en entorno Node/Vitest
 * sin dependencias pesadas de DOM, garantizando aislamiento estricto y reactividad inmediata.
 */
function renderHook<T>(hookFn: () => T) {
  let stateSlots: any[] = [];
  let memoSlots: Array<{ value: any; deps: any[] | undefined }> = [];
  let slotIndex = 0;
  let memoIndex = 0;
  let result: T;

  const dispatcher = {
    useState(initialValue: any) {
      const idx = slotIndex++;
      if (idx >= stateSlots.length) {
        const val = typeof initialValue === 'function' ? initialValue() : initialValue;
        stateSlots.push(val);
      }
      const setState = (action: any) => {
        const next = typeof action === 'function' ? action(stateSlots[idx]) : action;
        stateSlots[idx] = next;
        rerender();
      };
      return [stateSlots[idx], setState];
    },
    useMemo(fn: () => any, deps: any[] | undefined) {
      const idx = memoIndex++;
      const prev = memoSlots[idx];
      if (
        prev &&
        deps &&
        prev.deps &&
        deps.length === prev.deps.length &&
        prev.deps.every((d, i) => Object.is(d, deps[i]))
      ) {
        return prev.value;
      }
      const val = fn();
      memoSlots[idx] = { value: val, deps };
      return val;
    },
    useCallback(fn: any, deps: any[] | undefined) {
      return dispatcher.useMemo(() => fn, deps);
    },
  };

  function rerender() {
    slotIndex = 0;
    memoIndex = 0;
    const clientInternals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    const prevDispatcher = clientInternals.H;
    clientInternals.H = dispatcher;
    try {
      result = hookFn();
    } finally {
      clientInternals.H = prevDispatcher;
    }
  }

  rerender();

  return {
    get current() {
      return result;
    },
    rerender,
  };
}

describe('usePosts Hook - Suite de Certificación Forense', () => {
  let hook: ReturnType<typeof renderHook<ReturnType<typeof usePosts>>>;

  beforeEach(() => {
    hook = renderHook(() => usePosts());
  });

  // =========================================================================
  // 1. INICIALIZACIÓN Y MÉTRICAS
  // =========================================================================
  describe('1. Inicialización y Estado Inicial', () => {
    it('debe inicializar con 7 publicaciones mock canónicas y estados por defecto', () => {
      expect(hook.current.posts).toHaveLength(7);
      expect(hook.current.filteredPosts).toHaveLength(7);
      expect(hook.current.searchQuery).toBe('');
      expect(hook.current.stateFilter).toBe('all');
      expect(hook.current.formatFilter).toBe('all');
      expect(hook.current.isMutating).toBe(false);
      expect(hook.current.errorToast).toBeNull();
    });

    it('debe calcular métricas agregadas correctas por estado y formato', () => {
      const { metrics } = hook.current;
      expect(metrics.total).toBe(7);

      // Verificación de conteo por estado FSM
      expect(metrics.byState.idea).toBe(1);
      expect(metrics.byState.in_progress).toBe(1);
      expect(metrics.byState.in_review).toBe(1);
      expect(metrics.byState.changes_requested).toBe(1);
      expect(metrics.byState.approved).toBe(1);
      expect(metrics.byState.scheduled).toBe(1);
      expect(metrics.byState.published).toBe(1);
      expect(metrics.byState.publishing).toBe(0);
      expect(metrics.byState.failed).toBe(0);

      // Verificación de conteo por formato de Instagram
      expect(metrics.byFormat.feed_post).toBe(4);
      expect(metrics.byFormat.reel).toBe(2);
      expect(metrics.byFormat.carousel).toBe(1);
    });
  });

  // =========================================================================
  // 2. FILTRADO MULTIDIMENSIONAL (ESTADO Y FORMATO)
  // =========================================================================
  describe('2. Filtrado Multidimensional', () => {
    it('debe filtrar exclusivamente por estado FSM', () => {
      const testCases: Array<{ state: PostState; expectedCount: number; expectedId: string }> = [
        { state: 'idea', expectedCount: 1, expectedId: 'post-101' },
        { state: 'in_progress', expectedCount: 1, expectedId: 'post-102' },
        { state: 'in_review', expectedCount: 1, expectedId: 'post-103' },
        { state: 'changes_requested', expectedCount: 1, expectedId: 'post-104' },
        { state: 'approved', expectedCount: 1, expectedId: 'post-105' },
        { state: 'scheduled', expectedCount: 1, expectedId: 'post-106' },
        { state: 'published', expectedCount: 1, expectedId: 'post-107' },
      ];

      for (const tc of testCases) {
        hook.current.setStateFilter(tc.state);
        expect(hook.current.filteredPosts).toHaveLength(tc.expectedCount);
        expect(hook.current.filteredPosts[0].id).toBe(tc.expectedId);
        expect(hook.current.filteredPosts[0].state).toBe(tc.state);
      }

      // Estado sin publicaciones
      hook.current.setStateFilter('failed');
      expect(hook.current.filteredPosts).toHaveLength(0);

      // Revertir a todos
      hook.current.setStateFilter('all');
      expect(hook.current.filteredPosts).toHaveLength(7);
    });

    it('debe filtrar exclusivamente por formato de Instagram', () => {
      // Feed Posts (4)
      hook.current.setFormatFilter('feed_post');
      expect(hook.current.filteredPosts).toHaveLength(4);
      hook.current.filteredPosts.forEach((post) => {
        expect(post.format).toBe('feed_post');
      });

      // Reels (2)
      hook.current.setFormatFilter('reel');
      expect(hook.current.filteredPosts).toHaveLength(2);
      hook.current.filteredPosts.forEach((post) => {
        expect(post.format).toBe('reel');
      });

      // Carousels (1)
      hook.current.setFormatFilter('carousel');
      expect(hook.current.filteredPosts).toHaveLength(1);
      expect(hook.current.filteredPosts[0].id).toBe('post-104');

      // Revertir a todos
      hook.current.setFormatFilter('all');
      expect(hook.current.filteredPosts).toHaveLength(7);
    });

    it('debe aplicar filtrado compuesto simultáneo (Estado FSM + Formato Instagram)', () => {
      // 'approved' AND 'feed_post' -> post-105
      hook.current.setStateFilter('approved');
      hook.current.setFormatFilter('feed_post');
      expect(hook.current.filteredPosts).toHaveLength(1);
      expect(hook.current.filteredPosts[0].id).toBe('post-105');

      // 'scheduled' AND 'reel' -> post-106
      hook.current.setStateFilter('scheduled');
      hook.current.setFormatFilter('reel');
      expect(hook.current.filteredPosts).toHaveLength(1);
      expect(hook.current.filteredPosts[0].id).toBe('post-106');

      // 'idea' AND 'reel' -> ningún match (post-101 es feed_post)
      hook.current.setStateFilter('idea');
      hook.current.setFormatFilter('reel');
      expect(hook.current.filteredPosts).toHaveLength(0);
    });
  });

  // =========================================================================
  // 3. BÚSQUEDA REACTIVA POR TEXTO (TÍTULO, CAPTION, HASHTAGS)
  // =========================================================================
  describe('3. Búsqueda Reactiva Multidimensional', () => {
    it('debe buscar reactivamente por coincidencia en el título (case-insensitive)', () => {
      hook.current.setSearchQuery('Primavera');
      expect(hook.current.filteredPosts).toHaveLength(1);
      expect(hook.current.filteredPosts[0].id).toBe('post-101');

      // Búsqueda en minúsculas y mayúsculas
      hook.current.setSearchQuery('pRiMaVeRa');
      expect(hook.current.filteredPosts).toHaveLength(1);
      expect(hook.current.filteredPosts[0].id).toBe('post-101');

      hook.current.setSearchQuery('BLAZER');
      expect(hook.current.filteredPosts).toHaveLength(1);
      expect(hook.current.filteredPosts[0].id).toBe('post-106');
    });

    it('debe buscar reactivamente por contenido del caption', () => {
      hook.current.setSearchQuery('15 segundos');
      expect(hook.current.filteredPosts).toHaveLength(1);
      expect(hook.current.filteredPosts[0].id).toBe('post-102');

      hook.current.setSearchQuery('armario cápsula');
      expect(hook.current.filteredPosts).toHaveLength(1);
      expect(hook.current.filteredPosts[0].id).toBe('post-104');
    });

    it('debe buscar reactivamente en la lista de hashtags', () => {
      hook.current.setSearchQuery('#capsulewardrobe');
      expect(hook.current.filteredPosts).toHaveLength(1);
      expect(hook.current.filteredPosts[0].id).toBe('post-104');

      // Sin el símbolo '#'
      hook.current.setSearchQuery('capsulewardrobe');
      expect(hook.current.filteredPosts).toHaveLength(1);
      expect(hook.current.filteredPosts[0].id).toBe('post-104');

      // Búsqueda que coincide en varios posts (#slowfashion / #slowfashionmovement)
      hook.current.setSearchQuery('slowfashion');
      expect(hook.current.filteredPosts).toHaveLength(2);
      const matchedIds = hook.current.filteredPosts.map((p) => p.id);
      expect(matchedIds).toContain('post-103');
      expect(matchedIds).toContain('post-107');
    });

    it('debe ignorar espacios en blanco superfluos al inicio y final', () => {
      hook.current.setSearchQuery('   minimalismo   ');
      expect(hook.current.filteredPosts).toHaveLength(1);
      expect(hook.current.filteredPosts[0].id).toBe('post-101');
    });

    it('debe retornar lista vacía cuando no existen coincidencias', () => {
      hook.current.setSearchQuery('consulta_inexistente_xyz_123');
      expect(hook.current.filteredPosts).toHaveLength(0);
    });

    it('debe combinar búsqueda reactiva con filtros de estado y formato', () => {
      // 'sofia_atelier' está en caption de post-105
      hook.current.setSearchQuery('sofia_atelier');
      hook.current.setStateFilter('approved');
      hook.current.setFormatFilter('feed_post');
      expect(hook.current.filteredPosts).toHaveLength(1);
      expect(hook.current.filteredPosts[0].id).toBe('post-105');

      // Si cambiamos el filtro de estado a 'idea', no debe haber coincidencias
      hook.current.setStateFilter('idea');
      expect(hook.current.filteredPosts).toHaveLength(0);
    });
  });

  // =========================================================================
  // 4. MUTACIÓN OPTIMISTA Y TRANSICIONES FSM
  // =========================================================================
  describe('4. Mutación Optimista en Transiciones FSM', () => {
    it('debe transicionar con éxito en camino válido (idea -> in_progress)', async () => {
      const previousTotal = hook.current.posts.length;

      const updated = await hook.current.transitionPost('post-101', 'in_progress');

      expect(updated.id).toBe('post-101');
      expect(updated.state).toBe('in_progress');

      // Estado local actualizado
      const postInState = hook.current.posts.find((p) => p.id === 'post-101');
      expect(postInState?.state).toBe('in_progress');
      expect(hook.current.posts.length).toBe(previousTotal);
      expect(hook.current.errorToast).toBeNull();
      expect(hook.current.isMutating).toBe(false);

      // Métricas reactivas actualizadas
      expect(hook.current.metrics.byState.idea).toBe(0);
      expect(hook.current.metrics.byState.in_progress).toBe(2);
    });

    it('debe transicionar con éxito con payload requerido (approved -> scheduled)', async () => {
      const scheduleDate = '2026-11-01T15:00:00.000Z';

      const updated = await hook.current.transitionPost('post-105', 'scheduled', {
        scheduledAt: scheduleDate,
      });

      expect(updated.state).toBe('scheduled');
      expect(updated.scheduledAt).toBe(scheduleDate);

      const postInState = hook.current.posts.find((p) => p.id === 'post-105');
      expect(postInState?.state).toBe('scheduled');
      expect(postInState?.scheduledAt).toBe(scheduleDate);
      expect(hook.current.errorToast).toBeNull();

      // Métricas actualizadas
      expect(hook.current.metrics.byState.approved).toBe(0);
      expect(hook.current.metrics.byState.scheduled).toBe(2);
    });

    it('debe realizar ROLLBACK EXACTO ante transición inválida por grafo FSM (idea -> published)', async () => {
      const initialPostsSnapshot = [...hook.current.posts];

      await expect(
        hook.current.transitionPost('post-101', 'published')
      ).rejects.toThrow();

      // Verificación de Rollback: post-101 sigue en 'idea'
      const targetPost = hook.current.posts.find((p) => p.id === 'post-101');
      expect(targetPost?.state).toBe('idea');
      expect(hook.current.posts).toEqual(initialPostsSnapshot);

      // Verificación de Error Toast
      expect(hook.current.errorToast).not.toBeNull();
      expect(hook.current.errorToast).toContain('Transición no permitida');
      expect(hook.current.isMutating).toBe(false);

      // Métricas inalteradas
      expect(hook.current.metrics.byState.idea).toBe(1);
      expect(hook.current.metrics.byState.published).toBe(1);
    });

    it('debe realizar ROLLBACK EXACTO ante violación de guardas FSM (approved -> scheduled sin scheduledAt)', async () => {
      const initialPostsSnapshot = [...hook.current.posts];

      // post-105 está en 'approved', pero omitimos scheduledAt en el payload
      await expect(
        hook.current.transitionPost('post-105', 'scheduled', {})
      ).rejects.toThrow();

      // Rollback verificado: post-105 sigue en 'approved'
      const targetPost = hook.current.posts.find((p) => p.id === 'post-105');
      expect(targetPost?.state).toBe('approved');
      expect(hook.current.posts).toEqual(initialPostsSnapshot);

      // Error Toast contiene detalle de la guarda
      expect(hook.current.errorToast).not.toBeNull();
      expect(hook.current.errorToast).toContain('scheduledAt');
      expect(hook.current.isMutating).toBe(false);
    });

    it('debe lanzar error y registrar toast si el post a transicionar no existe', async () => {
      await expect(
        hook.current.transitionPost('post-fantasma-inexistente', 'in_progress')
      ).rejects.toThrow('Post no encontrado: post-fantasma-inexistente');

      expect(hook.current.errorToast).toBe('Post no encontrado: post-fantasma-inexistente');
      expect(hook.current.isMutating).toBe(false);
    });
  });

  // =========================================================================
  // 5. OPERACIONES CRUD (CREAR, ACTUALIZAR, ELIMINAR)
  // =========================================================================
  describe('5. Operaciones CRUD de Posts', () => {
    it('debe crear un nuevo post con valores por defecto y prependerlo a la lista', async () => {
      const newPost = await hook.current.createPost({
        title: 'Nuevo Drop Exclusivo',
        format: 'reel',
      });

      expect(newPost.id).toBeDefined();
      expect(newPost.title).toBe('Nuevo Drop Exclusivo');
      expect(newPost.format).toBe('reel');
      expect(newPost.state).toBe('idea');
      expect(newPost.platform).toBe('instagram');

      // Prependido al inicio de la lista
      expect(hook.current.posts).toHaveLength(8);
      expect(hook.current.posts[0].id).toBe(newPost.id);
      expect(hook.current.filteredPosts[0].id).toBe(newPost.id);

      // Métricas reactivas actualizadas
      expect(hook.current.metrics.total).toBe(8);
      expect(hook.current.metrics.byState.idea).toBe(2);
      expect(hook.current.metrics.byFormat.reel).toBe(3);
    });

    it('debe crear un post con estructura completa personalizada', async () => {
      const customPost = await hook.current.createPost({
        clientId: 'client-custom',
        authorId: 'author-custom',
        title: 'Carrusel Educativo de Moda',
        format: 'carousel',
        briefingScript: 'Explicación detallada de tejidos orgánicos.',
        copy: {
          caption: 'Los secretos detrás del lino certificado.',
          characterCount: 42,
          characterLimit: 2200,
          hashtags: ['#lino', '#organico'],
          firstComment: '#artesanal',
          isValid: true,
        },
      });

      expect(customPost.clientId).toBe('client-custom');
      expect(customPost.authorId).toBe('author-custom');
      expect(customPost.copy.caption).toBe('Los secretos detrás del lino certificado.');
      expect(customPost.format).toBe('carousel');
    });

    it('debe actualizar un post existente y actualizar su timestamp de modificación', async () => {
      const originalPost = hook.current.posts.find((p) => p.id === 'post-101')!;

      const updated = await hook.current.updatePost('post-101', {
        title: 'Teaser Primavera 2026 - Versión Definitiva',
        briefingScript: 'Nuevo enfoque con paleta cálida.',
      });

      expect(updated.title).toBe('Teaser Primavera 2026 - Versión Definitiva');
      expect(updated.briefingScript).toBe('Nuevo enfoque con paleta cálida.');
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(originalPost.updatedAt).getTime()
      );

      // Confirmar en el estado reactivo
      const inState = hook.current.posts.find((p) => p.id === 'post-101');
      expect(inState?.title).toBe('Teaser Primavera 2026 - Versión Definitiva');
    });

    it('debe lanzar error y notificar en toast al intentar actualizar un post inexistente', async () => {
      await expect(
        hook.current.updatePost('id-que-no-existe', { title: 'Nuevo Título' })
      ).rejects.toThrow('Post no encontrado: id-que-no-existe');

      expect(hook.current.errorToast).toBe('Post no encontrado: id-que-no-existe');
    });

    it('debe eliminar un post por su id y decrementar las métricas correspondientes', async () => {
      // Eliminar post-104 (único carrusel en changes_requested)
      await hook.current.deletePost('post-104');

      expect(hook.current.posts).toHaveLength(6);
      expect(hook.current.posts.some((p) => p.id === 'post-104')).toBe(false);
      expect(hook.current.filteredPosts.some((p) => p.id === 'post-104')).toBe(false);

      // Verificación de métricas actualizadas
      expect(hook.current.metrics.total).toBe(6);
      expect(hook.current.metrics.byState.changes_requested).toBe(0);
      expect(hook.current.metrics.byFormat.carousel).toBe(0);
    });
  });

  // =========================================================================
  // 6. REPROGRAMACIÓN DE FECHAS (reschedulePost - DRAG & DROP CALENDARIO)
  // =========================================================================
  describe('6. Reprogramación de Fecha (reschedulePost)', () => {
    it('debe transicionar de approved a scheduled al reprogramar fecha en Calendario', async () => {
      // post-105 está en estado 'approved'
      const newScheduledDate = '2026-10-31T17:00:00.000Z';

      const rescheduled = await hook.current.reschedulePost('post-105', newScheduledDate);

      expect(rescheduled.state).toBe('scheduled');
      expect(rescheduled.scheduledAt).toBe(newScheduledDate);

      // Verificar en el array de publicaciones del hook
      const postInState = hook.current.posts.find((p) => p.id === 'post-105');
      expect(postInState?.state).toBe('scheduled');
      expect(postInState?.scheduledAt).toBe(newScheduledDate);

      // Métricas reactivas
      expect(hook.current.metrics.byState.approved).toBe(0);
      expect(hook.current.metrics.byState.scheduled).toBe(2);
    });

    it('debe actualizar scheduledAt directamente si el post ya está en estado scheduled', async () => {
      // post-106 ya está en estado 'scheduled'
      const newScheduledDate = '2026-10-29T20:00:00.000Z';

      const rescheduled = await hook.current.reschedulePost('post-106', newScheduledDate);

      expect(rescheduled.state).toBe('scheduled');
      expect(rescheduled.scheduledAt).toBe(newScheduledDate);

      const postInState = hook.current.posts.find((p) => p.id === 'post-106');
      expect(postInState?.scheduledAt).toBe(newScheduledDate);
      expect(postInState?.state).toBe('scheduled');
    });

    it('debe lanzar error al reprogramar un post inexistente', async () => {
      await expect(
        hook.current.reschedulePost('post-fantasma', '2026-11-01T00:00:00.000Z')
      ).rejects.toThrow('Post no encontrado: post-fantasma');
    });
  });

  // =========================================================================
  // 7. GESTIÓN DEL TOAST DE ERROR
  // =========================================================================
  describe('7. Gestión de Errores y Notificaciones', () => {
    it('debe limpiar el errorToast al invocar clearErrorToast', async () => {
      // Provocar error para establecer toast
      try {
        await hook.current.transitionPost('post-101', 'published');
      } catch {
        // Error esperado
      }

      expect(hook.current.errorToast).not.toBeNull();

      // Limpiar toast
      hook.current.clearErrorToast();
      expect(hook.current.errorToast).toBeNull();
    });
  });
});
