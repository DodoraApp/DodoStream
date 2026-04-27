import { WifiOff } from 'lucide-react';

export function DisconnectionBanner() {
  return (
    <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-400">
      <WifiOff className="h-4 w-4 shrink-0" />
      <p>
        Lost connection to DodoStream — make sure the app is open and Remote Control is active.
      </p>
    </div>
  );
}
