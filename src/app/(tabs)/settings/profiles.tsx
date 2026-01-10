import { Container } from '@/components/basic/Container';
import { ProfilesSettingsContent } from '@/components/settings/ProfilesSettingsContent';

export default function ProfilesSettings() {
  return (
    <Container disablePadding safeAreaEdges={['left', 'right']}>
      <ProfilesSettingsContent />
    </Container>
  );
}
