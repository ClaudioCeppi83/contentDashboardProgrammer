/**
 * @file page.tsx
 * @description Ruta dinámica '/portal/[clientId]' para el Portal de Aprobación de Cliente.
 * Aislamiento multicliente estricto por el identificador de cliente recibido en los parámetros.
 */

import React from 'react';
import type { Metadata } from 'next';
import { ClientPortalView } from '@/components/client-portal/client-portal-view';
import { getClientProfile } from '@/components/client-portal/client-portal-types';

interface PageProps {
  params: Promise<{
    clientId: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { clientId } = await params;
  const client = getClientProfile(clientId);

  return {
    title: `Portal de Aprobación — ${client.name} | Social Ops Dashboard`,
    description: `Revisión ejecutiva, auditoría y aprobación de publicaciones para Instagram de ${client.name}.`,
  };
}

export default async function ClientPortalPage({ params }: PageProps) {
  const { clientId } = await params;

  return <ClientPortalView clientId={clientId} />;
}
