import { Container } from '@/components/basic/Container';
import { DataSettingsContent } from '@/components/settings/DataSettingsContent';

export default function DataSettings() {
  return (
    <Container disablePadding safeAreaEdges={['left', 'right']} ignoreLeftInsetInLandscape>
      <DataSettingsContent />
    </Container>
  );
}
