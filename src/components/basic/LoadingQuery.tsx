import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/theme/theme';

import { Button } from './Button';
import { LoadingIndicator } from './LoadingIndicator';

interface LoadingQueryProps<T> {
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  data?: T;
  loadingMessage?: string;
  loadingComponent?: ReactNode;
  errorMessage?: string;
  onRetry?: () => void;
  children: (data: T) => ReactNode;
  emptyMessage?: string;
  isEmpty?: (data: T) => boolean;
}

export function LoadingQuery<T>({
  isLoading,
  isError,
  error,
  data,
  loadingMessage,
  loadingComponent,
  errorMessage,
  onRetry,
  children,
  emptyMessage,
  isEmpty,
}: LoadingQueryProps<T>) {
  const { t } = useTranslation('common');

  if (isLoading) {
    return loadingComponent ?? <LoadingIndicator message={loadingMessage ?? t('loading')} />;
  }

  if (isError) {
    return (
      <Box flex={1} justifyContent="center" alignItems="center" padding="l" gap="m">
        <Text variant="body" color="danger" textAlign="center">
          {errorMessage || error?.message || t('unexpected_error')}
        </Text>
        {onRetry && <Button onPress={onRetry} variant="secondary" title={t('retry')} />}
      </Box>
    );
  }

  if (!data || (isEmpty && isEmpty(data))) {
    return (
      <Box flex={1} justifyContent="center" alignItems="center" padding="l">
        <Text variant="body" color="textSecondary" textAlign="center">
          {emptyMessage ?? t('no_data')}
        </Text>
      </Box>
    );
  }

  return <>{children(data)}</>;
}
