import { createContext, useState, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { Btn, Icon } from "../ui";
import { CabinetFront, type PortKey, type PortState } from "../viz";
import type { Cabinet } from "../model";

/** 手机屏幕层的浮层挂载点（急停遮罩要盖住底部导航） */
export const OverlayCtx = createContext<HTMLElement | null>(null);

export function StepBar({ steps, idx }: { steps: string[]; idx: number }) {
  return (
    <div className="flex gap-1.5">
      {steps.map((s, i) => (
        <div key={s} className="flex-1">
          <div className={cn("h-1 rounded-full", i < idx ? "bg-ok" : i === idx ? "bg-amber-led" : "bg-g-700")} />
          <div className={cn("mt-1 text-[10px]", i === idx ? "font-semibold text-amber-led" : i < idx ? "text-ok" : "text-g-500")}>
            {i + 1} {s}
          </div>
        </div>
      ))}
    </div>
  );
}

export function MCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-[10px] border border-g-700 bg-g-850 p-3.5", className)}>{children}</div>;
}

export function Check({ checked, onChange, children }: { checked: boolean; onChange: (b: boolean) => void; children: ReactNode }) {
  return (
    <button onClick={() => onChange(!checked)} className={cn("flex w-full cursor-pointer items-start gap-3 rounded-[8px] border px-3 py-3 text-left transition", checked ? "border-ok/40 bg-ok/8" : "border-g-700 bg-g-900")}>
      <span className={cn("mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-[4px] border", checked ? "border-ok bg-ok text-g-950" : "border-g-500")}>{checked && <Icon name="check" size={13} stroke={3} />}</span>
      <span className={cn("text-[13px] leading-snug", checked ? "text-g-200" : "text-g-100")}>{children}</span>
    </button>
  );
}

export interface ConnItem {
  key: PortKey;
  title: string;
  desc: string;
  action: string;
  doneText: string;
  ms?: number;
}

/** “到场先连什么”：前面板接线图 + 按顺序点亮要接的口 */
export function ConnectStep({
  cab,
  items,
  device,
  onNext,
  nextLabel,
}: {
  cab: Cabinet;
  items: ConnItem[];
  device: "rescue" | "reconnect" | "inspect";
  onNext: () => void;
  nextLabel: string;
}) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const active = items.findIndex((i) => !done[i.key]);
  const all = active === -1;

  const run = (it: ConnItem) => {
    setBusy(it.key);
    setTimeout(() => {
      setDone((d) => ({ ...d, [it.key]: true }));
      setBusy(null);
    }, it.ms ?? 1300);
  };

  const ports: Partial<Record<PortKey, PortState>> = {};
  items.forEach((it, i) => {
    ports[it.key] = done[it.key] ? "done" : i === active ? "active" : "todo";
  });

  return (
    <div className="space-y-3">
      <div className="rounded-[10px] border border-g-700 bg-g-950 p-2.5">
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="label-cap">{cab.id} · 前维护面板</span>
          <span className="text-[10px] text-amber-led">{all ? "接线完成" : `当前：${items[active].title}`}</span>
        </div>
        <CabinetFront
          ports={ports}
          bridge={done.brg ? "linked" : "idle"}
          pulse={device === "rescue" ? (done.mnt ? "linked" : "idle") : "off"}
          lamp={all ? "ok" : "warn"}
        />
      </div>

      <div className="space-y-2">
        {items.map((it, i) => {
          const isDone = done[it.key];
          const isActive = i === active;
          return (
            <div key={it.key} className={cn("rounded-[10px] border p-3 transition", isDone ? "border-ok/40 bg-ok/6" : isActive ? "border-amber-led/60 bg-amber-led/6" : "border-g-800 bg-g-900 opacity-60")}>
              <div className="flex items-start gap-3">
                <span className={cn("num flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold", isDone ? "bg-ok text-g-950" : isActive ? "bg-amber-led text-g-950" : "bg-g-700 text-g-400")}>
                  {isDone ? <Icon name="check" size={13} stroke={3} /> : i + 1}
                </span>
                <div className="flex-1">
                  <div className="text-[14px] font-semibold text-g-100">{it.title}</div>
                  <div className="mt-0.5 text-[12px] leading-snug text-g-400">{isDone ? it.doneText : it.desc}</div>
                </div>
              </div>
              {isActive && (
                <Btn variant="primary" size="lg" className="mt-3 w-full" disabled={busy === it.key} onClick={() => run(it)}>
                  {busy === it.key ? (
                    <>
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-g-950 border-t-transparent" />
                      握手中…
                    </>
                  ) : (
                    <>
                      <Icon name="link" size={15} />
                      {it.action}
                    </>
                  )}
                </Btn>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-g-500">
        <span className="mr-1">作业防护</span>
        {["绝缘手套", "护目镜", "万用表验电", "灭火器就位"].map((t) => (
          <span key={t} className="rounded-[3px] border border-g-700 bg-g-900 px-1.5 py-0.5 text-g-300">{t}</span>
        ))}
      </div>

      <Btn variant="primary" size="lg" className="w-full" disabled={!all} onClick={onNext}>
        {nextLabel}
        <Icon name="chev" size={16} />
      </Btn>
    </div>
  );
}
