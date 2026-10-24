'use client';

/**
 * @file kanban-column.tsx
 * @description Columna del tablero Kanban con cabecera fija de 48px, dot cromático de estado,
 * contador y soporte de Drag & Drop con guardas visuales de transición según la FSM.
 */

import React, { useState } from 'react';
import type { PostDocument, PostState } from '@/domain/models/post.types';
import { VALID_POST_TRANSITIONS } from '@/domain/models/post.types';
import { STATE_LABELS } from '@/components/ui/badge';
import { KanbanCard } from './kanban-card';
import { cn } from '@/lib/utils';
import { ShieldAlert } from 'lucide-react';

interface KanbanColumnProps {
  state: PostState;
  posts: PostDocument[];
  onCardClick: (post: PostDocument) => void;
  onQuickTransition: (postId: string, targetState: PostState) => void;
  onDropPost: (postId: string, targetState: PostState) => void;
  allPosts: PostDocument[];
}

export function KanbanColumn({
  state,
  posts,
  onCardClick,
  onQuickTransition,
  onDropPost,
  allPosts,
}: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isInvalidTransition, setIsInvalidTransition] = useState(false);

  const statusDotColorMap: Record<PostState, string> = {
    idea: 'bg-slate-400',
    in_progress: 'bg-sky-400',
    in_review: 'bg-amber-400',
    changes_requested: 'bg-orange-400',
    approved: 'bg-emerald-400',
    scheduled: 'bg-purple-400',
    publishing: 'bg-fuchsia-400',
    published: 'bg-green-500',
    failed: 'bg-red-500',
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
    setIsInvalidTransition(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setIsInvalidTransition(false);

    const postId = e.dataTransfer.getData('text/plain');
    if (!postId) return;

    const sourcePost = allPosts.find((p) => p.id === postId);
    if (!sourcePost || sourcePost.state === state) return;

    // Verificar si la transición está permitida en la FSM
    const allowed = VALID_POST_TRANSITIONS[sourcePost.state] || [];
    if (!allowed.includes(state)) {
      setIsInvalidTransition(true);
      setTimeout(() => setIsInvalidTransition(false), 2000);
      return;
    }

    onDropPost(postId, state);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'flex flex-col w-[320px] shrink-0 rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-3 transition-all duration-150',
        isDragOver && !isInvalidTransition && 'border-primary/60 bg-primary/5 ring-2 ring-primary/20',
        isInvalidTransition && 'border-destructive/60 bg-destructive/5 ring-2 ring-destructive/20'
      )}
    >
      {/* Cabecera de Columna Fija de 48px */}
      <div className="h-12 min-h-[48px] px-2 flex items-center justify-between border-b border-border/60 mb-3 select-none">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'w-2.5 h-2.5 rounded-full shadow-xs',
              statusDotColorMap[state] || 'bg-slate-400'
            )}
          />
          <h3 className="font-semibold text-sm text-foreground tracking-tight">
            {STATE_LABELS[state]}
          </h3>
        </div>

        <span className="px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-secondary text-muted-foreground border border-border">
          {posts.length}
        </span>
      </div>

      {/* Alerta de Guarda FSM Violada durante Drag & Drop */}
      {isInvalidTransition && (
        <div className="mb-2 p-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-1.5 animate-in fade-in-0 duration-150">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Transición no permitida por la FSM</span>
        </div>
      )}

      {/* Lista de Tarjetas con Scroll Interno Elegante */}
      <div className="flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-280px)] pr-1 pb-2">
        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center border border-dashed border-border/80 rounded-xl bg-secondary/10">
            <p className="text-xs text-muted-foreground font-medium">
              Sin publicaciones
            </p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">
              Arrastra un post aquí
            </p>
          </div>
        ) : (
          posts.map((post) => (
            <KanbanCard
              key={post.id}
              post={post}
              onClick={onCardClick}
              onQuickTransition={onQuickTransition}
            />
          ))
        )}
      </div>
    </div>
  );
}
