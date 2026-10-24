'use client';

/**
 * @file schedule-modal.tsx
 * @description Modal interactivo para fijar fecha y hora al agendar una publicación.
 * Valida que la fecha sea estrictamente futura (> now + 2 minutos) según la FSM.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Calendar, AlertCircle } from 'lucide-react';

export interface ScheduleModalProps {
  isOpen: boolean;
  postTitle: string;
  currentScheduledAt?: string | null;
  onClose: () => void;
  onConfirm: (scheduledAtIso: string) => void;
  isSubmitting?: boolean;
}

export function ScheduleModal({
  isOpen,
  postTitle,
  currentScheduledAt,
  onClose,
  onConfirm,
  isSubmitting = false,
}: ScheduleModalProps) {
  // Inicializar con la fecha actual + 1 hora en formato 'YYYY-MM-DDTHH:mm'
  const getDefaultDateTime = useCallback(() => {
    if (currentScheduledAt) {
      const parsed = new Date(currentScheduledAt);
      if (!isNaN(parsed.getTime()) && parsed.getTime() > Date.now() + 2 * 60 * 1000) {
        return parsed.toISOString().slice(0, 16);
      }
    }
    const defaultDate = new Date(Date.now() + 60 * 60 * 1000);
    return defaultDate.toISOString().slice(0, 16);
  }, [currentScheduledAt]);

  const [dateTimeValue, setDateTimeValue] = useState(getDefaultDateTime);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDateTimeValue(getDefaultDateTime());
      setValidationError(null);
    }
  }, [isOpen, getDefaultDateTime]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateTimeValue) {
      setValidationError('Por favor selecciona una fecha y hora de publicación.');
      return;
    }

    const selectedTime = new Date(dateTimeValue).getTime();
    const minTime = Date.now() + 2 * 60 * 1000;

    if (isNaN(selectedTime) || selectedTime <= minTime) {
      setValidationError(
        'La fecha de publicación debe ser al menos 2 minutos posterior a la hora actual.'
      );
      return;
    }

    setValidationError(null);
    onConfirm(new Date(dateTimeValue).toISOString());
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Agendar Publicación de Instagram" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Banner del post */}
        <div className="p-3 rounded-lg bg-secondary/50 border border-border/80 flex items-start gap-3">
          <Calendar className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono font-semibold">
              Publicación a agendar
            </p>
            <p className="text-sm font-medium text-foreground truncate mt-0.5">{postTitle}</p>
          </div>
        </div>

        {/* Input datetime-local */}
        <div className="space-y-1.5">
          <label htmlFor="schedule-datetime" className="block text-xs font-medium text-foreground">
            Fecha y hora de despacho <span className="text-destructive">*</span>
          </label>
          <input
            id="schedule-datetime"
            type="datetime-local"
            value={dateTimeValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setDateTimeValue(e.target.value);
              if (validationError) setValidationError(null);
            }}
            min={new Date(Date.now() + 2 * 60 * 1000).toISOString().slice(0, 16)}
            className="w-full h-11 px-3 rounded-lg border border-input bg-card text-foreground font-mono text-xs focus:ring-2 focus:ring-primary focus:outline-none"
            required
          />
          <p className="text-[11px] text-muted-foreground">
            La tarea se programará en Google Cloud Tasks y se publicará automáticamente en Meta Graph API.
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
          <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting} disabled={isSubmitting}>
            Confirmar y Agendar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
