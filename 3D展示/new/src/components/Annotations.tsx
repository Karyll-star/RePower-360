interface Props {
  visible: boolean;
  register: (id: string, el: HTMLElement | null) => void;
  onClick: (id: string) => void;
  estop: boolean;
}

const items: { id: string; title: string; sub: string; side?: 'left' | 'right' }[] = [
  { id: 'screen', title: '10.1" 工业触控屏', sub: '1000 nits · 实时 SOH / 波形' },
  { id: 'estop', title: 'E-STOP 物理急停', sub: '点击按下 / 复位' },
  { id: 'cables', title: '5 路航空快接测试线', sub: '开尔文四线制采样', side: 'left' },
  { id: 'trolley', title: '双杆伸缩拉杆', sub: '点击伸出 / 收回' },
  { id: 'wheel', title: '全地形静音轮', sub: 'Ø165mm 聚氨酯', side: 'left' },
  { id: 'bridge', title: 'RE-BRIDGE 边缘网关', sub: 'CAN · RS485 · 5G' },
  { id: 'ports', title: 'ETH / USB / TYPE-C', sub: '千兆工业以太网' },
  { id: 'antenna', title: 'SMA 全向天线', sub: '5G / 4G 全网通' },
];

export function Annotations({ visible, register, onClick, estop }: Props) {
  return (
    <div className={`pointer-events-none absolute inset-0 z-10 overflow-hidden transition-opacity duration-500 ${visible ? '' : 'invisible opacity-0'}`}>
      {items.map((it) => {
        const left = it.side === 'left';
        const alarm = it.id === 'estop' && estop;
        return (
          <div
            key={it.id}
            ref={(el) => register(it.id, el)}
            className="absolute left-0 top-0 transition-opacity duration-300"
            style={{ opacity: 0 }}
          >
            <button onClick={() => onClick(it.id)} className="group relative block cursor-pointer">
              <span className={`absolute -left-[7px] -top-[7px] h-3.5 w-3.5 rounded-full border-2 ${alarm ? 'border-red-400 bg-red-500/40' : 'border-cyan-300 bg-cyan-400/30'}`} />
              <span className={`absolute -left-[7px] -top-[7px] h-3.5 w-3.5 animate-ping rounded-full ${alarm ? 'bg-red-400/60' : 'bg-cyan-300/50'}`} />
              <span
                className={`absolute top-0 h-px w-8 ${left ? 'right-[7px] bg-gradient-to-l' : 'left-[7px] bg-gradient-to-r'} from-cyan-300/90 to-cyan-300/20`}
              />
              <span
                className={`absolute -top-[19px] whitespace-nowrap rounded-md border border-white/10 bg-slate-950/70 px-2.5 py-1 text-left backdrop-blur-md transition group-hover:border-cyan-300/60 ${
                  left ? 'right-[42px]' : 'left-[42px]'
                }`}
              >
                <span className={`block text-[12px] font-semibold ${alarm ? 'text-red-300' : 'text-white'}`}>{alarm ? 'E-STOP 已触发 · 点击复位' : it.title}</span>
                <span className="block text-[10px] text-slate-400">{it.sub}</span>
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
