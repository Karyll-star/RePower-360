import { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, MousePointerClick } from 'lucide-react';
import { Viewer, type LightPreset, type ViewName } from './three/Viewer';
import type { ScreenMode } from './three/screenUI';
import { PosterOverlay, Logo } from './components/PosterOverlay';
import { Annotations } from './components/Annotations';
import { ControlDock } from './components/ControlDock';
import { SpecsModal } from './components/SpecsModal';
import { playEStopAlarm, playMechanicalClick, playRelaySound } from './utils/audio';

const MODES: ScreenMode[] = ['activation', 'impedance', 'diagnostic', 'cloud'];

const PART_INFO: Record<string, string> = {
  knob: '多功能旋钮 · 调节脉冲频率 10Hz – 1kHz',
  antenna: 'SMA 全向天线 · 5G/4G 全网通上行',
  screen: '10.1" 工业触控屏 · 点击切换显示模式',
  button: '功能按键 · 切换屏幕工作模式',
};

export function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const annoEls = useRef(new Map<string, HTMLElement>());
  const soundRef = useRef(true);

  const [view, setView] = useState<ViewName>('poster');
  const [trolley, setTrolley] = useState(true);
  const [estop, setEStop] = useState(false);
  const [exploded, setExploded] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [light, setLight] = useState<LightPreset>('studio');
  const [screenMode, setScreenMode] = useState<ScreenMode>('activation');
  const [labels, setLabels] = useState(true);
  const [specs, setSpecs] = useState(false);
  const [sound, setSound] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [viewerTick, setViewerTick] = useState(0);
  const toastTimer = useRef<number>(0);

  soundRef.current = sound;

  const showToast = useCallback((t: string) => {
    setToast(t);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const toggleEStop = useCallback(() => {
    setEStop((v) => {
      if (soundRef.current) (v ? () => playMechanicalClick(true) : playEStopAlarm)();
      return !v;
    });
  }, []);
  const toggleTrolley = useCallback(() => {
    if (soundRef.current) playMechanicalClick(false);
    setTrolley((v) => !v);
  }, []);
  const toggleExploded = useCallback(() => {
    if (soundRef.current) playRelaySound();
    setExploded((v) => !v);
  }, []);
  const cycleMode = useCallback(() => {
    if (soundRef.current) playMechanicalClick(false);
    setScreenMode((m) => MODES[(MODES.indexOf(m) + 1) % MODES.length]);
  }, []);

  // handle clicks coming from the 3D scene
  const actionRef = useRef<(a: string) => void>(() => {});
  actionRef.current = (a: string) => {
    switch (a) {
      case 'estop':
        toggleEStop();
        break;
      case 'trolley':
        toggleTrolley();
        break;
      case 'button':
      case 'screen':
        cycleMode();
        showToast(PART_INFO[a]);
        break;
      case 'knob':
        if (soundRef.current) playMechanicalClick(false);
        showToast(PART_INFO.knob);
        break;
      case 'antenna':
        showToast(PART_INFO.antenna);
        break;
      case 'bridge':
        setView('bridge');
        break;
    }
  };

  // create viewer once
  useEffect(() => {
    let cancelled = false;
    let v: Viewer | null = null;
    let t = 0;
    const fonts = Promise.all(
      ['400 40px Inter', '600 40px Inter', '700 40px Inter', '400 20px "JetBrains Mono"', '600 20px "JetBrains Mono"'].map((f) =>
        document.fonts.load(f).catch(() => null)
      )
    );
    const timeout = new Promise((r) => setTimeout(r, 1800));
    Promise.race([fonts, timeout]).then(() => {
      if (cancelled || !hostRef.current) return;
      v = new Viewer(hostRef.current, {
        onAction: (a) => actionRef.current(a),
        onUserOrbit: () => setView('free'),
      });
      viewerRef.current = v;
      annoEls.current.forEach((el, id) => v!.registerAnnotation(id, el));
      t = window.setTimeout(() => setReady(true), 400);
      setViewerTick((n) => n + 1);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      v?.dispose();
      viewerRef.current = null;
    };
  }, []);

  // state -> viewer sync
  useEffect(() => viewerRef.current?.setView(view), [view, viewerTick]);
  useEffect(() => viewerRef.current?.pulse.setTrolley(trolley), [trolley, viewerTick]);
  useEffect(() => {
    viewerRef.current?.pulse.setEStop(estop);
    viewerRef.current?.bridge.setOffline(estop);
  }, [estop, viewerTick]);
  useEffect(() => viewerRef.current?.pulse.setExploded(exploded), [exploded, viewerTick]);
  useEffect(() => viewerRef.current?.setAutoRotate(autoRotate), [autoRotate, viewerTick]);
  useEffect(() => viewerRef.current?.setLighting(light), [light, viewerTick]);
  useEffect(() => viewerRef.current?.setScreenMode(screenMode), [screenMode, viewerTick]);

  const register = useCallback((id: string, el: HTMLElement | null) => {
    if (el) annoEls.current.set(id, el);
    else annoEls.current.delete(id);
    viewerRef.current?.registerAnnotation(id, el);
  }, []);

  const onAnnotationClick = (id: string) => {
    if (id === 'estop') toggleEStop();
    else if (id === 'trolley') toggleTrolley();
    else if (id === 'screen') setView('screen');
    else if (id === 'cables') setView('cables');
    else if (id === 'bridge' || id === 'ports' || id === 'antenna') setView('bridge');
    else if (id === 'wheel') setView('repulse');
  };

  const screenshot = () => {
    const v = viewerRef.current;
    if (!v) return;
    const url = v.screenshot();
    const a = document.createElement('a');
    a.href = url;
    a.download = `RE-ENERGY-render-${Date.now()}.png`;
    a.click();
    showToast('已导出当前渲染画面 PNG');
  };

  const poster = view === 'poster';

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#161c24] font-sans text-white select-none">
      <div ref={hostRef} className="absolute inset-0" />

      {/* vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_40%_45%,transparent_55%,rgba(5,8,12,0.55))]" />

      <PosterOverlay visible={poster} onFocus={setView} onOpenSpecs={() => setSpecs(true)} />
      <Annotations visible={labels && !poster} register={register} onClick={onAnnotationClick} estop={estop} />

      {/* header */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-5 sm:px-[4.3%] sm:pt-[3.2%]">
        <button className="pointer-events-auto cursor-pointer" onClick={() => setView('poster')}>
          <Logo />
        </button>
        <div className="pointer-events-auto flex items-center gap-2">
          {!poster && (
            <span className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/50 px-3 py-1.5 text-[11px] text-slate-300 backdrop-blur md:flex">
              <MousePointerClick className="h-3.5 w-3.5 text-cyan-300" />
              拖拽旋转 · 滚轮缩放 · 点击急停 / 拉杆 / 屏幕 / 旋钮
            </span>
          )}
          <button
            onClick={() => setSound((s) => !s)}
            className="cursor-pointer rounded-full border border-white/10 bg-slate-950/50 p-2 text-slate-300 backdrop-blur hover:text-white"
            title="音效"
          >
            {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <ControlDock
        view={view}
        setView={setView}
        trolley={trolley}
        toggleTrolley={toggleTrolley}
        estop={estop}
        toggleEStop={toggleEStop}
        exploded={exploded}
        toggleExploded={toggleExploded}
        autoRotate={autoRotate}
        toggleAutoRotate={() => {
          setAutoRotate((a) => !a);
          setView('free');
        }}
        light={light}
        setLight={setLight}
        screenMode={screenMode}
        setScreenMode={setScreenMode}
        labels={labels}
        toggleLabels={() => setLabels((l) => !l)}
        openSpecs={() => setSpecs(true)}
        screenshot={screenshot}
      />

      {/* toast */}
      <div
        className={`pointer-events-none absolute left-1/2 top-24 z-30 -translate-x-1/2 rounded-full border border-cyan-300/30 bg-slate-950/80 px-4 py-2 text-[12px] text-cyan-100 backdrop-blur transition-all duration-300 ${
          toast ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
        }`}
      >
        {toast}
      </div>

      {/* E-stop alert ring */}
      {estop && (
        <div className="pointer-events-none absolute inset-0 z-20 animate-pulse shadow-[inset_0_0_120px_rgba(239,68,68,0.45)]">
          <div className="absolute left-1/2 top-24 -translate-x-1/2 rounded-full border border-red-400/60 bg-red-950/80 px-4 py-2 text-[12px] font-semibold text-red-100">
            ⚠ EMERGENCY STOP · 输出继电器已断开 · 网关离线
          </div>
        </div>
      )}

      {/* loader */}
      <div
        className={`pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0d1218] transition-opacity duration-1000 ${
          ready ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <Logo />
        <div className="mt-6 h-px w-40 overflow-hidden bg-white/10">
          <div className="h-full w-1/2 animate-pulse bg-cyan-300" />
        </div>
      </div>

      <SpecsModal isOpen={specs} onClose={() => setSpecs(false)} />
    </div>
  );
}

export default App;
