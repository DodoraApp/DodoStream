import { WifiOff } from 'lucide-react';

export function SessionEndedScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <div className="mb-6 rounded-full bg-red-500/10 p-6 text-red-400">
        <WifiOff size={64} strokeWidth={1.5} />
      </div>
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
        Session Ended
      </h1>
      <p className="max-w-sm text-zinc-400">
        Your connection has expired. Please restart the remote from your TV to generate a new link.
      </p>
    </div>
  );
}
