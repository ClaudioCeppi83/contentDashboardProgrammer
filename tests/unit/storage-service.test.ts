/**
 * @file storage-service.test.ts
 * @description Suite de pruebas unitarias de seguridad para StorageService.
 * Certifica el Mínimo Privilegio Temporal (TTL <= 60 min), acción exclusiva de lectura (GET)
 * y protección contra Directory Traversal / Null Byte Injection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  StorageService,
  StorageSecurityError,
  MAX_SIGNED_URL_TTL_MINUTES,
  type StorageBucketLike,
} from '@/infrastructure/storage/storage.service';
import type { InstagramMediaAsset } from '@/domain/models/post.types';

describe('StorageService Security Unit Tests', () => {
  let mockFile: any;
  let mockBucket: StorageBucketLike;
  let service: StorageService;

  beforeEach(() => {
    mockFile = {
      getSignedUrl: vi.fn(async (config: any) => {
        return [`https://storage.googleapis.com/signed-url-mock?action=${config.action}&expires=${config.expires}`];
      }),
    };

    mockBucket = {
      file: vi.fn(() => mockFile),
    };

    service = new StorageService(mockBucket);
  });

  describe('1. Mínimo Privilegio Temporal (TTL <= 60 min)', () => {
    it('permite generar Signed URLs con TTL de 60 minutos o menor', async () => {
      const url = await service.generateReadSignedUrl('media/post-1/image1.jpg', 60);
      expect(url).toContain('https://storage.googleapis.com');
      expect(mockFile.getSignedUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 'v4',
          action: 'read',
          expires: expect.any(Number),
        })
      );
    });

    it('permite generar Signed URLs con TTL de 15 minutos', async () => {
      const before = Date.now();
      await service.generateReadSignedUrl('media/post-1/image1.jpg', 15);
      const after = Date.now();

      const config = mockFile.getSignedUrl.mock.calls[0][0];
      const diffMinutes = Math.round((config.expires - before) / (60 * 1000));
      expect(diffMinutes).toBe(15);
      expect(config.expires).toBeGreaterThanOrEqual(before + 15 * 60 * 1000);
      expect(config.expires).toBeLessThanOrEqual(after + 15 * 60 * 1000);
    });

    it('bloquea terminantemente peticiones de TTL superior a 60 minutos', async () => {
      await expect(
        service.generateReadSignedUrl('media/post-1/image1.jpg', 61)
      ).rejects.toThrowError(StorageSecurityError);

      await expect(
        service.generateReadSignedUrl('media/post-1/image1.jpg', 120)
      ).rejects.toThrowError(/excede el máximo permitido de 60 minutos/);
    });

    it('rechaza TTLs inválidos, negativos o no numéricos', async () => {
      await expect(
        service.generateReadSignedUrl('media/post-1/image1.jpg', 0)
      ).rejects.toThrowError(StorageSecurityError);

      await expect(
        service.generateReadSignedUrl('media/post-1/image1.jpg', -10)
      ).rejects.toThrowError(StorageSecurityError);

      await expect(
        service.generateReadSignedUrl('media/post-1/image1.jpg', Number.NaN)
      ).rejects.toThrowError(StorageSecurityError);
    });
  });

  describe('2. Restricción Estricta de Métodos HTTP (GET / Read-Only)', () => {
    it('garantiza que la configuración de Cloud Storage usa estrictamente action: "read"', async () => {
      await service.generateReadSignedUrl('media/post-1/image1.jpg', 30);
      const config = mockFile.getSignedUrl.mock.calls[0][0];
      expect(config.action).toBe('read');
      expect(config.action).not.toBe('write');
      expect(config.action).not.toBe('delete');
    });
  });

  describe('3. Sanitización de Entradas y Protección contra Path Traversal', () => {
    it('rechaza intentos de Directory Traversal con "../"', async () => {
      await expect(
        service.generateReadSignedUrl('../../etc/passwd', 30)
      ).rejects.toThrowError(/Directory Traversal detectado/);

      await expect(
        service.generateReadSignedUrl('media/../../secrets/service-account.json', 30)
      ).rejects.toThrowError(/Directory Traversal detectado/);
    });

    it('rechaza rutas con backslashes de Windows "..\\"', async () => {
      await expect(
        service.generateReadSignedUrl('media\\..\\secrets', 30)
      ).rejects.toThrowError(/Directory Traversal detectado/);
    });

    it('rechaza Null Byte Injection "\\0"', async () => {
      await expect(
        service.generateReadSignedUrl('media/safe.jpg\0.exe', 30)
      ).rejects.toThrowError(/Null Byte Injection detectado/);
    });

    it('rechaza rutas absolutas que inician con "/"', async () => {
      await expect(
        service.generateReadSignedUrl('/etc/shadow', 30)
      ).rejects.toThrowError(/Directory Traversal detectado/);
    });

    it('rechaza caracteres peligrosos de inyección de comandos o URLs', async () => {
      await expect(
        service.generateReadSignedUrl('media/post; rm -rf /', 30)
      ).rejects.toThrowError(/caracteres no permitidos/);

      await expect(
        service.generateReadSignedUrl('media/<script>alert(1)</script>', 30)
      ).rejects.toThrowError(/caracteres no permitidos/);
    });
  });

  describe('4. Generación en Lote para Media Assets', () => {
    it('genera URLs firmadas individualmente para cada asset respetando el mapa de IDs', async () => {
      const mockAssets: InstagramMediaAsset[] = [
        {
          id: 'asset-1',
          storagePath: 'clients/client-1/posts/post-1/image-1.jpg',
          downloadUrl: '',
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
          width: 1080,
          height: 1080,
          aspectRatio: '1:1',
          validationPassed: true,
        },
        {
          id: 'asset-2',
          storagePath: 'clients/client-1/posts/post-1/image-2.jpg',
          downloadUrl: '',
          mimeType: 'image/jpeg',
          sizeBytes: 2048,
          width: 1080,
          height: 1080,
          aspectRatio: '1:1',
          validationPassed: true,
        },
      ];

      const urlMap = await service.generateMediaSignedUrls(mockAssets, 45);
      expect(Object.keys(urlMap)).toHaveLength(2);
      expect(urlMap['asset-1']).toBeDefined();
      expect(urlMap['asset-2']).toBeDefined();
      expect(mockBucket.file).toHaveBeenCalledWith('clients/client-1/posts/post-1/image-1.jpg');
      expect(mockBucket.file).toHaveBeenCalledWith('clients/client-1/posts/post-1/image-2.jpg');
    });
  });
});
