import { FC, memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { SIMKL_PIN_DOMAIN, SIMKL_PIN_URL } from '@/api/simkl/config';
import { completeSimklConnection, useSimklPinAuth, useSimklSync } from '@/api/simkl/hooks';
import { TRAKT_ACTIVATE_DOMAIN, TRAKT_ACTIVATE_URL } from '@/api/trakt/config';
import { completeTraktConnection, useTraktPinAuth, useTraktSync } from '@/api/trakt/hooks';
import { SimklLogo } from '@/components/basic/SimklLogo';
import { TraktLogo } from '@/components/basic/TraktLogo';
import { IntegrationFirstConnectModal } from '@/components/settings/IntegrationFirstConnectModal';
import { IntegrationPinAuthModal } from '@/components/settings/IntegrationPinAuthModal';
import { IntegrationSettingsCard } from '@/components/settings/IntegrationSettingsCard';
import { SIMKL_PIN_TIMEOUT_S, TOAST_DURATION_SHORT } from '@/constants/ui';
import { useIntegrationsStore } from '@/store/integrations.store';
import { useProfileStore } from '@/store/profile.store';
import { showToast } from '@/store/toast.store';
import { Box } from '@/theme/theme';
import type { SimklConnection, SyncMode, TraktConnection } from '@/types/integrations';
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('IntegrationsSettingsContent');

interface IntegrationsSettingsContentProps {
  scrollable?: boolean;
}

export const IntegrationsSettingsContent: FC<IntegrationsSettingsContentProps> = memo(
  ({ scrollable = true }) => {
    const { t } = useTranslation('settings');
    const activeProfileId = useProfileStore((s) => s.activeProfileId);

    const simklSettings = useIntegrationsStore((s) =>
      activeProfileId ? s.settings[activeProfileId]?.simkl : undefined
    );
    const traktSettings = useIntegrationsStore((s) =>
      activeProfileId ? s.settings[activeProfileId]?.trakt : undefined
    );

    const simklConnected = !!simklSettings?.connection;
    const traktConnected = !!traktSettings?.connection;

    const { disconnectSimkl, disconnectTrakt, setSyncMode } = useIntegrationsStore();

    const {
      sync: syncSimkl,
      isSyncing: isSimklSyncing,
      lastSyncAt: simklLastSyncAt,
    } = useSimklSync(activeProfileId);

    const {
      sync: syncTrakt,
      isSyncing: isTraktSyncing,
      lastSyncAt: traktLastSyncAt,
    } = useTraktSync(activeProfileId);

    const [showSimklPinModal, setShowSimklPinModal] = useState(false);
    const [pendingSimklConnection, setPendingSimklConnection] = useState<SimklConnection | null>(
      null
    );
    const [showSimklFirstConnectModal, setShowSimklFirstConnectModal] = useState(false);

    const handleSimklPinSuccess = useCallback(
      async (accessToken: string) => {
        setShowSimklPinModal(false);
        if (!activeProfileId) return;
        try {
          const connection = await completeSimklConnection(activeProfileId, accessToken);
          setPendingSimklConnection(connection);
          setShowSimklFirstConnectModal(true);
        } catch (error) {
          debug('completeSimklConnectionError', { error });
          showToast({
            title: t('simkl.connection_failed'),
            message: t('simkl.connection_failed_desc'),
            preset: 'error',
            duration: TOAST_DURATION_SHORT,
          });
        }
      },
      [activeProfileId, t]
    );
    const simklPinAuth = useSimklPinAuth(handleSimklPinSuccess);

    const handleSimklFirstConnectConfirm = useCallback(
      async (syncMode: SyncMode, clearLocal: boolean) => {
        if (!activeProfileId || !pendingSimklConnection) return;
        useIntegrationsStore
          .getState()
          .connectSimkl(activeProfileId, pendingSimklConnection, syncMode);

        const { runImport, runExport } = await import('@/api/simkl/sync-service');
        if (syncMode === 'pull' || syncMode === 'full') {
          await runImport(activeProfileId, pendingSimklConnection.accessToken, undefined, {
            clearLocalFirst: clearLocal,
          });
        }
        if (syncMode === 'push' || syncMode === 'full') {
          await runExport(activeProfileId, pendingSimklConnection.accessToken);
        }
      },
      [activeProfileId, pendingSimklConnection]
    );
    const handleSimklFirstConnectDone = useCallback(() => {
      setShowSimklFirstConnectModal(false);
      setPendingSimklConnection(null);
      showToast({ title: t('simkl.connected'), duration: TOAST_DURATION_SHORT });
    }, [t]);
    const [showTraktAuthModal, setShowTraktAuthModal] = useState(false);
    const [pendingTraktConnection, setPendingTraktConnection] = useState<TraktConnection | null>(
      null
    );
    const [showTraktFirstConnectModal, setShowTraktFirstConnectModal] = useState(false);

    const handleTraktAuthSuccess = useCallback(
      async (accessToken: string, refreshToken: string, expiresAt: number) => {
        setShowTraktAuthModal(false);
        if (!activeProfileId) return;
        try {
          const connection = await completeTraktConnection(
            activeProfileId,
            accessToken,
            refreshToken,
            expiresAt
          );
          setPendingTraktConnection(connection);
          setShowTraktFirstConnectModal(true);
        } catch (error) {
          debug('completeTraktConnectionError', { error });
          showToast({
            title: t('trakt.connection_failed'),
            message: t('trakt.connection_failed_desc'),
            preset: 'error',
            duration: TOAST_DURATION_SHORT,
          });
        }
      },
      [activeProfileId, t]
    );
    const traktPinAuth = useTraktPinAuth(handleTraktAuthSuccess);

    const handleTraktFirstConnectConfirm = useCallback(
      async (syncMode: SyncMode, clearLocal: boolean) => {
        if (!activeProfileId || !pendingTraktConnection) return;
        useIntegrationsStore
          .getState()
          .connectTrakt(activeProfileId, pendingTraktConnection, syncMode);

        const { runImport, runExport } = await import('@/api/trakt/sync-service');
        if (syncMode === 'pull' || syncMode === 'full') {
          await runImport(activeProfileId, pendingTraktConnection.accessToken, undefined, {
            clearLocalFirst: clearLocal,
          });
        }
        if (syncMode === 'push' || syncMode === 'full') {
          await runExport(activeProfileId, pendingTraktConnection.accessToken);
        }
      },
      [activeProfileId, pendingTraktConnection]
    );

    const handleTraktFirstConnectDone = useCallback(() => {
      setShowTraktFirstConnectModal(false);
      setPendingTraktConnection(null);
      showToast({ title: t('trakt.connected'), duration: TOAST_DURATION_SHORT });
    }, [t]);
    const handleSimklDisconnect = useCallback(() => {
      if (!activeProfileId) return;
      disconnectSimkl(activeProfileId);
      showToast({ title: t('simkl.disconnected'), duration: TOAST_DURATION_SHORT });
    }, [activeProfileId, disconnectSimkl, t]);

    const handleSimklSyncModeChange = useCallback(
      (mode: SyncMode) => {
        if (!activeProfileId) return;
        setSyncMode(activeProfileId, 'simkl', mode);
      },
      [activeProfileId, setSyncMode]
    );

    const handleTraktDisconnect = useCallback(() => {
      if (!activeProfileId) return;
      disconnectTrakt(activeProfileId);
      showToast({ title: t('trakt.disconnected'), duration: TOAST_DURATION_SHORT });
    }, [activeProfileId, disconnectTrakt, t]);

    const handleTraktSyncModeChange = useCallback(
      (mode: SyncMode) => {
        if (!activeProfileId) return;
        setSyncMode(activeProfileId, 'trakt', mode);
      },
      [activeProfileId, setSyncMode]
    );
    const simklLogo = useMemo(() => <SimklLogo size="iconLarge" />, []);
    const traktLogo = useMemo(() => <TraktLogo size="iconLarge" />, []);
    const content = (
      <Box paddingVertical="m" paddingHorizontal="m" gap="l">
        <IntegrationSettingsCard
          title="Simkl"
          logo={simklLogo}
          websiteUrl="https://simkl.com/"
          i18nNs="simkl"
          settings={simklSettings}
          isSyncing={isSimklSyncing}
          lastSyncAt={simklLastSyncAt}
          onConnect={() => setShowSimklPinModal(true)}
          onDisconnect={handleSimklDisconnect}
          onSyncModeChange={handleSimklSyncModeChange}
          onSyncNow={syncSimkl}
          disabled={traktConnected && !simklConnected}
          disabledReason={
            traktConnected && !simklConnected ? t('simkl.other_connected') : undefined
          }
        />

        <IntegrationSettingsCard
          title="Trakt.tv"
          logo={traktLogo}
          websiteUrl="https://trakt.tv/"
          i18nNs="trakt"
          settings={traktSettings}
          isSyncing={isTraktSyncing}
          lastSyncAt={traktLastSyncAt}
          onConnect={() => setShowTraktAuthModal(true)}
          onDisconnect={handleTraktDisconnect}
          onSyncModeChange={handleTraktSyncModeChange}
          onSyncNow={syncTrakt}
          disabled={simklConnected && !traktConnected}
          disabledReason={
            simklConnected && !traktConnected ? t('trakt.other_connected') : undefined
          }
        />
      </Box>
    );

    return (
      <>
        {scrollable ? (
          <ScrollView showsVerticalScrollIndicator={false}>{content}</ScrollView>
        ) : (
          content
        )}
        {/* Modals */}
        <IntegrationPinAuthModal
          visible={showSimklPinModal}
          i18nNs="simkl"
          activateUrl={SIMKL_PIN_URL}
          activateDomain={SIMKL_PIN_DOMAIN}
          pinAuth={simklPinAuth}
          showCountdown
          countdownSeconds={SIMKL_PIN_TIMEOUT_S}
          onCancel={() => setShowSimklPinModal(false)}
        />
        {pendingSimklConnection && activeProfileId && (
          <IntegrationFirstConnectModal
            visible={showSimklFirstConnectModal}
            i18nNs="simkl"
            username={pendingSimklConnection.username}
            onConfirm={handleSimklFirstConnectConfirm}
            onDone={handleSimklFirstConnectDone}
          />
        )}
        <IntegrationPinAuthModal
          visible={showTraktAuthModal}
          i18nNs="trakt"
          activateUrl={TRAKT_ACTIVATE_URL}
          activateDomain={TRAKT_ACTIVATE_DOMAIN}
          pinAuth={traktPinAuth}
          onCancel={() => setShowTraktAuthModal(false)}
        />
        {pendingTraktConnection && activeProfileId && (
          <IntegrationFirstConnectModal
            visible={showTraktFirstConnectModal}
            i18nNs="trakt"
            username={pendingTraktConnection.username}
            onConfirm={handleTraktFirstConnectConfirm}
            onDone={handleTraktFirstConnectDone}
          />
        )}
      </>
    );
  }
);

IntegrationsSettingsContent.displayName = 'IntegrationsSettingsContent';
