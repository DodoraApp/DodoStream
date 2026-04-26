import { Container } from '@/components/basic/Container';
import { Link, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Box, Text } from '@/theme/theme';

export default function NotFoundScreen() {
  const { t } = useTranslation('common');

  return (
    <Box flex={1} backgroundColor="mainBackground">
      <Stack.Screen options={{ title: t('oops') }} />
      <Container>
        <Text variant="subheader">{t('screen_not_found')}</Text>
        <Link href="/">
          <Box marginTop="m" paddingTop="m">
            <Text variant="body" color="textLink">
              {t('go_to_home')}
            </Text>
          </Box>
        </Link>
      </Container>
    </Box>
  );
}
