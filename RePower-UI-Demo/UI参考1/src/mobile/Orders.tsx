import { cn } from "../utils/cn";
import { useStore } from "../store";
import { Btn, Chip, Icon, Lamp } from "../ui";
import { SITES, TYPE_NAME, fmtPct, fmtY, healthyMean, pulsePlan, type Order } from "../model";
import { MCard } from "./parts";

export default function MOrders({ onStart }: { onStart: (id: string) => void }) {
  const { state, mets } = useStore();
  const mine = state.orders.filter((o) => o.engineer === state.engineer);
  const todo = mine.filter((o) => o.status === "dispatched" || o.status === "in_progress");
  const done = mine.filter((o) => o.status === "done");
  const gain = done.reduce((a, o) => a + o.gain, 0);

  const Card = (o: Order) => {
    const cab = state.cabinets.find((c) => c.id === o.cabinetId)!;
    const site = SITES.find((s) => s.id === cab.siteId)!;
    const m = mets[cab.id];
    const gear = o.type === "rescue" ? ["Re-Bridge", "Re-Pulse"] : o.type === "reconnect" ? ["Re-Bridge", "备用 SIM / 保险"] : ["Re-Bridge", "红外测温枪"];
    const hm = healthyMean(cab, o.cellIds);
    return (
      <MCard key={o.id} className={cn(o.priority === "P0" && "border-estop/50", o.status === "in_progress" && "border-amber-led/60")}>
        <div className="flex items-center justify-between">
          <span className="num text-[11px] text-g-500">{o.id}</span>
          <span className="flex gap-1.5">
            <Chip tone={o.priority === "P0" ? "red" : o.priority === "P1" ? "amber" : "mute"}>{o.priority}</Chip>
            <Chip tone={o.type === "inspect" ? "red" : "mute"}>{TYPE_NAME[o.type]}</Chip>
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2.5">
          <Lamp d={m.display} className="!h-2.5 !w-2.5" />
          <div className="flex-1">
            <div className="num text-[17px] font-bold leading-none">{cab.id}</div>
            <div className="mt-1 flex items-center gap-1 text-[11px] text-g-500"><Icon name="pin" size={11} />{site.name} · {cab.kwh}kWh</div>
          </div>
          {o.gain > 0 && (
            <div className="text-right">
              <div className="num text-[15px] font-bold text-ok">+{fmtY(o.gain)}</div>
              <div className="text-[9.5px] text-g-500">预计月增</div>
            </div>
          )}
        </div>
        {o.note && <div className="mt-2 text-[12px] leading-snug text-g-400">{o.note}</div>}

        <div className="mt-3 rounded-[8px] bg-g-950 p-2.5">
          <div className="label-cap mb-1.5 !text-[9.5px]">到场要带 / 要连</div>
          <div className="flex flex-wrap gap-1.5">
            {gear.map((g) => <span key={g} className="flex items-center gap-1 rounded-[4px] border border-amber-led/30 bg-amber-led/8 px-2 py-1 text-[11px] text-amber-led"><Icon name="plug" size={11} />{g}</span>)}
          </div>
          {o.type === "rescue" && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {o.cellIds.map((id) => {
                const c = cab.cells[id - 1];
                const p = pulsePlan(c, hm);
                return (
                  <span key={id} className="num rounded-[4px] bg-g-800 px-2 py-1 text-[11px] text-g-200">
                    #{String(id).padStart(2, "0")} <span className="text-g-500">{fmtPct(c.soh, 0)}</span> → <b className={p.blocked ? "text-estop" : "text-amber-led"}>{p.blocked ? "禁止" : `${p.rec}A`}</b>
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <Btn variant="primary" size="lg" className="mt-3 w-full" onClick={() => onStart(o.id)}>
          {o.status === "in_progress" ? "继续作业" : "开始作业"}<Icon name="chev" size={16} />
        </Btn>
      </MCard>
    );
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[19px] font-bold">{state.engineer}，今日工单</div>
        <div className="mt-0.5 text-[11.5px] text-g-500">苏锡常片区 · 工单由 PC 中台实时派发</div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { l: "待作业", v: String(todo.length), c: todo.length ? "text-amber-led" : "text-g-100" },
          { l: "已完成", v: String(done.length), c: "text-g-100" },
          { l: "累计挽回/月", v: fmtY(gain), c: "text-ok" },
        ].map((s) => (
          <div key={s.l} className="rounded-[8px] border border-g-700 bg-g-850 px-2.5 py-2">
            <div className="text-[10px] text-g-500">{s.l}</div>
            <div className={cn("num mt-0.5 text-[15px] font-bold", s.c)}>{s.v}</div>
          </div>
        ))}
      </div>

      {todo.length === 0 && (
        <MCard className="py-8 text-center">
          <Icon name="list" size={28} className="mx-auto text-g-600" />
          <div className="mt-2 text-sm text-g-300">暂无待作业工单</div>
          <div className="mt-1 text-xs text-g-500">在 PC 中台「工单调度」派单给「{state.engineer}」，这里会实时出现</div>
        </MCard>
      )}
      {todo.map(Card)}

      {done.length > 0 && (
        <div>
          <div className="label-cap mb-1.5 mt-4">已完成</div>
          <div className="space-y-1.5">
            {done.map((o) => (
              <div key={o.id} className="flex items-center gap-2.5 rounded-[8px] border border-g-800 bg-g-900 px-3 py-2.5 text-xs">
                <Icon name="check" size={14} className="text-ok" />
                <span className="num font-semibold">{o.cabinetId}</span>
                <span className="text-g-500">{TYPE_NAME[o.type]}</span>
                <span className="num ml-auto text-ok">{o.gain > 0 ? `+${fmtY(o.gain)}` : "已闭环"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
