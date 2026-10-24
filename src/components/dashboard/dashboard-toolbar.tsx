'use client';

/**
 * @file dashboard-toolbar.tsx
 * @description Barra de control a nivel de página (Page-Level Control Bar) que sincroniza
 * las vistas (Kanban, Calendario, Tabla), filtros de formato y estado, y búsqueda reactiva.
 */

import React from 'react';
import {
  Search,
  X,
  LayoutGrid,
  Calendar as CalendarIcon,
  Table2,
  Filter,
  RotateCcw,
} from 'lucide-react';
import type { PostState, InstagramFormat } from '@/domain/models/post.types';
import { STATE_LABELS } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type DashboardViewMode = 'kanban' | 'calendar' | 'table';

interface DashboardToolbarProps {
  currentView: DashboardViewMode;
  onViewChange: (view: DashboardViewMode) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  stateFilter: PostState | 'all';
  onStateFilterChange: (state: PostState | 'all') => void;
  formatFilter: InstagramFormat | 'all';
  onFormatFilterChange: (format: InstagramFormat | 'all') => void;
  totalFilteredCount: number;
  totalCount: number;
}

export function DashboardToolbar({
  currentView,
  onViewChange,
  searchQuery,
  onSearchChange,
  stateFilter,
  onStateFilterChange,
  formatFilter,
  onFormatFilterChange,
  totalFilteredCount,
  totalCount,
}: DashboardToolbarProps) {
  const hasActiveFilters =
    searchQuery.trim() !== '' || stateFilter !== 'all' || formatFilter !== 'all';

  const handleResetFilters = () => {
    onSearchChange('');
    onStateFilterChange('all');
    onFormatFilterChange('all');
  };

  return (
    <div className="bg-card border-b border-border px-6 py-3.5 space-y-3">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Lado Izquierdo: Buscador Reactivo y Filtros */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Buscador */}
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar posts, captions, #tags..."
              className="w-full h-11 pl-9 pr-9 rounded-lg border border-border bg-secondary/30 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Selector de Estado FSM */}
          <div className="relative inline-flex items-center">
            <select
              value={stateFilter}
              onChange={(e) => onStateFilterChange(e.target.value as PostState | 'all')}
              className="h-11 pl-3 pr-8 rounded-lg border border-border bg-secondary/30 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer appearance-none"
            >
              <option value="all" className="bg-card text-foreground">
                Todos los estados
              </option>
              {Object.entries(STATE_LABELS).map(([stateKey, label]) => (
                <option key={stateKey} value={stateKey} className="bg-card text-foreground">
                  {label}
                </option>
              ))}
            </select>
            <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>

          {/* Selector de Formato Segmentado */}
          <div className="inline-flex rounded-lg border border-border bg-secondary/30 p-1">
            <button
              type="button"
              onClick={() => onFormatFilterChange('all')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all select-none',
                formatFilter === 'all'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => onFormatFilterChange('feed_post')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all select-none',
                formatFilter === 'feed_post'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Feed
            </button>
            <button
              type="button"
              onClick={() => onFormatFilterChange('carousel')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all select-none',
                formatFilter === 'carousel'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Carrusel
            </button>
            <button
              type="button"
              onClick={() => onFormatFilterChange('reel')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all select-none',
                formatFilter === 'reel'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Reels
            </button>
          </div>

          {/* Reset Filters CTA si hay filtros activos */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpiar ({totalFilteredCount}/{totalCount})</span>
            </button>
          )}
        </div>

        {/* Lado Derecho: Conmutador de Vistas */}
        <div className="flex items-center justify-between lg:justify-end gap-2">
          <div className="inline-flex rounded-lg border border-border bg-secondary/30 p-1">
            <button
              type="button"
              onClick={() => onViewChange('kanban')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all select-none',
                currentView === 'kanban'
                  ? 'bg-card text-foreground shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => onViewChange('calendar')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all select-none',
                currentView === 'calendar'
                  ? 'bg-card text-foreground shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Calendario</span>
            </button>
            <button
              type="button"
              onClick={() => onViewChange('table')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all select-none',
                currentView === 'table'
                  ? 'bg-card text-foreground shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>Tabla</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
