import { Container } from '@/components/basic/Container';
import { UISettingsContent } from '@/components/settings/UISettingsContent';

export default function UISettings() {
  return (
    <Container disablePadding safeAreaEdges={['left', 'right']}>
      <UISettingsContent />
    </Container>
  );
}
