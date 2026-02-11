import { ReactNode } from 'react';
import { Box, Text } from '@/theme/theme';
import { LoadingIndicator } from './LoadingIndicator';
import { Button } from './Button';

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
  loadingMessage = 'Loading...',
  loadingComponent,
  errorMessage,
  onRetry,
  children,
  emptyMessage = 'No data available',
  isEmpty,
}: LoadingQueryProps<T>) {
  if (isLoading) {
    return loadingComponent ?? <LoadingIndicator message={loadingMessage} />;
  }

  if (isError) {
    return (
      <Box flex={1} justifyContent="center" alignItems="center" padding="l" gap="m">
        <Text variant="body" color="danger" textAlign="center">
          {errorMessage || error?.message || 'An error occurred'}
        </Text>
        {onRetry && <Button onPress={onRetry} variant="secondary" />}
      </Box>
    );
  }

  if (!data || (isEmpty && isEmpty(data))) {
    return (
      <Box flex={1} justifyContent="center" alignItems="center" padding="l">
        <Text variant="body" color="textSecondary" textAlign="center">
          {emptyMessage}
        </Text>
      </Box>
    );
  }

  return <>{children(data)}</>;
}
