'use client';

/**
 * @file kanban-card.tsx
 * @description Tarjeta de post para el tablero Kanban con thumbnail multimedia,
 * badge de ratio nativo, extracto de caption, fecha programada y atajos de transición de estado.
 */

import React from 'react';
import { Calendar, ChevronRight, MessageSquare, AlertCircle } from 'lucide-react';
import type { PostDocument, PostState } from '@/domain/models/post.types';
import { VALID_POST_TRANSITIONS } from '@/domain/models/post.types';
import { FormatBadge, STATE_LABELS } from '@/components/ui/badge';

interface KanbanCardProps {
  post: PostDocument;
  onClick: (post: PostDocument) => void;
  onQuickTransition?: (postId: string, targetState: PostState) => void;
  onDragStart?: (e: React.DragEvent, postId: string) => void;
}

export function KanbanCard({
  post,
  onClick,
  onQuickTransition,
  onDragStart,
}: KanbanCardProps) {
  const allowedTransitions = VALID_POST_TRANSITIONS[post.state] || [];
  const primaryMedia = post.media[0];

  const formattedScheduledDate = post.scheduledAt
    ? new Date(post.scheduledAt).toLocaleDateString('es-ES', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', post.id);
        if (onDragStart) onDragStart(e, post.id);
      }}
      onClick={() => onClick(post)}
      className="group relative rounded-xl border border-border bg-card p-3.5 shadow-sm hover:border-primary/50 hover:bg-secondary/40 transition-all duration-150 ease-out cursor-grab active:cursor-grabbing space-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      tabIndex={0}
      role="button"
      aria-label={`Editar post: ${post.title}`}
    >
      {/* Thumbnail Multimedia Superior y Badges de Formato */}
      {primaryMedia && (
        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-secondary/60 border border-border/50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={primaryMedia.downloadUrl}
            alt={post.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute top-2 left-2 flex items-center gap-1.5 shadow-md">
            <FormatBadge
              format={post.format}
              aspectRatio={primaryMedia.aspectRatio}
              slideCount={post.format === 'carousel' ? post.media.length : undefined}
            />
          </div>
          {primaryMedia.durationSeconds && (
            <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono bg-background/80 text-foreground font-semibold backdrop-blur-xs">
              {primaryMedia.durationSeconds}s
            </span>
          )}
        </div>
      )}

      {/* Título y Extracto de Caption */}
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
          {post.title}
        </h4>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {post.copy.caption || post.briefingScript || 'Sin caption redactado aún.'}
        </p>
      </div>

      {/* Metadatos Inferiores: Fecha Agendada & Comentarios */}
      <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs text-muted-foreground">
        {formattedScheduledDate ? (
          <div className="inline-flex items-center gap-1 font-mono text-[11px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
            <Calendar className="w-3 h-3" />
            <span>{formattedScheduledDate}</span>
          </div>
        ) : (
          <span className="text-[11px] font-mono text-muted-foreground/70">
            Sin fecha agendada
          </span>
        )}

        {post.comments.length > 0 && (
          <div className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
            <MessageSquare className="w-3 h-3" />
            <span>{post.comments.length}</span>
          </div>
        )}
      </div>

      {/* Atajos de Transición Directa FSM */}
      {allowedTransitions.length > 0 && onQuickTransition && (
        <div
          className="pt-2 flex flex-wrap items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {allowedTransitions.map((nextState) => (
            <button
              key={nextState}
              type="button"
              onClick={() => onQuickTransition(post.id, nextState)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-secondary/80 hover:bg-primary hover:text-white border border-border transition-all duration-100 cursor-pointer"
            >
              <span>Avanzar a {STATE_LABELS[nextState]}</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          ))}
        </div>
      )}

      {/* Indicador de Error si estado es failed */}
      {post.state === 'failed' && (
        <div className="inline-flex items-center gap-1 text-[11px] text-destructive bg-destructive/10 px-2 py-1 rounded w-full border border-destructive/20 font-medium">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Error de publicación en Instagram API</span>
        </div>
      )}
    </div>
  );
}
