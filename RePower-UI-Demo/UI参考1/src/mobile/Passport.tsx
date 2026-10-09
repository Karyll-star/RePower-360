import { useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { useStore } from "../store";
import { Btn, Chip, Icon, Ring, Seg } from "../ui";
import { MCard } from "./parts";
import { CHANNELS, bestChannel, completenessOf, fmtPct, fmtY, valueOf, type Channel, type Passport } from "../model";

function Qr({ seed }: { seed: string }) {
  const N = 11;
  let h = 7;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  const rnd = () => ((h = (Math.imul(h, 1103515245) + 12345) | 0) >>> 16) & 1;
  const cells: boolean[] = [];
  for (let i = 0; i < N * N; i++) cells.push(rnd() === 1);
  const inFinder = (x: number, y: number) => (x < 3 && y < 3) || (x > N - 4 && y < 3) || (x < 3 && y > N - 4);
  return (
    <svg viewBox={`0 0 ${N} ${N}`} className="h-14 w-14 rounded-[4px] bg-g-100 p-[3px]" shapeRendering="crispEdges">
      {cells.map((on, i) => {
        const x = i % N, y = Math.floor(i / N);
        if (inFinder(x, y)) return null;
        return on ? <rect key={i} x={x} y={y} width="1" height="1" fill="#0b0d0e" /> : null;
      })}
      {[[0, 0], [N - 3, 0], [0, N - 3]].map(([x, y]) => (
        <g key={`${x}${y}`}>
          <rect x={x} y={y} width="3" height="3" fill="#0b0d0e" />
          <rect x={x + 0.7} y={y + 0.7} width="1.6" height="1.6" fill="#e8ebee" />
          <rect x={x + 1.1} y={y + 1.1} width="0.8" height="0.8" fill="#0b0d0e" />
        </g>
      ))}
    </svg>
  );
}

function Detail({ pp, onBack }: { pp: Passport; onBack: () => void }) {
  const { state, dispatch } = useStore();
  const comp = completenessOf(pp.items);
  const base = { kwh: pp.kwh, soh: pp.soh, cycles: pp.cycles, chem: pp.chem };
  const best = bestChannel({ ...base, completeness: comp });
  const [ch, setCh] = useState<Channel>(best);
  const v = valueOf({ ...base, completeness: comp, channel: ch });
  const v0 = valueOf({ ...base, completeness: 0, channel: ch });
  const v1 = valueOf({ ...base, completeness: 1, channel: ch });
  const listed = state.listings[pp.id];
  const missing = pp.items
    .filter((i) => i.got < 0.99)
    .map((i) => ({ ...i, up: valueOf({ ...base, completeness: Math.min(1, comp + (i.pts * (1 - i.got)) / 100), channel: ch }).value - v.value }))
    .sort((a, b) => b.up - a.up)
    .slice(0, 3);
  const maxBar = Math.max(v1.value, 1);

  return (
    <div className="space-y-3 pb-2">
      <button onClick={onBack} className="flex cursor-pointer items-center gap-1 text-xs text-g-400 hover:text-g-200"><Icon name="chev" size={13} className="rotate-180" />护照列表</button>

      <MCard className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-1.5"><Chip tone={pp.kind === "retired" ? "amber" : "ok"}>{pp.kind === "retired" ? "已退役" : "在役"}</Chip><Chip>{pp.chem}</Chip></div>
          <div className="num mt-1.5 text-[18px] font-bold leading-none">{pp.id}</div>
          <div className="mt-1 text-[11.5px] text-g-400">{pp.name}</div>
          <div className="text-[10.5px] text-g-500">{pp.origin} · {pp.date}</div>
        </div>
        <Qr seed={pp.id} />
      </MCard>

      <div className="grid grid-cols-4 gap-1.5 text-center">
        {[
          { l: "容量", v: `${pp.kwh}kWh` },
          { l: "平均SOH", v: fmtPct(pp.sohMean, 0) },
          { l: "最短板", v: fmtPct(pp.sohMin, 0), c: pp.sohMin < 0.74 ? "text-estop" : pp.sohMin < 0.86 ? "text-amber-led" : "" },
          { l: "循环", v: String(pp.cycles) },
        ].map((x) => (
          <div key={x.l} className="rounded-[8px] border border-g-700 bg-g-850 px-1 py-2">
            <div className="text-[9.5px] text-g-500">{x.l}</div>
            <div className={cn("num mt-0.5 text-[13px] font-bold", x.c)}>{x.v}</div>
          </div>
        ))}
      </div>

      {/* 残值估价器 */}
      <MCard className="border-amber-led/30">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-semibold">残值估价</span>
          <span className="text-[10px] text-g-500">示意估算 · 非正式报价</span>
        </div>
        <Seg size="sm" className="w-full [&>button]:flex-1" value={ch} onChange={setCh} options={(Object.keys(CHANNELS) as Channel[]).map((k) => ({ v: k, label: CHANNELS[k].name + (k === best ? " ★" : "") }))} />
        <div className="mt-1 text-[10.5px] text-g-500">{CHANNELS[ch].desc}</div>

        {v.ok ? (
          <>
            <div className="mt-3 text-center">
              <div className="text-[11px] text-g-400">这块电池现在能卖</div>
              <div className="num text-[40px] font-bold leading-none text-amber-led">{fmtY(v.value)}</div>
              <div className="num mt-1 text-[11px] text-g-500">≈ {fmtY(v.value / pp.kwh)} / kWh</div>
            </div>
            <div className="num mt-3 space-y-1 rounded-[8px] bg-g-950 p-2.5 text-[11.5px]">
              <div className="flex justify-between"><span className="text-g-400">{pp.kwh} kWh × 单价（SOH {fmtPct(pp.soh)}）</span><span>{fmtY(v.perKwh)}/kWh</span></div>
              <div className="flex justify-between"><span className="text-g-400">× 循环折扣（{pp.cycles} 次）</span><span>{v.cf.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-g-400">× 护照系数（完整度 {fmtPct(comp, 0)}）</span><span className={v.premium >= 1 ? "text-ok" : "text-estop"}>{v.premium.toFixed(2)}</span></div>
            </div>
            <div className="mt-3 space-y-1.5">
              {[
                { l: "无护照", val: v0.value, c: "bg-g-500" },
                { l: "当前护照", val: v.value, c: "bg-amber-led" },
                { l: "补齐后", val: v1.value, c: "bg-ok" },
              ].map((b) => (
                <div key={b.l} className="flex items-center gap-2 text-[11px]">
                  <span className="w-14 text-g-400">{b.l}</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-[2px] bg-g-950"><i className={cn("block h-full", b.c)} style={{ width: `${(b.val / maxBar) * 100}%` }} /></span>
                  <span className="num w-16 text-right text-g-200">{fmtY(b.val)}</span>
                </div>
              ))}
            </div>
            {ch === "recycle" && <div className="mt-2 rounded-[6px] bg-g-950 px-2.5 py-2 text-[11px] text-g-400">拆解回收按材料计价，护照不加价——这也是为什么要尽量走梯次渠道。</div>}
          </>
        ) : (
          <div className="mt-3 rounded-[8px] border border-estop/30 bg-estop/8 p-3 text-xs text-g-300"><b className="text-estop">SOH 不达标：</b>{pp.soh < 0.6 ? "低于 60%" : "低于 70%"}，该渠道无法收购。请切换渠道。</div>
        )}

        {listed ? (
          <div className="mt-3 flex items-center justify-center gap-1.5 rounded-[8px] border border-ok/40 bg-ok/8 py-2.5 text-[13px] font-semibold text-ok"><Icon name="check" size={15} />已提交 · 挂牌 {fmtY(listed)}</div>
        ) : (
          <Btn variant="primary" size="lg" className="mt-3 w-full" disabled={!v.ok} onClick={() => dispatch({ type: "list", passportId: pp.id, price: v.value })}>
            <Icon name="tag" size={15} />申请回购报价 · 挂牌
          </Btn>
        )}
      </MCard>

      {/* 完整度 */}
      <MCard>
        <div className="mb-3 flex items-center gap-3">
          <Ring value={comp} size={46} stroke={5} color={comp > 0.75 ? "#7fd1a8" : comp > 0.5 ? "#ffb020" : "#e5342e"}><span className="num text-[10px] font-bold">{fmtPct(comp, 0)}</span></Ring>
          <div>
            <div className="text-[13px] font-semibold">护照完整度</div>
            <div className="text-[11px] text-g-500">数据越完整，买家越敢出价</div>
          </div>
        </div>
        <div className="space-y-2.5">
          {pp.items.map((i) => (
            <div key={i.label}>
              <div className="flex items-center justify-between text-[12px]"><span className="text-g-200">{i.label}</span><span className="num text-g-400">{(i.pts * i.got).toFixed(0)}/{i.pts}</span></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-g-800"><i className={cn("block h-full", i.got > 0.9 ? "bg-ok" : i.got > 0.4 ? "bg-amber-led" : "bg-estop")} style={{ width: `${Math.max(i.got * 100, 3)}%` }} /></div>
              <div className="mt-0.5 text-[10.5px] text-g-500">{i.hint}</div>
            </div>
          ))}
        </div>
        {missing.length > 0 && v.ok && (
          <div className="mt-3 rounded-[8px] border border-amber-led/25 bg-amber-led/6 p-2.5">
            <div className="mb-1 text-[11.5px] font-semibold text-amber-led">补齐这些，还能多卖：</div>
            {missing.map((m) => (
              <div key={m.label} className="flex justify-between text-[11.5px] text-g-300"><span>{m.label}</span><span className="num text-ok">+{fmtY(m.up)}</span></div>
            ))}
          </div>
        )}
      </MCard>

      {/* 履历 */}
      <MCard>
        <div className="mb-2 text-[13px] font-semibold">全生命周期履历</div>
        <div className="relative space-y-3 pl-4">
          <span className="absolute bottom-1 left-[5px] top-1 w-px bg-g-700" />
          {pp.logs.map((l, i) => (
            <div key={i} className="relative">
              <span className={cn("absolute -left-[15px] top-1 h-2.5 w-2.5 rounded-full border-2 border-g-900", l.kind === "repair" ? "bg-ok" : l.kind === "warn" ? "bg-amber-led" : "bg-g-500")} />
              <div className="num text-[10.5px] text-g-500">{l.t}</div>
              <div className={cn("text-[12px] leading-snug", l.kind === "repair" ? "text-ok" : l.kind === "warn" ? "text-amber-led" : "text-g-200")}>{l.text}</div>
            </div>
          ))}
        </div>
      </MCard>
    </div>
  );
}

export default function MPassport({ openId, onOpen }: { openId: string | null; onOpen: (id: string | null) => void }) {
  const { state, passports } = useStore();
  const [kind, setKind] = useState<"retired" | "cabinet">("retired");
  const list = useMemo(() => passports.filter((p) => p.kind === kind), [passports, kind]);
  const open = openId ? passports.find((p) => p.id === openId) : null;

  if (open) return <Detail key={open.id} pp={open} onBack={() => onOpen(null)} />;

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[19px] font-bold">电池护照</div>
        <div className="mt-0.5 text-[11.5px] text-g-500">每块电池的“身份证 + 病历本 + 价签”</div>
      </div>
      <Seg className="w-full [&>button]:flex-1" value={kind} onChange={setKind} options={[{ v: "retired", label: `退役电池 ${passports.filter((p) => p.kind === "retired").length}` }, { v: "cabinet", label: `在役储能柜 ${passports.filter((p) => p.kind === "cabinet").length}` }]} />
      <div className="space-y-2">
        {list.map((pp) => {
          const comp = completenessOf(pp.items);
          const base = { kwh: pp.kwh, soh: pp.soh, cycles: pp.cycles, chem: pp.chem, completeness: comp };
          const ch = bestChannel(base);
          const val = valueOf({ ...base, channel: ch }).value;
          return (
            <button key={pp.id} onClick={() => onOpen(pp.id)} className="flex w-full cursor-pointer items-center gap-3 rounded-[10px] border border-g-700 bg-g-850 p-3 text-left transition hover:bg-g-800">
              <Ring value={pp.soh} size={46} stroke={5} color={pp.soh > 0.8 ? "#7fd1a8" : pp.soh > 0.7 ? "#ffb020" : "#e5342e"}><span className="num text-[10px] font-bold">{fmtPct(pp.soh, 0)}</span></Ring>
              <div className="min-w-0 flex-1">
                <div className="num text-[13px] font-bold">{pp.id}</div>
                <div className="truncate text-[11px] text-g-500">{pp.kwh}kWh · {pp.cycles}次 · {pp.chem}</div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="h-1 w-14 overflow-hidden rounded-full bg-g-800"><i className="block h-full bg-amber-led" style={{ width: `${comp * 100}%` }} /></span>
                  <span className="num text-[10px] text-g-500">护照 {fmtPct(comp, 0)}</span>
                  {state.listings[pp.id] && <Chip tone="ok">已挂牌</Chip>}
                </div>
              </div>
              <div className="text-right">
                <div className="num text-[15px] font-bold text-amber-led">{fmtY(val)}</div>
                <div className="text-[10px] text-g-500">{CHANNELS[ch].name}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
