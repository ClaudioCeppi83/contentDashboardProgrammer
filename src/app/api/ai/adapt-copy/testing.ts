/**
 * @file testing.ts
 * @description Inyección de servicios simulados para pruebas de integración de la ruta /api/ai/adapt-copy.
 */

import type { AICopyService } from '@/application/services/ai-copy.service';

let testingService: AICopyService | null = null;

export function setAICopyServiceForTesting(service: AICopyService | null): void {
  testingService = service;
}

export function getTestingAICopyService(): AICopyService | null {
  return testingService;
}
