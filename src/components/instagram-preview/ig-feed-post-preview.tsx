'use client';

/**
 * @file ig-feed-post-preview.tsx
 * @description Previsualizador fidedigno de Instagram para Feed (1:1 / 4:5), Carrusel y Reels (9:16).
 * Componente puro desacoplado utilizable tanto en el Post Drawer como en el Portal de Cliente.
 */

import React, { useState } from 'react';
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Music2,
  Pin,
  Volume2,
} from 'lucide-react';
import type { InstagramFormat, InstagramMediaAsset } from '@/domain/models/post.types';
import { cn } from '@/lib/utils';

interface IgFeedPostPreviewProps {
  authorName?: string;
  authorAvatar?: string;
  location?: string;
  format: InstagramFormat;
  media: InstagramMediaAsset[];
  caption: string;
  firstComment?: string;
  likesCount?: number;
  className?: string;
}

export function IgFeedPostPreview({
  authorName = 'lumina_official',
  authorAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
  location = 'Madrid, España',
  format,
  media,
  caption,
  firstComment,
  likesCount = 1420,
  className,
}: IgFeedPostPreviewProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);

  const primaryMedia = media[activeSlide] || media[0];
  const isCarousel = format === 'carousel' && media.length > 1;
  const isReel = format === 'reel';
  const isPortraitFeed = format === 'feed_post' && primaryMedia?.aspectRatio === '4:5';

  // Parser para renderizar hashtags en color interactivo azul (#3b82f6)
  const renderFormattedCaption = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(#[a-zA-Z0-9_ñÑáéíóúÁÉÍÓÚ]+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('#')) {
        return (
          <span key={index} className="text-primary hover:underline cursor-pointer">
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const truncatedCaption =
    !isCaptionExpanded && caption.length > 125 ? caption.slice(0, 125) + '...' : caption;

  return (
    <div
      className={cn(
        'w-full max-w-[420px] mx-auto rounded-2xl border border-border bg-black text-white shadow-2xl overflow-hidden font-sans select-none flex flex-col',
        className
      )}
    >
      {/* 1. Header del Post */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-neutral-900 bg-neutral-950">
        <div className="flex items-center gap-2.5">
          {/* Avatar con borde sutil */}
          <div className="w-8 h-8 rounded-full p-[1.5px] bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={authorAvatar}
              alt={authorName}
              className="w-full h-full rounded-full object-cover border border-black"
            />
          </div>
          <div className="leading-tight">
            <span className="font-semibold text-xs tracking-tight text-white hover:underline cursor-pointer">
              {authorName}
            </span>
            {location && (
              <p className="text-[10px] text-neutral-400 font-normal">{location}</p>
            )}
          </div>
        </div>

        <button
          type="button"
          aria-label="Más opciones"
          className="text-neutral-400 hover:text-white p-1"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Contenedor Multimedia según Aspect Ratio */}
      <div
        className={cn(
          'relative w-full bg-neutral-900 overflow-hidden flex items-center justify-center',
          isReel && 'aspect-[9/16]',
          isPortraitFeed && 'aspect-[4/5]',
          !isReel && !isPortraitFeed && 'aspect-square'
        )}
      >
        {primaryMedia ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={primaryMedia.downloadUrl}
            alt="Instagram asset preview"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="p-8 text-center text-neutral-500 text-xs">
            Sin imagen o video cargado
          </div>
        )}

        {/* Controles de Carrusel (Flechas y Contador 1/N) */}
        {isCarousel && (
          <>
            <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-black/60 text-white backdrop-blur-xs">
              {activeSlide + 1}/{media.length}
            </span>
            {activeSlide > 0 && (
              <button
                type="button"
                onClick={() => setActiveSlide((prev) => Math.max(0, prev - 1))}
                aria-label="Foto anterior"
                className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-xs hover:bg-black/70"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            {activeSlide < media.length - 1 && (
              <button
                type="button"
                onClick={() => setActiveSlide((prev) => Math.min(media.length - 1, prev + 1))}
                aria-label="Siguiente foto"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-xs hover:bg-black/70"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </>
        )}

        {/* Overlay Exclusivo de Reels (9:16) */}
        {isReel && (
          <div className="absolute right-3 bottom-14 flex flex-col items-center gap-4 text-white">
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => setIsLiked(!isLiked)}
                className="p-1 hover:scale-110 transition-transform"
              >
                <Heart
                  className={cn(
                    'w-6 h-6',
                    isLiked ? 'fill-rose-500 text-rose-500' : 'text-white'
                  )}
                />
              </button>
              <span className="text-[11px] font-mono">1.4K</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <button type="button" className="p-1 hover:scale-110 transition-transform">
                <MessageCircle className="w-6 h-6 text-white" />
              </button>
              <span className="text-[11px] font-mono">48</span>
            </div>
            <button type="button" className="p-1 hover:scale-110 transition-transform">
              <Send className="w-6 h-6 text-white" />
            </button>
            <button type="button" className="p-1 hover:scale-110 transition-transform">
              <Volume2 className="w-5 h-5 text-white" />
            </button>
          </div>
        )}
      </div>

      {/* 3. Barra de Acciones Nativas (Feed & Carrusel) */}
      {!isReel && (
        <div className="px-3.5 pt-3 pb-1 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIsLiked(!isLiked)}
              aria-label="Me gusta"
              className="text-white hover:opacity-80 transition-opacity"
            >
              <Heart
                className={cn(
                  'w-6 h-6 transition-colors',
                  isLiked ? 'fill-rose-500 text-rose-500' : 'text-white'
                )}
              />
            </button>
            <button
              type="button"
              aria-label="Comentar"
              className="text-white hover:opacity-80 transition-opacity"
            >
              <MessageCircle className="w-6 h-6" />
            </button>
            <button
              type="button"
              aria-label="Compartir"
              className="text-white hover:opacity-80 transition-opacity"
            >
              <Send className="w-6 h-6" />
            </button>
          </div>

          {/* Dots Indicadores de Carrusel */}
          {isCarousel && (
            <div className="flex items-center gap-1">
              {media.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'w-1.5 h-1.5 rounded-full transition-all',
                    i === activeSlide ? 'bg-primary w-2 h-2' : 'bg-neutral-600'
                  )}
                />
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsSaved(!isSaved)}
            aria-label="Guardar"
            className="text-white hover:opacity-80 transition-opacity"
          >
            <Bookmark
              className={cn(
                'w-6 h-6 transition-colors',
                isSaved ? 'fill-white text-white' : 'text-white'
              )}
            />
          </button>
        </div>
      )}

      {/* 4. Contador de Me Gusta */}
      <div className="px-3.5 pt-1 text-xs font-semibold text-white">
        {(likesCount + (isLiked ? 1 : 0)).toLocaleString()} Me gusta
      </div>

      {/* 5. Caption con Nombre de Usuario y Expansor 'más...' */}
      <div className="px-3.5 pt-1.5 text-xs text-neutral-200 leading-relaxed break-words">
        <span className="font-semibold text-white mr-1.5">{authorName}</span>
        {renderFormattedCaption(truncatedCaption)}
        {caption.length > 125 && !isCaptionExpanded && (
          <button
            type="button"
            onClick={() => setIsCaptionExpanded(true)}
            className="text-neutral-500 hover:text-neutral-300 ml-1 font-normal cursor-pointer"
          >
            más...
          </button>
        )}
      </div>

      {/* 6. Primer Comentario Fijado (First Comment) */}
      {firstComment && firstComment.trim() !== '' && (
        <div className="mx-3.5 my-2 p-2 rounded-lg bg-neutral-900/80 border border-neutral-800 text-xs text-neutral-300 flex items-start gap-1.5">
          <Pin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
          <div className="leading-tight break-words">
            <span className="font-semibold text-white mr-1">{authorName}</span>
            {renderFormattedCaption(firstComment)}
          </div>
        </div>
      )}

      {/* 7. Footer de Reel (Pista de Audio) o Timestamp de Feed */}
      {isReel ? (
        <div className="px-3.5 py-2.5 flex items-center gap-1.5 text-[11px] text-neutral-300">
          <Music2 className="w-3.5 h-3.5 text-white animate-spin" />
          <span className="truncate">Audio original • {authorName}</span>
        </div>
      ) : (
        <div className="px-3.5 py-2 text-[10px] text-neutral-500 font-mono uppercase tracking-wider">
          HACE 2 HORAS
        </div>
      )}
    </div>
  );
}
