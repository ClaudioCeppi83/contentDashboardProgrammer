'use client';

/**
 * @file dashboard-header.tsx
 * @description Encabezado principal del Social Ops Dashboard con resumen de KPIs en tiempo real,
 * selector de cliente activo y botón de acción principal '+ Nuevo Post'.
 */

import React from 'react';
import { Instagram, Plus, Sparkles, Calendar, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashboardHeaderProps {
  onNewPost: () => void;
  metrics: {
    total: number;
    byState: Record<string, number>;
  };
}

export function DashboardHeader({ onNewPost, metrics }: DashboardHeaderProps) {
  return (
    <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Identidad y Cuenta de Instagram */}
        <div className="flex items-center justify-between md:justify-start gap-2 w-full md:w-auto min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner shrink-0">
              <Instagram className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground font-sans">
                  Social Ops
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-primary/10 text-primary border border-primary/20 font-medium shrink-0">
                  v0.1.0 MVP
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <p className="text-xs text-muted-foreground font-mono truncate">
                  @lumina_official
                </p>
              </div>
            </div>
          </div>

          {/* Botón Nuevo Post en Mobile (visible solo en < md) */}
          <div className="md:hidden shrink-0">
            <Button
              onClick={onNewPost}
              variant="primary"
              size="sm"
              className="font-semibold shadow-md whitespace-nowrap text-xs h-9 px-3"
            >
              <Plus className="w-4 h-4 mr-1" />
              Nuevo
            </Button>
          </div>
        </div>

        {/* Resumen de KPIs de Flujo (Single Source of Metric Truth) */}
        <div className="flex items-center gap-3 overflow-x-auto pb-1 md:pb-0">
          <div className="px-3.5 py-1.5 rounded-lg border border-border bg-secondary/30 flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <div>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                Total
              </p>
              <p className="text-sm font-bold font-mono text-foreground tabular-nums">
                {metrics.total}
              </p>
            </div>
          </div>

          <div className="px-3.5 py-1.5 rounded-lg border border-border bg-secondary/30 flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-amber-400" />
            <div>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                En Revisión
              </p>
              <p className="text-sm font-bold font-mono text-amber-400 tabular-nums">
                {metrics.byState['in_review'] || 0}
              </p>
            </div>
          </div>

          <div className="px-3.5 py-1.5 rounded-lg border border-border bg-secondary/30 flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-purple-400" />
            <div>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                Agendados
              </p>
              <p className="text-sm font-bold font-mono text-purple-400 tabular-nums">
                {metrics.byState['scheduled'] || 0}
              </p>
            </div>
          </div>

          <div className="px-3.5 py-1.5 rounded-lg border border-border bg-secondary/30 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <div>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                Publicados
              </p>
              <p className="text-sm font-bold font-mono text-emerald-400 tabular-nums">
                {metrics.byState['published'] || 0}
              </p>
            </div>
          </div>

          {/* Botón Primario Principal de Acción (visible en md y superior) */}
          <Button
            onClick={onNewPost}
            variant="primary"
            size="default"
            className="hidden md:inline-flex font-semibold shadow-md whitespace-nowrap ml-2"
          >
            <Plus className="w-4 h-4 mr-1" />
            Nuevo Post
          </Button>
        </div>
      </div>
    </header>
  );
}
