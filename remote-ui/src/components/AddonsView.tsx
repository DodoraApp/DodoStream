import React, { useState, useCallback } from 'react';
import {
  Trash2,
  Settings,
  Puzzle,
  Plus,
  AlertCircle,
  Loader2,
  AlertTriangle,
  X,
} from 'lucide-react';
import { Profile, Addon } from '../api';
import { useAllAddonsQuery, useInstallAddonMutation, useRemoveAddonMutation } from '../queries';

interface AddonsViewProps {
  profiles: Profile[];
  onSessionEnded?: () => void;
}

interface AddonRowProps {
  addon: Addon;
  activeInProfiles: Profile[];
  profiles: Profile[];
  onRequestDelete: (addon: Addon) => void;
}

const AddonRow = React.memo(function AddonRow({
  addon,
  activeInProfiles,
  profiles,
  onRequestDelete,
}: AddonRowProps) {
  return (
    <div className="flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-xl mb-3 shadow-sm">
      <div className="flex items-center gap-4 overflow-hidden pr-4">
        <div className="shrink-0 h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
          <Puzzle size={20} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-zinc-100 truncate">{addon.name}</h3>
            <span className="shrink-0 text-xs text-zinc-500">v{addon.version}</span>
          </div>
          <p className="text-sm text-zinc-400 mt-0.5 truncate">{addon.description}</p>

          {activeInProfiles.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              {activeInProfiles.map((p) => {
                const profileIndex = profiles.findIndex((prof) => prof.id === p.id);
                return (
                  <div
                    key={p.id}
                    title={`Active in ${p.name}`}
                    className={`h-5 w-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center bg-[${profiles[profileIndex].color}] shadow-sm`}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {addon.configurable && (
          <a
            href={addon.manifestUrl.replace('manifest.json', 'configure')}
            target="_blank"
            rel="noreferrer"
            className="p-2 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
            title="Configure Addon">
            <Settings size={20} />
          </a>
        )}
        <button
          onClick={() => onRequestDelete(addon)}
          className="p-2 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
          title="Delete Addon">
          <Trash2 size={20} />
        </button>
      </div>
    </div>
  );
});

export function AddonsView({ profiles, onSessionEnded }: AddonsViewProps) {
  const [manifestUrl, setManifestUrl] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Addon | null>(null);

  const { addons, activeByProfile, isLoading, error } = useAllAddonsQuery(profiles, onSessionEnded);
  const installMutation = useInstallAddonMutation(onSessionEnded);
  const removeMutation = useRemoveAddonMutation(onSessionEnded);

  const handleInstall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manifestUrl.trim()) return;
    installMutation.mutate(manifestUrl.trim(), {
      onSuccess: () => setManifestUrl(''),
    });
  };

  const handleDelete = (addon: Addon) => {
    removeMutation.mutate(addon.id, {
      onSuccess: () => setPendingDelete(null),
    });
  };

  const handleRequestDelete = useCallback((addon: Addon) => {
    setPendingDelete(addon);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setPendingDelete(null);
  }, []);

  if (isLoading && addons.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-100">
        <Loader2 size={32} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Addons</h2>
        <p className="text-zinc-400">
          Addons are installed globally. Go to Profiles to activate and reorder per profile.
        </p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <form onSubmit={handleInstall} className="flex flex-col sm:flex-row gap-3">
          <input
            type="url"
            value={manifestUrl}
            onChange={(e) => setManifestUrl(e.target.value)}
            placeholder="https://example.com/manifest.json"
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            required
          />
          <button
            type="submit"
            disabled={installMutation.isPending || !manifestUrl.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap">
            {installMutation.isPending ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Plus size={20} />
            )}
            Install Addon
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle size={20} className="shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {installMutation.isError && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle size={20} className="shrink-0" />
          <p className="text-sm">
            {installMutation.error instanceof Error
              ? installMutation.error.message
              : 'Failed to install addon'}
          </p>
        </div>
      )}

      {removeMutation.isError && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle size={20} className="shrink-0" />
          <p className="text-sm">
            {removeMutation.error instanceof Error
              ? removeMutation.error.message
              : 'Failed to delete addon'}
          </p>
        </div>
      )}

      {pendingDelete && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={20} className="shrink-0 text-rose-400" />
          <p className="flex-1 text-sm text-rose-300">
            Delete <span className="font-medium text-rose-200">{pendingDelete.name}</span>? This
            cannot be undone.
          </p>
          <button
            onClick={() => handleDelete(pendingDelete)}
            disabled={removeMutation.isPending}
            className="shrink-0 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:opacity-50">
            {removeMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Delete'}
          </button>
          <button
            onClick={handleCancelDelete}
            className="shrink-0 p-2 text-rose-400 hover:text-rose-200 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>
      )}

      <div>
        {addons.length === 0 ? (
          <div className="text-center py-16 px-4 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl border-dashed">
            <Puzzle size={48} className="mx-auto text-zinc-600 mb-4" />
            <p className="text-zinc-400">No addons installed yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {addons.map((addon) => (
              <AddonRow
                key={addon.id}
                addon={addon}
                profiles={profiles}
                activeInProfiles={activeByProfile[addon.id] || []}
                onRequestDelete={handleRequestDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
