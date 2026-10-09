import React from 'react';
import { X, Zap, Radio, Activity } from 'lucide-react';

interface SpecsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SpecsModal: React.FC<SpecsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900/95 border border-cyan-500/30 rounded-2xl p-6 md:p-8 shadow-2xl text-slate-100 shadow-cyan-500/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-700/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-slate-950 font-black">
              RE
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                RE-ENERGY 储能后市场智能装备规格书
              </h2>
              <p className="text-xs md:text-sm text-cyan-400">
                RE-PULSE 移动式巡检工作站 &amp; RE-BRIDGE 磁吸式边缘网关
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Device 1: RE-PULSE */}
        <div className="mt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                RE-PULSE 移动式储能电芯主动活化巡检工作站
              </h3>
              <p className="text-xs text-slate-400">
                Mobile Energy Cell Activation &amp; Diagnostic Station (Energy Storage Health Guardian)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
              <span className="text-xs text-cyan-400 block mb-1">活化脉冲激励参数</span>
              <div className="space-y-1 text-slate-300">
                <p className="flex justify-between"><span>脉冲频率范围:</span> <span className="font-mono text-white">10 Hz ~ 1000 Hz 可调</span></p>
                <p className="flex justify-between"><span>最大峰值脉冲电流:</span> <span className="font-mono text-white">120 A (双向可控)</span></p>
                <p className="flex justify-between"><span>电芯适用范围:</span> <span className="font-mono text-white">LFP / NCM / 钠离子电芯 (1.5V-5.0V)</span></p>
                <p className="flex justify-between"><span>消除锂枝晶与钝化层:</span> <span className="font-mono text-emerald-400">电化学高频可控微脉冲</span></p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
              <span className="text-xs text-emerald-400 block mb-1">电芯高精度诊断采样</span>
              <div className="space-y-1 text-slate-300">
                <p className="flex justify-between"><span>电芯电压检测精度:</span> <span className="font-mono text-white">±0.5 mV (0.01% F.S.)</span></p>
                <p className="flex justify-between"><span>交流内阻 EIS 测量:</span> <span className="font-mono text-white">0.01 mΩ ~ 100 mΩ (0.1% 精准)</span></p>
                <p className="flex justify-between"><span>多通道航空快接接口:</span> <span className="font-mono text-white">4路独立开尔文四线制检测</span></p>
                <p className="flex justify-between"><span>单次健康评级耗时:</span> <span className="font-mono text-emerald-400">&lt; 35 秒 (快速巡检模式)</span></p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
              <span className="text-xs text-blue-400 block mb-1">交互与结构安全设计</span>
              <div className="space-y-1 text-slate-300">
                <p className="flex justify-between"><span>车载级高亮显示屏:</span> <span className="font-mono text-white">10.1 英寸防眩光工业触控屏 (1000 nits)</span></p>
                <p className="flex justify-between"><span>急停物理安全防护:</span> <span className="font-mono text-rose-400">双触点硬件互锁紧急断电保护</span></p>
                <p className="flex justify-between"><span>拉杆机构:</span> <span className="font-mono text-white">双金属强化静音伸缩拉杆 + 全地形轮</span></p>
                <p className="flex justify-between"><span>外壳防护等级:</span> <span className="font-mono text-white">IP54 工业防尘防溅等级</span></p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
              <span className="text-xs text-amber-400 block mb-1">供电与环境适应</span>
              <div className="space-y-1 text-slate-300">
                <p className="flex justify-between"><span>供电方式:</span> <span className="font-mono text-white">内置磷酸铁锂电池组 + AC 220V 宽压输入</span></p>
                <p className="flex justify-between"><span>野外单机巡检续航:</span> <span className="font-mono text-white">持续工作 &gt; 8 小时 (可外接充电宝)</span></p>
                <p className="flex justify-between"><span>工作环境温度:</span> <span className="font-mono text-white">-20°C ~ +55°C</span></p>
                <p className="flex justify-between"><span>整机净重:</span> <span className="font-mono text-white">14.8 kg (便携登机拉杆箱规格)</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* Device 2: RE-BRIDGE */}
        <div className="mt-8 pt-6 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                RE-BRIDGE 磁吸式多协议边缘网关
              </h3>
              <p className="text-xs text-slate-400">
                Magnetic Multi-Protocol Edge Gateway (Edge Telemetry &amp; Cloud Bridge)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
              <span className="text-xs text-emerald-400 block mb-1">总线与储能协议兼容</span>
              <div className="space-y-1 text-slate-300">
                <p className="flex justify-between"><span>现场总线接口:</span> <span className="font-mono text-white">双路 CAN 2.0B / CAN FD + 隔离式 RS485</span></p>
                <p className="flex justify-between"><span>储能协议库支持:</span> <span className="font-mono text-white">Modbus RTU/TCP, MQTT, IEC 61850</span></p>
                <p className="flex justify-between"><span>BMS适配机型:</span> <span className="font-mono text-emerald-400">宁德时代, 比亚迪, 阳光电源等主流BMS</span></p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
              <span className="text-xs text-cyan-400 block mb-1">上行通讯与磁吸安装</span>
              <div className="space-y-1 text-slate-300">
                <p className="flex justify-between"><span>上行通信制式:</span> <span className="font-mono text-white">千兆工业以太网 + 5G/4G 全网通蜂窝</span></p>
                <p className="flex justify-between"><span>固定方式:</span> <span className="font-mono text-white">强力钕铁硼磁吸式底座 (防脱扣附着)</span></p>
                <p className="flex justify-between"><span>边缘计算能力:</span> <span className="font-mono text-white">四核 ARM Cortex-A55 算力核心</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Core Life-cycle services */}
        <div className="mt-8 pt-6 border-t border-slate-800">
          <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            后市场 · 储能设备全生命周期服务体系
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-800/40 border border-cyan-500/20 text-center">
              <div className="font-bold text-cyan-400 mb-1">重新上云 Re-Cloud</div>
              <div className="text-slate-400">历史资产边缘纳管与实时数字孪生</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/40 border border-emerald-500/20 text-center">
              <div className="font-bold text-emerald-400 mb-1">季度订阅 Subscription</div>
              <div className="text-slate-400">定期巡检与预防性主动维护工单</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/40 border border-blue-500/20 text-center">
              <div className="font-bold text-blue-400 mb-1">主动维护 Maintenance</div>
              <div className="text-slate-400">高频脉冲抑制析锂，延寿 25%+</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/40 border border-purple-500/20 text-center">
              <div className="font-bold text-purple-400 mb-1">回收转卖 Resell</div>
              <div className="text-slate-400">梯次利用残值评估与撮合交易</div>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-medium shadow-lg shadow-cyan-500/20 transition cursor-pointer"
          >
            关闭规格书
          </button>
        </div>
      </div>
    </div>
  );
};
