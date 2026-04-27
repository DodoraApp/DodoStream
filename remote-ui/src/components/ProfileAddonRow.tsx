import React, { useState } from 'react';
import { GripVertical, Settings, ChevronDown, ChevronUp, Puzzle } from 'lucide-react';
import { Switch } from '@headlessui/react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Addon, AddonConfig } from '../api';

interface ProfileAddonRowProps {
  addon: Addon;
  isSortable: boolean;
  onToggleActive: (addon: Addon, isActive: boolean) => void;
  onUpdateConfig: (addon: Addon, configUpdates: Partial<AddonConfig>) => void;
}

const ProfileAddonRow = React.memo(function ProfileAddonRow({
  addon,
  isSortable,
  onToggleActive,
  onUpdateConfig,
}: ProfileAddonRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { config } = addon;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: addon.id, disabled: !isSortable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  const hasSubConfigs = config.isActive;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-zinc-900 border border-zinc-800 rounded-xl mb-3 overflow-hidden transition-colors ${
        isDragging ? 'shadow-xl shadow-black/50 border-indigo-500/50 opacity-90' : 'shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between p-3 sm:p-4">
        <div className="flex items-center gap-2 sm:gap-3 overflow-hidden pr-2 sm:pr-4 flex-1 min-w-0">
          {isSortable ? (
            <div
              {...attributes}
              {...listeners}
              style={{ touchAction: 'none' }}
              className="cursor-grab active:cursor-grabbing p-1 sm:p-1.5 text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-800 transition-colors"
            >
              <GripVertical size={18} />
            </div>
          ) : (
            <div className="w-6 sm:w-8" /> // Spacer to align with sortable items
          )}

          <div className="shrink-0 h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
            <Puzzle size={16} className="sm:hidden" />
            <Puzzle size={20} className="hidden sm:block" />
          </div>

          <div className="min-w-0 flex-1 cursor-default">
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <h3 className={`font-medium truncate ${config.isActive ? 'text-zinc-100' : 'text-zinc-500'}`}>
                {addon.name}
              </h3>
              <span className="text-xs text-zinc-500 sm:shrink-0">v{addon.version}</span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-500 mt-0.5 truncate">{addon.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          {addon.configurable && (
            <a
              href={addon.manifestUrl.replace('manifest.json', 'configure')}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 sm:p-2 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
              title="Configure Addon"
            >
              <Settings size={18} className="sm:hidden" />
              <Settings size={20} className="hidden sm:block" />
            </a>
          )}

          {hasSubConfigs && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 sm:p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              {isExpanded ? (
                <>
                  <ChevronUp size={18} className="sm:hidden" />
                  <ChevronUp size={20} className="hidden sm:block" />
                </>
              ) : (
                <>
                  <ChevronDown size={18} className="sm:hidden" />
                  <ChevronDown size={20} className="hidden sm:block" />
                </>
              )}
            </button>
          )}

          <Switch
            checked={config.isActive}
            onChange={(checked) => onToggleActive(addon, checked)}
            className={`${
              config.isActive ? 'bg-indigo-500' : 'bg-zinc-700'
            } relative inline-flex h-5 w-9 sm:h-6 sm:w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-900 sm:ml-2`}
          >
            <span
              className={`${
                config.isActive ? 'translate-x-5 sm:translate-x-6' : 'translate-x-1'
              } inline-block h-3 w-3 sm:h-4 sm:w-4 transform rounded-full bg-white transition-transform`}
            />
          </Switch>
        </div>
      </div>

      {hasSubConfigs && isExpanded && (
        <div className="px-3 sm:px-14 pb-4 pt-2 border-t border-zinc-800/50 bg-zinc-900/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">Visible on Home</span>
            <Switch
              checked={config.useCatalogsOnHome ?? true}
              onChange={(checked) => onUpdateConfig(addon, { useCatalogsOnHome: checked })}
              className={`${
                config.useCatalogsOnHome !== false ? 'bg-indigo-500' : 'bg-zinc-700'
              } relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none`}
            >
              <span className={`${config.useCatalogsOnHome !== false ? 'translate-x-5' : 'translate-x-1'} inline-block h-3 w-3 transform rounded-full bg-white transition-transform`} />
            </Switch>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">Use in Search</span>
            <Switch
              checked={config.useCatalogsInSearch ?? true}
              onChange={(checked) => onUpdateConfig(addon, { useCatalogsInSearch: checked })}
              className={`${
                config.useCatalogsInSearch !== false ? 'bg-indigo-500' : 'bg-zinc-700'
              } relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none`}
            >
              <span className={`${config.useCatalogsInSearch !== false ? 'translate-x-5' : 'translate-x-1'} inline-block h-3 w-3 transform rounded-full bg-white transition-transform`} />
            </Switch>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">Use for Subtitles</span>
            <Switch
              checked={config.useForSubtitles ?? false}
              onChange={(checked) => onUpdateConfig(addon, { useForSubtitles: checked })}
              className={`${
                config.useForSubtitles ? 'bg-indigo-500' : 'bg-zinc-700'
              } relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none`}
            >
              <span className={`${config.useForSubtitles ? 'translate-x-5' : 'translate-x-1'} inline-block h-3 w-3 transform rounded-full bg-white transition-transform`} />
            </Switch>
          </div>
        </div>
      )}
    </div>
  );
});

export { ProfileAddonRow };