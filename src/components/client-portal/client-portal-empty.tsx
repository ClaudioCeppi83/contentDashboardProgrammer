'use client';

/**
 * @file client-portal-empty.tsx
 * @description Estados vacíos elegantes y resolutivos para el Portal de Aprobación.
 * Cumple con la directriz anti-slop: cero trazados técnicos expuestos, iconografía SVG
 * de peso único y llamadas a la acción (CTA) intuitivas.
 */

import React from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Calendar,
  RotateCcw,
  Search,
  Sparkles,
  Inbox,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ClientPortalTab } from './client-portal-types';

interface ClientPortalEmptyProps {
  type: 'client_empty' | 'tab_empty' | 'search_empty';
  tab?: ClientPortalTab;
  clientId?: string;
  clientName?: string;
  onResetSearch?: () => void;
  onSwitchTab?: (tab: ClientPortalTab) => void;
}

export function ClientPortalEmpty({
  type,
  tab = 'pending',
  clientId,
  clientName,
  onResetSearch,
  onSwitchTab,
}: ClientPortalEmptyProps) {
  // 1. Caso de búsqueda sin resultados
  if (type === 'search_empty') {
    return (
      <div className="w-full max-w-md mx-auto py-16 px-6 text-center rounded-2xl border border-dashed border-border/80 bg-card/40 my-8">
        <div className="w-12 h-12 rounded-xl bg-secondary/80 text-muted-foreground flex items-center justify-center mx-auto mb-4 border border-border">
          <Search className="w-5 h-5" />
        </div>
        <h3 className="text-base font-semibold text-foreground">
          Sin publicaciones coincidentes
        </h3>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed max-w-sm mx-auto">
          No se encontró ninguna publicación con el término buscado en esta sección.
        </p>
        {onResetSearch && (
          <div className="mt-5">
            <Button variant="outline" size="sm" onClick={onResetSearch}>
              Limpiar búsqueda
            </Button>
          </div>
        )}
      </div>
    );
  }

  // 2. Caso de Aislamiento Multicliente: El cliente no tiene ningún post registrado
  if (type === 'client_empty') {
    return (
      <div className="w-full max-w-lg mx-auto py-20 px-6 text-center rounded-2xl border border-border bg-card/60 shadow-xl my-10">
        <div className="w-14 h-14 rounded-2xl bg-secondary text-primary flex items-center justify-center mx-auto mb-4 border border-border shadow-xs">
          <Inbox className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-foreground tracking-tight">
          Sin publicaciones para este cliente
        </h2>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed max-w-md mx-auto">
          Actualmente no existen piezas de contenido asociadas al identificador{' '}
          <code className="px-1.5 py-0.5 rounded bg-secondary font-mono text-foreground font-semibold">
            {clientId}
          </code>
          . Tu equipo de contenidos (Community Manager) te notificará por correo cuando el
          primer calendario editorial esté listo para tu revisión.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/portal/client-lumina">
            <Button variant="primary" size="sm" className="gap-2">
              <span>Explorar cliente demo (Lumina Brand)</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              Volver al Dashboard CM
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // 3. Caso de Pestaña vacía según el filtro seleccionado
  if (tab === 'pending') {
    return (
      <div className="w-full max-w-md mx-auto py-16 px-6 text-center rounded-2xl border border-dashed border-emerald-500/20 bg-emerald-500/5 my-8">
        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-3.5 border border-emerald-500/20">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-foreground">
          ¡Todo al día! Cero pendientes
        </h3>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed max-w-xs mx-auto">
          No tienes publicaciones pendientes de aprobación en este momento. Todas las piezas
          han sido procesadas o están siendo programadas por el equipo.
        </p>
        {onSwitchTab && (
          <div className="mt-5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSwitchTab('approved_scheduled')}
              className="text-xs gap-1.5"
            >
              <span>Ver publicaciones aprobadas</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (tab === 'approved_scheduled') {
    return (
      <div className="w-full max-w-md mx-auto py-16 px-6 text-center rounded-2xl border border-dashed border-border/80 bg-card/40 my-8">
        <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto mb-3.5 border border-purple-500/20">
          <Calendar className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-foreground">
          Sin publicaciones aprobadas o agendadas
        </h3>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed max-w-xs mx-auto">
          Las piezas que apruebes en la pestaña de pendientes pasarán aquí para su posterior
          despacho y agendamiento en Instagram.
        </p>
        {onSwitchTab && (
          <div className="mt-5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSwitchTab('pending')}
              className="text-xs"
            >
              Revisar pendientes
            </Button>
          </div>
        )}
      </div>
    );
  }

  // tab === 'history_changes'
  return (
    <div className="w-full max-w-md mx-auto py-16 px-6 text-center rounded-2xl border border-dashed border-border/80 bg-card/40 my-8">
      <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-3.5 border border-amber-500/20">
        <RotateCcw className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-foreground">
        Historial de cambios y publicaciones vacío
      </h3>
      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed max-w-xs mx-auto">
        Aquí se registrarán las publicaciones en las que hayas solicitado ajustes al Community
        Manager o aquellas que ya hayan sido publicadas en vivo en Instagram.
      </p>
    </div>
  );
}
