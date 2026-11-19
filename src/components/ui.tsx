import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import type { IncidentStatus, Priority } from '../lib/types';
import { STATUS_LABEL } from '../lib/store';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export function Button({ variant = 'secondary', size = 'md', className, children, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  const v: Record<Variant, string> = {
    primary: 'bg-indigo text-white hover:bg-indigo-2 border border-indigo',
    secondary: 'bg-surface text-ink border border-line-strong hover:border-ink/40',
    ghost: 'bg-transparent text-muted hover:text-ink hover:bg-ink/5 border border-transparent',
    danger: 'bg-surface text-alarm border border-alarm/40 hover:bg-alarm-wash',
    success: 'bg-leaf text-white border border-leaf hover:brightness-110',
  };
  const s = { sm: 'h-8 px-3 text-[13px] gap-1.5', md: 'h-9 px-3.5 text-sm gap-2', lg: 'h-11 px-5 text-[15px] gap-2' }[size];
  return (
    <button className={cx('inline-flex items-center justify-center rounded-[6px] font-medium transition-colors disabled:opacity-45 whitespace-nowrap', v[variant], s, className)} {...rest}>
      {children}
    </button>
  );
}

export function Badge({ tone = 'neutral', children, className }: { tone?: 'neutral' | 'indigo' | 'saffron' | 'leaf' | 'alarm'; children: ReactNode; className?: string }) {
  const t = {
    neutral: 'bg-ink/[0.05] text-muted',
    indigo: 'bg-indigo-wash text-indigo',
    saffron: 'bg-saffron-wash text-saffron',
    leaf: 'bg-leaf-wash text-leaf',
    alarm: 'bg-alarm-wash text-alarm',
  }[tone];
  return <span className={cx('inline-flex items-center gap-1 rounded-[4px] px-1.5 text-[12px] font-medium leading-none h-[22px] whitespace-nowrap shrink-0', t, className)}>{children}</span>;
}

export const PRIORITY_META: Record<Priority, { label: string; tone: 'alarm' | 'saffron' | 'indigo' | 'neutral' }> = {
  P1: { label: 'P1 Critical', tone: 'alarm' },
  P2: { label: 'P2 High', tone: 'saffron' },
  P3: { label: 'P3 Medium', tone: 'indigo' },
  P4: { label: 'P4 Low', tone: 'neutral' },
};
export function PriorityBadge({ p }: { p: Priority }) {
  return <Badge tone={PRIORITY_META[p].tone}>{PRIORITY_META[p].label}</Badge>;
}
export function StatusBadge({ s }: { s: IncidentStatus }) {
  const tone = { pending_review: 'saffron', open: 'neutral', routed: 'indigo', in_progress: 'indigo', resolved: 'leaf' }[s] as 'saffron' | 'neutral' | 'indigo' | 'leaf';
  return (
    <Badge tone={tone}>
      <span className={cx('size-1.5 rounded-full', s === 'pending_review' ? 'bg-saffron' : s === 'resolved' ? 'bg-leaf' : s === 'open' ? 'bg-faint' : 'bg-indigo')} />
      {STATUS_LABEL[s]}
    </Badge>
  );
}

/** Routing score bar with the review threshold marked. Score is a demo heuristic, not a calibrated probability. */
export function ConfidenceMeter({ value, threshold, compact = false }: { value: number; threshold: number; compact?: boolean }) {
  const ok = value >= threshold;
  return (
    <div className={compact ? 'w-28' : 'w-full'}>
      <div className="relative h-1.5 rounded-full bg-ink/[0.07]">
        <div className={cx('absolute inset-y-0 left-0 rounded-full', ok ? 'bg-indigo' : 'bg-saffron')} style={{ width: `${value * 100}%` }} />
        <div className="absolute -top-1 h-3.5 w-px bg-ink/60" style={{ left: `${threshold * 100}%` }} title={`Review threshold ${threshold}`} />
      </div>
      {!compact && (
        <div className="mt-1.5 flex justify-between text-[12px] text-muted num">
          <span>{ok ? 'Above' : 'Below'} review threshold ({threshold})</span>
          <span className="text-ink font-semibold">{value.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

export function SimBanner({ className }: { className?: string }) {
  return (
    <div className={cx('flex items-center gap-2 text-[12px] text-saffron', className)}>
      <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
      <span className="font-semibold tracking-wide">SIMULATED DEMONSTRATION DATA — NOT LIVE GOVERNMENT RECORDS.</span>
    </div>
  );
}

/* ---------- dialog ---------- */
export function Dialog({ open, title, children, onClose, footer, wide }: {
  open: boolean; title: string; children: ReactNode; onClose: () => void; footer?: ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    setTimeout(() => ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus() ?? ref.current?.focus(), 10);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        className={cx('fade-in relative w-full bg-surface border border-line rounded-t-[12px] sm:rounded-[10px] shadow-[0_24px_60px_-20px_rgba(26,29,41,.35)] max-h-[88vh] flex flex-col', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b hairline">
          <h2 className="font-display text-[17px] font-semibold leading-snug pt-0.5">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink p-1 -m-1" aria-label="Close"><X className="size-4" /></button>
        </div>
        <div className="px-5 py-4 overflow-y-auto text-[14px] text-ink/90">{children}</div>
        {footer && <div className="px-5 py-3 border-t hairline flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function useConfirm() {
  const [cfg, setCfg] = useState<null | { title: string; body: ReactNode; confirm: string; tone?: 'primary' | 'danger' | 'success'; onConfirm: () => void }>(null);
  const ask = useCallback((c: NonNullable<typeof cfg>) => setCfg(c), []);
  const node = (
    <Dialog open={!!cfg} title={cfg?.title ?? ''} onClose={() => setCfg(null)}
      footer={<>
        <Button variant="ghost" onClick={() => setCfg(null)}>Cancel</Button>
        <Button data-autofocus variant={cfg?.tone ?? 'primary'} onClick={() => { cfg?.onConfirm(); setCfg(null); }}>{cfg?.confirm}</Button>
      </>}>
      {cfg?.body}
    </Dialog>
  );
  return { ask, node };
}

/* ---------- toasts ---------- */
type Toast = { id: number; tone: 'success' | 'info' | 'error'; text: string };
const ToastCtx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { ...t, id }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[60] flex flex-col gap-2 items-end" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="fade-in flex items-start gap-2.5 max-w-sm bg-ink text-white text-[14px] rounded-[8px] px-3.5 py-2.5 shadow-lg">
            {t.tone === 'success' ? <CheckCircle2 className="size-4 mt-0.5 text-[#9fd3b0] shrink-0" /> : t.tone === 'error' ? <AlertTriangle className="size-4 mt-0.5 text-[#f0a597] shrink-0" /> : <Info className="size-4 mt-0.5 text-[#b9c2ef] shrink-0" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------- formatting ---------- */
export function ago(ms: number, now = Date.now()) {
  const m = Math.max(0, Math.round((now - ms) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}
export function clock(ms: number) {
  return new Date(ms).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
