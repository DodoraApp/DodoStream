import React, { useState, useMemo } from 'react';
import { Loader2, AlertCircle, Puzzle } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Profile, Addon, AddonConfig } from '../api';
import {
  useProfileAddonsQuery,
  useReorderAddonsMutation,
  useToggleActiveMutation,
  useUpdateAddonConfigMutation,
} from '../queries';
import { ProfileAddonRow } from './ProfileAddonRow';

interface ProfilesViewProps {
  profiles: Profile[];
  onSessionEnded?: () => void;
}

export function ProfilesView({ profiles, onSessionEnded }: ProfilesViewProps) {
  const [selectedProfileId, setSelectedProfileId] = useState<string>(profiles[0]?.id ?? '');

  const { addons, isLoading, error, refetch } = useProfileAddonsQuery(
    selectedProfileId,
    onSessionEnded,
  );

  const reorderMutation = useReorderAddonsMutation(selectedProfileId, onSessionEnded);
  const toggleMutation = useToggleActiveMutation(selectedProfileId, onSessionEnded);
  const configMutation = useUpdateAddonConfigMutation(selectedProfileId, onSessionEnded);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeAddons = useMemo(() => addons.filter((a) => a.config.isActive), [addons]);
  const inactiveAddons = useMemo(() => addons.filter((a) => !a.config.isActive), [addons]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = activeAddons.findIndex((a) => a.id === active.id);
    const newIndex = activeAddons.findIndex((a) => a.id === over.id);
    const newActive = arrayMove(activeAddons, oldIndex, newIndex);

    const orderedIds = [...newActive.map((a) => a.id), ...inactiveAddons.map((a) => a.id)];
    reorderMutation.mutate(orderedIds);
  };

  const handleToggleActive = (addon: Addon, isActive: boolean) => {
    toggleMutation.mutate({ addonId: addon.id, isActive });
  };

  const handleUpdateConfig = (addon: Addon, configUpdates: Partial<AddonConfig>) => {
    configMutation.mutate({ addonId: addon.id, configUpdates });
  };

  if (profiles.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-100 text-zinc-400">
        No profiles found.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Profiles</h2>
        <p className="text-zinc-400">
          Activate, configure, and reorder addons per profile.
        </p>
      </div>

      {/* Profile Selector */}
      <div>
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">Select Profile</h2>
        <div className="flex items-center gap-3 overflow-x-auto pb-4 hide-scrollbar">
          {profiles.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedProfileId(p.id)}
              className={`shrink-0 px-4 py-2 rounded-full font-medium text-sm transition-colors flex items-center gap-3 ${
                selectedProfileId === p.id 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20' 
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              <div className="h-6 w-6 rounded-full bg-black/20 flex items-center justify-center text-xs font-bold text-current opacity-90">
                {p.name.charAt(0).toUpperCase()}
              </div>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
          <button 
            onClick={() => refetch()}
            className="text-sm font-medium text-rose-400 hover:text-rose-300"
          >
            Retry
          </button>
        </div>
      )}

      {/* Addons Sections */}
      {isLoading && addons.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-indigo-500" />
        </div>
      ) : addons.length === 0 ? (
        <div className="text-center py-16 px-4 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl border-dashed">
          <Puzzle size={48} className="mx-auto text-zinc-600 mb-4" />
          <p className="text-zinc-400">No addons found for this profile.</p>
        </div>
      ) : (
        <div className="space-y-10">
          
          {/* Active Addons */}
          <div>
            <h3 className="text-lg font-medium text-zinc-100 mb-4 flex items-center gap-2">
              Active Addons
              <span className="text-xs font-normal text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                {activeAddons.length}
              </span>
            </h3>
            
            {activeAddons.length === 0 ? (
              <p className="text-zinc-500 text-sm py-4">No active addons. Enable some below.</p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={activeAddons.map(a => a.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {activeAddons.map(addon => (
                      <ProfileAddonRow
                        key={addon.id}
                        addon={addon}
                        isSortable={true}
                        onToggleActive={handleToggleActive}
                        onUpdateConfig={handleUpdateConfig}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Inactive Addons */}
          {inactiveAddons.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-zinc-500 mb-4 flex items-center gap-2">
                Inactive Addons
                <span className="text-xs font-normal text-zinc-600 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full">
                  {inactiveAddons.length}
                </span>
              </h3>
              
              <div className="space-y-3 opacity-75 grayscale-50 transition-all hover:grayscale-0 hover:opacity-100">
                {inactiveAddons.map(addon => (
                  <ProfileAddonRow
                    key={addon.id}
                    addon={addon}
                    isSortable={false}
                    onToggleActive={handleToggleActive}
                    onUpdateConfig={handleUpdateConfig}
                  />
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
