import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, Cable, Check, CheckCircle2, ChevronRight, DoorOpen, Flame, Gauge, HardHat, Loader2, MapPin, QrCode, RadioTower, RotateCcw, Siren, Thermometer, Wrench,
} from 'lucide-react';
import reBridgeImg from '../assets/re-bridge.jpg';
import rePulseImg from '../assets/re-pulse.jpg';
import { APP_ENGINEER, cellLabel, cellPos, type Cabinet } from '../data/fleet';
import { balanceCells, computeStats, weakList, yuan } from '../data/model';
import { snapOf, useStore, type OrderKind, type WorkOrder } from '../store/store';
import { Btn, KIND_META, Priority } from '../components/ui';
import { InjectStep } from './Inject';
import { cn } from '../utils/cn';

type StepKey = 'safety' | 'bridge' | 'clamp' | 'inject' | 'verify' | 'reveal' | 'inspect';
const FLOWS: Record<OrderKind, StepKey[]> = {
  balance: ['safety', 'bridge', 'clamp', 'inject', 'verify'],
  rescue: ['safety', 'bridge', 'reveal'],
  inspect: ['safety', 'inspect'],
  retire: ['safety', 'inspect'],
};
const STEP_LABEL: Record<StepKey, string> = { safety: '安全', bridge: '通讯', clamp: '夹具', inject: '注入', verify: '验收', reveal: '回传', inspect: '巡检' };
const progress = new Map<string, { step: number; doneIdxs: number[] }>();
const wideMode = () => (window.innerWidth >= 1280 ? 'split' : 'pc');

function StepTitle({ n, title, sub }: { n: string; title: string; sub?: string }) {
  return (
    <div>
      <div className="label text-sig">STEP {n}</div>
      <div className="mt-0.5 text-[16px] font-semibold text-g-50">{title}</div>
      {sub && <div className="text-[12px] text-g-400">{sub}</div>}
    </div>
  );
}

function EmptyOps() {
  const { state, dispatch } = useStore();
  const candidates = state.orders.filter((o) => o.engineer === APP_ENGINEER && (o.status === 'onsite' || o.status === 'suspended'));
  return (
    <div className="px-5 pt-8 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-g-850 ring-1 ring-g-700">
        <Wrench size={28} className="text-g-400" />
      </div>
      <h3 className="mt-4 text-[16px] font-semibold text-g-50">还没有进行中的作业</h3>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-g-400">在「工单」中接单并到场打卡后，这里会一步步引导：安全确认 → 通讯接入 → 夹具连接 → 注入均衡 → 复测验收。</p>
      <div className="mt-4 space-y-2">
        {candidates.map((o) => (
          <Btn key={o.id} variant="outline" className="w-full" onClick={() => dispatch({ type: 'NAV', patch: { activeOrder: o.id } })}>
            继续 {o.id} · {o.cabinetId} {KIND_META[o.kind].label}
          </Btn>
        ))}
      </div>
      <Btn variant="primary" className="mt-4" onClick={() => dispatch({ type: 'NAV', patch: { mobileTab: 'tasks' } })}>
        去工单
      </Btn>
    </div>
  );
}

function Stepper({ flow, step }: { flow: StepKey[]; step: number }) {
  return (
    <div className="mt-3 flex items-center">
      {flow.map((k, i) => (
        <div key={k} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <span
              className={cn(
                'num grid h-6 w-6 place-items-center rounded-full border text-[10.5px]',
                i < step ? 'border-sig bg-sig text-g-1000' : i === step ? 'border-sig text-sig shadow-[0_0_12px_rgba(255,165,31,.5)]' : 'border-g-600 text-g-500',
              )}
            >
              {i < step ? <Check size={12} strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn('text-[10.5px]', i <= step ? 'text-g-200' : 'text-g-500')}>{STEP_LABEL[k]}</span>
          </div>
          {i < flow.length - 1 && <div className={cn('mx-1 mb-4 h-px flex-1', i < step ? 'bg-sig/70' : 'bg-g-700')} />}
        </div>
      ))}
    </div>
  );
}

const SAFETY = [
  { icon: HardHat, t: '绝缘手套（1000 V）· 护目镜 · 安全鞋', s: 'PPE 拍照留档' },
  { icon: Siren, t: '确认急停位置：柜门右侧蘑菇头 · Re-Pulse 顶部急停', s: '作业全程可一键触达' },
  { icon: DoorOpen, t: 'PCS 切至「检修 / 待机」，柜门联锁正常', s: '禁止在充放电状态下夹接电芯' },
  { icon: Flame, t: '消防就绪：气溶胶 / 全氟己酮压力正常', s: '读数 ≥ 设计值 90%' },
  { icon: Gauge, t: '绝缘电阻 ≥ 1 MΩ（正 / 负极对地）', s: '1000 V 兆欧表测量' },
  { icon: Thermometer, t: '柜内 ≤ 35 °C · 无异味 · 无鼓包', s: '红外测温枪扫描各 PACK' },
];

function SafetyStep({ onDone }: { onDone: () => void }) {
  const [checked, setChecked] = useState<boolean[]>(SAFETY.map(() => false));
  const all = checked.every(Boolean);
  return (
    <div className="space-y-3">
      <StepTitle n="01" title="安全确认" sub="六项全部确认后才解锁 Re-Pulse 输出" />
      <div className="space-y-2">
        {SAFETY.map((it, i) => {
          const Icon = it.icon;
          const on = checked[i];
          return (
            <button
              key={it.t}
              onClick={() => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))}
              className={cn('flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors', on ? 'border-sig/50 bg-sig/[0.06]' : 'border-g-700 bg-g-850')}
            >
              <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', on ? 'bg-sig text-g-1000' : 'bg-g-900 text-g-300 ring-1 ring-g-700')}>
                <Icon size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium leading-snug text-g-100">{it.t}</span>
                <span className="block text-[11px] text-g-500">{it.s}</span>
              </span>
              <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-md border', on ? 'border-sig bg-sig text-g-1000' : 'border-g-600')}>
                {on && <Check size={14} strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
      {!all && (
        <button onClick={() => setChecked(SAFETY.map(() => true))} className="text-[11.5px] text-g-500 hover:text-g-300 hover:underline">
          演示：一键全部确认
        </button>
      )}
      <Btn variant="primary" size="lg" className="w-full" disabled={!all} onClick={onDone}>
        {all ? '安全确认完成 · 下一步' : `还差 ${checked.filter((v) => !v).length} 项`}
      </Btn>
    </div>
  );
}

function BridgeStep({ order, cab, onDone }: { order: WorkOrder; cab: Cabinet; onDone: () => void }) {
  const { dispatch } = useStore();
  const rescue = order.kind === 'rescue';
  const [phase, setPhase] = useState<'idle' | 'scan' | 'ok'>(rescue && cab.online ? 'ok' : 'idle');
  const [lines, setLines] = useState<string[]>([]);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const proto = cab.offline?.protocol ?? (cab.oemStatus !== '在服' ? `${cab.oem} BMS · 私有 CAN 250 kbps` : `${cab.oem} BMS · CAN 500 kbps`);
  const baud = proto.includes('9600') ? '9600 bps' : proto.includes('250') ? '250 kbps' : '500 kbps';
  const script = [
    '上电自检 · Re-Bridge RB-0311 · 固件 v3.4.2',
    'CAN_H / CAN_L 差分电平正常 · 终端电阻 120 Ω',
    `自动识别波特率 ${baud}`,
    `匹配协议库（37 种）→ ${proto}`,
    '只读旁路模式 · 不写入 BMS · 不改原厂固件',
    '映射点位 312/312 · 单体电压 / 温度 / SOC / 告警',
    rescue ? '4G 链路 −79 dBm · 上云成功 · 补传 BMS 缓存 72 h' : '高频采样 1 Hz 已开启 · 已同步 RE/OPS 中台',
  ];
  const start = () => {
    setPhase('scan');
    setLines([]);
    script.forEach((l, i) => {
      timers.current.push(
        window.setTimeout(() => {
          setLines((x) => [...x, l]);
          if (i === script.length - 1) {
            setPhase('ok');
            if (rescue) dispatch({ type: 'RESCUE_DONE', id: order.id, cabinetId: cab.id });
          }
        }, 420 * (i + 1)),
      );
    });
  };
  return (
    <div className="space-y-3">
      <StepTitle n="02" title="通讯接入 · Re-Bridge" sub={rescue ? '把失联柜带回来：接入 BMS 通讯口，旁路上云' : '接入 BMS 通讯口，开启 1 Hz 单体级采样'} />
      <div className="panel overflow-hidden">
        <img src={reBridgeImg} alt="Re-Bridge" className="h-32 w-full object-cover" />
        <div className="p-3.5">
          <div className="label">接线 · BCU 通讯口 J3</div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
            {[
              { pin: 'PIN 1', n: 'CAN_H', c: 'bg-sig' },
              { pin: 'PIN 2', n: 'CAN_L', c: 'bg-g-100' },
              { pin: 'PIN 3', n: 'GND', c: 'bg-g-500' },
            ].map((p) => (
              <div key={p.pin} className="rounded-lg bg-g-900 p-2 ring-1 ring-g-700">
                <span className={cn('mx-auto block h-2 w-8 rounded-full', p.c)} />
                <div className="num mt-1.5 text-g-100">{p.n}</div>
                <div className="text-g-500">{p.pin}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[11.5px] text-g-400">
            终端电阻拨码 <b className="text-g-100">120 Ω · ON</b> · 只读旁路，无需原厂授权
          </div>
        </div>
      </div>
      <div className="panel-inset num relative min-h-[96px] overflow-hidden p-3 text-[11px] leading-relaxed">
        {phase === 'scan' && <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 animate-scan bg-linear-to-b from-transparent via-sig/15 to-transparent" />}
        {lines.length === 0 && phase !== 'ok' ? (
          <span className="text-g-500">$ 等待握手…</span>
        ) : (
          lines.map((l) => (
            <div key={l} className="text-g-300">
              <span className="text-sig">✓</span> {l}
            </div>
          ))
        )}
        {phase === 'ok' && lines.length === 0 && <div className="text-g-300">✓ 已接入 · 链路正常</div>}
        {phase === 'scan' && (
          <div className="text-g-500">
            <Loader2 size={11} className="inline animate-spin" /> 处理中…
          </div>
        )}
      </div>
      {phase === 'ok' && rescue && (
        <div className="animate-rise rounded-xl border border-sig/50 bg-sig/[0.08] p-3 text-[12.5px] leading-relaxed text-g-100">
          柜体已恢复在线 · 失联 {cab.rescued?.days ?? 0} 天的盲区数据已回传中台
        </div>
      )}
      {phase !== 'ok' ? (
        <Btn variant="primary" size="lg" className="w-full" disabled={phase === 'scan'} icon={<RadioTower size={17} />} onClick={start}>
          {phase === 'scan' ? '握手中…' : '开始握手 · 自动识别协议'}
        </Btn>
      ) : (
        <Btn variant="primary" size="lg" className="w-full" onClick={onDone}>
          下一步
        </Btn>
      )}
    </div>
  );
}

function PackMap({ pack, targets, focus }: { pack: number; targets: number[]; focus: number }) {
  const base = (pack - 1) * 48;
  return (
    <div className="rounded-lg bg-g-950 p-2.5 ring-1 ring-g-700">
      <div className="label mb-1.5 flex justify-between">
        <span>PACK {pack} · 开盖俯视</span>
        <span>BMU →</span>
      </div>
      <div className="grid grid-cols-12 gap-[3px]">
        {Array.from({ length: 48 }, (_, i) => {
          const idx = base + i;
          const isF = idx === focus;
          const isT = targets.includes(idx);
          return (
            <span
              key={i}
              className={cn('h-[14px] rounded-[2px]', isF ? 'animate-blink bg-sig shadow-[0_0_10px_rgba(255,165,31,.9)]' : isT ? 'bg-sig/35' : 'bg-g-700')}
            />
          );
        })}
      </div>
    </div>
  );
}

function ClampStep({ order, cab, onDone }: { order: WorkOrder; cab: Cabinet; onDone: () => void }) {
  const chs = order.targets.slice(0, 4);
  const [open, setOpen] = useState(0);
  const [st, setSt] = useState<Record<number, 'checking' | 'ok'>>({});
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const check = (i: number) => {
    setSt((s) => ({ ...s, [i]: 'checking' }));
    timers.current.push(
      window.setTimeout(() => {
        setSt((s) => ({ ...s, [i]: 'ok' }));
        setOpen((o) => (o === i && i < chs.length - 1 ? i + 1 : o));
      }, 650),
    );
  };
  const all = chs.length > 0 && chs.every((_, i) => st[i] === 'ok');
  const okCount = Object.values(st).filter((v) => v === 'ok').length;
  return (
    <div className="space-y-3">
      <StepTitle n="03" title="夹具连接 · Re-Pulse" sub={`${chs.length} 颗目标电芯 → ${chs.length} 个通道并行注入`} />
      <div className="panel flex items-center gap-3 overflow-hidden p-2 pr-3">
        <img src={rePulseImg} alt="Re-Pulse" className="h-20 w-24 shrink-0 rounded-lg object-cover" />
        <div className="text-[11.5px] leading-relaxed text-g-300">
          <div className="label text-sig">RE-PULSE · 4 通道注入均衡仪</div>
          单通道 0–15 A · 极性反接锁止 · 45 °C 降流 / 55 °C 切断 · 硬件急停 &lt; 10 ms
        </div>
      </div>
      {chs.map((t, i) => {
        const p = cellPos(t.idx);
        const isOpen = open === i;
        const s = st[i];
        const ocv = 3.2 + 0.0018 * cab.cells[t.idx].soc;
        return (
          <div key={t.idx} className={cn('overflow-hidden rounded-xl border', s === 'ok' ? 'border-sig/40 bg-sig/[0.04]' : 'border-g-700 bg-g-850')}>
            <button onClick={() => setOpen(isOpen ? -1 : i)} className="flex w-full items-center gap-3 p-3 text-left">
              <span className="num grid h-8 w-11 place-items-center rounded-md bg-g-950 text-[11px] font-bold text-sig ring-1 ring-g-700">CH{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="num block text-[14px] font-semibold text-g-50">
                  {t.label} <span className="text-[11px] font-normal text-sig">· {t.current} A</span>
                </span>
                <span className="block text-[11px] text-g-400">
                  PACK {p.pack} · 第 {p.row} 排 第 {p.col} 列 · 母排 B{p.pos}
                </span>
              </span>
              {s === 'ok' ? (
                <CheckCircle2 size={18} className="text-sig" />
              ) : s === 'checking' ? (
                <Loader2 size={18} className="animate-spin text-g-400" />
              ) : (
                <ChevronRight size={18} className={cn('text-g-500 transition-transform', isOpen && 'rotate-90')} />
              )}
            </button>
            {isOpen && (
              <div className="border-t border-g-750 p-3">
                <PackMap pack={p.pack} targets={chs.map((x) => x.idx)} focus={t.idx} />
                <ol className="mt-3 space-y-1.5 text-[12px] text-g-300">
                  <li>① 拆下 PACK {p.pack} 前盖（M6 × 8，复装扭矩 6 N·m）</li>
                  <li>
                    ② 定位 第 {p.row} 排 第 {p.col} 列 · 母排编号 B{p.pos}
                  </li>
                  <li>
                    ③ <span className="text-stop-hi">红夹</span> → 正极柱，<span className="text-g-50">黑夹</span> → 负极柱
                  </li>
                </ol>
                {s === 'ok' ? (
                  <div className="num mt-3 rounded-lg bg-g-950 p-2.5 text-[11.5px] text-g-200 ring-1 ring-sig/40">
                    ✓ 极性正确 · OCV {ocv.toFixed(3)} V · 接触电阻 0.4{t.idx % 7} mΩ
                  </div>
                ) : (
                  <Btn variant="outline" className="mt-3 w-full" disabled={s === 'checking'} icon={<Cable size={15} />} onClick={() => check(i)}>
                    {s === 'checking' ? '自检中…' : '极性自检'}
                  </Btn>
                )}
              </div>
            )}
          </div>
        );
      })}
      {!all && (
        <button onClick={() => chs.forEach((_, i) => st[i] !== 'ok' && check(i))} className="text-[11.5px] text-g-500 hover:text-g-300 hover:underline">
          演示：一键自检全部通道
        </button>
      )}
      <Btn variant="primary" size="lg" className="w-full" disabled={!all} onClick={onDone}>
        {all ? '全部通道就绪 · 进入注入' : `${okCount}/${chs.length} 通道就绪`}
      </Btn>
    </div>
  );
}

function VerifyStep({ order, cab, idxs }: { order: WorkOrder; cab: Cabinet; idxs: number[] }) {
  const { dispatch } = useStore();
  const submitted = order.status === 'review' || order.status === 'done';
  const before = order.before ?? snapOf(computeStats(cab));
  const predicted = useMemo(() => snapOf(computeStats({ ...cab, cells: balanceCells(cab.cells, idxs) })), [cab, idxs]);
  const after = order.after ?? predicted;
  const recovered = order.recovered ?? Math.max(0, before.lossMonthly - after.lossMonthly);
  const ITEMS = [`夹具已全部拆除并清点（${idxs.length}/${idxs.length}）`, 'PACK 前盖复装 · 扭矩 6 N·m', '柜门联锁恢复 · PCS 切回自动', '现场照片 3 张已上传'];
  const [checks, setChecks] = useState<boolean[]>(ITEMS.map(() => submitted));
  const rows = [
    { k: '末端压差', b: `${before.deltaV} mV`, a: `${after.deltaV} mV` },
    { k: 'SOC 极差', b: `${before.socSpread.toFixed(1)}%`, a: `${after.socSpread.toFixed(1)}%` },
    { k: '可用容量', b: `${before.usableKWh.toFixed(1)} kWh`, a: `${after.usableKWh.toFixed(1)} kWh` },
    { k: '月度木桶损失', b: yuan(before.lossMonthly), a: yuan(after.lossMonthly) },
  ];
  return (
    <div className="space-y-3">
      <StepTitle n="05" title="复测验收" sub="Re-Bridge 1 Hz 复测 · 结果实时回传中台" />
      <div className="panel overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-2 p-3.5 text-[12.5px]">
          <span className="text-[11px] text-g-500">指标</span>
          <span className="text-right text-[11px] text-g-500">均衡前</span>
          <span className="text-right text-[11px] text-g-500">均衡后</span>
          {rows.map((r) => (
            <div key={r.k} className="contents">
              <span className="text-g-300">{r.k}</span>
              <span className="num text-right text-g-500 line-through decoration-g-600">{r.b}</span>
              <span className="num text-right font-semibold text-sig">{r.a}</span>
            </div>
          ))}
        </div>
        <div className="flex items-end justify-between border-t border-g-750 bg-sig/[0.06] px-3.5 py-3">
          <div>
            <div className="label">每月追回</div>
            <div className="num text-glow-sig text-[28px] font-semibold leading-none text-sig">{yuan(recovered)}</div>
          </div>
          <div className="num text-right text-[11px] text-g-400">
            年化 {yuan(recovered * 12)}
            <br />
            来自 {idxs.length} 颗电芯注入
          </div>
        </div>
      </div>
      {!submitted ? (
        <>
          <div className="space-y-2">
            {ITEMS.map((t, i) => (
              <button
                key={t}
                onClick={() => setChecks((c) => c.map((v, j) => (j === i ? !v : v)))}
                className={cn('flex w-full items-center gap-3 rounded-xl border p-3 text-left text-[12.5px]', checks[i] ? 'border-sig/50 bg-sig/[0.06] text-g-100' : 'border-g-700 bg-g-850 text-g-300')}
              >
                <span className={cn('grid h-5 w-5 shrink-0 place-items-center rounded border', checks[i] ? 'border-sig bg-sig text-g-1000' : 'border-g-600')}>
                  {checks[i] && <Check size={12} strokeWidth={3} />}
                </span>
                {t}
              </button>
            ))}
          </div>
          {!checks.every(Boolean) && (
            <button onClick={() => setChecks(ITEMS.map(() => true))} className="text-[11.5px] text-g-500 hover:text-g-300 hover:underline">
              演示：一键全部确认
            </button>
          )}
          <Btn
            variant="primary"
            size="lg"
            className="w-full"
            disabled={!checks.every(Boolean)}
            onClick={() => dispatch({ type: 'BALANCE_DONE', id: order.id, cabinetId: cab.id, idxs })}
          >
            提交验收 · 同步中台
          </Btn>
        </>
      ) : (
        <div className="animate-rise rounded-xl border border-sig/50 bg-sig/[0.07] p-4 text-center">
          <CheckCircle2 size={28} className="mx-auto text-sig" />
          <div className="mt-2 text-[15px] font-semibold text-g-50">{order.status === 'done' ? '中台已验收归档' : '已提交 · 等待中台验收'}</div>
          <div className="mt-1 text-[12px] text-g-400">资产总览的"看不见的损失"已同步下降</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Btn variant="ghost" onClick={() => dispatch({ type: 'NAV', patch: { mobileTab: 'tasks' } })}>
              回到工单
            </Btn>
            <Btn variant="primary" icon={<ArrowRight size={14} />} onClick={() => dispatch({ type: 'NAV', patch: { mode: wideMode(), pcPage: 'orders' } })}>
              去中台验收
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function RevealStep({ order, cab }: { order: WorkOrder; cab: Cabinet }) {
  const { state, dispatch } = useStore();
  const st = computeStats(cab);
  const r = cab.rescued;
  const hot = st.tMax >= 45;
  const weak = weakList(cab.cells, 8).filter((w) => w.dSoc < -0.9).slice(0, 4);
  const follow = state.orders.find((o) => o.cabinetId === cab.id && o.id !== order.id && o.status !== 'done');
  const submitted = order.status === 'review' || order.status === 'done';
  const createFollow = () => {
    if (hot)
      dispatch({ type: 'DISPATCH', kind: 'inspect', cabinetId: cab.id, title: `${cellLabel(st.hotCell)} 高温 · 风扇 / 风道排查`, engineer: APP_ENGINEER, priority: 'P1', targets: [], source: 'field' });
    else if (weak.length)
      dispatch({
        type: 'DISPATCH', kind: 'balance', cabinetId: cab.id, title: `电芯均衡 · ${weak[0].label} 等 ${weak.length} 颗`, engineer: APP_ENGINEER,
        priority: st.status === 'critical' ? 'P1' : 'P2', targets: weak, source: 'field',
      });
  };
  if (!cab.online) return <div className="panel-inset p-4 text-[12.5px] text-g-300">柜体尚未恢复在线，请返回上一步完成 Re-Bridge 握手。</div>;
  return (
    <div className="space-y-3">
      <StepTitle n="03" title="盲区数据回传" sub={`失联 ${r?.days ?? 0} 天里发生了什么，现在都看得见了`} />
      <div className="panel p-3.5">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-g-950 p-2 ring-1 ring-g-750">
            <div className="text-[10px] text-g-500">末端压差</div>
            <div className="num text-[16px] font-semibold text-g-50">
              {r ? <span className="text-[11px] text-g-500 line-through">{r.staleDeltaV}</span> : null} {st.deltaV}
            </div>
            <div className="text-[9.5px] text-g-500">mV</div>
          </div>
          <div className="rounded-lg bg-g-950 p-2 ring-1 ring-g-750">
            <div className="text-[10px] text-g-500">最高温度</div>
            <div className={cn('num text-[16px] font-semibold', hot ? 'text-stop-hi' : 'text-g-50')}>{st.tMax.toFixed(1)}</div>
            <div className="text-[9.5px] text-g-500">°C</div>
          </div>
          <div className="rounded-lg bg-g-950 p-2 ring-1 ring-g-750">
            <div className="text-[10px] text-g-500">月木桶损失</div>
            <div className="num text-[16px] font-semibold text-sig">{yuan(st.lossMonthly)}</div>
            <div className="text-[9.5px] text-g-500">/月</div>
          </div>
        </div>
        <div className={cn('mt-3 rounded-lg p-2.5 text-[12px] leading-relaxed', hot ? 'bg-stop/10 text-stop-hi ring-1 ring-stop/40' : 'bg-sig/10 text-g-100 ring-1 ring-sig/30')}>
          {hot
            ? `${cellLabel(st.hotCell)} 温度 ${st.tMax.toFixed(1)} °C，同排多颗偏高——风扇疑似故障，建议立即生成温控排查工单。`
            : weak.length
              ? `盲区内恶化：${weak[0].label} 等 ${weak.length} 颗电芯 SOC 明显偏低，建议当场转均衡工单。`
              : '电芯状态良好，可直接提交救援验收。'}
        </div>
      </div>
      {(hot || weak.length > 0) &&
        (follow ? (
          <div className="rounded-xl border border-g-700 bg-g-850 p-3 text-[12px] text-g-300">
            已生成后续工单 <span className="num text-g-100">{follow.id}</span> · {follow.title}
            <Btn size="sm" variant="outline" className="mt-2 w-full" onClick={() => dispatch({ type: 'NAV', patch: { mobileTab: 'tasks' } })}>
              去工单查看
            </Btn>
          </div>
        ) : (
          <Btn variant="outline" size="lg" className="w-full" onClick={createFollow}>
            {hot ? '生成温控排查工单（派给我）' : '转均衡工单（派给我）'}
          </Btn>
        ))}
      {submitted ? (
        <div className="rounded-xl border border-sig/50 bg-sig/[0.07] p-3 text-center text-[13px] text-g-100">救援已提交 · 等待中台验收</div>
      ) : (
        <Btn
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => dispatch({ type: 'STATUS', id: order.id, status: 'review', text: `Re-Bridge 救援完成 · 已恢复在线（失联 ${r?.days ?? 0} 天）`, tone: 'ok', from: 'field' })}
        >
          提交救援验收
        </Btn>
      )}
    </div>
  );
}

const INSPECT_ITEMS: Record<'inspect' | 'retire', string[]> = {
  inspect: ['风扇 / 液冷泵运转正常', '风道滤网清灰', '温感复核（红外 vs BMS 偏差 ≤ 2 °C）', '消防气溶胶压力正常', '柜体密封与防水完好'],
  retire: ['模组外观无鼓包、无漏液', '模组静置电压一致性复测', '内阻抽检 8 颗', '扫码绑定电池护照', '包装与运输标识（UN3480）'],
};

function InspectStep({ order }: { order: WorkOrder }) {
  const { dispatch } = useStore();
  const kind = order.kind === 'retire' ? 'retire' : 'inspect';
  const items = INSPECT_ITEMS[kind];
  const submitted = order.status === 'review' || order.status === 'done';
  const [checks, setChecks] = useState<boolean[]>(items.map(() => submitted));
  return (
    <div className="space-y-3">
      <StepTitle n="02" title={kind === 'retire' ? '退役评估' : '巡检清单'} sub={order.title} />
      <div className="space-y-2">
        {items.map((t, i) => (
          <button
            key={t}
            onClick={() => setChecks((c) => c.map((v, j) => (j === i ? !v : v)))}
            className={cn('flex w-full items-center gap-3 rounded-xl border p-3 text-left text-[12.5px]', checks[i] ? 'border-sig/50 bg-sig/[0.06] text-g-100' : 'border-g-700 bg-g-850 text-g-300')}
          >
            <span className={cn('grid h-5 w-5 shrink-0 place-items-center rounded border', checks[i] ? 'border-sig bg-sig text-g-1000' : 'border-g-600')}>
              {checks[i] && <Check size={12} strokeWidth={3} />}
            </span>
            {t}
          </button>
        ))}
      </div>
      {kind === 'retire' && (
        <Btn variant="outline" className="w-full" icon={<QrCode size={15} />} onClick={() => dispatch({ type: 'NAV', patch: { mobileTab: 'passport', passportId: 'BP-HF01-P2' } })}>
          打开该模组的电池护照
        </Btn>
      )}
      {submitted ? (
        <div className="rounded-xl border border-sig/50 bg-sig/[0.07] p-3 text-center text-[13px] text-g-100">已提交 · 等待中台验收</div>
      ) : (
        <Btn
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!checks.every(Boolean)}
          onClick={() => dispatch({ type: 'STATUS', id: order.id, status: 'review', text: `${kind === 'retire' ? '退役评估' : '巡检'}完成 · ${items.length}/${items.length} 项 · 提交验收`, tone: 'ok', from: 'field' })}
        >
          {checks.every(Boolean) ? '提交验收' : `还差 ${checks.filter((v) => !v).length} 项`}
        </Btn>
      )}
    </div>
  );
}

function EstopFab({ onPress }: { onPress: () => void }) {
  return (
    <div className="absolute bottom-[90px] right-3 z-30 flex flex-col items-center">
      <button onClick={onPress} aria-label="急停" className="estop-ring grid h-[66px] w-[66px] place-items-center rounded-full">
        <span className="estop-cap grid h-[44px] w-[44px] place-items-center rounded-full text-[10px] font-black tracking-wider text-white/90">STOP</span>
      </button>
      <span className="mt-0.5 rounded bg-g-950/85 px-1.5 text-[10px] font-semibold text-stop-hi">急停</span>
    </div>
  );
}

function HoldButton({ onDone }: { onDone: () => void }) {
  const [p, setP] = useState(0);
  const raf = useRef<number | null>(null);
  const t0 = useRef(0);
  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    },
    [],
  );
  const tick = (t: number) => {
    const v = Math.min(1, (t - t0.current) / 1500);
    setP(v);
    if (v >= 1) {
      raf.current = null;
      onDone();
      return;
    }
    raf.current = requestAnimationFrame(tick);
  };
  const down = () => {
    t0.current = performance.now();
    raf.current = requestAnimationFrame(tick);
  };
  const up = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    setP(0);
  };
  return (
    <button
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={up}
      className="relative mt-6 h-12 w-full select-none overflow-hidden rounded-xl border border-g-600 bg-g-850 text-[13px] font-semibold text-g-100"
    >
      <span className="absolute inset-y-0 left-0 bg-sig/35" style={{ width: `${p * 100}%` }} />
      <span className="relative flex items-center justify-center gap-2">
        <RotateCcw size={15} /> 长按 1.5 秒 · 旋转复位
      </span>
    </button>
  );
}

function EstopOverlay({ onReset }: { onReset: () => void }) {
  return (
    <div className="absolute inset-0 z-[60] flex flex-col bg-[#0b0605]/97">
      <div className="hazard-red h-3 shrink-0" />
      <div className="no-scrollbar flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 text-center">
        <div className="estop-ring grid h-[116px] w-[116px] place-items-center rounded-full">
          <span data-pressed="true" className="estop-cap grid h-[80px] w-[80px] place-items-center rounded-full text-[15px] font-black tracking-wider text-white/90">
            STOP
          </span>
        </div>
        <h2 className="text-glow-stop mt-5 text-[26px] font-bold text-stop-hi">急停已触发</h2>
        <p className="mt-2 text-[12.5px] leading-relaxed text-g-300">
          Re-Pulse 全部通道输出已硬件切断（&lt; 10 ms）
          <br />
          工单已挂起，并同步推送 RE/OPS 中台
        </p>
        <ol className="mt-4 w-full space-y-2 text-left text-[12.5px] text-g-200">
          {['保持柜门关闭，撤离至 5 m 外', '观察有无烟雾 / 异味，必要时拨打 119', '通知园区 EHS 与中台值班（已自动推送）', '确认温度回落 < 40 °C 后方可复位'].map((t, i) => (
            <li key={t} className="flex gap-2.5 rounded-lg bg-g-900/80 px-3 py-2 ring-1 ring-stop/20">
              <span className="num font-bold text-stop-hi">{i + 1}</span>
              {t}
            </li>
          ))}
        </ol>
        <HoldButton onDone={onReset} />
      </div>
      <div className="hazard-red h-3 shrink-0" />
    </div>
  );
}

function OrderHead({ order, cab }: { order: WorkOrder; cab: Cabinet }) {
  return (
    <div className="panel p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Priority p={order.priority} />
          <span className="num text-[11px] text-g-400">{order.id}</span>
        </div>
        <span className="text-[11px] text-g-400">
          {cab.cooling} · {cab.oem}
        </span>
      </div>
      <div className="mt-1.5 text-[15px] font-semibold text-g-50">
        {cab.id} · {KIND_META[order.kind].label}
      </div>
      <div className="flex items-center gap-1 text-[11.5px] text-g-400">
        <MapPin size={11} /> {cab.city} · {cab.site}
      </div>
    </div>
  );
}

function OpsFlow({ order }: { order: WorkOrder }) {
  const { state, dispatch } = useStore();
  const cab = state.cabinets.find((c) => c.id === order.cabinetId)!;
  const flow = FLOWS[order.kind];
  const finished = order.status === 'review' || order.status === 'done';
  const saved = progress.get(order.id);
  const [step, setStep] = useState(() => (finished ? flow.length - 1 : Math.min(saved?.step ?? 0, flow.length - 1)));
  const [doneIdxs, setDoneIdxs] = useState<number[]>(saved?.doneIdxs ?? []);
  const [estop, setEstop] = useState(order.status === 'suspended');
  useEffect(() => {
    progress.set(order.id, { step, doneIdxs });
  }, [order.id, step, doneIdxs]);
  const key = flow[step];
  const next = () => setStep((s) => Math.min(flow.length - 1, s + 1));

  const pressEstop = () => {
    if (estop) return;
    setEstop(true);
    dispatch({ type: 'STATUS', id: order.id, status: 'suspended', text: '现场急停触发 · Re-Pulse 输出已切断 · 工单挂起', tone: 'crit', from: 'field' });
  };
  const resetEstop = () => {
    setEstop(false);
    dispatch({ type: 'STATUS', id: order.id, status: 'onsite', text: '急停已复位 · 现场确认安全后恢复作业', tone: 'warn', from: 'field' });
  };
  const showFab = !finished && (key === 'bridge' || key === 'clamp' || key === 'inject');

  return (
    <div className="px-4 pb-28 pt-3">
      <OrderHead order={order} cab={cab} />
      <Stepper flow={flow} step={step} />
      <div className="mt-4">
        {key === 'safety' && <SafetyStep onDone={next} />}
        {key === 'bridge' && <BridgeStep order={order} cab={cab} onDone={next} />}
        {key === 'clamp' && <ClampStep order={order} cab={cab} onDone={next} />}
        {key === 'inject' && (
          <InjectStep
            order={order}
            cab={cab}
            estop={estop}
            onEstop={pressEstop}
            onComplete={(idxs) => {
              setDoneIdxs(idxs);
              next();
            }}
          />
        )}
        {key === 'verify' && <VerifyStep order={order} cab={cab} idxs={doneIdxs.length ? doneIdxs : order.targets.map((t) => t.idx)} />}
        {key === 'reveal' && <RevealStep order={order} cab={cab} />}
        {key === 'inspect' && <InspectStep order={order} />}
      </div>
      {showFab && !estop && <EstopFab onPress={pressEstop} />}
      {estop && <EstopOverlay onReset={resetEstop} />}
    </div>
  );
}

export function FieldOps() {
  const { state } = useStore();
  const order = state.orders.find((o) => o.id === state.ui.activeOrder);
  if (!order) return <EmptyOps />;
  return <OpsFlow key={order.id} order={order} />;
}
