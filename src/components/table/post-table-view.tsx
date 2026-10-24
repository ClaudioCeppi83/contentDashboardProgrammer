'use client';

/**
 * @file post-table-view.tsx
 * @description Vista tabular operativa de alta densidad (filas de 56px) con ordenamiento rápido,
 * selector interactivo de transiciones FSM y acceso directo a edición y portal de aprobación.
 */

import React, { useState, useMemo } from 'react';
import {
  ArrowUpDown,
  ExternalLink,
  Edit3,
  Trash2,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import type { PostDocument, PostState } from '@/domain/models/post.types';
import { VALID_POST_TRANSITIONS } from '@/domain/models/post.types';
import { StateBadge, FormatBadge, STATE_LABELS } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface PostTableViewProps {
  posts: PostDocument[];
  onEditPost: (post: PostDocument) => void;
  onTransitionPost: (postId: string, targetState: PostState) => void;
  onDeletePost: (postId: string) => void;
}

type SortField = 'title' | 'state' | 'scheduledAt' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export function PostTableView({
  posts,
  onEditPost,
  onTransitionPost,
  onDeletePost,
}: PostTableViewProps) {
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [activeDropdownPostId, setActiveDropdownPostId] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedPosts = useMemo(() => {
    return [...posts].sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      if (sortField === 'title') {
        valA = a.title.toLowerCase();
        valB = b.title.toLowerCase();
      } else if (sortField === 'state') {
        valA = a.state;
        valB = b.state;
      } else if (sortField === 'scheduledAt') {
        valA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
        valB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      } else {
        valA = new Date(a.createdAt).getTime();
        valB = new Date(b.createdAt).getTime();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [posts, sortField, sortDirection]);

  return (
    <div className="px-6 py-4 max-w-7xl mx-auto space-y-4">
      <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            {/* Cabecera de la Tabla */}
            <thead>
              <tr className="border-b border-border bg-secondary/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono select-none">
                <th className="py-3.5 px-4 w-14">Media</th>
                <th className="py-3.5 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('title')}
                    className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer"
                  >
                    <span>Título & Briefing</span>
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </button>
                </th>
                <th className="py-3.5 px-4 w-32">Formato</th>
                <th className="py-3.5 px-4 w-44">
                  <button
                    type="button"
                    onClick={() => handleSort('state')}
                    className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer"
                  >
                    <span>Estado FSM</span>
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </button>
                </th>
                <th className="py-3.5 px-4 w-44">
                  <button
                    type="button"
                    onClick={() => handleSort('scheduledAt')}
                    className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer"
                  >
                    <span>Fecha Programada</span>
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </button>
                </th>
                <th className="py-3.5 px-4 w-32 text-right">Acciones</th>
              </tr>
            </thead>

            {/* Filas de la Tabla (Alta densidad: h-14 / 56px) */}
            <tbody className="divide-y divide-border/60 text-sm">
              {sortedPosts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <p className="text-sm font-medium">No se encontraron publicaciones.</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Ajusta los filtros o crea una nueva publicación.
                    </p>
                  </td>
                </tr>
              ) : (
                sortedPosts.map((post) => {
                  const primaryMedia = post.media[0];
                  const allowedTransitions = VALID_POST_TRANSITIONS[post.state] || [];
                  const isDropdownOpen = activeDropdownPostId === post.id;

                  const formattedDate = post.scheduledAt
                    ? new Date(post.scheduledAt).toLocaleDateString('es-ES', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : null;

                  return (
                    <tr
                      key={post.id}
                      className="h-14 hover:bg-secondary/20 transition-colors group cursor-pointer"
                      onClick={() => onEditPost(post)}
                    >
                      {/* 1. Miniatura 40x40 px */}
                      <td className="py-2 px-4">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-secondary border border-border shrink-0 relative">
                          {primaryMedia ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={primaryMedia.downloadUrl}
                              alt={post.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              <AlertCircle className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 2. Título & Caption breve */}
                      <td className="py-2 px-4 max-w-xs">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {post.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {post.copy.caption || post.briefingScript || 'Sin copy redactado'}
                          </p>
                        </div>
                      </td>

                      {/* 3. Formato */}
                      <td className="py-2 px-4">
                        <FormatBadge
                          format={post.format}
                          aspectRatio={primaryMedia?.aspectRatio}
                          slideCount={post.format === 'carousel' ? post.media.length : undefined}
                        />
                      </td>

                      {/* 4. Selector Interactivo de Estado FSM */}
                      <td className="py-2 px-4 relative" onClick={(e) => e.stopPropagation()}>
                        <div className="relative inline-block">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveDropdownPostId(isDropdownOpen ? null : post.id)
                            }
                            className="inline-flex items-center gap-1 focus-visible:outline-none"
                            title="Cambiar estado de publicación"
                          >
                            <StateBadge state={post.state} size="sm" />
                          </button>

                          {/* Menú desplegable con ÚNICAMENTE transiciones autorizadas por la FSM */}
                          {isDropdownOpen && (
                            <div
                              className="absolute left-0 mt-1.5 w-48 rounded-xl border border-border bg-card p-1.5 shadow-xl z-40 animate-in fade-in-0 zoom-in-95"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <p className="px-2 py-1 text-[10px] font-mono font-semibold uppercase text-muted-foreground tracking-wider border-b border-border/50">
                                Transiciones válidas
                              </p>
                              {allowedTransitions.length === 0 ? (
                                <p className="px-2 py-2 text-xs text-muted-foreground italic">
                                  Estado terminal (sin transiciones)
                                </p>
                              ) : (
                                allowedTransitions.map((target) => (
                                  <button
                                    key={target}
                                    type="button"
                                    onClick={() => {
                                      onTransitionPost(post.id, target);
                                      setActiveDropdownPostId(null);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-foreground hover:bg-secondary flex items-center justify-between transition-colors cursor-pointer"
                                  >
                                    <span>{STATE_LABELS[target]}</span>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 5. Fecha Programada */}
                      <td className="py-2 px-4 text-xs font-mono text-muted-foreground">
                        {formattedDate ? (
                          <span className="inline-flex items-center gap-1.5 text-purple-400 bg-purple-500/10 px-2 py-1 rounded">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{formattedDate}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60 italic">Sin fecha</span>
                        )}
                      </td>

                      {/* 6. Acciones Rápidas */}
                      <td
                        className="py-2 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onEditPost(post)}
                            title="Editar en Drawer"
                            aria-label={`Editar post ${post.title}`}
                          >
                            <Edit3 className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              window.open(`/portal/${post.clientId}?post=${post.id}`, '_blank');
                            }}
                            title="Ver en Portal de Cliente"
                            aria-label="Abrir vista de revisión de cliente"
                          >
                            <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-primary" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onDeletePost(post.id)}
                            title="Eliminar post"
                            aria-label={`Eliminar post ${post.title}`}
                            className="hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
