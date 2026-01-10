import { FC, ReactNode, memo } from 'react';
import { Box } from '@/theme/theme';
import { useResponsiveLayout } from '@/hooks/useBreakpoint';
import { TVFocusGuideView } from 'react-native';

interface SettingsShellProps {
  /** Left panel content (menu, headings, profile switcher, etc.) */
  menu: ReactNode;
  /** Content to render in the right panel (or full screen on mobile) */
  children: ReactNode;
}

/**
 * Responsive settings container that provides split layout on wide screens
 *
 * On mobile: Renders only children (navigation handles menu)
 * On tablet/TV: Renders left menu + right content panel
 *
 * @example
 * <SettingsShell
 *   menuItems={SETTINGS_MENU_ITEMS}
 *   selectedId={selectedPage}
 *   onSelectItem={setSelectedPage}
 * >
 *   {selectedPage === 'playback' && <PlaybackSettingsContent />}
 *   {selectedPage === 'profiles' && <ProfilesSettingsContent />}
 * </SettingsShell>
 */
export const SettingsShell: FC<SettingsShellProps> = memo(({ menu, children }) => {
  const { splitLayout } = useResponsiveLayout();

  // Mobile: just render children, navigation is handled by Stack
  if (!splitLayout.enabled) {
    return <>{children}</>;
  }

  // Wide layout: split view with menu on left, content on right
  return (
    <Box flex={1} flexDirection="row">
      {/* Left panel - Menu */}
      <Box
        width={splitLayout.menuWidth}
        backgroundColor="cardBackground"
        borderRightWidth={1}
        borderRightColor="cardBorder"
        padding="s">
        {menu}
      </Box>

      {/* Right panel - Content */}
      <TVFocusGuideView style={{ flex: splitLayout.contentFlex }}>
        <Box flex={1} backgroundColor="mainBackground">
          {children}
        </Box>
      </TVFocusGuideView>
    </Box>
  );
});
