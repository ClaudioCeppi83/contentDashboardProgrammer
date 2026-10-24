'use client';

/**
 * @file feedback-modal.tsx
 * @description Modal interactivo y accesible para solicitar cambios en una publicación.
 * Exige retroalimentación textual mandatoria para transicionar a 'changes_requested'.
 */

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { MessageSquareWarning, AlertCircle } from 'lucide-react';

export interface FeedbackModalProps {
  isOpen: boolean;
  postTitle: string;
  onClose: () => void;
  onConfirm: (feedback: string) => void;
  isSubmitting?: boolean;
}

export function FeedbackModal({
  isOpen,
  postTitle,
  onClose,
  onConfirm,
  isSubmitting = false,
}: FeedbackModalProps) {
  const [feedback, setFeedback] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Resetear estado al abrir
  useEffect(() => {
    if (isOpen) {
      setFeedback('');
      setValidationError(null);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = feedback.trim();
    if (!trimmed) {
      setValidationError('Por favor ingresa un comentario con los cambios solicitados.');
      return;
    }
    if (trimmed.length < 5) {
      setValidationError('El feedback debe tener al menos 5 caracteres descriptivos.');
      return;
    }

    setValidationError(null);
    onConfirm(trimmed);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Solicitar Cambios en la Publicación" maxWidth="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Banner contextual del post */}
        <div className="p-3 rounded-lg bg-secondary/50 border border-border/80 flex items-start gap-3">
          <MessageSquareWarning className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono font-semibold">
              Publicación seleccionada
            </p>
            <p className="text-sm font-medium text-foreground truncate mt-0.5">{postTitle}</p>
          </div>
        </div>

        {/* Input de feedback */}
        <div className="space-y-1.5">
          <label htmlFor="feedback-comment" className="block text-xs font-medium text-foreground">
            Motivo o instrucciones de cambio <span className="text-destructive">*</span>
          </label>
          <Textarea
            id="feedback-comment"
            value={feedback}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
              setFeedback(e.target.value);
              if (validationError) setValidationError(null);
            }}
            placeholder="Describe qué aspectos del copy, diseño o formato deben ser modificados por el Community Manager..."
            rows={4}
            autoFocus
            className="text-xs leading-relaxed"
          />
          <p className="text-[11px] text-muted-foreground">
            Este comentario se registrará en el historial de auditoría y devolverá el post al estado
            <span className="font-semibold text-amber-400"> 'Cambios Solicitados'</span>.
          </p>
        </div>

        {/* Alerta de validación */}
        {validationError && (
          <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Botones de acción */}
        <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="destructive"
            size="sm"
            isLoading={isSubmitting}
            disabled={!feedback.trim() || isSubmitting}
          >
            Confirmar y Solicitar Cambios
          </Button>
        </div>
      </form>
    </Modal>
  );
}
