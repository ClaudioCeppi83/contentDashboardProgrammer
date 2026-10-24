/**
 * @file storage.service.ts
 * @description Servicio de infraestructura para generación segura de Signed URLs en Cloud Storage.
 * Implementa el principio de Mínimo Privilegio Temporal (TTL <= 60 min) y restricción estricta a lectura (GET).
 */

import { getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { getFirebaseAdminApp } from '../firebase/firebase-admin.config';
import type { InstagramMediaAsset } from '@/domain/models/post.types';

export class StorageSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageSecurityError';
  }
}

export interface StorageBucketLike {
  file(path: string): {
    getSignedUrl(config: {
      version: 'v4';
      action: 'read';
      expires: number;
    }): Promise<[string]>;
  };
}

export const MAX_SIGNED_URL_TTL_MINUTES = 60;
export const MAX_SIGNED_URL_TTL_MS = MAX_SIGNED_URL_TTL_MINUTES * 60 * 1000;

export class StorageService {
  private bucket: StorageBucketLike | null;
  private readonly defaultTtlMinutes: number;

  constructor(bucket?: StorageBucketLike | null, defaultTtlMinutes = 60) {
    this.bucket = bucket ?? null;
    this.defaultTtlMinutes = defaultTtlMinutes;
  }

  private getBucket(): StorageBucketLike {
    if (this.bucket) {
      return this.bucket;
    }

    if (getApps().length === 0) {
      getFirebaseAdminApp();
    }

    const storage = getStorage();
    const bucketName =
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.GCS_BUCKET_NAME ||
      'social-ops-dashboard-media';

    this.bucket = storage.bucket(bucketName) as unknown as StorageBucketLike;
    return this.bucket;
  }

  /**
   * Sanitiza y valida la ruta de almacenamiento contra Directory Traversal y Null Byte Injection.
   */
  public sanitizeStoragePath(storagePath: string): string {
    if (!storagePath || typeof storagePath !== 'string') {
      throw new StorageSecurityError('La ruta de almacenamiento (storagePath) es requerida y debe ser un string válido.');
    }

    const trimmed = storagePath.trim();

    // Detección de Null Byte Injection
    if (trimmed.includes('\0')) {
      throw new StorageSecurityError('Null Byte Injection detectado en la ruta de almacenamiento.');
    }

    // Detección de Directory Traversal y rutas relativas peligrosas
    if (trimmed.includes('..') || trimmed.includes('\\') || trimmed.startsWith('/') || trimmed.startsWith('./')) {
      throw new StorageSecurityError('Directory Traversal detectado en la ruta de almacenamiento.');
    }

    // Caracteres permitidos: alfanuméricos, barras normales, guiones, barras bajas y puntos
    const safePathRegex = /^[a-zA-Z0-9_\-\.\/]+$/;
    if (!safePathRegex.test(trimmed)) {
      throw new StorageSecurityError('La ruta de almacenamiento contiene caracteres no permitidos.');
    }

    return trimmed;
  }

  /**
   * Genera una Signed URL segura de sólo lectura (HTTP GET) con expiración máxima estricta de 60 minutos.
   */
  async generateReadSignedUrl(
    storagePath: string,
    expiresInMinutes: number = this.defaultTtlMinutes
  ): Promise<string> {
    const cleanPath = this.sanitizeStoragePath(storagePath);

    if (typeof expiresInMinutes !== 'number' || Number.isNaN(expiresInMinutes) || expiresInMinutes <= 0) {
      throw new StorageSecurityError('El tiempo de expiración debe ser un número positivo.');
    }

    if (expiresInMinutes > MAX_SIGNED_URL_TTL_MINUTES) {
      throw new StorageSecurityError(
        `Violación de Mínimo Privilegio: la expiración solicitada (${expiresInMinutes} min) excede el máximo permitido de ${MAX_SIGNED_URL_TTL_MINUTES} minutos.`
      );
    }

    const now = Date.now();
    const expiresMs = now + expiresInMinutes * 60 * 1000;

    const bucket = this.getBucket();
    const file = bucket.file(cleanPath);

    // Forzado estricto: action es inmutablemente 'read' (HTTP GET) y version 'v4'
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: expiresMs,
    });

    return signedUrl;
  }

  /**
   * Genera en lote las Signed URLs para todos los assets multimedia de un post.
   */
  async generateMediaSignedUrls(
    mediaAssets: InstagramMediaAsset[],
    expiresInMinutes: number = this.defaultTtlMinutes
  ): Promise<Record<string, string>> {
    const signedUrlMap: Record<string, string> = {};

    for (const asset of mediaAssets) {
      const url = await this.generateReadSignedUrl(asset.storagePath, expiresInMinutes);
      signedUrlMap[asset.id] = url;
    }

    return signedUrlMap;
  }
}
