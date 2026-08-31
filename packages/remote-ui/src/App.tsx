import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AddonsView } from './components/AddonsView';
import { BottomNav, ViewTab } from './components/BottomNav';
import { DisconnectionBanner } from './components/DisconnectionBanner';
import { Header } from './components/Header';
import { LoadingSpinner } from './components/LoadingSpinner';
import { PinDialog } from './components/PinDialog';
import { ProfilesView } from './components/ProfilesView';
import { SessionEndedScreen } from './components/SessionEndedScreen';
import { api, isSessionEndedError, Profile, setPin } from './api';
import { queryKeys } from './queries';

const HEALTH_CHECK_INTERVAL_MS = 5_000;

function consumeUrlPin(): void {
  const params = new URLSearchParams(window.location.search);
  const pin = params.get('pin');
  if (!pin) return;

  setPin(pin);
  params.delete('pin');
  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
  window.history.replaceState({}, '', nextUrl);
}

export default function App() {
  const [hasPin, setHasPin] = useState(() => {
    consumeUrlPin();
    return Boolean(localStorage.getItem('dodostream_pin'));
  });
  const [view, setView] = useState<ViewTab>('addons');
  const [sessionEnded, setSessionEnded] = useState(false);
  const queryClient = useQueryClient();

  const profilesQuery = useQuery({
    queryKey: queryKeys.profiles.all,
    queryFn: api.getProfiles,
    enabled: hasPin && !sessionEnded,
    retry: false,
    refetchInterval: (query) =>
      query.state.status === 'success' ? HEALTH_CHECK_INTERVAL_MS : false,
  });

  // Detect session-ended errors from any fetch (initial or background refetch)
  useEffect(() => {
    if (profilesQuery.error && isSessionEndedError(profilesQuery.error)) {
      setSessionEnded(true);
    }
  }, [profilesQuery.error]);

  const handleSessionEnded = () => {
    setSessionEnded(true);
  };

  const handlePinSuccess = () => {
    setHasPin(true);
    void queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all });
  };

  // Derive status from query state — no manual state machine needed
  const status = (() => {
    if (sessionEnded) return 'session-ended' as const;
    if (!hasPin) return 'pin-required' as const;
    if (profilesQuery.status === 'error') {
      return isSessionEndedError(profilesQuery.error)
        ? ('session-ended' as const)
        : ('pin-required' as const);
    }
    if (profilesQuery.status === 'success') return 'ready' as const;
    return 'loading' as const; // pending with query enabled
  })();

  const profiles: Profile[] = profilesQuery.data ?? [];
  const isDisconnected = status === 'ready' && profilesQuery.error !== null;

  if (status === 'session-ended') {
    return <SessionEndedScreen />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 pb-[env(safe-area-inset-bottom)]">
      <Header />

      <main className="flex-1 pb-20">
        {status === 'ready' && isDisconnected && <DisconnectionBanner />}

        <div className="px-3 sm:px-4">
          {status === 'loading' && <LoadingSpinner />}

          {status === 'ready' && view === 'addons' && (
            <AddonsView profiles={profiles} onSessionEnded={handleSessionEnded} />
          )}

          {status === 'ready' && view === 'profiles' && (
            <ProfilesView profiles={profiles} onSessionEnded={handleSessionEnded} />
          )}

          {status === 'pin-required' && <PinDialog onSuccess={handlePinSuccess} />}
        </div>
      </main>

      {status === 'ready' && <BottomNav activeView={view} onViewChange={setView} />}
    </div>
  );
}
