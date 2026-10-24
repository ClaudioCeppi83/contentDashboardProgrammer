'use client';

/**
 * @file use-posts.ts
 * @description Hook reactivo para la gestión de publicaciones de Instagram con mutaciones optimistas,
 * filtrado multidimensional, integración con PostFsmService y persistencia en memoria/localStorage.
 */

import { useState, useMemo, useCallback } from 'react';
import type {
  PostDocument,
  PostState,
  InstagramFormat,
} from '@/domain/models/post.types';
import { PostFsmService, type TransitionPayload } from '@/application/services/post-fsm.service';

const INITIAL_MOCK_POSTS: PostDocument[] = [
  {
    id: 'post-101',
    clientId: 'client-lumina',
    authorId: 'cm-clara',
    title: 'Teaser Campaña Primavera 2026',
    briefingScript: 'Generar expectativa sobre el drop de primavera con enfoque minimalista.',
    state: 'idea',
    platform: 'instagram',
    format: 'feed_post',
    copy: {
      caption: 'Algo nuevo está floreciendo. Menos ruido, más presencia. Espéralo este jueves. 🌱✨',
      characterCount: 81,
      characterLimit: 2200,
      hashtags: ['#primavera2026', '#minimalismo', '#nuevacoleccion'],
      firstComment: '#streetwear #sustainablefashion #designinspiration #estilo',
      isValid: true,
    },
    media: [
      {
        id: 'media-101',
        storagePath: 'posts/post-101/spring-teaser.jpg',
        downloadUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1080&auto=format&fit=crop&q=80',
        mimeType: 'image/jpeg',
        sizeBytes: 1.8 * 1024 * 1024,
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
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z',
  },
  {
    id: 'post-102',
    clientId: 'client-lumina',
    authorId: 'cm-clara',
    title: 'Behind The Scenes: Grabación Studio Reels',
    briefingScript: 'Mostrar proceso creativo real en nuestro estudio de Madrid.',
    state: 'in_progress',
    platform: 'instagram',
    format: 'reel',
    copy: {
      caption: 'Lo que no se ve en 15 segundos: 4 horas de iluminación, 12 tomas descartadas y mucho café. 🎬 ¿Te gustaría ver el resultado final?',
      characterCount: 135,
      characterLimit: 2200,
      hashtags: ['#behindthescenes', '#creadoresdecontenido', '#reelsvideo'],
      firstComment: '#filmmaking #studiolife #creativeops #socialmediamarketing',
      isValid: true,
    },
    media: [
      {
        id: 'media-102',
        storagePath: 'posts/post-102/bts-reel.mp4',
        downloadUrl: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=1080&auto=format&fit=crop&q=80',
        mimeType: 'video/mp4',
        sizeBytes: 34 * 1024 * 1024,
        width: 1080,
        height: 1920,
        aspectRatio: '9:16',
        durationSeconds: 28,
        validationPassed: true,
      },
    ],
    scheduledAt: null,
    cloudTaskName: null,
    idempotencyKey: null,
    comments: [
      {
        id: 'comment-102-1',
        authorId: 'cm-clara',
        authorRole: 'cm',
        content: 'Editando subtítulos dinámicos y audio en tendencia.',
        createdAt: '2026-10-22T14:30:00.000Z',
        statusChangeFrom: 'idea',
        statusChangeTo: 'in_progress',
      },
    ],
    createdAt: '2026-10-21T11:00:00.000Z',
    updatedAt: '2026-10-22T14:30:00.000Z',
  },
  {
    id: 'post-103',
    clientId: 'client-lumina',
    authorId: 'cm-clara',
    title: 'Lookbook Editorial: Tonos Neutros',
    briefingScript: 'Post de feed con retrato elegante destacando la textura de los linos.',
    state: 'in_review',
    platform: 'instagram',
    format: 'feed_post',
    copy: {
      caption: 'Elegancia sin esfuerzo. La paleta de neutros que dialoga con cualquier espacio y momento del día. Desliza para apreciar los detalles artesanales. 🤍',
      characterCount: 153,
      characterLimit: 2200,
      hashtags: ['#lookbook', '#slowfashion', '#estiloneutro'],
      firstComment: '#organictextiles #consciousapparel #editorialfashion',
      isValid: true,
    },
    media: [
      {
        id: 'media-103',
        storagePath: 'posts/post-103/lookbook-portrait.jpg',
        downloadUrl: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1080&auto=format&fit=crop&q=80',
        mimeType: 'image/jpeg',
        sizeBytes: 3.2 * 1024 * 1024,
        width: 1080,
        height: 1350,
        aspectRatio: '4:5',
        validationPassed: true,
      },
    ],
    scheduledAt: null,
    cloudTaskName: null,
    idempotencyKey: null,
    comments: [
      {
        id: 'comment-103-1',
        authorId: 'cm-clara',
        authorRole: 'cm',
        content: 'Enviado para revisión de cliente. ¿Aprobamos para este viernes?',
        createdAt: '2026-10-23T09:15:00.000Z',
        statusChangeFrom: 'in_progress',
        statusChangeTo: 'in_review',
      },
    ],
    createdAt: '2026-10-22T08:00:00.000Z',
    updatedAt: '2026-10-23T09:15:00.000Z',
  },
  {
    id: 'post-104',
    clientId: 'client-lumina',
    authorId: 'cm-clara',
    title: 'Guía Carrusel: 5 Claves de Estilo Sostenible',
    briefingScript: 'Carrusel educativo de 4 diapositivas para generar guardados y compartidos.',
    state: 'changes_requested',
    platform: 'instagram',
    format: 'carousel',
    copy: {
      caption: 'Construir un armario cápsula no es privarse de opciones, sino multiplicar combinaciones inteligentes. Guarda esta guía para tu próxima sesión de orden. 📌👗',
      characterCount: 161,
      characterLimit: 2200,
      hashtags: ['#capsulewardrobe', '#estilosostenible', '#tipsmoda'],
      firstComment: '#modaconsciente #organizacion #minimalistwardrobe',
      isValid: true,
    },
    media: [
      {
        id: 'media-104-1',
        storagePath: 'posts/post-104/slide-1.jpg',
        downloadUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1080&auto=format&fit=crop&q=80',
        mimeType: 'image/jpeg',
        sizeBytes: 2.1 * 1024 * 1024,
        width: 1080,
        height: 1350,
        aspectRatio: '4:5',
        validationPassed: true,
      },
      {
        id: 'media-104-2',
        storagePath: 'posts/post-104/slide-2.jpg',
        downloadUrl: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=1080&auto=format&fit=crop&q=80',
        mimeType: 'image/jpeg',
        sizeBytes: 1.9 * 1024 * 1024,
        width: 1080,
        height: 1350,
        aspectRatio: '4:5',
        validationPassed: true,
      },
      {
        id: 'media-104-3',
        storagePath: 'posts/post-104/slide-3.jpg',
        downloadUrl: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=1080&auto=format&fit=crop&q=80',
        mimeType: 'image/jpeg',
        sizeBytes: 2.4 * 1024 * 1024,
        width: 1080,
        height: 1350,
        aspectRatio: '4:5',
        validationPassed: true,
      },
    ],
    scheduledAt: null,
    cloudTaskName: null,
    idempotencyKey: null,
    comments: [
      {
        id: 'comment-104-1',
        authorId: 'client-lumina',
        authorRole: 'client',
        content: 'Por favor sustituir la foto de la diapositiva 2 por una con mejor contraste de luz y acortar la primera frase.',
        createdAt: '2026-10-23T16:45:00.000Z',
        statusChangeFrom: 'in_review',
        statusChangeTo: 'changes_requested',
      },
    ],
    createdAt: '2026-10-21T15:20:00.000Z',
    updatedAt: '2026-10-23T16:45:00.000Z',
  },
  {
    id: 'post-105',
    clientId: 'client-lumina',
    authorId: 'cm-clara',
    title: 'Anuncio Colaboración con Diseñadora Invitada',
    briefingScript: 'Presentación oficial de la cápsula colaborativa de edición limitada.',
    state: 'approved',
    platform: 'instagram',
    format: 'feed_post',
    copy: {
      caption: 'Dos visiones, una sola armonía. Nos unimos a @sofia_atelier para crear piezas que desafían lo convencional. Disponible online a partir del domingo. ✨',
      characterCount: 153,
      characterLimit: 2200,
      hashtags: ['#colaboracion', '#edicionlimitada', '#disenodeautor'],
      firstComment: '#artisanat #limiteddrop #atelierfashion',
      isValid: true,
    },
    media: [
      {
        id: 'media-105',
        storagePath: 'posts/post-105/collab.jpg',
        downloadUrl: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=1080&auto=format&fit=crop&q=80',
        mimeType: 'image/jpeg',
        sizeBytes: 2.8 * 1024 * 1024,
        width: 1080,
        height: 1080,
        aspectRatio: '1:1',
        validationPassed: true,
      },
    ],
    scheduledAt: null,
    cloudTaskName: null,
    idempotencyKey: null,
    comments: [
      {
        id: 'comment-105-1',
        authorId: 'client-lumina',
        authorRole: 'client',
        content: '¡Aprobado! Excelente selección de copy y composición visual.',
        createdAt: '2026-10-24T11:00:00.000Z',
        statusChangeFrom: 'in_review',
        statusChangeTo: 'approved',
      },
    ],
    createdAt: '2026-10-22T12:00:00.000Z',
    updatedAt: '2026-10-24T11:00:00.000Z',
  },
  {
    id: 'post-106',
    clientId: 'client-lumina',
    authorId: 'cm-clara',
    title: 'Reel Rápido: 3 Maneras de Combinar un Blazer',
    briefingScript: 'Formato dinámico estilo Reels con transiciones rítmicas al compás de la música.',
    state: 'scheduled',
    platform: 'instagram',
    format: 'reel',
    copy: {
      caption: 'Una sola prenda, tres personalidades totalmente distintas: Casual Chic, Reunión de Negocios y Cena de Viernes. ¿Cuál va más con tu estilo? 👇',
      characterCount: 147,
      characterLimit: 2200,
      hashtags: ['#reelsmoda', '#blazerstyle', '#outfitoftheday'],
      firstComment: '#fashionreels #howtostyle #capsulestyle #streetstyle',
      isValid: true,
    },
    media: [
      {
        id: 'media-106',
        storagePath: 'posts/post-106/blazer-reel.mp4',
        downloadUrl: 'https://images.unsplash.com/photo-1550614000-4895a10e1bfd?w=1080&auto=format&fit=crop&q=80',
        mimeType: 'video/mp4',
        sizeBytes: 42 * 1024 * 1024,
        width: 1080,
        height: 1920,
        aspectRatio: '9:16',
        durationSeconds: 45,
        validationPassed: true,
      },
    ],
    scheduledAt: '2026-10-28T18:30:00.000Z',
    cloudTaskName: 'projects/social-ops/locations/europe-west1/queues/instagram-dispatch/tasks/task-reel-106',
    idempotencyKey: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    comments: [
      {
        id: 'comment-106-1',
        authorId: 'cm-clara',
        authorRole: 'cm',
        content: 'Programado en Google Cloud Tasks para el 28 de Octubre a las 18:30 CET.',
        createdAt: '2026-10-24T12:00:00.000Z',
        statusChangeFrom: 'approved',
        statusChangeTo: 'scheduled',
      },
    ],
    createdAt: '2026-10-23T10:00:00.000Z',
    updatedAt: '2026-10-24T12:00:00.000Z',
  },
  {
    id: 'post-107',
    clientId: 'client-lumina',
    authorId: 'cm-clara',
    title: 'Manifiesto de Marca: La Belleza de lo Auténtico',
    briefingScript: 'Post de feed con imagen de alta definición y declaración de principios.',
    state: 'published',
    platform: 'instagram',
    format: 'feed_post',
    copy: {
      caption: 'Creemos en prendas que cuentan historias y resisten el paso de las temporadas. Menos modas fugaces, más durabilidad emocional. Gracias por acompañarnos en este camino. 🌿',
      characterCount: 172,
      characterLimit: 2200,
      hashtags: ['#manifiesto', '#slowfashionmovement', '#autenticidad'],
      firstComment: '#sustentabilidad #ethicalfashion #slowliving #textiledesign',
      isValid: true,
    },
    media: [
      {
        id: 'media-107',
        storagePath: 'posts/post-107/manifesto.jpg',
        downloadUrl: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1080&auto=format&fit=crop&q=80',
        mimeType: 'image/jpeg',
        sizeBytes: 2.2 * 1024 * 1024,
        width: 1080,
        height: 1080,
        aspectRatio: '1:1',
        validationPassed: true,
      },
    ],
    scheduledAt: '2026-10-24T16:00:00.000Z',
    publishedAt: '2026-10-24T16:00:15.000Z',
    publishResult: {
      mediaContainerId: 'container-987654321',
      mediaId: '17998877665544',
      permalink: 'https://instagram.com/p/DB123456789',
    },
    comments: [],
    createdAt: '2026-10-20T09:00:00.000Z',
    updatedAt: '2026-10-24T16:00:15.000Z',
  },
];

export interface PostsFilterState {
  searchQuery: string;
  stateFilter: PostState | 'all';
  formatFilter: InstagramFormat | 'all';
}

export function usePosts() {
  const [posts, setPosts] = useState<PostDocument[]>(INITIAL_MOCK_POSTS);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stateFilter, setStateFilter] = useState<PostState | 'all'>('all');
  const [formatFilter, setFormatFilter] = useState<InstagramFormat | 'all'>('all');
  const [isMutating, setIsMutating] = useState<boolean>(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const fsmService = useMemo(() => new PostFsmService(), []);

  // Filtrado reactivo de posts
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      // Filtro por Estado FSM
      if (stateFilter !== 'all' && post.state !== stateFilter) {
        return false;
      }

      // Filtro por Formato Instagram
      if (formatFilter !== 'all' && post.format !== formatFilter) {
        return false;
      }

      // Filtro de Búsqueda reactiva (título, caption, hashtags)
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        const titleMatch = post.title.toLowerCase().includes(query);
        const captionMatch = post.copy.caption.toLowerCase().includes(query);
        const hashtagMatch = post.copy.hashtags.some((tag) => tag.toLowerCase().includes(query));
        if (!titleMatch && !captionMatch && !hashtagMatch) {
          return false;
        }
      }

      return true;
    });
  }, [posts, stateFilter, formatFilter, searchQuery]);

  // Métricas reactivas agregadas
  const metrics = useMemo(() => {
    const total = posts.length;
    const byState: Record<PostState, number> = {
      idea: 0,
      in_progress: 0,
      in_review: 0,
      changes_requested: 0,
      approved: 0,
      scheduled: 0,
      publishing: 0,
      published: 0,
      failed: 0,
    };
    const byFormat: Record<InstagramFormat, number> = {
      feed_post: 0,
      carousel: 0,
      reel: 0,
    };

    posts.forEach((p) => {
      byState[p.state] = (byState[p.state] || 0) + 1;
      byFormat[p.format] = (byFormat[p.format] || 0) + 1;
    });

    return { total, byState, byFormat };
  }, [posts]);

  // Transición FSM con Mutación Optimista y Rollback garantizado
  const transitionPost = useCallback(
    async (
      id: string,
      targetState: PostState,
      payload?: TransitionPayload
    ): Promise<PostDocument> => {
      setIsMutating(true);
      setErrorToast(null);

      // 1. Snapshot del estado previo para rollback exacto
      const previousPostsSnapshot = [...posts];
      const targetPost = posts.find((p) => p.id === id);

      if (!targetPost) {
        setIsMutating(false);
        const err = `Post no encontrado: ${id}`;
        setErrorToast(err);
        throw new Error(err);
      }

      try {
        // 2. Validación y cálculo de transición mediante PostFsmService (SSoT)
        const updatedPost = fsmService.transition(targetPost, targetState, payload);

        // 3. Mutación optimista inmediata en el estado local
        setPosts((prev) => prev.map((p) => (p.id === id ? updatedPost : p)));
        setIsMutating(false);
        return updatedPost;
      } catch (err: unknown) {
        // 4. Rollback verbatim al snapshot previo en caso de error o violación de guardas
        setPosts(previousPostsSnapshot);
        setIsMutating(false);
        const message = err instanceof Error ? err.message : 'Error al procesar la transición de estado.';
        setErrorToast(message);
        throw err;
      }
    },
    [posts, fsmService]
  );

  // Crear nuevo Post con mutación optimista
  const createPost = useCallback(
    async (postData: Partial<PostDocument>): Promise<PostDocument> => {
      setIsMutating(true);
      setErrorToast(null);

      const now = new Date().toISOString();
      const newPost: PostDocument = {
        id: `post-${Date.now().toString(36)}`,
        clientId: postData.clientId || 'client-lumina',
        authorId: postData.authorId || 'cm-clara',
        title: postData.title || 'Nueva Publicación',
        briefingScript: postData.briefingScript || '',
        state: 'idea',
        platform: 'instagram',
        format: postData.format || 'feed_post',
        copy: postData.copy || {
          caption: '',
          characterCount: 0,
          characterLimit: 2200,
          hashtags: [],
          firstComment: '',
          isValid: true,
        },
        media: postData.media || [],
        scheduledAt: null,
        cloudTaskName: null,
        idempotencyKey: null,
        comments: [],
        createdAt: now,
        updatedAt: now,
      };

      setPosts((prev) => [newPost, ...prev]);
      setIsMutating(false);
      return newPost;
    },
    []
  );

  // Actualizar Post existente (optimista)
  const updatePost = useCallback(
    async (id: string, updates: Partial<PostDocument>): Promise<PostDocument> => {
      setIsMutating(true);
      setErrorToast(null);
      const previousPostsSnapshot = [...posts];

      const current = posts.find((p) => p.id === id);
      if (!current) {
        setIsMutating(false);
        const err = `Post no encontrado: ${id}`;
        setErrorToast(err);
        throw new Error(err);
      }

      const updated: PostDocument = {
        ...current,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      try {
        setPosts((prev) => prev.map((p) => (p.id === id ? updated : p)));
        setIsMutating(false);
        return updated;
      } catch (err: unknown) {
        setPosts(previousPostsSnapshot);
        setIsMutating(false);
        const message = err instanceof Error ? err.message : 'Error al actualizar el post.';
        setErrorToast(message);
        throw err;
      }
    },
    [posts]
  );

  // Reprogramar fecha (Drag & Drop en Calendario Editorial)
  const reschedulePost = useCallback(
    async (id: string, newDateIso: string): Promise<PostDocument> => {
      const targetPost = posts.find((p) => p.id === id);
      if (!targetPost) {
        throw new Error(`Post no encontrado: ${id}`);
      }

      // Si está en 'approved', transiciona a 'scheduled' con la nueva fecha
      if (targetPost.state === 'approved') {
        return transitionPost(id, 'scheduled', { scheduledAt: newDateIso });
      }

      // Si ya está agendado, actualiza la fecha de agenda directamente
      return updatePost(id, { scheduledAt: newDateIso });
    },
    [posts, transitionPost, updatePost]
  );

  // Eliminar post
  const deletePost = useCallback(async (id: string): Promise<void> => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return {
    posts,
    filteredPosts,
    searchQuery,
    setSearchQuery,
    stateFilter,
    setStateFilter,
    formatFilter,
    setFormatFilter,
    metrics,
    isMutating,
    errorToast,
    clearErrorToast: () => setErrorToast(null),
    transitionPost,
    createPost,
    updatePost,
    reschedulePost,
    deletePost,
  };
}
