import { LayoutGrid, Calendar, Table2, Instagram } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="max-w-2xl space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary border border-primary/20">
          <Instagram className="w-3.5 h-3.5" />
          Social Ops Dashboard v0.1.0 • Fase 0 Foundation
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Operaciones de Contenido Instagram-First
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg">
          Flujo de trabajo desacoplado, alta densidad operativa y aprobación sin fricción entre CM y Cliente.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-left">
          <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
            <LayoutGrid className="w-5 h-5 text-primary mb-2" />
            <h3 className="font-semibold text-sm">Kanban Operativo</h3>
            <p className="text-xs text-muted-foreground mt-1">Gestión fluida de estados desde Idea hasta Publicado.</p>
          </div>
          <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
            <Calendar className="w-5 h-5 text-primary mb-2" />
            <h3 className="font-semibold text-sm">Calendario Editorial</h3>
            <p className="text-xs text-muted-foreground mt-1">Reprogramación visual y balance de parrilla.</p>
          </div>
          <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
            <Table2 className="w-5 h-5 text-primary mb-2" />
            <h3 className="font-semibold text-sm">Vista Tabular</h3>
            <p className="text-xs text-muted-foreground mt-1">Alta densidad de datos y filtrado masivo.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
