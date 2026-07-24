import { PrivacyExplainer } from './PrivacyExplainer';
import { ThemeToggle } from './ThemeToggle';

const headerClass =
  'flex items-center justify-between gap-4 border-b border-border bg-bg px-4 py-3';

export function AppHeader() {
  return (
    <header className={headerClass}>
      <span className="text-lg font-bold text-fg">PeerPoker</span>
      <nav className="flex items-center gap-2">
        <PrivacyExplainer />
        <ThemeToggle />
      </nav>
    </header>
  );
}
