import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Params } from '@storybook/react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Linking } from 'react-native';
import { URL } from 'react-native-url-polyfill';
import { view } from './storybook.requires';

const controlSegments = new Set(['story', 'stories', 'storybook']);

const storageConfig = {
  getItem: AsyncStorage.getItem,
  setItem: AsyncStorage.setItem,
};

const slugifySegment = (segment: string) =>
  segment
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

const arraysMatch = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const getStoryIndexEntries = () => {
  const internalView = view as unknown as {
    _storyIndex?: {
      entries: Record<string, { title: string; name: string; id: string }>;
    };
  };
  return Object.values(internalView._storyIndex?.entries ?? {});
};

const matchStoryFromIndex = (segments: string[]) => {
  const normalizedSegments = segments.map(slugifySegment).filter(Boolean);
  if (normalizedSegments.length === 0) {
    return undefined;
  }

  const entries = getStoryIndexEntries();
  if (entries.length === 0) {
    return undefined;
  }

  if (normalizedSegments.length === 1) {
    const match = entries.find((entry) => slugifySegment(entry.name) === normalizedSegments[0]);
    if (match) {
      return match.id;
    }
  }

  const lastSegment = normalizedSegments.at(-1);
  const pathWithoutLast = normalizedSegments.slice(0, -1);

  for (const entry of entries) {
    const titleSegments = entry.title.split('/').map(slugifySegment).filter(Boolean);
    const storyNameSegment = slugifySegment(entry.name);
    const entryPathSegments = [...titleSegments, storyNameSegment];
    if (arraysMatch(entryPathSegments, normalizedSegments)) {
      return entry.id;
    }
    if (arraysMatch(titleSegments, normalizedSegments)) {
      return entry.id;
    }
  }

  if (lastSegment === 'default' && pathWithoutLast.length > 0) {
    const match = entries.find((entry) => {
      const titleSegments = entry.title.split('/').map(slugifySegment).filter(Boolean);
      return arraysMatch(titleSegments, pathWithoutLast);
    });
    if (match) {
      return match.id;
    }
  }

  return undefined;
};

/**
 * Translate path segments into the kebab-case story id Storybook expects.
 */
const resolveStoryIdFromPath = (segments: string[]) => {
  const normalized = segments
    .map((value) => slugifySegment(value))
    .filter(Boolean)
    .filter((value) => !controlSegments.has(value));

  if (normalized.length === 0) {
    return undefined;
  }

  if (normalized.length === 1) {
    return normalized[0];
  }

  const storyName = normalized[normalized.length - 1];
  const kind = normalized.slice(0, -1).join('-');
  return kind ? `${kind}--${storyName}` : storyName;
};

type DeepLinkConfig = Pick<Params, 'initialSelection' | 'onDeviceUI'>;

const defaultConfig: Partial<Params> = {
  storage: storageConfig,
};

export const StorybookUIWrapper = () => {
  const [deepLinkConfig, setDeepLinkConfig] = useState<DeepLinkConfig | {} | undefined>(undefined);
  const [url, setUrl] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const handleUrl = ({ url: incomingUrl }: { url: string }) => {
      setUrl(incomingUrl);
    };

    const subscription = Linking.addEventListener('url', handleUrl);

    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl === null) {
        setDeepLinkConfig({});
        return;
      }

      if (typeof initialUrl === 'string') {
        setUrl(initialUrl);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (url === undefined) {
      return;
    }

    if (url === null) {
      setDeepLinkConfig({});
      return;
    }

    try {
      const parsedURL = new URL(url);
      const explicitId = parsedURL.searchParams.get('id') ?? parsedURL.searchParams.get('storyId');
      const storyPathQuery =
        parsedURL.searchParams.get('path') ?? parsedURL.searchParams.get('storyPath');
      const pathnameSegments = parsedURL.pathname.split('/').filter(Boolean);
      const querySegments = storyPathQuery ? storyPathQuery.split('/').filter(Boolean) : [];
      const pathSegments = querySegments.length > 0 ? querySegments : pathnameSegments;
      const fromIndex = matchStoryFromIndex(pathSegments);
      const derivedId = resolveStoryIdFromPath(pathSegments);
      const initialSelection = explicitId ?? fromIndex ?? derivedId;

      if (initialSelection) {
        setDeepLinkConfig({
          initialSelection,
          onDeviceUI: false,
        });
      } else {
        setDeepLinkConfig({});
      }
    } catch (error) {
      console.warn('Storybook deep link parsing failed', error);
      setDeepLinkConfig({});
    }
  }, [url]);

  const storybookConfig = useMemo(() => {
    if (deepLinkConfig === undefined) {
      return undefined;
    }
    return {
      ...defaultConfig,
      ...deepLinkConfig,
    };
  }, [deepLinkConfig]);

  if (storybookConfig === undefined) {
    return null;
  }

  const StorybookUIRoot = view.getStorybookUI(storybookConfig);
  return <StorybookUIRoot />;
};
