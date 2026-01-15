import { Container } from '@/components/basic/Container';
import { SubtitlesSettingsContent } from '@/components/settings/SubtitlesSettingsContent';

export default function SubtitlesSettings() {
  return (
    <Container disablePadding safeAreaEdges={['left', 'right']}>
      <SubtitlesSettingsContent />
    </Container>
  );
}
