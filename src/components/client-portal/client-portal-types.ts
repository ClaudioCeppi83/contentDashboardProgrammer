/**
 * @file client-portal-types.ts
 * @description Tipos, interfaces y constantes para el Portal de Aprobación de Cliente.
 * Soporta aislamiento multicliente, perfiles de marca y filtrado por estado.
 */

import type { PostState } from '@/domain/models/post.types';

export type ClientPortalTab = 'pending' | 'approved_scheduled' | 'history_changes';

export interface ClientProfile {
  id: string;
  name: string;
  legalName?: string;
  handle: string;
  avatarUrl: string;
  industry: string;
  verified: boolean;
}

/**
 * Registro de marcas clientes conocidas para el MVP.
 * Se genera fallback dinámico elegante para cualquier otro clientId recibido.
 */
export const KNOWN_CLIENTS: Record<string, ClientProfile> = {
  'client-lumina': {
    id: 'client-lumina',
    name: 'Lumina Brand',
    legalName: 'Lumina Sustainable Fashion S.L.',
    handle: 'lumina_official',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    industry: 'Moda Sostenible & Vanguardia',
    verified: true,
  },
  'client-acme': {
    id: 'client-acme',
    name: 'Acme Studio',
    legalName: 'Acme Creative Studio Inc.',
    handle: 'acme_studio',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    industry: 'Diseño e Innovación Tecnológica',
    verified: true,
  },
};

/**
 * Obtiene el perfil del cliente o construye un fallback limpio y profesional.
 */
export function getClientProfile(clientId: string): ClientProfile {
  const normalized = clientId.trim().toLowerCase();
  if (KNOWN_CLIENTS[normalized]) {
    return KNOWN_CLIENTS[normalized];
  }

  // Generación amigable desde el slug del clientId (ej: 'client-nordic-living' -> 'Nordic Living')
  const cleanName = normalized
    .replace(/^client[-_]/, '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const displayName = cleanName ? `${cleanName} Brand` : 'Cliente Corporativo';
  const handleName = (cleanName ? cleanName.replace(/\s+/g, '_') : normalized).toLowerCase();

  return {
    id: normalized,
    name: displayName,
    handle: `${handleName}_official`,
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
    industry: 'Cuenta Corporativa Verificada',
    verified: true,
  };
}

/**
 * Mapeo de estados correspondientes a cada pestaña del portal.
 */
export const TAB_STATES: Record<ClientPortalTab, readonly PostState[]> = {
  pending: ['in_review'],
  approved_scheduled: ['approved', 'scheduled'],
  history_changes: ['published', 'changes_requested'],
};

/**
 * Formateador de fechas para el portal de cliente en español europeo.
 */
export function formatPortalDate(isoString?: string | null): string {
  if (!isoString) return 'Sin fecha agendada';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return isoString;
  }
}
