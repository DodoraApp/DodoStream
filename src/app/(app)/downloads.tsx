import { useTranslation } from 'react-i18next';

import { Stack, useLocalSearchParams } from 'expo-router';

import { Container } from '@/components/basic/Container';
import { DownloadsList } from '@/components/media/DownloadsList';
import { Box } from '@/theme/theme';

/** Downloads of the active profile, optionally limited to one movie or series. */
export default function DownloadsPage() {
  const { t } = useTranslation('media');
  const { metaId } = useLocalSearchParams<{ metaId?: string }>();

  return (
    <Container safeAreaEdges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: t('downloads') }} />
      <Box flex={1} paddingHorizontal="s" paddingTop="m">
        <DownloadsList metaId={metaId} />
      </Box>
    </Container>
  );
}
