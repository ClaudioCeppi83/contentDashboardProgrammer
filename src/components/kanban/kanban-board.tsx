'use client';

/**
 * @file kanban-board.tsx
 * @description Tablero Kanban completo con renderizado de columnas por estado FSM,
 * desplazamiento horizontal suave y gestión reactiva de transiciones de post.
 */

import React from 'react';
import type { PostDocument, PostState } from '@/domain/models/post.types';
import { KanbanColumn } from './kanban-column';

const KANBAN_STATES: PostState[] = [
  'idea',
  'in_progress',
  'in_review',
  'changes_requested',
  'approved',
  'scheduled',
  'published',
  'failed',
];

interface KanbanBoardProps {
  posts: PostDocument[];
  onCardClick: (post: PostDocument) => void;
  onTransition: (postId: string, targetState: PostState) => void;
}

export function KanbanBoard({ posts, onCardClick, onTransition }: KanbanBoardProps) {
  return (
    <div className="w-full overflow-x-auto pb-6 pt-2">
      <div className="flex items-start gap-4 min-w-max px-6">
        {KANBAN_STATES.map((state) => {
          const columnPosts = posts.filter((p) => p.state === state);
          return (
            <KanbanColumn
              key={state}
              state={state}
              posts={columnPosts}
              onCardClick={onCardClick}
              onQuickTransition={onTransition}
              onDropPost={onTransition}
              allPosts={posts}
            />
          );
        })}
      </div>
    </div>
  );
}
