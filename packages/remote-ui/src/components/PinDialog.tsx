import { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { setPin } from '../api';

interface PinDialogProps {
  onSuccess: () => void;
}

export function PinDialog({ onSuccess }: PinDialogProps) {
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim().length === 0) {
      setError('Please enter a PIN');
      return;
    }

    setPin(pinInput.trim());
    onSuccess();
  };

  return (
    <Dialog as="div" className="relative z-50" open onClose={() => {}}>
      <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-sm overflow-hidden rounded-2xl bg-zinc-900 p-6 shadow-2xl ring-1 ring-white/10">
          <DialogTitle as="h3" className="mb-2 text-xl font-semibold text-white">
            Enter PIN
          </DialogTitle>
          <p className="mb-6 text-sm text-zinc-400">
            Please enter the PIN shown on your TV to connect.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="number"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setError('');
                }}
                placeholder="e.g. 1234"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                autoFocus
              />
              {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500">
              Connect
            </button>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
