/**
 * @file firestore.service.ts
 * @description Capa de persistencia tipada con PostDocument para Cloud Firestore.
 * Provee operaciones CRUD, consultas por cliente/estado y actualización transaccional atómica.
 */

import {
  type Firestore,
  type CollectionReference,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import type { PostDocument, PostState } from '@/domain/models/post.types';
import { getFirestoreDb } from './firebase-admin.config';

export const postConverter: FirestoreDataConverter<PostDocument> = {
  toFirestore(post: PostDocument) {
    return { ...post };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): PostDocument {
    return snapshot.data() as PostDocument;
  },
};

export class FirestoreService {
  private readonly db: Firestore;
  private readonly collectionName = 'posts';

  constructor(db?: Firestore) {
    this.db = db ?? getFirestoreDb();
  }

  private get collection(): CollectionReference<PostDocument> {
    return this.db.collection(this.collectionName).withConverter(postConverter);
  }

  async getPostById(postId: string): Promise<PostDocument | null> {
    const docSnap = await this.collection.doc(postId).get();
    if (!docSnap.exists) {
      return null;
    }
    return docSnap.data() ?? null;
  }

  async createPost(post: PostDocument): Promise<PostDocument> {
    const now = new Date().toISOString();
    const docToSave: PostDocument = {
      ...post,
      createdAt: post.createdAt || now,
      updatedAt: post.updatedAt || now,
    };
    await this.collection.doc(post.id).set(docToSave);
    return docToSave;
  }

  async updatePost(postId: string, data: Partial<PostDocument>): Promise<PostDocument> {
    const docRef = this.collection.doc(postId);
    const existing = await this.getPostById(postId);
    if (!existing) {
      throw new Error(`Post not found with ID: ${postId}`);
    }

    const updatedAt = new Date().toISOString();
    const updatedPost: PostDocument = {
      ...existing,
      ...data,
      id: postId,
      updatedAt,
    };

    await docRef.set(updatedPost);
    return updatedPost;
  }

  async listPostsByClient(clientId: string): Promise<PostDocument[]> {
    const snapshot = await this.collection.where('clientId', '==', clientId).get();
    return snapshot.docs.map((doc) => doc.data());
  }

  async listPostsByState(state: PostState, clientId?: string): Promise<PostDocument[]> {
    let query = this.collection.where('state', '==', state);
    if (clientId) {
      query = query.where('clientId', '==', clientId);
    }
    const snapshot = await query.get();
    return snapshot.docs.map((doc) => doc.data());
  }

  async transactionalStateUpdate(
    postId: string,
    expectedState: PostState,
    nextState: PostState,
    payload?: Partial<PostDocument>,
    expectedIdempotencyKey?: string
  ): Promise<PostDocument> {
    const docRef = this.collection.doc(postId);

    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);
      if (!snapshot.exists) {
        throw new Error(`Post no encontrado: ${postId}`);
      }

      const current = snapshot.data();
      if (!current) {
        throw new Error(`No fue posible leer los datos del post: ${postId}`);
      }

      if (current.state !== expectedState) {
        throw new Error(
          `Conflicto de estado FSM para el post ${postId}: se esperaba '${expectedState}', pero el estado actual es '${current.state}'.`
        );
      }

      if (expectedIdempotencyKey && current.idempotencyKey !== expectedIdempotencyKey) {
        throw new Error(
          `IdempotencyKey mismatch para el post ${postId}: tarea desactualizada o ya procesada.`
        );
      }

      const updatedAt = new Date().toISOString();
      const updatedPost: PostDocument = {
        ...current,
        ...payload,
        id: postId,
        state: nextState,
        updatedAt,
      };

      transaction.set(docRef, updatedPost);
      return updatedPost;
    });
  }
}
