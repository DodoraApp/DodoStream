import { Container } from '@/components/basic/Container';
import { HomeSettingsContent } from '@/components/settings/HomeSettingsContent';

export default function HomeSettings() {
  return (
    <Container disablePadding safeAreaEdges={['left', 'right']}>
      <HomeSettingsContent />
    </Container>
  );
}
