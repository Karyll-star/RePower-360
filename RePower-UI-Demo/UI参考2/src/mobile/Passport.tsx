import { useMemo, useState } from 'react';
import { BadgeCheck, Battery, CheckCircle2, QrCode, Recycle, RadioTower, ScanLine, Tag } from 'lucide-react';
import { PASSPORTS, hashStr, mulberry32 } from '../data/fleet';
import { residual, yuan, type ValuePath } from '../data/model';
import { useStore } from '../store/store';
import { Btn, Range } from '../components/ui';
import { cn } from '../utils/cn';

interface Quote {
  buyer: string;
  path: string;
  price: number;
}

function QR({ seed, size = 86 }: { seed: number; size?: number }) {
  const n = 25;
  const cells = useMemo(() => {
    const r = mulberry32(seed);
    const out: [number, number][] = [];
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        if ((x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8)) continue;
        if (r() > 0.52) out.push([x, y]);
      }
    return out;
  }, [seed]);
  const finders: [number, number][] = [
    [0, 0],
    [n - 7, 0],
    [0, n - 7],
  ];
  return (
    <svg viewBox={`-1.5 -1.5 ${n + 3} ${n + 3}`} width={size} height={size} className="shrink-0 rounded-md bg-g-50">
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill="#0b0c0e" />
      ))}
      {finders.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width={7} height={7} fill="#0b0c0e" />
          <rect x={x + 1} y={y + 1} width={5} height={5} fill="#f4f2ed" />
          <rect x={x + 2} y={y + 2} width={3} height={3} fill="#0b0c0e" />
        </g>
      ))}
    </svg>
  );
}

const PATH_ICON: Record<ValuePath['key'], typeof Battery> = { storage: Battery, backup: RadioTower, recycle: Recycle };
const BUYERS: Record<ValuePath['key'], string> = { storage: '循能储能 · 工商业梯次', backup: '绿源梯次 · 基站备电', recycle: '锂回再生 · 湿法回收' };

export function Passport() {
  const { state, dispatch } = useStore();
  const mod = PASSPORTS.find((p) => p.id === state.ui.passportId) ?? PASSPORTS[0];
  const [li, setLi] = useState(7.6);
  const [scan, setScan] = useState(false);
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const sold = state.sales.find((s) => s.moduleId === mod.id);
  const rv = useMemo(() => residual(mod, li), [mod, li]);
  const maxV = Math.max(...rv.paths.map((p) => (p.ok ? p.withPassport : 0)), 1);
  const premium = rv.best.withPassport - rv.best.raw;
  const minCell = Math.min(...mod.cellSoh);

  const pick = (id: string) => {
    if (id === mod.id) return;
    setScan(true);
    setQuotes(null);
    dispatch({ type: 'NAV', patch: { passportId: id } });
    window.setTimeout(() => setScan(false), 900);
  };
  const doScan = () => {
    setScan(true);
    window.setTimeout(() => setScan(false), 1100);
  };
  const list = () => {
    const r = mulberry32(hashStr(mod.id) + Math.round(li * 10));
    setQuotes(
      rv.paths
        .filter((p) => p.ok)
        .map((p) => ({ buyer: BUYERS[p.key], path: p.name, price: Math.round(p.withPassport * (0.96 + r() * 0.07)) }))
        .sort((a, b) => b.price - a.price),
    );
  };

  const fields: [string, string, boolean?][] = [
    ['化学体系', 'LFP · 280 Ah'],
    ['规格', '1P48S · 43 kWh'],
    ['制造', mod.mfg],
    ['投运 → 退役', `${mod.commissioned} → ${mod.retired}`],
    ['累计循环', `${mod.cycles.toLocaleString('zh-CN')} 次`],
    ['累计吞吐', `${mod.throughput} MWh`],
    ['平均内阻', `${mod.rMean} mΩ`],
    ['历史最高温', `${mod.tMax} °C`, mod.tMax >= 45],
    ['热事件', `${mod.thermal} 次`, mod.thermal > 0],
    ['主动均衡', `${mod.balances} 次 · Re-Pulse`],
    ['碳足迹', `${mod.carbon} kgCO₂e/kWh`],
    ['数据来源', 'Re-Bridge · 1 Hz'],
  ];

  return (
    <div className="space-y-3 px-4 pb-8 pt-3">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {PASSPORTS.map((p) => (
          <button
            key={p.id}
            onClick={() => pick(p.id)}
            className={cn('shrink-0 rounded-lg border px-2.5 py-1.5 text-left transition-colors', p.id === mod.id ? 'border-sig/60 bg-sig/10' : 'border-g-700 bg-g-850')}
          >
            <div className="num text-[12px] font-semibold text-g-50">
              {p.cabinetId} · P{p.pack}
            </div>
            <div className="text-[10.5px] text-g-400">
              SOH {(p.soh * 100).toFixed(1)}%{state.sales.some((s) => s.moduleId === p.id) ? ' · 已售' : ''}
            </div>
          </button>
        ))}
        <button onClick={doScan} className="flex shrink-0 flex-col items-center justify-center rounded-lg border border-dashed border-g-600 px-3 text-[10.5px] text-g-400">
          <ScanLine size={15} />
          扫码
        </button>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-g-650 bg-linear-to-br from-g-800 via-g-850 to-g-925 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]">
        <div className="flex items-center justify-between border-b border-g-700 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="led led-warn h-2 w-2" />
            <span className="label text-g-200">BATTERY PASSPORT · 电池护照</span>
          </div>
          <span className="flex items-center gap-1 text-[10.5px] text-sig">
            <BadgeCheck size={13} /> 数据已验证
          </span>
        </div>
        <div className="flex gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="num text-[18px] font-bold text-g-50">{mod.id}</div>
            <div className="mt-0.5 text-[11px] leading-snug text-g-400">{mod.origin}</div>
            <div className="mt-2 text-[11.5px] text-g-300">{mod.maker}</div>
            <div className="num text-[10.5px] text-g-500">批次 {mod.batch}</div>
          </div>
          <QR seed={hashStr(mod.id)} />
        </div>
        <div className="grid grid-cols-2 gap-px border-t border-g-750 bg-g-750">
          {fields.map(([k, v, bad]) => (
            <div key={k} className="bg-g-850 px-3.5 py-2">
              <div className="text-[10px] text-g-500">{k}</div>
              <div className={cn('num text-[12px]', bad ? 'text-stop-hi' : 'text-g-100')}>{v}</div>
            </div>
          ))}
        </div>
        {scan && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-g-950/85 backdrop-blur-sm">
            <div className="relative grid h-32 w-32 place-items-center overflow-hidden rounded-xl border-2 border-sig/70">
              <QrCode size={64} className="text-g-500" />
              <div className="absolute inset-x-0 top-0 h-1/3 animate-scan bg-linear-to-b from-transparent via-sig/45 to-transparent" />
            </div>
            <div className="mt-3 text-[12px] text-g-200">识别电池护照中…</div>
          </div>
        )}
      </div>

      <div className="panel p-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="label">模组 SOH · 短板限制</div>
            <div className={cn('num mt-1 text-[34px] font-semibold leading-none', mod.soh >= 0.8 ? 'text-g-50' : mod.soh >= 0.7 ? 'text-sig' : 'text-stop-hi')}>
              {(mod.soh * 100).toFixed(1)}
              <span className="text-[14px] text-g-500">%</span>
            </div>
          </div>
          <div className="text-right text-[11px] leading-relaxed text-g-400">
            单体离散度 σ <span className="num text-g-100">{mod.sigma}%</span>
            <br />
            数据完整度 <span className="num text-sig">{mod.dataScore}%</span>
          </div>
        </div>
        <div className="relative mt-3 h-2 rounded-full bg-g-900">
          <div
            className={cn('absolute inset-y-0 left-0 rounded-full', mod.soh >= 0.8 ? 'bg-g-200' : mod.soh >= 0.7 ? 'bg-sig' : 'bg-stop')}
            style={{ width: `${Math.max(0, Math.min(1, (mod.soh - 0.5) / 0.5)) * 100}%` }}
          />
          <span className="absolute -bottom-1 -top-1 border-l border-dashed border-sig/70" style={{ left: '40%' }} />
          <span className="absolute -bottom-1 -top-1 border-l border-dashed border-g-200/70" style={{ left: '60%' }} />
        </div>
        <div className="relative mt-1.5 h-3 text-[9.5px] text-g-500">
          <span className="absolute left-0">50%</span>
          <span className="absolute -translate-x-1/2 text-sig" style={{ left: '40%' }}>
            70% 备电
          </span>
          <span className="absolute -translate-x-1/2" style={{ left: '60%' }}>
            80% 储能梯次
          </span>
          <span className="absolute right-0">100%</span>
        </div>
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-[10.5px] text-g-500">
            <span>48 颗单体 SOH 分布</span>
            <span className="num">最低 {(minCell * 100).toFixed(1)}%</span>
          </div>
          <div className="flex h-14 items-end gap-[2px] rounded-md bg-g-950 p-1.5 ring-1 ring-g-750">
            {mod.cellSoh.map((s, i) => (
              <span
                key={i}
                className={cn('flex-1 rounded-t-[1px]', s < 0.7 ? 'bg-stop' : s < 0.8 ? 'bg-sig' : 'bg-g-400')}
                style={{ height: `${Math.max(6, ((s - 0.6) / 0.4) * 100)}%` }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="panel p-4">
        <div className="label mb-3">全生命周期履历</div>
        <ol className="relative space-y-3 border-l border-g-700 pl-4">
          {mod.events.map((e) => (
            <li key={e.date + e.text} className="relative">
              <span
                className={cn(
                  'absolute -left-[21.5px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-g-900',
                  e.tone === 'crit' ? 'bg-stop' : e.tone === 'warn' ? 'bg-sig' : e.tone === 'ok' ? 'bg-g-100' : 'bg-g-500',
                )}
              />
              <div className="num text-[10.5px] text-g-500">{e.date}</div>
              <div className="text-[12px] leading-snug text-g-200">{e.text}</div>
            </li>
          ))}
        </ol>
      </div>

      <div className="panel p-4">
        <div className="flex items-center justify-between">
          <div className="label">退役后还能卖多少钱</div>
          <span className="num text-[10.5px] text-g-500">43 kWh · {Math.round(rv.mass)} kg</span>
        </div>
        <div className="mt-3">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[12px] text-g-300">碳酸锂价格</span>
            <span className="num text-[13px] font-semibold text-g-50">{li.toFixed(1)} 万元/吨</span>
          </div>
          <Range value={li} min={5} max={25} step={0.1} onChange={setLi} />
        </div>
        <div className="mt-4 space-y-2.5">
          {rv.paths.map((p) => {
            const best = p.key === rv.best.key;
            const Icon = PATH_ICON[p.key];
            return (
              <div key={p.key} className={cn('rounded-xl border p-3 transition-colors', best ? 'border-sig/60 bg-sig/[0.07]' : 'border-g-700 bg-g-850', !p.ok && 'opacity-50')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-g-100">
                    <Icon size={14} className={best ? 'text-sig' : 'text-g-400'} />
                    {p.name}
                    {best && <span className="rounded bg-sig px-1 text-[9.5px] font-bold text-g-1000">最优</span>}
                  </span>
                  <span className={cn('num text-[15px] font-semibold', best ? 'text-sig' : 'text-g-100')}>{p.ok ? yuan(p.withPassport) : '不适用'}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-g-950">
                  <div className={cn('h-full rounded-full transition-all duration-500', best ? 'bg-sig' : 'bg-g-500')} style={{ width: `${p.ok ? (p.withPassport / maxV) * 100 : 0}%` }} />
                </div>
                <div className="mt-1.5 flex justify-between gap-2 text-[10.5px] text-g-500">
                  <span>{p.req}</span>
                  {p.ok && p.key !== 'recycle' && <span className="num shrink-0">无护照 {yuan(p.raw)}</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 rounded-lg bg-g-950 p-3 text-[11.5px] leading-relaxed text-g-300 ring-1 ring-g-750">
          {rv.best.key === 'recycle' ? (
            <>
              SOH 或热事件不满足梯次门槛，最优路径为拆解再生；护照证明化学体系与安全履历，回收商免去抽检，可小幅溢价 <span className="text-sig">+{yuan(premium)}</span>。
            </>
          ) : (
            <>
              <span className="text-sig">护照数据溢价 +{yuan(premium)}</span>（+{Math.round(rv.premium * 100)}%）：完整 BMS 履历与 Re-Pulse 均衡记录，让买方免去约 2 周容量复测与安全折价。
            </>
          )}
        </div>
      </div>

      {sold ? (
        <div className="animate-rise rounded-xl border border-sig/60 bg-sig/[0.08] p-4 text-center">
          <CheckCircle2 size={28} className="mx-auto text-sig" />
          <div className="num mt-2 text-[20px] font-semibold text-sig">已成交 {yuan(sold.price)}</div>
          <div className="mt-1 text-[12px] text-g-300">{sold.buyer} · 护照随资产转移 · T+3 到账</div>
        </div>
      ) : quotes ? (
        <div className="panel animate-rise p-4">
          <div className="label mb-2">已收到 {quotes.length} 份报价 · 附护照验证</div>
          {quotes.map((q, i) => (
            <div key={q.buyer} className="flex items-center justify-between gap-2 border-t border-g-750 py-2.5 first:border-0">
              <div className="min-w-0">
                <div className="truncate text-[12.5px] text-g-100">{q.buyer}</div>
                <div className="text-[10.5px] text-g-500">{q.path} · 护照验证 ✓</div>
              </div>
              <Btn
                size="sm"
                variant={i === 0 ? 'primary' : 'ghost'}
                onClick={() => {
                  dispatch({ type: 'SOLD', moduleId: mod.id, buyer: q.buyer, price: q.price });
                  setQuotes(null);
                }}
              >
                {yuan(q.price)} 成交
              </Btn>
            </div>
          ))}
        </div>
      ) : (
        <Btn variant="primary" size="lg" className="w-full" icon={<Tag size={16} />} onClick={list}>
          一键挂牌（附电池护照）
        </Btn>
      )}
    </div>
  );
}
