/**
 * @file mock-publisher.provider.ts
 * @description Proveedor simulado (Mock) del puerto secundario SocialPublisherAdapter.
 * Empleado para pruebas unitarias, CI/CD y desarrollo local offline.
 */

import type {
  SocialPublisherAdapter,
  PublishOptions,
  PublishResult,
  MediaContainerProcessingState,
} from '@/domain/adapters/social-publisher.interface';
import type {
  PostDocument,
  InstagramMediaAsset,
  PreflightValidationResult,
} from '@/domain/models/post.types';
import { validateInstagramCopy } from '@/application/validation/preflight-copy.validator';
import { validateInstagramMedia } from '@/application/validation/preflight-media.validator';

export class MockPublisherProvider implements SocialPublisherAdapter {
  readonly platform = 'instagram';

  public shouldFail = false;
  public isTransientError = false;
  public failureMessage = 'Mock publisher simulated failure';
  public publishHistory: Array<{ post: PostDocument; options?: PublishOptions }> = [];

  async validatePreflight(post: PostDocument): Promise<PreflightValidationResult> {
    const copyRes = validateInstagramCopy(post.copy);
    const mediaRes = validateInstagramMedia(post.format, post.media);

    const errors = [...copyRes.errors, ...mediaRes.errors];
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async createMediaContainer(asset: InstagramMediaAsset, _caption: string): Promise<string> {
    return `mock_container_${asset.id}`;
  }

  async checkContainerStatus(_containerId: string): Promise<MediaContainerProcessingState> {
    return 'finished';
  }

  async publish(post: PostDocument, options?: PublishOptions): Promise<PublishResult> {
    this.publishHistory.push({ post, options });

    if (this.shouldFail) {
      return {
        success: false,
        error: this.failureMessage,
        isTransientError: this.isTransientError,
      };
    }

    return {
      success: true,
      platformPostId: `ig_${post.id}_${Date.now()}`,
      permalink: `https://www.instagram.com/p/mock_${post.id}/`,
      mediaContainerId: `container_${post.id}`,
    };
  }

  reset(): void {
    this.shouldFail = false;
    this.isTransientError = false;
    this.failureMessage = 'Mock publisher simulated failure';
    this.publishHistory = [];
  }
}
