import { Container } from '@/components/basic/Container';
import { PlaybackSettingsContent } from '@/components/settings/PlaybackSettingsContent';

export default function PlaybackSettings() {
  return (
    <Container disablePadding safeAreaEdges={['left', 'right']}>
      <PlaybackSettingsContent />
    </Container>
  );
}
