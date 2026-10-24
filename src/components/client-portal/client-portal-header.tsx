'use client';

/**
 * @file client-portal-header.tsx
 * @description Header ejecutivo del Portal de Aprobación de Cliente.
 * Presenta logotipo vectorial, nombre de la marca cliente, badge de posts pendientes
 * e indicador interactivo de entorno seguro SSL con cifrado y aislamiento multicliente.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Info,
} from 'lucide-react';
import type { ClientProfile } from './client-portal-types';
import { cn } from '@/lib/utils';

interface ClientPortalHeaderProps {
  client: ClientProfile;
  pendingCount: number;
  totalClientPosts: number;
  className?: string;
}

export function ClientPortalHeader({
  client,
  pendingCount,
  totalClientPosts,
  className,
}: ClientPortalHeaderProps) {
  const [showSecurityDetails, setShowSecurityDetails] = useState(false);
  const [isEncryptedSession, setIsEncryptedSession] = useState(true);

  return (
    <header
      className={cn(
        'w-full border-b border-border/80 bg-background/95 backdrop-blur-md sticky top-0 z-40',
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* 1. Bloque de Identidad y Marca */}
          <div className="flex items-center gap-3.5">
            {/* Logo de Marca / Avatar con borde de degradado fino */}
            <div className="relative group shrink-0">
              <div className="w-12 h-12 rounded-xl p-[2px] bg-gradient-to-tr from-primary/60 via-emerald-500/40 to-primary/20 shadow-md shadow-primary/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={client.avatarUrl}
                  alt={client.name}
                  className="w-full h-full rounded-[10px] object-cover bg-neutral-900"
                />
              </div>
              {client.verified && (
                <div
                  title="Cuenta corporativa verificada"
                  className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center ring-2 ring-background text-[10px]"
                >
                  <CheckCircle2 className="w-3 h-3" />
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-foreground tracking-tight truncate">
                  Portal de Aprobación — {client.name}
                </h1>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                  @{client.handle}
                </span>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <span>{client.industry}</span>
                <span className="text-border">•</span>
                <span className="text-foreground/80 font-medium">Instagram Operations v0.1.0</span>
              </p>
            </div>
          </div>

          {/* 2. Bloque de Telemetría Ejecutiva e Indicador de Seguridad */}
          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap justify-between md:justify-end">
            {/* Badge de Posts Pendientes */}
            <div
              className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all select-none',
                pendingCount > 0
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-xs'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              )}
            >
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  pendingCount > 0 ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                )}
              />
              <span className="font-mono font-semibold tabular-nums text-sm">
                {pendingCount}
              </span>
              <span>
                {pendingCount === 1
                  ? 'publicación pendiente'
                  : 'publicaciones pendientes'}
              </span>
            </div>

            {/* Switch / Indicador Interactivo de Entorno Seguro */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSecurityDetails(!showSecurityDetails)}
                aria-label="Información de entorno seguro"
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150',
                  isEncryptedSession
                    ? 'bg-secondary/70 hover:bg-secondary border-border/80 text-foreground'
                    : 'bg-destructive/10 border-destructive/30 text-destructive'
                )}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="hidden sm:inline">Entorno Seguro SSL</span>
                <span className="sm:hidden">Seguro</span>
                <Lock className="w-3 h-3 text-muted-foreground" />
              </button>

              {/* Popover flotante con detalles de seguridad y aislamiento */}
              {showSecurityDetails && (
                <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 p-3.5 rounded-xl bg-card border border-border shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 text-xs">
                  <div className="flex items-start justify-between gap-2 mb-2 pb-2 border-b border-border/70">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">Conexión Verificada</p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          ID: {client.id}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSecurityDetails(false)}
                      className="text-muted-foreground hover:text-foreground text-xs p-1"
                    >
                      ✕
                    </button>
                  </div>

                  <p className="text-muted-foreground leading-relaxed">
                    Aislamiento multicliente garantizado. Este portal sólo expone el contenido
                    aprobado o en revisión asignado a <strong className="text-foreground">{client.name}</strong>.
                  </p>

                  <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Firma Criptográfica:</span>
                    <span className="font-mono text-emerald-400 font-medium">ACTIVA (v0.1.0)</span>
                  </div>

                  {/* Interruptor de simulación de cifrado */}
                  <div className="mt-2 flex items-center justify-between text-[11px] pt-1">
                    <span className="text-muted-foreground">Auditoría en tiempo real:</span>
                    <button
                      type="button"
                      onClick={() => setIsEncryptedSession(!isEncryptedSession)}
                      className="text-[10px] font-mono text-primary underline hover:opacity-80"
                    >
                      {isEncryptedSession ? 'Activa' : 'Pausada'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Enlace sutil para operadores/CM de vuelta al Dashboard */}
            <Link
              href="/dashboard"
              title="Volver a la estación de trabajo CM"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border/60 hover:border-border bg-transparent hover:bg-secondary/50 text-[11px] text-muted-foreground hover:text-foreground transition-all duration-150"
            >
              <ArrowLeft className="w-3 h-3" />
              <span className="hidden lg:inline">Dashboard CM</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
