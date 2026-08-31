import { DodoLogo } from './DodoLogo';

export function Header() {
  return (
    <header className="sticky top-0 z-10 bg-zinc-950/80 p-4 backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        <DodoLogo size={28} />
        <h1 className="text-xl font-semibold text-zinc-50">DodoStream Remote</h1>
      </div>
    </header>
  );
}
