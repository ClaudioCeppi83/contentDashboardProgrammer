/**
 * @file page.tsx
 * @description Ruta principal /dashboard del Social Ops Dashboard.
 */

import { DashboardView } from '@/components/dashboard/dashboard-view';

export const metadata = {
  title: 'Dashboard Operativo | Social Ops Dashboard',
  description: 'Gestión Kanban, Calendario Editorial y Previsualización fidedigna de Instagram.',
};

export default function DashboardPage() {
  return <DashboardView />;
}
