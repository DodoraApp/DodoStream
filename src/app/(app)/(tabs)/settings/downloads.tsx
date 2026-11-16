import { Container } from '@/components/basic/Container';
import { DownloadsSettingsContent } from '@/components/settings/DownloadsSettingsContent';

export default function DownloadsSettings() {
  return (
    <Container disablePadding safeAreaEdges={['left', 'right']} ignoreLeftInsetInLandscape>
      <DownloadsSettingsContent />
    </Container>
  );
}
