import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Flame, Pause, Play, Wrench } from 'lucide-react';
import type { Cabinet } from '../data/fleet';
import { useStore, type WorkOrder } from '../store/store';
import { Btn, Led, Range, Seg } from '../components/ui';
import { Spark } from '../components/charts';
import { cn } from '../utils/cn';

type ChState = 'idle' | 'run' | 'derate' | 'done' | 'fault' | 'isolated';
interface Ch {
  ch: number;
  idx: number;
  label: string;
  need: number;
  done: number;
  set: number;
  rec: number;
  t: number;
  tAmb: number;
  rc: number; // 夹具接触电阻 mΩ
  heat: number;
  selfRate: number; // 自发热 °C/min
  state: ChState;
  soh: number;
  soc0: number;
  r: number;
  hist: number[];
  ack: boolean;
}

const T_WARN = 45;
const T_CUT = 55;
const saved = new Map<string, Ch[]>();

function initChannels(order: WorkOrder, cab: Cabinet): Ch[] {
  return order.targets.slice(0, 4).map((t, i) => {
    const c = cab.cells[t.idx];
    return {
      ch: i + 1, idx: t.idx, label: t.label, need: Math.max(0.6, t.needAh), done: 0, set: t.current, rec: t.current,
      t: c.t, tAmb: c.t, rc: 0.4, heat: 0, selfRate: 0, state: 'idle', soh: c.soh, soc0: c.soc, r: c.r, hist: [c.t], ack: false,
    };
  });
}

function stepCh(c: Ch, speed: number): Ch {
  if (c.state !== 'run' && c.state !== 'derate') return c;
  const dtMin = (0.25 * speed) / 60;
  const I = c.state === 'derate' ? Math.min(3, c.set) : c.set;
  const done = Math.min(c.need, c.done + (I * dtMin) / 60);
  const heat = c.heat + c.selfRate * dtMin;
  const target = c.tAmb + I * I * c.rc * 0.09 + I * 0.12 + heat;
  const t = c.t + (target - c.t) * (1 - Math.exp(-dtMin / 4));
  let state: ChState = c.state;
  if (t >= T_CUT) state = 'fault';
  else if (t >= T_WARN && state === 'run') state = 'derate';
  else if (done >= c.need - 1e-6) state = 'done';
  return { ...c, done, heat, t, state, hist: [...c.hist.slice(-59), t] };
}

const actualI = (c: Ch) => (c.state === 'derate' ? Math.min(3, c.set) : c.state === 'run' ? c.set : 0);

export function InjectStep({
  order, cab, estop, onEstop, onComplete,
}: { order: WorkOrder; cab: Cabinet; estop: boolean; onEstop: () => void; onComplete: (idxs: number[]) => void }) {
  const { dispatch } = useStore();
  const [chs, setChs] = useState<Ch[]>(() => saved.get(order.id) ?? initChannels(order, cab));
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(300);
  const [sel, setSel] = useState(0);
  const [sheet, setSheet] = useState<number | null>(null);
  const [red, setRed] = useState<number | null>(null);
  const [faultMenu, setFaultMenu] = useState(false);
  const flagged = useRef<Set<string>>(new Set());

  useEffect(() => {
    saved.set(order.id, chs);
  }, [chs, order.id]);

  useEffect(() => {
    if (!estop) return;
    setRunning(false);
    setSheet(null);
    setRed(null);
    setChs((p) => p.map((c) => (c.state === 'fault' ? { ...c, state: 'isolated' } : c)));
  }, [estop]);

  useEffect(() => {
    if (!running || estop) return;
    const id = window.setInterval(() => setChs((p) => p.map((c) => stepCh(c, speed))), 250);
    return () => window.clearInterval(id);
  }, [running, estop, speed]);

  useEffect(() => {
    if (estop) return;
    chs.forEach((c, i) => {
      if (c.state === 'fault' && !flagged.current.has(`f${c.ch}`)) {
        flagged.current.add(`f${c.ch}`);
        setRed(i);
        setSheet(null);
        setRunning(false);
        dispatch({
          type: 'EVENT', tone: 'crit', from: 'field', cabinetId: cab.id, toast: '现场高温告警 · 通道已切断',
          text: `${cab.id} · CH${c.ch} ${c.label} 温度 ${c.t.toFixed(1)}°C ≥ 55°C · Re-Pulse 已切断该通道，等待现场处置`,
        });
      } else if (c.state === 'derate' && !c.ack && !flagged.current.has(`d${c.ch}`)) {
        flagged.current.add(`d${c.ch}`);
        setSheet(i);
        dispatch({
          type: 'EVENT', tone: 'warn', from: 'field', cabinetId: cab.id, toast: '现场温度预警 · 自动降流',
          text: `${cab.id} · CH${c.ch} ${c.label} 温度 ${c.t.toFixed(1)}°C ≥ 45°C · Re-Pulse 已自动降流至 3 A`,
        });
      }
    });
    if (running && chs.length && chs.every((c) => c.state === 'done' || c.state === 'isolated')) setRunning(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chs]);

  const allDone = chs.length > 0 && chs.every((c) => c.state === 'done' || c.state === 'isolated');
  const doneIdxs = chs.filter((c) => c.state === 'done').map((c) => c.idx);
  const isolatedCount = chs.filter((c) => c.state === 'isolated').length;
  const anyStarted = chs.some((c) => c.state !== 'idle');

  const start = () => {
    setChs((p) => p.map((c) => (c.state === 'idle' ? { ...c, state: 'run' } : c)));
    setRunning(true);
  };
  const setCurrent = (i: number, v: number) => setChs((p) => p.map((c, j) => (j === i ? { ...c, set: v } : c)));
  const injectFault = (kind: 'loose' | 'internal') => {
    const target = ['run', 'idle', 'derate'].includes(chs[sel]?.state) ? sel : chs.findIndex((c) => ['run', 'idle', 'derate'].includes(c.state));
    if (target < 0) return;
    setChs((p) =>
      p.map((c, j) =>
        j === target ? { ...c, rc: kind === 'loose' ? 3.6 : c.rc, selfRate: kind === 'internal' ? 1.8 : c.selfRate, set: Math.max(c.set, kind === 'loose' ? 8 : c.set), state: c.state === 'idle' ? 'run' : c.state } : c.state === 'idle' ? { ...c, state: 'run' } : c,
      ),
    );
    setSel(target);
    setRunning(true);
    setFaultMenu(false);
  };
  const retighten = () => {
    if (sheet === null) return;
    const ch = chs[sheet].ch;
    flagged.current.delete(`d${ch}`);
    setChs((p) => p.map((c, j) => (j === sheet ? { ...c, rc: 0.4, state: c.state === 'derate' ? 'run' : c.state, ack: false } : c)));
    setSheet(null);
  };
  const keep = () => {
    if (sheet === null) return;
    setChs((p) => p.map((c, j) => (j === sheet ? { ...c, ack: true } : c)));
    setSheet(null);
  };
  const isolate = () => {
    if (red === null) return;
    setChs((p) => p.map((c, j) => (j === red ? { ...c, state: 'isolated' } : c)));
    setRed(null);
  };

  const c = chs[sel];
  const I = c ? actualI(c) : 0;
  const soc = c ? c.soc0 + (c.done / (c.soh * 280)) * 100 : 0;
  const volt = c ? 3.2 + 0.0018 * soc + (I * c.r) / 1000 : 0;
  const remain = c && I > 0 ? Math.max(0, ((c.need - c.done) / I) * 60) : 0;
  const tTone = (t: number) => (t >= T_WARN ? 'text-stop-hi' : t >= 38 ? 'text-sig' : 'text-g-100');
  const sheetCh = sheet !== null ? chs[sheet] : null;
  const redCh = red !== null ? chs[red] : null;
  const dtMin = (0.25 * speed) / 60;
  const rate = redCh && redCh.hist.length > 4 ? (redCh.hist[redCh.hist.length - 1] - redCh.hist[redCh.hist.length - 5]) / (4 * dtMin) : 0;

  return (
    <div className="space-y-3">
      <div>
        <div className="label text-sig">STEP 04</div>
        <div className="mt-0.5 text-[16px] font-semibold text-g-50">注入均衡 · 给哪颗电芯注入多大电流</div>
        <div className="text-[12px] text-g-400">电流由中台按 SOC 偏差计算，现场可在安全范围内微调</div>
      </div>

      <div className="flex items-center gap-2">
        {running ? (
          <Btn variant="ghost" size="lg" className="flex-1" icon={<Pause size={17} />} onClick={() => setRunning(false)}>
            暂停注入
          </Btn>
        ) : (
          <Btn variant="primary" size="lg" className="flex-1" icon={<Play size={17} />} disabled={allDone || estop} onClick={start}>
            {anyStarted ? '继续注入' : `启动 ${chs.length} 通道注入`}
          </Btn>
        )}
        <Seg
          value={String(speed)}
          onChange={(v) => setSpeed(Number(v))}
          size="sm"
          options={[
            { value: '60', label: '×60' },
            { value: '300', label: '×300' },
            { value: '900', label: '×900' },
          ]}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] text-g-500">
        <span className="flex items-center gap-1.5">
          <Led tone={running ? 'warn' : 'ok'} size={6} blink={running} /> Re-Pulse RP-0207 · 蓝牙已连 · 演示加速 ×{speed}
        </span>
        <button onClick={() => setFaultMenu((v) => !v)} className="text-g-400 hover:text-sig">
          演示故障 ▾
        </button>
      </div>
      {faultMenu && (
        <div className="animate-rise rounded-xl border border-g-700 bg-g-900 p-1.5 text-[12px]">
          <button onClick={() => injectFault('loose')} className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-g-800">
            <Wrench size={14} className="text-sig" /> 夹具松动（接触电阻 ↑）
            <span className="ml-auto text-[10.5px] text-g-500">→ 预警降流</span>
          </button>
          <button onClick={() => injectFault('internal')} className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-g-800">
            <Flame size={14} className="text-stop-hi" /> 电芯内部异常（自发热）
            <span className="ml-auto text-[10.5px] text-g-500">→ 切断 · 急停</span>
          </button>
        </div>
      )}

      <div className="space-y-2">
        {chs.map((x, i) => {
          const prog = x.done / x.need;
          const ai = actualI(x);
          const label =
            x.state === 'idle' ? '待启动' : x.state === 'run' ? (running ? '注入中' : '暂停') : x.state === 'derate' ? '降流 3A' : x.state === 'done' ? '完成' : x.state === 'fault' ? '切断' : '已隔离';
          return (
            <button
              key={x.ch}
              onClick={() => setSel(i)}
              className={cn(
                'w-full rounded-xl border p-2.5 text-left transition-colors',
                x.state === 'fault' || x.state === 'isolated' ? 'border-stop/60 bg-stop/[0.06]' : sel === i ? 'border-sig/60 bg-g-800' : 'border-g-700 bg-g-850',
              )}
            >
              <div className="flex items-center gap-2">
                <span className="num w-9 text-[11px] font-bold text-sig">CH{x.ch}</span>
                <span className="num text-[13px] font-semibold text-g-50">{x.label}</span>
                <span className="num ml-auto text-[11px] text-g-300">{ai} A</span>
                <span className={cn('num w-[52px] text-right text-[11px]', tTone(x.t))}>{x.t.toFixed(1)}°C</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-g-950">
                  <div
                    className={cn('h-full rounded-full transition-[width] duration-300', x.state === 'done' ? 'bg-g-200' : x.state === 'derate' ? 'bg-sig/60' : x.state === 'isolated' || x.state === 'fault' ? 'bg-stop' : 'bg-sig')}
                    style={{ width: `${Math.min(100, prog * 100)}%` }}
                  />
                </div>
                <span className="num w-9 text-right text-[10.5px] text-g-400">{Math.round(prog * 100)}%</span>
                <span
                  className={cn(
                    'w-[50px] rounded px-1 text-center text-[10px]',
                    x.state === 'derate' ? 'bg-sig/15 text-sig' : x.state === 'fault' || x.state === 'isolated' ? 'bg-stop/20 text-stop-hi' : x.state === 'done' ? 'bg-g-700 text-g-100' : 'text-g-400',
                  )}
                >
                  {label}
                </span>
              </div>
              {x.state === 'isolated' && <div className="mt-1.5 text-[10.5px] text-stop-hi">疑似内短路 / 接触不良 → 建议更换，并生成电池护照</div>}
            </button>
          );
        })}
      </div>

      {c && (
        <div className="panel p-3.5">
          <div className="flex items-center justify-between">
            <span className="label">
              CH{c.ch} · {c.label} · 实时
            </span>
            <span className="text-[10.5px] text-g-500">剩余约 {Math.round(remain)} 分钟</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { l: '电流', v: `${I}`, u: 'A', s: `设定 ${c.set} A`, cls: 'text-sig' },
              { l: '温度', v: c.t.toFixed(1), u: '°C', s: `环境 ${c.tAmb.toFixed(1)}`, cls: tTone(c.t) },
              { l: '电压', v: volt.toFixed(3), u: 'V', s: `SOC ${soc.toFixed(1)}%`, cls: 'text-g-50' },
            ].map((r) => (
              <div key={r.l} className="rounded-lg bg-g-950 p-2 ring-1 ring-g-750">
                <div className="text-[10px] text-g-500">{r.l}</div>
                <div className={cn('num text-[18px] font-semibold leading-tight', r.cls)}>
                  {r.v}
                  <span className="text-[10px] font-normal text-g-500"> {r.u}</span>
                </div>
                <div className="num text-[9.5px] text-g-500">{r.s}</div>
              </div>
            ))}
          </div>
          <div className="mt-2.5 rounded-lg bg-g-950 p-2 ring-1 ring-g-750">
            <div className="mb-1 flex justify-between text-[10px] text-g-500">
              <span>温度曲线</span>
              <span>
                <span className="text-sig">预警 45</span> · <span className="text-stop-hi">切断 55</span>
              </span>
            </div>
            <Spark
              data={c.hist.length > 1 ? c.hist : [c.t, c.t]}
              width={290}
              height={44}
              min={Math.min(24, ...c.hist)}
              max={Math.max(60, ...c.hist)}
              color={c.t >= T_WARN ? '#ff6157' : '#ffa51f'}
              thresholds={[
                { y: T_WARN, color: '#ffa51f' },
                { y: T_CUT, color: '#ff6157' },
              ]}
            />
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] text-g-300">注入电流设定</span>
              <span className={cn('num text-[18px] font-semibold', c.set > 13 ? 'text-stop-hi' : 'text-sig')}>{c.set} A</span>
            </div>
            <div className="relative mt-1 h-4">
              <span className="num absolute -translate-x-1/2 whitespace-nowrap text-[10px] text-g-300" style={{ left: `${((c.rec - 1) / 14) * 100}%` }}>
                ▼ 推荐 {c.rec}A
              </span>
            </div>
            <Range
              value={c.set}
              min={1}
              max={15}
              step={1}
              onChange={(v) => setCurrent(sel, v)}
              fill={c.set > 13 ? '#e8352e' : c.set > 10 ? '#ff8a3d' : '#ffa51f'}
            />
            <div className={cn('mt-1.5 text-[11px]', c.set > 13 ? 'text-stop-hi' : c.set > 10 ? 'text-sig' : 'text-g-500')}>
              {c.set > 13
                ? '> 13 A 超出夹具额定，不建议'
                : c.set > 10
                  ? '> 10 A 温升风险上升，请盯住温度'
                  : `推荐 ${c.rec} A：需补 ${c.need.toFixed(1)} Ah ÷ 1.3 h ≈ ${Math.round(c.need / 1.3)} A，限幅 3–10 A（≤ 0.04C · 温升 < 3 °C）`}
            </div>
          </div>
          <div className="num mt-2 text-[11px] text-g-400">
            已补 {c.done.toFixed(1)} / {c.need.toFixed(1)} Ah · SOC {c.soc0.toFixed(1)}% → {soc.toFixed(1)}%
          </div>
        </div>
      )}

      {allDone && (
        <div className="animate-rise rounded-xl border border-sig/50 bg-sig/[0.07] p-3.5">
          <div className="text-[13.5px] font-semibold text-g-50">
            注入完成 · {doneIdxs.length}/{chs.length} 通道
          </div>
          {isolatedCount > 0 && <div className="mt-1 text-[11.5px] text-stop-hi">{isolatedCount} 颗电芯已隔离，建议更换并生成电池护照</div>}
          <Btn variant="primary" size="lg" className="mt-3 w-full" disabled={!doneIdxs.length} onClick={() => onComplete(doneIdxs)}>
            进入复测验收
          </Btn>
        </div>
      )}

      {sheetCh && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/55">
          <div className="animate-sheet overflow-hidden rounded-t-[28px] border-t border-sig/60 bg-g-900">
            <div className="hazard h-2" />
            <div className="p-5 pb-8">
              <div className="flex items-center gap-2 text-sig">
                <AlertTriangle size={18} />
                <span className="text-[16px] font-bold">
                  温度预警 · CH{sheetCh.ch} {sheetCh.label}
                </span>
              </div>
              <div className="num mt-1 text-[32px] font-semibold text-sig">{sheetCh.t.toFixed(1)} °C</div>
              <div className="mt-1 rounded-lg bg-sig/10 px-3 py-2 text-[12px] text-g-100 ring-1 ring-sig/30">Re-Pulse 已自动降流至 3 A（本地闭环，不依赖网络）</div>
              <ol className="mt-3 space-y-2 text-[12.5px] leading-snug text-g-200">
                <li>① 红外测温枪复核夹具与极柱：温差 &gt; 8 °C 判定接触不良</li>
                <li>② 断开该通道 → 清洁极柱 → 重新紧固（扭矩 4 N·m）</li>
                <li>
                  ③ 1 分钟内温升 &gt; 3 °C 或 ≥ 55 °C：<b className="text-stop-hi">立即急停</b>，撤离 5 m
                </li>
              </ol>
              <div className="mt-4 grid gap-2">
                <Btn variant="primary" size="lg" onClick={retighten}>
                  已重新紧固 · 恢复电流
                </Btn>
                <div className="grid grid-cols-2 gap-2">
                  <Btn variant="ghost" onClick={keep}>
                    保持 3 A 继续
                  </Btn>
                  <Btn variant="danger" onClick={onEstop}>
                    急停
                  </Btn>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {redCh && (
        <div className="absolute inset-0 z-50 flex flex-col bg-[#1a0706]/95">
          <div className="hazard-red h-3 shrink-0 animate-blink" />
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="flex items-center gap-2 text-stop-hi">
              <Flame size={20} />
              <span className="text-[12px] font-bold tracking-[0.25em]">THERMAL ALARM</span>
            </div>
            <h2 className="mt-2 text-[24px] font-bold text-g-50">温度失控风险</h2>
            <div className="num text-glow-stop mt-1 text-[46px] font-semibold text-stop-hi">{redCh.t.toFixed(1)}°C</div>
            <div className="text-[12.5px] text-g-300">
              CH{redCh.ch} {redCh.label} · 升温 {rate.toFixed(1)} °C/min · 该通道已切断
            </div>
            <button onClick={onEstop} className="estop-ring mt-6 grid h-[132px] w-[132px] place-items-center rounded-full" aria-label="急停">
              <span className="estop-cap grid h-[92px] w-[92px] place-items-center rounded-full text-[18px] font-black tracking-wider text-white">急停</span>
            </button>
            <div className="mt-3 text-[12px] text-g-400">按下急停：硬件切断全部通道，并同步中台</div>
            <button onClick={isolate} className="mt-5 text-[12px] text-g-400 underline underline-offset-2">
              已断开该通道夹具 · 仅隔离 CH{redCh.ch}
            </button>
          </div>
          <div className="hazard-red h-3 shrink-0 animate-blink" />
        </div>
      )}
    </div>
  );
}
