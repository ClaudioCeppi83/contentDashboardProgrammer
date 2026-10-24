'use client';

/**
 * @file client-post-card.tsx
 * @description Tarjeta de presentación de publicación para el Portal de Aprobación de Cliente.
 * Incluye mockup fidedigno de Instagram (Feed 1:1, 4:5, Reel 9:16 o Carrusel táctil),
 * desglose legible de copy y hashtags, acordeón de historial de feedback entre CM y Cliente,
 * y acciones ergonómicas de 1 clic (Aprobar con verde esmeralda / Solicitar cambios con ámbar).
 */

import React, { useState } from 'react';
import {
  CheckCircle2,
  RotateCcw,
  MessageSquare,
  Clock,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileText,
  Pin,
  ExternalLink,
  ShieldAlert,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import type { PostDocument } from '@/domain/models/post.types';
import { StateBadge, FormatBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IgFeedPostPreview } from '@/components/instagram-preview/ig-feed-post-preview';
import type { ClientProfile } from './client-portal-types';
import { formatPortalDate } from './client-portal-types';
import { cn } from '@/lib/utils';

interface ClientPostCardProps {
  post: PostDocument;
  client: ClientProfile;
  onApprove: (postId: string) => Promise<void>;
  onRequestChanges: (post: PostDocument) => void;
  isMutating?: boolean;
}

export function ClientPostCard({
  post,
  client,
  onApprove,
  onRequestChanges,
  isMutating = false,
}: ClientPostCardProps) {
  const [isCommentsExpanded, setIsCommentsExpanded] = useState(
    post.state === 'changes_requested' || post.comments.length > 0
  );
  const [isLocalApproving, setIsLocalApproving] = useState(false);

  const isPendingReview = post.state === 'in_review';
  const hasComments = post.comments && post.comments.length > 0;

  // Manejo de aprobación directa con feedback táctil inmediato
  const handleApproveClick = async () => {
    if (isMutating || isLocalApproving) return;
    setIsLocalApproving(true);
    try {
      await onApprove(post.id);
    } finally {
      setIsLocalApproving(false);
    }
  };

  return (
    <article
      className={cn(
        'w-full rounded-2xl border bg-card text-card-foreground shadow-lg transition-all duration-200 overflow-hidden',
        isPendingReview
          ? 'border-border/90 hover:border-primary/40 shadow-xl'
          : 'border-border/60 opacity-95'
      )}
    >
      {/* 1. Header de la Tarjeta con Título y Badges de Estado */}
      <div className="px-4 sm:px-6 py-4 border-b border-border/80 bg-secondary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <StateBadge state={post.state} size="sm" />
            <FormatBadge
              format={post.format}
              aspectRatio={post.media[0]?.aspectRatio}
              slideCount={post.media.length}
            />
            {post.scheduledAt && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md">
                <Clock className="w-3 h-3" />
                <span>{formatPortalDate(post.scheduledAt)}</span>
              </span>
            )}
          </div>

          <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight truncate">
            {post.title}
          </h2>

          {post.briefingScript && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 italic">
              Objetivo: {post.briefingScript}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <span className="text-[11px] font-mono text-muted-foreground">
            ID: <span className="text-foreground/80 font-semibold">{post.id}</span>
          </span>
        </div>
      </div>

      {/* 2. Cuerpo Principal: Layout Responsive (2 Columnas en Desktop, Stack Vertical en Mobile) */}
      <div className="p-4 sm:p-6 lg:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Columna Izquierda: Mockup Fidedigno de Instagram */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          <div className="w-full max-w-[380px] mx-auto shadow-2xl rounded-2xl overflow-hidden border border-border/50">
            <IgFeedPostPreview
              authorName={client.handle}
              authorAvatar={client.avatarUrl}
              location="Madrid, España"
              format={post.format}
              media={post.media}
              caption={post.copy.caption}
              firstComment={post.copy.firstComment}
              likesCount={1280}
            />
          </div>
          <p className="text-[11px] text-muted-foreground text-center mt-2.5 font-mono">
            {post.format === 'carousel'
              ? 'Desliza las flechas para inspeccionar todas las fotos'
              : post.format === 'reel'
              ? 'Vista vertical de Reel Instagram 9:16'
              : 'Vista previa exacta de Instagram Feed'}
          </p>
        </div>

        {/* Columna Derecha: Detalle de Copy, Primer Comentario, Feedback y Acciones */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* A. Bloque del Texto del Copy */}
          <div className="rounded-xl border border-border/80 bg-background/50 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" />
                <span>Texto Oficial de la Publicación (Copy)</span>
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                {post.copy.characterCount} / {post.copy.characterLimit} caracteres
              </span>
            </div>

            <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-line font-sans break-words">
              {post.copy.caption}
            </p>

            {/* Hashtags estructurados */}
            {post.copy.hashtags && post.copy.hashtags.length > 0 && (
              <div className="pt-2 border-t border-border/40 flex flex-wrap gap-1.5">
                {post.copy.hashtags.map((tag, i) => (
                  <span
                    key={i}
                    className="text-[11px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20"
                  >
                    {tag.startsWith('#') ? tag : `#${tag}`}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* B. Primer Comentario (First Comment) */}
          {post.copy.firstComment && post.copy.firstComment.trim() !== '' && (
            <div className="rounded-xl border border-border/80 bg-secondary/30 p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Pin className="w-3.5 h-3.5 text-amber-400" />
                <span>Primer Comentario Fijado (First Comment)</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed break-words font-mono">
                {post.copy.firstComment}
              </p>
            </div>
          )}

          {/* C. Historial de Feedback / Conversación entre CM y Cliente (Acordeón) */}
          <div className="rounded-xl border border-border/80 bg-secondary/20 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsCommentsExpanded(!isCommentsExpanded)}
              className="w-full px-4 py-3 min-h-[44px] flex items-center justify-between text-left hover:bg-secondary/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <span className="text-xs sm:text-sm font-semibold text-foreground">
                  Historial de Feedback y Auditoría
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-secondary border border-border text-foreground/90 font-medium">
                  {post.comments.length}
                </span>
              </div>
              {isCommentsExpanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {isCommentsExpanded && (
              <div className="px-4 pb-4 pt-1 space-y-2.5 border-t border-border/60">
                {hasComments ? (
                  post.comments.map((comment) => {
                    const isClient = comment.authorRole === 'client';
                    const isCm = comment.authorRole === 'cm';

                    return (
                      <div
                        key={comment.id}
                        className={cn(
                          'p-3 rounded-lg border text-xs space-y-1',
                          isClient
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-foreground'
                            : isCm
                            ? 'bg-sky-500/10 border-sky-500/20 text-foreground'
                            : 'bg-secondary/50 border-border text-foreground'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                          <div className="flex items-center gap-1.5 font-medium">
                            <span
                              className={cn(
                                'px-1.5 py-0.5 rounded font-mono font-semibold text-[10px]',
                                isClient
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : isCm
                                  ? 'bg-sky-500/20 text-sky-400'
                                  : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {isClient
                                ? 'Cliente (Tú)'
                                : isCm
                                ? 'Community Manager'
                                : 'Sistema'}
                            </span>
                            {comment.statusChangeTo && (
                              <span className="text-muted-foreground text-[10px]">
                                → Estado: {comment.statusChangeTo}
                              </span>
                            )}
                          </div>
                          <span className="text-muted-foreground font-mono text-[10px]">
                            {formatPortalDate(comment.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-foreground/90 pt-0.5 break-words">
                          {comment.content}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-muted-foreground py-2 text-center italic">
                    Sin comentarios previos en esta publicación. Está lista para tu primera revisión.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* D. Zona de Acciones Ergonómicas de 1 Clic */}
          <div className="pt-2">
            {isPendingReview ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-200/90 leading-relaxed">
                    Esta pieza requiere tu visto bueno. Revisa el copy, hashtags y elementos visuales.
                    Al aprobarla, se notificará al equipo para proceder con el agendamiento programado.
                  </p>
                </div>

                {/* Botones de acción táctiles (Mínimo 48px de alto para zona del pulgar en mobile) */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  {/* Botón Prominente: Aprobar Publicación (Verde Esmeralda) */}
                  <Button
                    type="button"
                    onClick={handleApproveClick}
                    disabled={isMutating || isLocalApproving}
                    isLoading={isLocalApproving}
                    className="w-full sm:flex-1 h-12 min-h-[48px] bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-950/40 rounded-xl active:scale-[0.97] transition-all gap-2 text-sm select-none"
                  >
                    <CheckCircle2 className="w-5 h-5 text-white" />
                    <span>Aprobar Publicación</span>
                  </Button>

                  {/* Botón Secundario: Solicitar Cambios (Ámbar / Outline) */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onRequestChanges(post)}
                    disabled={isMutating || isLocalApproving}
                    className="w-full sm:w-auto h-12 min-h-[48px] px-5 border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/80 rounded-xl active:scale-[0.97] transition-all gap-2 text-sm select-none"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Solicitar Cambios</span>
                  </Button>
                </div>
              </div>
            ) : post.state === 'approved' ? (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Publicación Aprobada — En cola de agendamiento por el Community Manager</span>
                </div>
              </div>
            ) : post.state === 'scheduled' ? (
              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-medium text-purple-400">
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>
                    Programada para publicación automática el{' '}
                    <strong className="underline font-mono">
                      {formatPortalDate(post.scheduledAt)}
                    </strong>
                  </span>
                </div>
              </div>
            ) : post.state === 'changes_requested' ? (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
                  <RotateCcw className="w-4 h-4 shrink-0" />
                  <span>
                    Cambios solicitados en curso. El Community Manager está adaptando el contenido.
                  </span>
                </div>
              </div>
            ) : post.state === 'published' ? (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Publicación transmitida y en vivo en Instagram</span>
                </div>
                {post.publishResult?.permalink && (
                  <a
                    href={post.publishResult.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-mono"
                  >
                    <span>Ver en Instagram</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
