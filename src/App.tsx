import { useEffect, useState } from 'react';
import { FlaskConical, RotateCcw } from 'lucide-react';
import { useStore } from './lib/store';
import { Button, SimBanner, cx, useConfirm, useToast } from './components/ui';
import Entry from './screens/Entry';
import Report from './screens/Report';
import Intelligence from './screens/Intelligence';
import Command from './screens/Command';

/** Routes are plain hash names (#report, #command-INC-2041) so links survive any static host or sandbox. */
export function toHash(path: string) {
  const parts = path.split('/').filter(Boolean);
  return parts.length ? `#${parts.join('-')}` : '#home';
}
export function navigate(path: string) {
  window.location.hash = toHash(path);
}
function parseHash(): string {
  const h = window.location.hash.replace(/^#\/?/, '');
  if (!h || h === 'home') return '/';
  if (h.includes('/')) return `/${h}`; // legacy #/x/y links
  const i = h.indexOf('-');
  return i === -1 ? `/${h}` : `/${h.slice(0, i)}/${h.slice(i + 1)}`;
}

function useHashRoute() {
  const get = parseHash;
  const [route, setRoute] = useState(get);
  useEffect(() => {
    const on = () => { setRoute(get()); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function Mark({ className = 'size-6' }: { className?: string }) {
  // Three streams meeting at one point: the confluence that gives TRIVENI its name.
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden fill="none">
      <path d="M3 6 C 14 6, 16 16, 27 16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M3 16 H 27" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity=".55" />
      <path d="M3 26 C 14 26, 16 16, 27 16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="27.5" cy="16" r="3" fill="#b8711a" />
    </svg>
  );
}

export default function App() {
  const route = useHashRoute();
  const { reset, state } = useStore();
  const toast = useToast();
  const { ask, node } = useConfirm();
  const [seg, param] = route.split('/').filter(Boolean);
  const latestCase = state.cases[0]?.complaintId;

  const nav = [
    { key: '', label: 'Overview', href: '/' },
    { key: 'report', label: 'Report an issue', href: '/report' },
    { key: 'intelligence', label: 'Intelligence', href: latestCase ? `/intelligence/${latestCase}` : '/intelligence' },
    { key: 'command', label: 'Command centre', href: '/command' },
  ];
  const active = seg ?? '';

  let screen;
  if (!seg) screen = <Entry />;
  else if (seg === 'report') screen = <Report />;
  else if (seg === 'intelligence') screen = <Intelligence complaintId={param} />;
  else if (seg === 'command') screen = <Command incidentId={param} />;
  else screen = <Entry />;

  return (
    <div className="min-h-screen flex flex-col">
      <button onClick={() => document.getElementById('main')?.focus()} className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-surface px-3 py-1 rounded z-50">Skip to content</button>
      <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur border-b hairline">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 h-14 flex items-center gap-6">
          <a href="#home" className="flex items-center gap-2 text-indigo shrink-0" aria-label="TRIVENI home">
            <Mark />
            <span className="font-display font-extrabold text-[17px] tracking-[0.14em] text-ink">TRIVENI</span>
          </a>
          <nav className="hidden md:flex items-center gap-1" aria-label="Main">
            {nav.map((n) => (
              <a key={n.key} href={toHash(n.href)} aria-current={active === n.key ? 'page' : undefined}
                className={cx('px-3 py-1.5 rounded-[6px] text-[14px] transition-colors', active === n.key ? 'text-ink bg-ink/[0.06] font-medium' : 'text-muted hover:text-ink')}>
                {n.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[12px] font-medium text-saffron bg-saffron-wash rounded-[4px] px-2 h-6">
              <FlaskConical className="size-3.5" aria-hidden /> Demo environment
            </span>
            <Button size="sm" variant="ghost" onClick={() => ask({
              title: 'Reset the demo?',
              body: <p>This restores the original simulated dataset and clears your submissions, officer decisions and notes in this browser.</p>,
              confirm: 'Reset demo', tone: 'danger',
              onConfirm: () => { reset(); navigate('/'); toast({ tone: 'success', text: 'Demo reset. Simulated data restored.' }); },
            })}>
              <RotateCcw className="size-3.5" aria-hidden /> <span className="hidden sm:inline">Reset demo</span>
            </Button>
          </div>
        </div>
        <nav className="md:hidden flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Main (mobile)">
          {nav.map((n) => (
            <a key={n.key} href={toHash(n.href)} aria-current={active === n.key ? 'page' : undefined}
              className={cx('shrink-0 px-3 py-1 rounded-[6px] text-[13px]', active === n.key ? 'bg-ink/[0.07] text-ink font-medium' : 'text-muted')}>
              {n.label}
            </a>
          ))}
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 outline-none">{screen}</main>
      <footer className="border-t hairline">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
          <SimBanner />
          <p className="text-[12px] text-faint">Idea-stage prototype for AI Kaushal Hackathon 2026. Not connected to IGRS, CM Helpline 1076 or any government system.</p>
        </div>
      </footer>
      {node}
    </div>
  );
}
