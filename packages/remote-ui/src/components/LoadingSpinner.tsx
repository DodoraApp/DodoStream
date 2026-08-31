import { Loader2 } from 'lucide-react';

export function LoadingSpinner() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      <p className="text-zinc-400">Loading…</p>
    </div>
  );
}
