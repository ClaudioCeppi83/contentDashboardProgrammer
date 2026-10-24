'use client';

/**
 * @file dashboard-view.tsx
 * @description Vista principal orquestadora del Social Ops Dashboard:
 * Integra el Header con KPIs, la Toolbar de filtrado multidimensional, el conmutador
 * de vistas (Kanban, Calendario Editorial, Tabla), el Post Drawer lateral de 50/50
 * y los modales interceptores de la FSM (FeedbackModal para changes_requested y ScheduleModal).
 */

import React, { useState } from 'react';
import { usePosts } from '@/application/hooks/use-posts';
import { DashboardHeader } from './dashboard-header';
import { DashboardToolbar, type DashboardViewMode } from './dashboard-toolbar';
import { KanbanBoard } from '@/components/kanban/kanban-board';
import { EditorialCalendar } from '@/components/calendar/editorial-calendar';
import { PostTableView } from '@/components/table/post-table-view';
import { PostDrawer } from '@/components/drawer/post-drawer';
import { FeedbackModal } from '@/components/modals/feedback-modal';
import { ScheduleModal } from '@/components/modals/schedule-modal';
import type { PostDocument, PostState } from '@/domain/models/post.types';
import { AlertCircle, X } from 'lucide-react';

interface PendingTransition {
  postId: string;
  targetState: PostState;
  postTitle: string;
  currentScheduledAt?: string | null;
}

export function DashboardView() {
  const {
    posts,
    filteredPosts,
    searchQuery,
    setSearchQuery,
    stateFilter,
    setStateFilter,
    formatFilter,
    setFormatFilter,
    metrics,
    errorToast,
    clearErrorToast,
    transitionPost,
    createPost,
    updatePost,
    reschedulePost,
    deletePost,
  } = usePosts();

  const [currentView, setCurrentView] = useState<DashboardViewMode>('kanban');
  const [selectedPost, setSelectedPost] = useState<PostDocument | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Estados para modales interceptores de FSM
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isSubmittingModal, setIsSubmittingModal] = useState(false);

  // Abrir Drawer para editar post existente
  const handleOpenEdit = (post: PostDocument) => {
    setSelectedPost(post);
    setIsDrawerOpen(true);
  };

  // Crear nuevo post y abrir Drawer de inmediato
  const handleNewPost = async () => {
    try {
      const newPost = await createPost({
        title: 'Nueva Publicación de Instagram',
        format: 'feed_post',
        state: 'idea',
        copy: {
          caption: '',
          characterCount: 0,
          characterLimit: 2200,
          hashtags: [],
          firstComment: '',
          isValid: true,
        },
        media: [
          {
            id: `media-initial-${Date.now()}`,
            storagePath: 'posts/initial/placeholder.jpg',
            downloadUrl:
              'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1080&auto=format&fit=crop&q=80',
            mimeType: 'image/jpeg',
            sizeBytes: 1.2 * 1024 * 1024,
            width: 1080,
            height: 1080,
            aspectRatio: '1:1',
            validationPassed: true,
          },
        ],
      });
      setSelectedPost(newPost);
      setIsDrawerOpen(true);
    } catch (err) {
      console.warn('Error al crear post:', err);
    }
  };

  // Guardar cambios desde el Drawer
  const handleSavePost = async (updatedPost: PostDocument) => {
    try {
      await updatePost(updatedPost.id, updatedPost);
      setSelectedPost(updatedPost);
    } catch (err) {
      console.warn('Error al guardar post:', err);
    }
  };

  // Transición FSM con interceptores interactivos y manejo de errores blindado
  const handleTransition = async (
    postId: string,
    targetState: PostState,
    payload?: { feedback?: string; scheduledAt?: string }
  ) => {
    const targetPost = posts.find((p) => p.id === postId);
    const postTitle = targetPost?.title || 'Publicación';

    // 1. Interceptar 'changes_requested' si no hay feedback provisto
    if (targetState === 'changes_requested' && (!payload?.feedback || !payload.feedback.trim())) {
      setPendingTransition({
        postId,
        targetState,
        postTitle,
      });
      setIsFeedbackModalOpen(true);
      return;
    }

    // 2. Interceptar 'scheduled' si no hay fecha válida futura (> now + 2 min)
    if (targetState === 'scheduled') {
      const proposedTimeStr = payload?.scheduledAt || targetPost?.scheduledAt;
      const proposedTimestamp = proposedTimeStr ? new Date(proposedTimeStr).getTime() : 0;
      const minValidTimestamp = Date.now() + 2 * 60 * 1000;

      if (!proposedTimestamp || isNaN(proposedTimestamp) || proposedTimestamp <= minValidTimestamp) {
        setPendingTransition({
          postId,
          targetState,
          postTitle,
          currentScheduledAt: targetPost?.scheduledAt,
        });
        setIsScheduleModalOpen(true);
        return;
      }
    }

    // 3. Ejecución protegida de la transición en la FSM
    try {
      const updated = await transitionPost(postId, targetState, payload);
      if (selectedPost && selectedPost.id === postId) {
        setSelectedPost(updated);
      }
    } catch (err) {
      // usePosts captura el error y lo expone en errorToast sin romper el render de React
      console.warn('Transición FSM no permitida:', err);
    }
  };

  // Confirmar feedback desde el modal
  const handleConfirmFeedback = async (feedbackText: string) => {
    if (!pendingTransition) return;
    const { postId, targetState } = pendingTransition;
    setIsSubmittingModal(true);
    try {
      const updated = await transitionPost(postId, targetState, { feedback: feedbackText });
      if (selectedPost && selectedPost.id === postId) {
        setSelectedPost(updated);
      }
      setIsFeedbackModalOpen(false);
      setPendingTransition(null);
    } catch (err) {
      console.warn('Error al confirmar feedback en FSM:', err);
    } finally {
      setIsSubmittingModal(false);
    }
  };

  // Confirmar agendamiento desde el modal
  const handleConfirmSchedule = async (scheduledAtIso: string) => {
    if (!pendingTransition) return;
    const { postId, targetState } = pendingTransition;
    setIsSubmittingModal(true);
    try {
      const updated = await transitionPost(postId, targetState, { scheduledAt: scheduledAtIso });
      if (selectedPost && selectedPost.id === postId) {
        setSelectedPost(updated);
      }
      setIsScheduleModalOpen(false);
      setPendingTransition(null);
    } catch (err) {
      console.warn('Error al agendar en FSM:', err);
    } finally {
      setIsSubmittingModal(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* 1. Header con Resumen de KPIs & + Nuevo Post */}
      <DashboardHeader onNewPost={handleNewPost} metrics={metrics} />

      {/* 2. Barra de Control de Página (Buscador, Filtros y Switch de Vistas) */}
      <DashboardToolbar
        currentView={currentView}
        onViewChange={setCurrentView}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        stateFilter={stateFilter}
        onStateFilterChange={setStateFilter}
        formatFilter={formatFilter}
        onFormatFilterChange={setFormatFilter}
        totalFilteredCount={filteredPosts.length}
        totalCount={posts.length}
      />

      {/* Toast Notificación de Error FSM / Validaciones */}
      {errorToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md p-4 rounded-xl border border-destructive/40 bg-card text-foreground shadow-2xl flex items-start gap-3 animate-in slide-in-from-bottom duration-200">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <p className="font-semibold text-destructive">Error en la operación</p>
            <p className="text-muted-foreground mt-0.5 leading-relaxed">{errorToast}</p>
          </div>
          <button
            type="button"
            onClick={clearErrorToast}
            aria-label="Cerrar notificación"
            className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. Área Principal de Contenido según la Vista Activa */}
      <main className="flex-1 py-4">
        {currentView === 'kanban' && (
          <KanbanBoard
            posts={filteredPosts}
            onCardClick={handleOpenEdit}
            onTransition={handleTransition}
          />
        )}

        {currentView === 'calendar' && (
          <EditorialCalendar
            posts={filteredPosts}
            onPostClick={handleOpenEdit}
            onReschedulePost={reschedulePost}
          />
        )}

        {currentView === 'table' && (
          <PostTableView
            posts={filteredPosts}
            onEditPost={handleOpenEdit}
            onTransitionPost={handleTransition}
            onDeletePost={deletePost}
          />
        )}
      </main>

      {/* 4. Post Drawer Lateral (Split Panel 50/50 & Instagram Mockup) */}
      <PostDrawer
        post={selectedPost}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSave={handleSavePost}
        onTransition={handleTransition}
      />

      {/* 5. Modales Interceptores de la FSM */}
      {pendingTransition && isFeedbackModalOpen && (
        <FeedbackModal
          isOpen={isFeedbackModalOpen}
          postTitle={pendingTransition.postTitle}
          onClose={() => {
            setIsFeedbackModalOpen(false);
            setPendingTransition(null);
          }}
          onConfirm={handleConfirmFeedback}
          isSubmitting={isSubmittingModal}
        />
      )}

      {pendingTransition && isScheduleModalOpen && (
        <ScheduleModal
          isOpen={isScheduleModalOpen}
          postTitle={pendingTransition.postTitle}
          currentScheduledAt={pendingTransition.currentScheduledAt}
          onClose={() => {
            setIsScheduleModalOpen(false);
            setPendingTransition(null);
          }}
          onConfirm={handleConfirmSchedule}
          isSubmitting={isSubmittingModal}
        />
      )}
    </div>
  );
}
