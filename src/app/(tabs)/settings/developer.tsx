import { Container } from '@/components/basic/Container';
import { DeveloperSettingsContent } from '@/components/settings/DeveloperSettingsContent';

export default function DeveloperSettings() {
  return (
    <Container disablePadding safeAreaEdges={['left', 'right']}>
      <DeveloperSettingsContent />
    </Container>
  );
}
