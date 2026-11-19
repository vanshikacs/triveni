import { PLACES, placeById } from '../lib/seed';
import type { Incident } from '../lib/types';
import { cx } from './ui';

/**
 * A schematic location panel instead of a tile map: works offline and makes no claim of geocoding precision.
 * Points are placed from approximate, simulated coordinates within each district's bounding box.
 */
export default function LocalityPanel({ incidents, selected, onSelect }: { incidents: Incident[]; selected?: string; onSelect: (id: string) => void }) {
  const districts = [...new Set(PLACES.map((p) => p.district))];
  return (
    <div className="panel p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-[15px] font-semibold">Where incidents are</h3>
        <span className="text-[12px] text-faint">Approximate, simulated</span>
      </div>
      <div className="mt-3 grid sm:grid-cols-3 2xl:grid-cols-1 gap-3">
        {districts.map((d) => {
          const places = PLACES.filter((p) => p.district === d);
          const lats = places.map((p) => p.lat), lngs = places.map((p) => p.lng);
          const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats) - 0.01, Math.max(...lats) + 0.01, Math.min(...lngs) - 0.01, Math.max(...lngs) + 0.01];
          const here = incidents.filter((i) => placeById(i.placeId)?.district === d);
          if (!here.length) return null;
          const byPlace = new Map<string, Incident[]>();
          here.forEach((i) => byPlace.set(i.placeId, [...(byPlace.get(i.placeId) || []), i]));
          return (
            <div key={d}>
              <div className="text-[12.5px] text-muted mb-1">{d}</div>
              <div className="relative h-24 rounded-[6px] border hairline bg-paper overflow-hidden" style={{ backgroundImage: 'linear-gradient(#e2ddd055 1px, transparent 1px), linear-gradient(90deg, #e2ddd055 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
                {[...byPlace.entries()].map(([pid, list]) => {
                  const p = placeById(pid)!;
                  const x = ((p.lng - minLng) / (maxLng - minLng || 1)) * 80 + 10;
                  const y = (1 - (p.lat - minLat) / (maxLat - minLat || 1)) * 56 + 14;
                  const reports = list.reduce((s, i) => s + i.complaintIds.length, 0);
                  const top = list.find((i) => i.id === selected) ?? [...list].sort((a, b) => a.priority.localeCompare(b.priority))[0];
                  const sev = top.status === 'resolved' ? 'bg-leaf' : top.priority === 'P1' ? 'bg-alarm' : top.priority === 'P2' ? 'bg-saffron' : 'bg-indigo';
                  const isSel = list.some((i) => i.id === selected);
                  const size = Math.min(26, 10 + reports * 2);
                  return (
                    <button key={pid} onClick={() => onSelect(top.id)} title={`${p.village}: ${list.length} incident(s), ${reports} report(s)`}
                      aria-label={`${p.village}, ${list.length} incidents, ${reports} reports`}
                      className="absolute -translate-x-1/2 -translate-y-1/2 group" style={{ left: `${x}%`, top: `${y}%` }}>
                      <span className={cx('block rounded-full opacity-85 ring-2', sev, isSel ? 'ring-ink' : 'ring-surface')} style={{ width: size, height: size }} />
                      <span className="absolute left-1/2 -translate-x-1/2 top-full mt-0.5 whitespace-nowrap text-[10.5px] text-muted group-hover:text-ink">{p.village.split(',')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11.5px] text-muted">
        <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-alarm" />P1</span>
        <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-saffron" />P2</span>
        <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-indigo" />P3–P4</span>
        <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-leaf" />Resolved</span>
        <span>Dot size grows with reports.</span>
      </div>
    </div>
  );
}
