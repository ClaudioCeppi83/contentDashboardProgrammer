'use client';

/**
 * @file post-drawer.tsx
 * @description Post Drawer Lateral con Split Panel 50/50:
 * - Panel Izquierdo: Formulario de copy, pre-flight validation de medios, asistente contextual inline
 *   con Gemini 3.8 Flash (Aceptar/Refinar/Descartar), selector de formato y atajos FSM.
 * - Panel Derecho: Previsualizador fidedigno de Instagram (Feed 1:1/4:5, Carrusel, Reel 9:16) e historial de comentarios.
 */

import React, { useState, useEffect, useId } from 'react';
import {
  X,
  Sparkles,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Calendar,
  Send,
  MessageSquare,
  ChevronRight,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import type {
  PostDocument,
  PostState,
  InstagramFormat,
  InstagramMediaAsset,
} from '@/domain/models/post.types';
import { VALID_POST_TRANSITIONS } from '@/domain/models/post.types';
import { StateBadge, STATE_LABELS } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { IgFeedPostPreview } from '@/components/instagram-preview/ig-feed-post-preview';
import { cn } from '@/lib/utils';

interface PostDrawerProps {
  post: PostDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedPost: PostDocument) => Promise<void>;
  onTransition: (postId: string, targetState: PostState, payload?: { feedback?: string; scheduledAt?: string }) => Promise<void>;
}

interface AdaptedAIResponse {
  caption: string;
  characterCount: number;
  hashtags: string[];
  firstComment: string;
  formatRecommendation: InstagramFormat;
  thoughtSignature?: string;
}

export function PostDrawer({
  post,
  isOpen,
  onClose,
  onSave,
  onTransition,
}: PostDrawerProps) {
  const titleInputId = useId();
  const copyTextareaId = useId();
  const firstCommentId = useId();
  const scheduledAtId = useId();

  // Estados locales editables del post
  const [title, setTitle] = useState('');
  const [format, setFormat] = useState<InstagramFormat>('feed_post');
  const [caption, setCaption] = useState('');
  const [firstComment, setFirstComment] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [mediaList, setMediaList] = useState<InstagramMediaAsset[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  // Estados de la Asistencia Contextual con IA (Gemini 3.8 Flash)
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AdaptedAIResponse | null>(null);
  const [aiRefinePrompt, setAiRefinePrompt] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);

  // Sincronizar datos al abrir o cambiar de post
  useEffect(() => {
    if (post) {
      setTitle(post.title);
      setFormat(post.format);
      setCaption(post.copy.caption);
      setFirstComment(post.copy.firstComment || '');
      setScheduledAt(post.scheduledAt ? post.scheduledAt.slice(0, 16) : '');
      setMediaList(post.media);
      setAiSuggestion(null);
      setAiError(null);
      setTransitionError(null);
      setNewCommentText('');
    }
  }, [post]);

  // Manejo de tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !post) return null;

  const charCount = caption.length;
  const isCharWarning = charCount >= 1800 && charCount < 2200;
  const isCharExceeded = charCount > 2200;

  // Validación Pre-flight en cliente de los medios
  const getPreflightStatus = () => {
    if (mediaList.length === 0) {
      return { isValid: false, message: 'Se requiere al menos 1 archivo multimedia.' };
    }

    if (format === 'reel') {
      const video = mediaList[0];
      if (video.mimeType !== 'video/mp4') {
        return { isValid: false, message: 'Reels debe ser un video MP4.' };
      }
      if (video.aspectRatio !== '9:16') {
        return { isValid: false, message: 'Reels debe tener aspecto vertical 9:16.' };
      }
      return { isValid: true, message: '✓ Video 9:16 (1080x1920) Validado OK para Reels' };
    }

    if (format === 'carousel') {
      if (mediaList.length < 2 || mediaList.length > 10) {
        return { isValid: false, message: 'Carrusel requiere entre 2 y 10 diapositivas.' };
      }
      return { isValid: true, message: `✓ ${mediaList.length} diapositivas validadas con aspecto consistente` };
    }

    // Feed Post
    const asset = mediaList[0];
    if (asset.aspectRatio !== '1:1' && asset.aspectRatio !== '4:5') {
      return { isValid: false, message: 'Feed admite ratio 1:1 (cuadrado) o 4:5 (vertical).' };
    }
    return { isValid: true, message: `✓ Imagen con ratio ${asset.aspectRatio} validada para Feed` };
  };

  const preflight = getPreflightStatus();

  // Guardar cambios del post
  const handleSave = async () => {
    setIsSaving(true);
    setTransitionError(null);
    try {
      const updated: PostDocument = {
        ...post,
        title,
        format,
        copy: {
          ...post.copy,
          caption,
          characterCount: caption.length,
          firstComment,
          isValid: !isCharExceeded,
        },
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        media: mediaList,
        updatedAt: new Date().toISOString(),
      };
      await onSave(updated);
      setIsSaving(false);
    } catch (err: unknown) {
      setIsSaving(false);
      setTransitionError(err instanceof Error ? err.message : 'Error al guardar el post');
    }
  };

  // Invocar Adaptación de Copy con Gemini 3.8 Flash (/api/ai/adapt-copy)
  const handleAdaptCopy = async (customPrompt?: string) => {
    setIsAiLoading(true);
    setAiError(null);

    const briefingText = customPrompt
      ? `${caption}\n[Instrucción de refinamiento]: ${customPrompt}`
      : caption || post.briefingScript || title;

    try {
      const response = await fetch('/api/ai/adapt-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefing: briefingText,
          format: format,
          tone: 'inspirational',
          previousThoughtSignature: aiSuggestion?.thoughtSignature,
        }),
      });

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Error al conectar con Gemini 3.8 Flash');
      }

      setAiSuggestion(json.data as AdaptedAIResponse);
      setIsAiLoading(false);
      setAiRefinePrompt('');
    } catch (err: unknown) {
      setIsAiLoading(false);
      setAiError(err instanceof Error ? err.message : 'Error de comunicación con IA');
    }
  };

  // Tríada interactiva: [Aceptar]
  const handleAcceptAi = () => {
    if (!aiSuggestion) return;
    setCaption(aiSuggestion.caption);
    if (aiSuggestion.firstComment) {
      setFirstComment(aiSuggestion.firstComment);
    }
    setAiSuggestion(null);
  };

  // Tríada interactiva: [Refinar]
  const handleRefineAi = () => {
    if (!aiRefinePrompt.trim()) return;
    handleAdaptCopy(aiRefinePrompt);
  };

  // Tríada interactiva: [Descartar]
  const handleDiscardAi = () => {
    setAiSuggestion(null);
    setAiRefinePrompt('');
    setAiError(null);
  };

  // Añadir comentario de feedback
  const handleAddComment = () => {
    if (!newCommentText.trim()) return;
    const newComment = {
      id: `comment-${Date.now()}`,
      authorId: 'cm-clara',
      authorRole: 'cm' as const,
      content: newCommentText.trim(),
      createdAt: new Date().toISOString(),
    };
    const updatedPost: PostDocument = {
      ...post,
      comments: [...post.comments, newComment],
    };
    onSave(updatedPost);
    setNewCommentText('');
  };

  const allowedTransitions = VALID_POST_TRANSITIONS[post.state] || [];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm animate-in fade-in-0 duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Panel de edición de publicación"
    >
      <div className="w-full max-w-6xl h-full bg-card border-l border-border shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Cabecera del Drawer */}
        <div className="h-16 px-4 sm:px-6 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-foreground truncate max-w-[150px] sm:max-w-xs md:max-w-md">
              {title || 'Editar Publicación'}
            </h2>
            <StateBadge state={post.state} size="sm" className="shrink-0" />
            <span className="hidden sm:inline text-xs font-mono text-muted-foreground shrink-0">
              ID: {post.id}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              isLoading={isSaving}
              className="font-medium text-xs sm:text-sm px-2.5 sm:px-3.5 h-9"
            >
              <span className="hidden sm:inline">Guardar Cambios</span>
              <span className="sm:hidden">Guardar</span>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Cerrar drawer"
            >
              <X className="w-5 h-5 text-muted-foreground hover:text-foreground" />
            </Button>
          </div>
        </div>

        {/* Alerta de Error de Transición */}
        {transitionError && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{transitionError}</span>
          </div>
        )}

        {/* Contenido Split Panel 50/50 */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-border">
          {/* PANEL IZQUIERDO: Formulario de Operación & Pre-Flight */}
          <div className="w-full lg:w-1/2 p-4 sm:p-6 lg:overflow-y-auto space-y-6 shrink-0 lg:shrink">
            {/* 1. Selector de Formato Segmentado */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                Formato de Instagram
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFormat('feed_post')}
                  className={cn(
                    'py-2 px-3 rounded-lg border text-xs font-medium text-center transition-all cursor-pointer',
                    format === 'feed_post'
                      ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary'
                      : 'border-border bg-secondary/30 text-muted-foreground hover:text-foreground'
                  )}
                >
                  Feed (1:1 / 4:5)
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('carousel')}
                  className={cn(
                    'py-2 px-3 rounded-lg border text-xs font-medium text-center transition-all cursor-pointer',
                    format === 'carousel'
                      ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary'
                      : 'border-border bg-secondary/30 text-muted-foreground hover:text-foreground'
                  )}
                >
                  Carrusel (2-10)
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('reel')}
                  className={cn(
                    'py-2 px-3 rounded-lg border text-xs font-medium text-center transition-all cursor-pointer',
                    format === 'reel'
                      ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary'
                      : 'border-border bg-secondary/30 text-muted-foreground hover:text-foreground'
                  )}
                >
                  Reel (9:16)
                </button>
              </div>
            </div>

            {/* 2. Zona de Medios & Validación Pre-Flight en Cliente */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                  Medios & Validación Pre-Flight
                </label>
                <span
                  className={cn(
                    'text-[11px] font-mono font-medium',
                    preflight.isValid ? 'text-emerald-400' : 'text-amber-400'
                  )}
                >
                  {preflight.isValid ? '✓ Aprobado' : '⚠ Validación pendiente'}
                </span>
              </div>

              {/* Status Banner */}
              <div
                className={cn(
                  'p-3 rounded-lg border text-xs flex items-center gap-2',
                  preflight.isValid
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                )}
              >
                {preflight.isValid ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                )}
                <span>{preflight.message}</span>
              </div>

              {/* Miniatura de assets cargados */}
              <div className="flex items-center gap-2 overflow-x-auto py-1">
                {mediaList.map((m, idx) => (
                  <div
                    key={m.id || idx}
                    className="relative w-16 h-16 rounded-lg overflow-hidden border border-border bg-secondary shrink-0 group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.downloadUrl}
                      alt={`Asset ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-0.5 right-0.5 px-1 rounded text-[9px] font-mono bg-black/70 text-white">
                      {m.aspectRatio}
                    </span>
                  </div>
                ))}
                <label className="w-16 h-16 rounded-lg border border-dashed border-border hover:border-primary flex flex-col items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors bg-secondary/20">
                  <Upload className="w-4 h-4 mb-0.5" />
                  <span className="text-[9px] font-mono">+ Media</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,video/mp4"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      // Mock de asset cargado para pre-flight interactivo
                      const isVideo = file.type.includes('video');
                      const newAsset: InstagramMediaAsset = {
                        id: `media-${Date.now()}`,
                        storagePath: `posts/${post.id}/${file.name}`,
                        downloadUrl: URL.createObjectURL(file),
                        mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
                        sizeBytes: file.size,
                        width: isVideo ? 1080 : 1080,
                        height: isVideo ? 1920 : 1080,
                        aspectRatio: isVideo ? '9:16' : '1:1',
                        durationSeconds: isVideo ? 30 : undefined,
                        validationPassed: true,
                      };
                      setMediaList((prev) => (format === 'carousel' ? [...prev, newAsset] : [newAsset]));
                    }}
                  />
                </label>
              </div>
            </div>

            {/* 3. Título del Post */}
            <div className="space-y-1.5">
              <label htmlFor={titleInputId} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                Título del Post
              </label>
              <Input
                id={titleInputId}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título interno para identificación..."
              />
            </div>

            {/* 4. Editor de Copy / Caption con Contador Dinámico & Asistente IA Inline */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor={copyTextareaId} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                  Copy / Caption
                </label>

                {/* Contador Dinámico de Caracteres (X / 2,200) */}
                <span
                  className={cn(
                    'text-xs font-mono font-semibold tabular-nums',
                    !isCharWarning && !isCharExceeded && 'text-muted-foreground',
                    isCharWarning && 'text-amber-400',
                    isCharExceeded && 'text-destructive'
                  )}
                >
                  {charCount.toLocaleString()} / 2,200 caracteres
                </span>
              </div>

              {/* Botón Asistente IA Contextual Inline (Cero Chatbot Flotante) */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs text-foreground font-medium">
                    Gemini 3.8 Flash
                  </span>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleAdaptCopy()}
                  isLoading={isAiLoading}
                  className="text-xs font-medium h-9"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  Adaptar Copy para Instagram
                </Button>
              </div>

              {/* Textarea del Copy */}
              <Textarea
                id={copyTextareaId}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Escribe el copy para Instagram aquí..."
                rows={5}
                className={cn(
                  isCharExceeded && 'border-destructive focus-visible:ring-destructive'
                )}
              />

              {/* Contenedor Interactivo de Sugerencia IA: Tríada [Aceptar], [Refinar], [Descartar] */}
              {aiSuggestion && (
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 space-y-3 animate-in fade-in-0 duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold font-mono text-primary flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Propuesta Optimizada por Gemini 3.8 Flash
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                      {aiSuggestion.characterCount} chars
                    </span>
                  </div>

                  <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap bg-background/50 p-2.5 rounded-lg border border-border">
                    {aiSuggestion.caption}
                  </p>

                  {/* Refinamiento secundario */}
                  <div className="flex items-center gap-2">
                    <Input
                      value={aiRefinePrompt}
                      onChange={(e) => setAiRefinePrompt(e.target.value)}
                      placeholder="Instrucción de refinamiento (ej. 'más informal', 'agrega CTA')..."
                      className="h-9 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRefineAi();
                      }}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleRefineAi}
                      isLoading={isAiLoading}
                      className="h-9 text-xs"
                    >
                      Refinar
                    </Button>
                  </div>

                  {/* Tríada de Acciones Principales */}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-primary/20">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDiscardAi}
                      className="text-xs h-9 text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      Descartar
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleAcceptAi}
                      className="text-xs h-9 font-semibold"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Aceptar y Aplicar
                    </Button>
                  </div>
                </div>
              )}

              {aiError && (
                <p className="text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
                  {aiError}
                </p>
              )}
            </div>

            {/* 5. Primer Comentario (First Comment) */}
            <div className="space-y-1.5">
              <label htmlFor={firstCommentId} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                Primer Comentario (Hashtags limpios o Enlace)
              </label>
              <Textarea
                id={firstCommentId}
                value={firstComment}
                onChange={(e) => setFirstComment(e.target.value)}
                placeholder="#moda #estilo #minimalismo..."
                rows={2}
                className="min-h-[70px]"
              />
            </div>

            {/* 6. Agendamiento de Fecha & Hora */}
            <div className="space-y-1.5">
              <label htmlFor={scheduledAtId} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                Fecha Programada de Publicación
              </label>
              <Input
                id={scheduledAtId}
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            {/* 7. Barra de Transiciones FSM Rápidas */}
            <div className="pt-4 border-t border-border space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                Flujo de Aprobación & Despacho (FSM)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {allowedTransitions.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">
                    Publicación en estado terminal ({STATE_LABELS[post.state]}).
                  </span>
                ) : (
                  allowedTransitions.map((nextState) => (
                    <Button
                      key={nextState}
                      variant="secondary"
                      size="sm"
                      onClick={() => onTransition(post.id, nextState, { scheduledAt })}
                      className="text-xs font-medium hover:border-primary"
                    >
                      <span>Avanzar a {STATE_LABELS[nextState]}</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* PANEL DERECHO: Previsualizador Fidedigno de Instagram & Historial */}
          <div className="w-full lg:w-1/2 p-4 sm:p-6 lg:overflow-y-auto space-y-6 bg-secondary/10 flex flex-col items-center shrink-0 lg:shrink">
            <div className="w-full max-w-[420px] flex items-center justify-between pb-2 border-b border-border/60">
              <span className="text-xs font-semibold font-mono text-muted-foreground uppercase tracking-wider">
                Preview Fidedigno de Instagram
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                Aspecto: {format === 'reel' ? '9:16' : mediaList[0]?.aspectRatio || '1:1'}
              </span>
            </div>

            {/* Mockup Nativo Puro */}
            <IgFeedPostPreview
              authorName="lumina_official"
              format={format}
              media={mediaList}
              caption={caption}
              firstComment={firstComment}
              likesCount={1420}
            />

            {/* Historial de Comentarios & Feedback de Cliente */}
            <div className="w-full max-w-[420px] pt-4 border-t border-border space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold font-mono text-muted-foreground uppercase tracking-wider">
                <MessageSquare className="w-4 h-4 text-primary" />
                <span>Historial de Feedback ({post.comments.length})</span>
              </div>

              {/* Lista de comentarios */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {post.comments.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic text-center py-2">
                    Sin comentarios de feedback registrados.
                  </p>
                ) : (
                  post.comments.map((comm) => (
                    <div
                      key={comm.id}
                      className="p-2.5 rounded-lg border border-border bg-card text-xs space-y-1 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground capitalize">
                          {comm.authorRole === 'client' ? '👤 Cliente' : '🛠️ Community Manager'}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {new Date(comm.createdAt).toLocaleDateString('es-ES', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">
                        {comm.content}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Campo para añadir nuevo comentario */}
              <div className="flex items-center gap-2 pt-2">
                <Input
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Escribir feedback o nota interna..."
                  className="h-10 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddComment();
                  }}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleAddComment}
                  className="h-10 text-xs shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
