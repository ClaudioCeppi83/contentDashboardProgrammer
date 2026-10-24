'use client';

/**
 * @file badge.tsx
 * @description Badges cromáticos para estados de la Máquina de Estados Finitos (FSM)
 * y formatos nativos de Instagram según DESIGN.md.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { PostState, InstagramFormat } from '@/domain/models/post.types';
import {
  Square,
  RectangleVertical,
  Layers,
  Film,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  Check,
} from 'lucide-react';

export const STATE_LABELS: Record<PostState, string> = {
  idea: 'Idea',
  in_progress: 'En Progreso',
  in_review: 'En Revisión',
  changes_requested: 'Cambios Pedidos',
  approved: 'Aprobado',
  scheduled: 'Agendado',
  publishing: 'Publicando',
  published: 'Publicado',
  failed: 'Error',
};

export const STATE_ICONS: Record<PostState, React.ComponentType<{ className?: string }>> = {
  idea: Sparkles,
  in_progress: Clock,
  in_review: AlertTriangle,
  changes_requested: RotateCcw,
  approved: Check,
  scheduled: Clock,
  publishing: Clock,
  published: CheckCircle2,
  failed: AlertCircle,
};

interface StateBadgeProps {
  state: PostState;
  showIcon?: boolean;
  className?: string;
  size?: 'sm' | 'default';
}

export function StateBadge({ state, showIcon = true, className, size = 'default' }: StateBadgeProps) {
  const Icon = STATE_ICONS[state];
  const label = STATE_LABELS[state] || state;
  const statusClass = `badge-status-${state.replace(/_/g, '-')}`;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium border rounded-full transition-colors select-none',
        size === 'sm' ? 'px-2 py-0.5 text-[11px] font-mono' : 'px-2.5 py-1 text-xs',
        statusClass,
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {showIcon && Icon && <Icon className="w-3 h-3" />}
      <span>{label}</span>
    </span>
  );
}

interface FormatBadgeProps {
  format: InstagramFormat;
  aspectRatio?: string;
  slideCount?: number;
  className?: string;
}

export function FormatBadge({ format, aspectRatio, slideCount, className }: FormatBadgeProps) {
  if (format === 'reel') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30',
          className
        )}
      >
        <Film className="w-3 h-3 text-purple-400" />
        <span>Reel 9:16</span>
      </span>
    );
  }

  if (format === 'carousel') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30',
          className
        )}
      >
        <Layers className="w-3 h-3 text-amber-400" />
        <span>Carrusel {slideCount ? `(${slideCount})` : ''}</span>
      </span>
    );
  }

  // feed_post
  const isPortrait = aspectRatio === '4:5';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium',
        isPortrait
          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
          : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30',
        className
      )}
    >
      {isPortrait ? (
        <RectangleVertical className="w-3 h-3" />
      ) : (
        <Square className="w-3 h-3" />
      )}
      <span>{isPortrait ? 'Feed 4:5' : 'Feed 1:1'}</span>
    </span>
  );
}
