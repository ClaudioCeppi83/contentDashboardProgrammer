'use client';

/**
 * @file client-portal-view.tsx
 * @description Vista principal orquestadora del Portal de Aprobación de Cliente (/portal/[clientId]).
 * - Aislamiento estricto multicliente por clientId recibido.
 * - Pestañas de filtrado: Pendientes de Aprobación, Aprobados y Programados, Historial y Cambios.
 * - Acciones de 1 clic (Aprobar / Solicitar Cambios) con FeedbackModal e integración con la FSM canónica.
 * - Enfoque Mobile-First, accesibilidad WCAG y retroalimentación reactiva inmediata.
 */

import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Clock,
  RotateCcw,
  Search,
  Sparkles,
  ShieldCheck,
  Filter,
  Check,
  AlertCircle,
  X,
  Bell,
} from 'lucide-react';
import { usePosts } from '@/application/hooks/use-posts';
import type { PostDocument } from '@/domain/models/post.types';
import { FeedbackModal } from '@/components/modals/feedback-modal';
import { ClientPortalHeader } from './client-portal-header';
import { ClientPostCard } from './client-post-card';
import { ClientPortalEmpty } from './client-portal-empty';
import {
  getClientProfile,
  TAB_STATES,
  type ClientPortalTab,
} from './client-portal-types';
import { cn } from '@/lib/utils';

interface ClientPortalViewProps {
  clientId: string;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'error';
  title: string;
  message: string;
}

export function ClientPortalView({ clientId }: ClientPortalViewProps) {
  const client = useMemo(() => getClientProfile(clientId), [clientId]);

  const {
    posts,
    transitionPost,
    isMutating,
    errorToast,
    clearErrorToast,
  } = usePosts();

  // Estados de interfaz del portal
  const [activeTab, setActiveTab] = useState<ClientPortalTab>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Estados del modal de feedback
  const [selectedPostForChanges, setSelectedPostForChanges] = useState<PostDocument | null>(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  // 1. Filtrado de Aislamiento Multicliente: posts pertenecientes exclusivamente a este clientId
  const clientPosts = useMemo(() => {
    return posts.filter((post) => post.clientId.toLowerCase() === clientId.toLowerCase());
  }, [posts, clientId]);

  // Contadores reactivos por pestaña para este cliente
  const pendingCount = useMemo(() => {
    return clientPosts.filter((p) => p.state === 'in_review').length;
  }, [clientPosts]);

  const approvedScheduledCount = useMemo(() => {
    return clientPosts.filter((p) => p.state === 'approved' || p.state === 'scheduled').length;
  }, [clientPosts]);

  const historyChangesCount = useMemo(() => {
    return clientPosts.filter((p) => p.state === 'published' || p.state === 'changes_requested').length;
  }, [clientPosts]);

  // 2. Posts filtrados por la pestaña activa
  const tabPosts = useMemo(() => {
    const allowedStates = TAB_STATES[activeTab];
    return clientPosts.filter((post) => allowedStates.includes(post.state));
  }, [clientPosts, activeTab]);

  // 3. Posts filtrados adicionalmente por búsqueda textual
  const finalFilteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return tabPosts;
    const query = searchQuery.toLowerCase().trim();
    return tabPosts.filter((post) => {
      const matchTitle = post.title.toLowerCase().includes(query);
      const matchCaption = post.copy.caption.toLowerCase().includes(query);
      const matchHashtags = post.copy.hashtags.some((tag) => tag.toLowerCase().includes(query));
      return matchTitle || matchCaption || matchHashtags;
    });
  }, [tabPosts, searchQuery]);

  // Helper para mostrar feedback toast auto-removible
  const showToast = (type: 'success' | 'warning' | 'error', title: string, message: string) => {
    const id = Date.now().toString();
    setToast({ id, type, title, message });
    setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 4500);
  };

  // Manejo de Aprobación de 1 Clic
  const handleApprove = async (postId: string) => {
    try {
      await transitionPost(postId, 'approved', {
        comment: {
          authorRole: 'client',
          authorId: clientId,
          content: 'Publicación revisada y aprobada por el cliente.',
        },
      });
      showToast(
        'success',
        '¡Publicación Aprobada!',
        'El equipo de contenidos ha sido notificado para agendar el despacho en Instagram.'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al procesar la aprobación.';
      showToast('error', 'Error en la transición', msg);
    }
  };

  // Apertura de modal para solicitar cambios
  const handleOpenRequestChanges = (post: PostDocument) => {
    setSelectedPostForChanges(post);
    setIsFeedbackModalOpen(true);
  };

  // Confirmación de feedback en modal
  const handleConfirmFeedback = async (feedbackText: string) => {
    if (!selectedPostForChanges) return;
    setIsSubmittingFeedback(true);
    try {
      await transitionPost(selectedPostForChanges.id, 'changes_requested', {
        feedback: feedbackText,
        comment: {
          authorRole: 'client',
          authorId: clientId,
          content: feedbackText,
        },
      });
      setIsFeedbackModalOpen(false);
      setSelectedPostForChanges(null);
      showToast(
        'warning',
        'Cambios Solicitados',
        'Se han remitido las observaciones al Community Manager para realizar las correcciones.'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al solicitar cambios.';
      showToast('error', 'Error en la transición', msg);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased selection:bg-primary/20 selection:text-primary">
      {/* 1. Header Ejecutivo con Logo, Nombre de Marca, Badge de Pendientes e Indicador Seguro */}
      <ClientPortalHeader
        client={client}
        pendingCount={pendingCount}
        totalClientPosts={clientPosts.length}
      />

      {/* 2. Banner de Toast Notificador Reactivo */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div
            className={cn(
              'p-4 rounded-xl shadow-2xl border flex items-start gap-3 backdrop-blur-md',
              toast.type === 'success' && 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200',
              toast.type === 'warning' && 'bg-amber-950/90 border-amber-500/40 text-amber-200',
              toast.type === 'error' && 'bg-rose-950/90 border-rose-500/40 text-rose-200'
            )}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
            {toast.type === 'warning' && <RotateCcw className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold text-white tracking-tight">{toast.title}</h4>
              <p className="text-[11px] text-white/80 mt-0.5 leading-snug">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-white/60 hover:text-white p-1 -mr-1 -mt-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Contenedor Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Caso Aislamiento: Cliente sin publicaciones registradas */}
        {clientPosts.length === 0 ? (
          <ClientPortalEmpty
            type="client_empty"
            clientId={clientId}
            clientName={client.name}
          />
        ) : (
          <>
            {/* 4. Barra de Navegación por Pestañas + Buscador */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/80">
              {/* Pestañas de filtrado para el cliente con badges de contador */}
              <nav
                aria-label="Pestañas de publicaciones"
                className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1"
              >
                {/* Pestaña: Pendientes de Aprobación */}
                <button
                  type="button"
                  onClick={() => setActiveTab('pending')}
                  className={cn(
                    'tap-target-48 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 flex items-center gap-2 shrink-0 select-none cursor-pointer',
                    activeTab === 'pending'
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60 border border-transparent'
                  )}
                >
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <span>Pendientes de Aprobación</span>
                  <span
                    className={cn(
                      'px-2 py-0.5 text-xs font-mono font-bold rounded-full',
                      pendingCount > 0
                        ? 'bg-amber-500 text-black font-semibold'
                        : 'bg-secondary text-muted-foreground'
                    )}
                  >
                    {pendingCount}
                  </span>
                </button>

                {/* Pestaña: Aprobados y Programados */}
                <button
                  type="button"
                  onClick={() => setActiveTab('approved_scheduled')}
                  className={cn(
                    'tap-target-48 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 flex items-center gap-2 shrink-0 select-none cursor-pointer',
                    activeTab === 'approved_scheduled'
                      ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30 shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60 border border-transparent'
                  )}
                >
                  <Clock className="w-4 h-4 text-purple-400" />
                  <span>Aprobados y Programados</span>
                  <span className="px-2 py-0.5 text-xs font-mono font-medium rounded-full bg-secondary text-muted-foreground">
                    {approvedScheduledCount}
                  </span>
                </button>

                {/* Pestaña: Historial y Cambios */}
                <button
                  type="button"
                  onClick={() => setActiveTab('history_changes')}
                  className={cn(
                    'tap-target-48 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 flex items-center gap-2 shrink-0 select-none cursor-pointer',
                    activeTab === 'history_changes'
                      ? 'bg-secondary text-foreground border border-border shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60 border border-transparent'
                  )}
                >
                  <RotateCcw className="w-4 h-4 text-muted-foreground" />
                  <span>Historial y Cambios</span>
                  <span className="px-2 py-0.5 text-xs font-mono font-medium rounded-full bg-secondary text-muted-foreground">
                    {historyChangesCount}
                  </span>
                </button>
              </nav>

              {/* Buscador reactivo dentro de la pestaña */}
              <div className="relative w-full md:w-64 shrink-0">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar en esta vista..."
                  className="w-full h-10 pl-9 pr-8 text-xs bg-secondary/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:bg-secondary focus:border-primary transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-1"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* 5. Lista de Publicaciones según Pestaña y Filtro */}
            {finalFilteredPosts.length === 0 ? (
              searchQuery ? (
                <ClientPortalEmpty
                  type="search_empty"
                  onResetSearch={() => setSearchQuery('')}
                />
              ) : (
                <ClientPortalEmpty
                  type="tab_empty"
                  tab={activeTab}
                  onSwitchTab={(t) => setActiveTab(t)}
                />
              )
            ) : (
              <div className="space-y-6">
                {finalFilteredPosts.map((post) => (
                  <ClientPostCard
                    key={post.id}
                    post={post}
                    client={client}
                    onApprove={handleApprove}
                    onRequestChanges={handleOpenRequestChanges}
                    isMutating={isMutating}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* 6. Modal Interceptor de Retroalimentación de Cambios (FeedbackModal) */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        postTitle={selectedPostForChanges?.title || 'Publicación'}
        onClose={() => {
          setIsFeedbackModalOpen(false);
          setSelectedPostForChanges(null);
        }}
        onConfirm={handleConfirmFeedback}
        isSubmitting={isSubmittingFeedback}
      />
    </div>
  );
}
