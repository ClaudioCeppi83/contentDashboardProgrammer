/**
 * @file client-portal-validator.test.ts
 * @description Suite de pruebas unitarias forenses para el validador y sanitizador de clientId en el Portal de Cliente.
 * Valida la mitigación de vectores de Path Traversal, Cross-Site Scripting (XSS), caracteres de inyección y límites de longitud.
 */

import { describe, it, expect } from 'vitest';
import { validateClientId } from '@/application/validation/client-portal.validator';

describe('validateClientId - Suite de Certificación de Seguridad', () => {
  describe('Identificadores Válidos Canónicos', () => {
    it('debe aceptar identificadores alfanuméricos simples', () => {
      const res = validateClientId('client1');
      expect(res.isValid).toBe(true);
      expect(res.sanitizedClientId).toBe('client1');
      expect(res.errors).toHaveLength(0);
    });

    it('debe aceptar identificadores con guiones y guiones bajos intermedios', () => {
      const validCases = [
        'client-lumina',
        'brand_nike_2026',
        'agency-client-01',
        'c-1',
        'alpha_beta-gamma',
      ];

      for (const id of validCases) {
        const res = validateClientId(id);
        expect(res.isValid).toBe(true);
        expect(res.sanitizedClientId).toBe(id);
        expect(res.errors).toHaveLength(0);
      }
    });

    it('debe recortar espacios periféricos (trim) de forma segura', () => {
      const res = validateClientId('  client-lumina  ');
      expect(res.isValid).toBe(true);
      expect(res.sanitizedClientId).toBe('client-lumina');
    });

    it('debe aceptar identificadores con longitud límite permitida (64 caracteres)', () => {
      const maxLenId = 'a' + 'x'.repeat(62) + 'b'; // 64 caracteres exactos
      expect(maxLenId.length).toBe(64);
      const res = validateClientId(maxLenId);
      expect(res.isValid).toBe(true);
      expect(res.sanitizedClientId).toBe(maxLenId);
    });
  });

  describe('Mitigación de Path Traversal', () => {
    it('debe rechazar secuencias de directory traversal (../)', () => {
      const res = validateClientId('../../etc/passwd');
      expect(res.isValid).toBe(false);
      expect(res.sanitizedClientId).toBeNull();
      expect(res.errors.some((e) => e.includes('peligrosos') || e.includes('inválido'))).toBe(true);
    });

    it('debe rechazar rutas que contengan barras normales o invertidas', () => {
      const traversalCases = [
        'client/subfolder',
        'client\\subfolder',
        '/portal/admin',
        '..\\windows\\system32',
      ];

      for (const id of traversalCases) {
        const res = validateClientId(id);
        expect(res.isValid).toBe(false);
        expect(res.sanitizedClientId).toBeNull();
      }
    });

    it('debe rechazar secuencias de traversal codificadas en URL (%2e%2e, %2f)', () => {
      const res = validateClientId('%2e%2e%2fadmin');
      expect(res.isValid).toBe(false);
      expect(res.sanitizedClientId).toBeNull();
    });
  });

  describe('Mitigación de Cross-Site Scripting (XSS) e Inyección de Código', () => {
    it('debe rechazar etiquetas script y código HTML', () => {
      const xssCases = [
        '<script>alert(1)</script>',
        '<img src=x onerror=alert(1)>',
        'client<b',
        'client>b',
      ];

      for (const xss of xssCases) {
        const res = validateClientId(xss);
        expect(res.isValid).toBe(false);
        expect(res.sanitizedClientId).toBeNull();
      }
    });

    it('debe rechazar pseudo-protocolos ejecutables (javascript:, data:)', () => {
      const protoCases = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
      ];

      for (const p of protoCases) {
        const res = validateClientId(p);
        expect(res.isValid).toBe(false);
        expect(res.sanitizedClientId).toBeNull();
      }
    });

    it('debe rechazar caracteres de control y Null Bytes (\\0, %00)', () => {
      const nullByteCases = [
        'client\0admin',
        'client%00admin',
        'client\r\nheader:injected',
      ];

      for (const nb of nullByteCases) {
        const res = validateClientId(nb);
        expect(res.isValid).toBe(false);
        expect(res.sanitizedClientId).toBeNull();
      }
    });

    it('debe rechazar caracteres especiales de inyección SQL o Shell (; \' " $ | & `)', () => {
      const injectionCases = [
        "client' OR '1'='1",
        'client; rm -rf /',
        'client | cat /etc/passwd',
        'client$HOME',
        'client`whoami`',
      ];

      for (const inj of injectionCases) {
        const res = validateClientId(inj);
        expect(res.isValid).toBe(false);
        expect(res.sanitizedClientId).toBeNull();
      }
    });
  });

  describe('Restricciones de Longitud y Formato de Estructura', () => {
    it('debe rechazar valores nulos, undefined o no cadenas', () => {
      expect(validateClientId(null).isValid).toBe(false);
      expect(validateClientId(undefined).isValid).toBe(false);
      expect(validateClientId(12345).isValid).toBe(false);
      expect(validateClientId({}).isValid).toBe(false);
    });

    it('debe rechazar cadenas vacías o compuestas solo de espacios', () => {
      expect(validateClientId('').isValid).toBe(false);
      expect(validateClientId('   ').isValid).toBe(false);
    });

    it('debe rechazar identificadores menores a 2 caracteres', () => {
      const res = validateClientId('a');
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('Longitud'))).toBe(true);
    });

    it('debe rechazar identificadores mayores a 64 caracteres', () => {
      const tooLong = 'a' + 'x'.repeat(64) + 'b'; // 66 caracteres
      const res = validateClientId(tooLong);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('Longitud'))).toBe(true);
    });

    it('debe rechazar identificadores que inicien o terminen con guión o guión bajo', () => {
      expect(validateClientId('-client-lumina').isValid).toBe(false);
      expect(validateClientId('_client-lumina').isValid).toBe(false);
      expect(validateClientId('client-lumina-').isValid).toBe(false);
      expect(validateClientId('client-lumina_').isValid).toBe(false);
    });
  });
});
