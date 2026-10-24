/**
 * @file instagram-graph.adapter.ts
 * @description Adaptador secundario concreto para publicación en Instagram mediante Meta Graph API.
 * Soporta Feed Posts (imagen/video), Reels y Carruseles con polling de contenedores y timeouts adaptativos.
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
import { classifyMetaGraphError } from './instagram-error.classifier';

export interface InstagramGraphConfig {
  accountId?: string;
  accessToken?: string;
  graphApiUrl?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
}

export class InstagramGraphAdapter implements SocialPublisherAdapter {
  readonly platform = 'instagram';

  private readonly accountId: string;
  private readonly accessToken: string;
  private readonly graphApiUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly pollIntervalMs: number;
  private readonly maxPollAttempts: number;

  constructor(config?: InstagramGraphConfig) {
    this.accountId =
      config?.accountId ||
      process.env.INSTAGRAM_ACCOUNT_ID ||
      process.env.IG_USER_ID ||
      '';
    this.accessToken =
      config?.accessToken ||
      process.env.INSTAGRAM_ACCESS_TOKEN ||
      process.env.META_ACCESS_TOKEN ||
      '';
    this.graphApiUrl =
      config?.graphApiUrl ||
      process.env.META_GRAPH_API_URL ||
      'https://graph.facebook.com/v21.0';
    this.fetchFn = config?.fetchFn ?? fetch;
    this.timeoutMs = config?.timeoutMs ?? 15000;
    this.pollIntervalMs = config?.pollIntervalMs ?? 1500;
    this.maxPollAttempts = config?.maxPollAttempts ?? 12;
  }

  async validatePreflight(post: PostDocument): Promise<PreflightValidationResult> {
    const copyResult = validateInstagramCopy(post.copy);
    const mediaResult = validateInstagramMedia(post.format, post.media);
    const errors = [...copyResult.errors, ...mediaResult.errors];

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async createMediaContainer(
    asset: InstagramMediaAsset,
    caption: string,
    extraOptions?: { isCarouselItem?: boolean; signedUrl?: string }
  ): Promise<string> {
    const mediaUrl = extraOptions?.signedUrl || asset.downloadUrl;
    const isVideo = asset.mimeType.startsWith('video/');
    const isReel = asset.aspectRatio === '9:16' && isVideo;

    const endpoint = `${this.graphApiUrl}/${this.accountId}/media`;
    const params: Record<string, string> = {
      access_token: this.accessToken,
    };

    if (extraOptions?.isCarouselItem) {
      params.is_carousel_item = 'true';
    } else if (caption) {
      params.caption = caption;
    }

    if (isVideo) {
      params.media_type = isReel && !extraOptions?.isCarouselItem ? 'REELS' : 'VIDEO';
      params.video_url = mediaUrl;
    } else {
      params.image_url = mediaUrl;
    }

    const data = await this.executeGraphRequest<{ id: string }>(endpoint, 'POST', params);
    return data.id;
  }

  async checkContainerStatus(containerId: string): Promise<MediaContainerProcessingState> {
    const url = `${this.graphApiUrl}/${containerId}?fields=status_code,status&access_token=${this.accessToken}`;
    const data = await this.executeGraphRequest<{ status_code: string; status?: string }>(url, 'GET');

    switch (data.status_code) {
      case 'FINISHED':
        return 'finished';
      case 'IN_PROGRESS':
        return 'in_progress';
      case 'ERROR':
      case 'EXPIRED':
      default:
        return 'error';
    }
  }

  async waitForContainerReady(containerId: string): Promise<void> {
    for (let attempt = 1; attempt <= this.maxPollAttempts; attempt++) {
      const status = await this.checkContainerStatus(containerId);
      if (status === 'finished') return;
      if (status === 'error') {
        throw new Error(`Contenedor ${containerId} falló con estado 'ERROR' en Meta Graph API.`);
      }
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }
    throw new Error(`Timeout al esperar el procesamiento del contenedor ${containerId}.`);
  }

  async publish(post: PostDocument, options?: PublishOptions): Promise<PublishResult> {
    if (!this.accountId || !this.accessToken) {
      return {
        success: false,
        error: 'Credenciales de Meta Graph API no configuradas (INSTAGRAM_ACCOUNT_ID o ACCESS_TOKEN ausentes).',
        isTransientError: false,
      };
    }

    try {
      let containerId: string;

      if (post.format === 'carousel') {
        containerId = await this.prepareCarouselContainer(post, options?.signedUrls);
      } else {
        const singleAsset = post.media[0];
        if (!singleAsset) {
          return { success: false, error: 'El post no contiene assets multimedia.', isTransientError: false };
        }
        const signedUrl = options?.signedUrls?.[singleAsset.id] || singleAsset.downloadUrl;
        containerId = await this.createMediaContainer(singleAsset, post.copy.caption, { signedUrl });

        if (singleAsset.mimeType.startsWith('video/')) {
          await this.waitForContainerReady(containerId);
        }
      }

      const publishEndpoint = `${this.graphApiUrl}/${this.accountId}/media_publish`;
      const publishData = await this.executeGraphRequest<{ id: string }>(publishEndpoint, 'POST', {
        creation_id: containerId,
        access_token: this.accessToken,
      });

      const platformPostId = publishData.id;
      const permalink = await this.fetchPermalink(platformPostId);

      if (post.copy.firstComment) {
        await this.postFirstComment(platformPostId, post.copy.firstComment).catch(() => {});
      }

      return {
        success: true,
        platformPostId,
        permalink,
        mediaContainerId: containerId,
      };
    } catch (err: unknown) {
      const classified = classifyMetaGraphError(err);
      return {
        success: false,
        error: classified.message,
        isTransientError: classified.isTransient,
      };
    }
  }

  private async prepareCarouselContainer(
    post: PostDocument,
    signedUrls?: Record<string, string>
  ): Promise<string> {
    const childIds: string[] = [];

    for (const asset of post.media) {
      const signedUrl = signedUrls?.[asset.id] || asset.downloadUrl;
      const childId = await this.createMediaContainer(asset, '', { isCarouselItem: true, signedUrl });

      if (asset.mimeType.startsWith('video/')) {
        await this.waitForContainerReady(childId);
      }
      childIds.push(childId);
    }

    const endpoint = `${this.graphApiUrl}/${this.accountId}/media`;
    const data = await this.executeGraphRequest<{ id: string }>(endpoint, 'POST', {
      media_type: 'CAROUSEL',
      children: childIds.join(','),
      caption: post.copy.caption,
      access_token: this.accessToken,
    });

    return data.id;
  }

  private async fetchPermalink(postId: string): Promise<string> {
    try {
      const url = `${this.graphApiUrl}/${postId}?fields=permalink&access_token=${this.accessToken}`;
      const data = await this.executeGraphRequest<{ permalink?: string }>(url, 'GET');
      return data.permalink || `https://www.instagram.com/p/${postId}/`;
    } catch {
      return `https://www.instagram.com/p/${postId}/`;
    }
  }

  private async postFirstComment(mediaId: string, comment: string): Promise<void> {
    const url = `${this.graphApiUrl}/${mediaId}/comments`;
    await this.executeGraphRequest(url, 'POST', {
      message: comment,
      access_token: this.accessToken,
    });
  }

  private async executeGraphRequest<T>(
    url: string,
    method: 'GET' | 'POST',
    params?: Record<string, string>
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let fullUrl = url;
    const init: RequestInit = {
      method,
      signal: controller.signal,
    };

    if (method === 'GET' && params) {
      const search = new URLSearchParams(params).toString();
      fullUrl = `${url}${url.includes('?') ? '&' : '?'}${search}`;
    } else if (method === 'POST' && params) {
      init.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
      init.body = new URLSearchParams(params).toString();
    }

    try {
      const res = await this.fetchFn(fullUrl, init);
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const classified = classifyMetaGraphError(null, res.status, json);
        const err = new Error(classified.message);
        (err as any).isTransient = classified.isTransient;
        (err as any).statusCode = res.status;
        (err as any).responseBody = json;
        throw err;
      }

      return json as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
