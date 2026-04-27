import { Puzzle, Users } from 'lucide-react';

export type ViewTab = 'addons' | 'profiles';

interface BottomNavProps {
  activeView: ViewTab;
  onViewChange: (view: ViewTab) => void;
}

const TAB_BASE =
  'flex flex-1 flex-col items-center gap-1 py-3 transition-colors text-[10px] font-medium uppercase tracking-wider';

export function BottomNav({ activeView, onViewChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 flex items-center justify-around border-t border-zinc-800 bg-zinc-900 pb-[env(safe-area-inset-bottom)]">
      <button
        onClick={() => onViewChange('addons')}
        className={`${TAB_BASE} ${activeView === 'addons' ? 'text-indigo-500' : 'text-zinc-400 hover:text-zinc-300'}`}>
        <Puzzle className="h-6 w-6" />
        <span>Addons</span>
      </button>
      <button
        onClick={() => onViewChange('profiles')}
        className={`${TAB_BASE} ${activeView === 'profiles' ? 'text-indigo-500' : 'text-zinc-400 hover:text-zinc-300'}`}>
        <Users className="h-6 w-6" />
        <span>Profiles</span>
      </button>
    </nav>
  );
}
