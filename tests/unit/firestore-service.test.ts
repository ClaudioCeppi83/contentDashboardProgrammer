import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { FirestoreService } from '@/infrastructure/firebase/firestore.service';
import type { PostDocument } from '@/domain/models/post.types';

describe('FirestoreService', () => {
  let mockDb: any;
  let service: FirestoreService;
  let mockStore: Map<string, PostDocument>;

  const samplePost: PostDocument = {
    id: 'post-1',
    clientId: 'client-alpha',
    authorId: 'cm-1',
    title: 'Post Alpha',
    state: 'idea',
    platform: 'instagram',
    format: 'feed_post',
    copy: {
      caption: 'Sample',
      characterCount: 6,
      characterLimit: 2200,
      hashtags: [],
      isValid: true,
    },
    media: [],
    comments: [],
    createdAt: '2026-10-24T12:00:00.000Z',
    updatedAt: '2026-10-24T12:00:00.000Z',
  };

  beforeEach(() => {
    mockStore = new Map();
    mockStore.set('post-1', { ...samplePost });

    const createQuery = (filters: Array<{ field: string; val: any }>) => ({
      where: vi.fn((field: string, _op: string, val: any) => {
        return createQuery([...filters, { field, val }]);
      }),
      get: vi.fn(async () => {
        let results = Array.from(mockStore.values());
        for (const f of filters) {
          results = results.filter((doc) => (doc as any)[f.field] === f.val);
        }
        return {
          docs: results.map((data) => ({
            data: () => data,
            id: data.id,
          })),
        };
      }),
    });

    const mockCollection = {
      doc: vi.fn((id: string) => ({
        get: vi.fn(async () => ({
          exists: mockStore.has(id),
          data: () => mockStore.get(id),
        })),
        set: vi.fn(async (data: PostDocument) => {
          mockStore.set(id, data);
        }),
      })),
      where: vi.fn((field: string, op: string, val: any) => {
        return createQuery([{ field, val }]);
      }),
    };

    mockDb = {
      collection: vi.fn(() => ({
        withConverter: vi.fn(() => mockCollection),
      })),
      runTransaction: vi.fn(async (updateFunction: (tx: any) => Promise<any>) => {
        const tx = {
          get: vi.fn(async (docRef: any) => {
            return docRef.get();
          }),
          set: vi.fn(async (docRef: any, data: PostDocument) => {
            return docRef.set(data);
          }),
        };
        return updateFunction(tx);
      }),
    } as unknown as Firestore;

    service = new FirestoreService(mockDb);
  });

  it('retrieves post by ID when found', async () => {
    const post = await service.getPostById('post-1');
    expect(post).not.toBeNull();
    expect(post?.id).toBe('post-1');
    expect(post?.title).toBe('Post Alpha');
  });

  it('returns null when post is not found', async () => {
    const post = await service.getPostById('non-existent');
    expect(post).toBeNull();
  });

  it('creates a new post with timestamps', async () => {
    const newPost: PostDocument = {
      ...samplePost,
      id: 'post-2',
      title: 'Post Beta',
      createdAt: '',
      updatedAt: '',
    };
    const created = await service.createPost(newPost);
    expect(created.id).toBe('post-2');
    expect(created.createdAt).toBeTruthy();
    expect(mockStore.has('post-2')).toBe(true);
  });

  it('updates an existing post', async () => {
    const updated = await service.updatePost('post-1', { title: 'Updated Title' });
    expect(updated.title).toBe('Updated Title');
    expect(mockStore.get('post-1')?.title).toBe('Updated Title');
  });

  it('throws error when updating non-existent post', async () => {
    await expect(
      service.updatePost('non-existent', { title: 'No Title' })
    ).rejects.toThrowError('Post not found');
  });

  it('lists posts filtered by client ID', async () => {
    const posts = await service.listPostsByClient('client-alpha');
    expect(posts).toHaveLength(1);
    expect(posts[0].clientId).toBe('client-alpha');
  });

  it('lists posts filtered by state and client', async () => {
    const posts = await service.listPostsByState('idea', 'client-alpha');
    expect(posts).toHaveLength(1);

    const empty = await service.listPostsByState('approved', 'client-alpha');
    expect(empty).toHaveLength(0);
  });

  describe('transactionalStateUpdate', () => {
    it('executes state transition atomically', async () => {
      const scheduledPost: PostDocument = {
        ...samplePost,
        state: 'scheduled',
        idempotencyKey: 'idemp-1234',
      };
      mockStore.set('post-1', scheduledPost);

      const result = await service.transactionalStateUpdate(
        'post-1',
        'scheduled',
        'publishing',
        undefined,
        'idemp-1234'
      );

      expect(result.state).toBe('publishing');
      expect(mockStore.get('post-1')?.state).toBe('publishing');
    });

    it('throws error on expectedState mismatch', async () => {
      await expect(
        service.transactionalStateUpdate('post-1', 'approved', 'scheduled')
      ).rejects.toThrowError("se esperaba 'approved', pero el estado actual es 'idea'");
    });

    it('throws error on idempotencyKey mismatch', async () => {
      const scheduledPost: PostDocument = {
        ...samplePost,
        state: 'scheduled',
        idempotencyKey: 'valid-key',
      };
      mockStore.set('post-1', scheduledPost);

      await expect(
        service.transactionalStateUpdate(
          'post-1',
          'scheduled',
          'publishing',
          undefined,
          'wrong-key'
        )
      ).rejects.toThrowError('IdempotencyKey mismatch');
    });
  });
});
