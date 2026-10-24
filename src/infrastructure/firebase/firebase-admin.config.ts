/**
 * @file firebase-admin.config.ts
 * @description Configuración limpia y singleton de Firebase Admin y Firestore para el backend.
 * Soporta entorno de emulador local (FIRESTORE_EMULATOR_HOST) y credenciales en la nube.
 */

import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let cachedFirestore: Firestore | null = null;

export function getFirebaseAdminApp(): App {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0]!;
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCP_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    'social-ops-dashboard-dev';

  // Si está presente el emulador local, inicializamos sin credenciales externas
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({ projectId });
  }

  // Si se provee la clave de cuenta de servicio en formato JSON
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      return initializeApp({
        credential: cert(serviceAccount),
        projectId,
      });
    } catch {
      // Fallback a Application Default Credentials (ADC)
      return initializeApp({ projectId });
    }
  }

  return initializeApp({ projectId });
}

export function getFirestoreDb(): Firestore {
  if (cachedFirestore) {
    return cachedFirestore;
  }

  const app = getFirebaseAdminApp();
  const db = getFirestore(app);

  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // Si ya fue configurado por otra invocación, ignoramos el error
  }

  cachedFirestore = db;
  return db;
}
