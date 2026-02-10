import { Container } from '@/components/basic/Container';
import { SyncSettingsContent } from '@/components/settings/SyncSettingsContent';

export default function SyncSettings() {
  return (
    <Container disablePadding safeAreaEdges={['left', 'right']}>
      <SyncSettingsContent />
    </Container>
  );
}
