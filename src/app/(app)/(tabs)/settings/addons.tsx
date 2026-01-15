import { Container } from '@/components/basic/Container';
import { AddonsSettingsContent } from '@/components/settings/AddonsSettingsContent';

export default function AddonsSettings() {
  return (
    <Container disablePadding safeAreaEdges={['left', 'right']}>
      <AddonsSettingsContent />
    </Container>
  );
}
