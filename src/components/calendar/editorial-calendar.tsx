'use client';

/**
 * @file editorial-calendar.tsx
 * @description Calendario Editorial interactivo con cuadrícula mensual, navegación cronológica,
 * píldoras de post con indicador semántico de estado FSM y Drag & Drop para reprogramación reactiva.
 */

import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Film,
  Layers,
  Square,
  RectangleVertical,
} from 'lucide-react';
import type { PostDocument } from '@/domain/models/post.types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface EditorialCalendarProps {
  posts: PostDocument[];
  onPostClick: (post: PostDocument) => void;
  onReschedulePost: (postId: string, newDateIso: string) => void;
}

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function EditorialCalendar({
  posts,
  onPostClick,
  onReschedulePost,
}: EditorialCalendarProps) {
  // Fecha seleccionada para visualización (por defecto Octubre 2026 para alinear con el proyecto)
  const [currentDate, setCurrentDate] = useState(() => new Date('2026-10-24T12:00:00Z'));
  const [draggedPostId, setDraggedPostId] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Navegación de mes
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date('2026-10-24T12:00:00Z'));
  };

  const monthLabel = useMemo(() => {
    const formatter = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
    const formatted = formatter.format(new Date(year, month, 1));
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }, [year, month]);

  // Cálculo de días del mes y padding de días anteriores/posteriores
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Ajustar día de la semana (0 es domingo en JS; queremos 0 = Lunes a 6 = Domingo)
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const daysInMonth = lastDayOfMonth.getDate();

    // Días del mes anterior para relleno
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const days: Array<{
      date: Date;
      isCurrentMonth: boolean;
      dayNumber: number;
      dateKey: string;
    }> = [];

    // Relleno mes anterior
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const dateObj = new Date(year, month - 1, d);
      days.push({
        date: dateObj,
        isCurrentMonth: false,
        dayNumber: d,
        dateKey: dateObj.toISOString().slice(0, 10),
      });
    }

    // Días del mes actual
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      days.push({
        date: dateObj,
        isCurrentMonth: true,
        dayNumber: d,
        dateKey: dateObj.toISOString().slice(0, 10),
      });
    }

    // Relleno mes siguiente hasta completar múltiplos de 7 (máx 35 o 42 celdas)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const dateObj = new Date(year, month + 1, d);
      days.push({
        date: dateObj,
        isCurrentMonth: false,
        dayNumber: d,
        dateKey: dateObj.toISOString().slice(0, 10),
      });
    }

    return days;
  }, [year, month]);

  // Agrupación de posts por día (YYYY-MM-DD)
  const postsByDateKey = useMemo(() => {
    const map = new Map<string, PostDocument[]>();
    posts.forEach((post) => {
      if (post.scheduledAt) {
        const key = post.scheduledAt.slice(0, 10);
        const list = map.get(key) || [];
        list.push(post);
        map.set(key, list);
      }
    });
    return map;
  }, [posts]);

  // Manejo de Drop en Celda de Día
  const handleCellDrop = (dateObj: Date) => {
    if (!draggedPostId) return;

    const targetPost = posts.find((p) => p.id === draggedPostId);
    let hours = 18;
    let minutes = 30;

    if (targetPost?.scheduledAt) {
      const orig = new Date(targetPost.scheduledAt);
      hours = orig.getUTCHours();
      minutes = orig.getUTCMinutes();
    }

    const newDate = new Date(Date.UTC(
      dateObj.getFullYear(),
      dateObj.getMonth(),
      dateObj.getDate(),
      hours,
      minutes,
      0,
      0
    ));

    onReschedulePost(draggedPostId, newDate.toISOString());
    setDraggedPostId(null);
  };

  const isToday = (date: Date) => {
    const todayStr = '2026-10-24';
    return date.toISOString().slice(0, 10) === todayStr;
  };

  return (
    <div className="px-6 py-4 space-y-4 max-w-7xl mx-auto">
      {/* Controles de Navegación del Calendario */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card border border-border p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground tracking-tight">
              {monthLabel}
            </h2>
            <p className="text-xs text-muted-foreground">
              Arrastra cualquier publicación para reprogramar su fecha de despacho
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToday}
            className="text-xs font-medium"
          >
            Hoy
          </Button>
          <div className="flex items-center border border-border rounded-lg bg-secondary/30">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Mes anterior"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-border" />
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Mes siguiente"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Cuadrícula Mensual */}
      <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-xs">
        {/* Cabecera de Días de la Semana */}
        <div className="grid grid-cols-7 border-b border-border bg-secondary/20">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Celdas de Días */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-border/60">
          {calendarDays.map(({ date, isCurrentMonth, dayNumber, dateKey }) => {
            const dayPosts = postsByDateKey.get(dateKey) || [];
            const isCurrentDay = isToday(date);

            return (
              <div
                key={dateKey}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleCellDrop(date)}
                className={cn(
                  'min-h-[120px] p-2 flex flex-col justify-between transition-colors relative group',
                  !isCurrentMonth && 'bg-secondary/10 opacity-40',
                  isCurrentMonth && 'bg-card hover:bg-secondary/15'
                )}
              >
                {/* Cabecera de Celda: Número de Día */}
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={cn(
                      'text-xs font-semibold font-mono rounded-full w-6 h-6 flex items-center justify-center transition-colors',
                      isCurrentDay
                        ? 'bg-primary text-white shadow-sm'
                        : isCurrentMonth
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    {dayNumber}
                  </span>

                  {dayPosts.length > 0 && (
                    <span className="text-[10px] font-mono font-medium text-muted-foreground">
                      {dayPosts.length} post{dayPosts.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Lista de Píldoras de Post */}
                <div className="flex-1 flex flex-col gap-1.5 overflow-hidden">
                  {dayPosts.slice(0, 3).map((post) => (
                    <CalendarPostPill
                      key={post.id}
                      post={post}
                      onClick={() => onPostClick(post)}
                      onDragStart={() => setDraggedPostId(post.id)}
                    />
                  ))}
                  {dayPosts.length > 3 && (
                    <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-secondary/40 font-semibold self-start">
                      +{dayPosts.length - 3} más
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface CalendarPostPillProps {
  post: PostDocument;
  onClick: () => void;
  onDragStart: () => void;
}

function CalendarPostPill({ post, onClick, onDragStart }: CalendarPostPillProps) {
  // Extracción de hora legible (ej. "18:30")
  const timeString = post.scheduledAt
    ? new Date(post.scheduledAt).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '';

  // Borde semántico de estado FSM (3px a la izquierda)
  const borderLeftColorMap: Record<string, string> = {
    idea: 'border-l-slate-400',
    in_progress: 'border-l-sky-400',
    in_review: 'border-l-amber-400',
    changes_requested: 'border-l-orange-400',
    approved: 'border-l-emerald-400',
    scheduled: 'border-l-purple-500',
    publishing: 'border-l-fuchsia-400',
    published: 'border-l-green-500',
    failed: 'border-l-red-500',
  };

  const FormatIcon = () => {
    if (post.format === 'reel') return <Film className="w-2.5 h-2.5 text-purple-400" />;
    if (post.format === 'carousel') return <Layers className="w-2.5 h-2.5 text-amber-400" />;
    if (post.media[0]?.aspectRatio === '4:5')
      return <RectangleVertical className="w-2.5 h-2.5 text-indigo-400" />;
    return <Square className="w-2.5 h-2.5 text-cyan-400" />;
  };

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', post.id);
        onDragStart();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'h-7 min-h-[28px] px-2 flex items-center gap-1.5 rounded-md border border-border bg-secondary/50 text-foreground text-xs font-medium cursor-grab active:cursor-grabbing hover:bg-secondary hover:border-primary/40 transition-all select-none border-l-4 truncate shadow-2xs',
        borderLeftColorMap[post.state] || 'border-l-border'
      )}
      title={`${post.title} (${timeString})`}
    >
      <FormatIcon />
      {timeString && (
        <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-0.5 shrink-0">
          <Clock className="w-2.5 h-2.5" />
          {timeString}
        </span>
      )}
      <span className="truncate text-[11px] font-medium leading-tight">
        {post.title}
      </span>
    </div>
  );
}
