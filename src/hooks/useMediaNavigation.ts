import { useCallback } from 'react';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { showToast } from '@/store/toast.store';
import { TOAST_DURATION_MEDIUM } from '@/constants/ui';
import { getLastStreamTarget, setLastStreamTarget } from '@/db';
import type { StreamTargetType } from '@/db/schema';
import type { ContentType, Stream } from '@/types/stremio';
import { useProfileStore } from '@/store/profile.store';

type StreamsBaseParams = {
  metaId: string;
  videoId: string;
  type: ContentType;
};

type StreamsExtraParams = Record<string, string | undefined>;

export type StreamTarget = { type: StreamTargetType; value: string };

type OpenStreamTargetArgs = {
  metaId: string;
  videoId: string | undefined;
  type: ContentType;
  title?: string;
  bingeGroup?: string;
  backgroundImage?: string;
  logoImage?: string;
  target: StreamTarget;
  navigation?: 'push' | 'replace';
  fromAutoPlay?: boolean;
  onExternalOpened?: () => void;
  onExternalOpenFailed?: () => void;
};

type OpenStreamFromStreamArgs = {
  metaId: string;
  videoId: string | undefined;
  type: ContentType;
  title?: string;
  backgroundImage?: string;
  logoImage?: string;
  stream: Stream;
  navigation?: 'push' | 'replace';
  fromAutoPlay?: boolean;
  onExternalOpened?: () => void;
  onExternalOpenFailed?: () => void;
};

export const useMediaNavigation = () => {
  const router = useRouter();
  const activeProfileId = useProfileStore((state) => state.activeProfileId);

  const navigateToDetails = useCallback(
    (id: string, type: ContentType) => {
      router.push({ pathname: '/details/[id]', params: { id, type } });
    },
    [router]
  );

  const pushToStreams = useCallback(
    (base: StreamsBaseParams, extras?: StreamsExtraParams) => {
      const params: Record<string, string | undefined> = { ...base, ...(extras ?? {}) };

      if (typeof params.autoPlay !== 'undefined' || !activeProfileId) {
        router.push({ pathname: '/streams', params });
        return;
      }

      void (async () => {
        const lastTarget = await getLastStreamTarget(activeProfileId, base.metaId, base.videoId);
        if (lastTarget) params.autoPlay = '1';
        router.push({ pathname: '/streams', params });
      })();
    },
    [activeProfileId, router]
  );

  const replaceToStreams = useCallback(
    (base: StreamsBaseParams, extras?: StreamsExtraParams) => {
      const params: Record<string, string | undefined> = { ...base, ...(extras ?? {}) };

      if (typeof params.autoPlay !== 'undefined' || !activeProfileId) {
        router.replace({ pathname: '/streams', params });
        return;
      }

      void (async () => {
        const lastTarget = await getLastStreamTarget(activeProfileId, base.metaId, base.videoId);
        if (lastTarget) params.autoPlay = '1';
        router.replace({ pathname: '/streams', params });
      })();
    },
    [activeProfileId, router]
  );

  const openStreamTarget = useCallback(
    async ({
      metaId,
      videoId,
      type,
      title,
      bingeGroup,
      backgroundImage,
      logoImage,
      target,
      navigation = 'push',
      fromAutoPlay,
      onExternalOpened,
      onExternalOpenFailed,
    }: OpenStreamTargetArgs): Promise<boolean> => {
      if (target.type === 'url') {
        const nav = navigation === 'replace' ? router.replace : router.push;
        nav({
          pathname: '/play',
          params: {
            source: target.value,
            title,
            metaId,
            type,
            videoId,
            bingeGroup,
            backgroundImage,
            logoImage,
            fromAutoPlay: fromAutoPlay ? '1' : undefined,
          },
        });
        return true;
      }

      const url =
        target.type === 'yt' ? `https://www.youtube.com/watch?v=${target.value}` : target.value;

      try {
        await Linking.openURL(url);
        if (activeProfileId) {
          await setLastStreamTarget({
            profileId: activeProfileId,
            metaId,
            videoId,
            type,
            target,
          });
        }
        onExternalOpened?.();
        return true;
      } catch {
        showToast({
          title: 'Unable to open link',
          message: url,
          preset: 'error',
          duration: TOAST_DURATION_MEDIUM,
        });
        onExternalOpenFailed?.();
        return false;
      }
    },
    [activeProfileId, router]
  );

  const openStreamFromStream = useCallback(
    async ({
      metaId,
      videoId,
      type,
      title,
      backgroundImage,
      logoImage,
      stream,
      navigation,
      fromAutoPlay,
      onExternalOpened,
      onExternalOpenFailed,
    }: OpenStreamFromStreamArgs): Promise<boolean> => {
      if (stream.url) {
        return openStreamTarget({
          metaId,
          videoId,
          type,
          title,
          bingeGroup: stream.behaviorHints?.group,
          backgroundImage,
          logoImage,
          target: { type: 'url', value: stream.url },
          navigation,
          fromAutoPlay,
        });
      }

      if (stream.externalUrl) {
        return openStreamTarget({
          metaId,
          videoId,
          type,
          title,
          target: { type: 'external', value: stream.externalUrl },
          navigation,
          onExternalOpened,
          onExternalOpenFailed,
        });
      }

      if (stream.ytId) {
        return openStreamTarget({
          metaId,
          videoId,
          type,
          title,
          target: { type: 'yt', value: stream.ytId },
          navigation,
          onExternalOpened,
          onExternalOpenFailed,
        });
      }

      return false;
    },
    [openStreamTarget]
  );

  return {
    navigateToDetails,
    pushToStreams,
    replaceToStreams,
    openStreamTarget,
    openStreamFromStream,
  };
};
