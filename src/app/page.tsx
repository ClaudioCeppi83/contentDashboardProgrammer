/**
 * @file page.tsx
 * @description Ruta raíz / que renderiza la estación de trabajo principal del Social Ops Dashboard.
 */

import { DashboardView } from '@/components/dashboard/dashboard-view';

export const metadata = {
  title: 'Social Ops Dashboard | Instagram-First Content Operations',
  description: 'Gestión Kanban, Calendario Editorial Drag & Drop, Vista Tabular y Drawer con IA para Instagram.',
};

export default function Home() {
  return <DashboardView />;
}
