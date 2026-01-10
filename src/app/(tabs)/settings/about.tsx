import { Container } from '@/components/basic/Container';
import { AboutSettingsContent } from '@/components/settings/AboutSettingsContent';

export default function AboutSettings() {
  return (
    <Container disablePadding safeAreaEdges={['left', 'right']}>
      <AboutSettingsContent />
    </Container>
  );
}
