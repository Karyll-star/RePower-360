/* ============================================================================
   Re-Energy 3D 展示 — 尺寸方案 / CMF 配置
   依据：《产品效果图.png》（主参考）+《Re-Energy 物理产品设计规范 v1.0》
   ========================================================================== */
(function (RE) {
  'use strict';

  /* --------------------------------------------------------------------------
     尺寸方案：可在界面中一键切换，用于对照“效果图比例”与“规范标注值”
     -------------------------------------------------------------------------- */
  RE.PRESETS = [
    {
      id: 'image',
      name: '效果图比例（推荐）',
      note: '按《产品效果图.png》透视反推：Re-Pulse 主体 520 × 320 × 400，总高≈990（含拉杆），轮径≈84',
      repulse: { W: 520, D: 320, H: 400, wheel: 84, handleTop: 990 },
      bridge: { W: 145, H: 84, D: 34 },
      base: { W: 132, H: 76, D: 11 }
    },
    {
      id: 'spec',
      name: '规范标注值',
      note: '《物理产品设计规范》02/17/20 节：520 × 360 × 210，总高 950–1050，轮径 70–90；Re-Bridge 145 × 85 × 32',
      repulse: { W: 520, D: 360, H: 210, wheel: 80, handleTop: 1000 },
      bridge: { W: 145, H: 85, D: 32 },
      base: { W: 132, H: 78, D: 10 }
    }
  ];

  /* --------------------------------------------------------------------------
     CMF（规范 19 节）：石墨灰主体 / 深色橡胶 / 阳极氧化铝 / 黑色玻璃屏
     数字化通过屏幕表达，机身不出现蓝紫渐变
     -------------------------------------------------------------------------- */
  RE.CMF = {
    shell:       { color: 0x40464e, roughness: 0.57, metalness: 0.22, envMapIntensity: 0.95 },
    shellMid:    { color: 0x373d45, roughness: 0.55, metalness: 0.25, envMapIntensity: 0.95 },
    shellDeep:   { color: 0x262b30, roughness: 0.52, metalness: 0.28, envMapIntensity: 0.9 },
    shellPanel:  { color: 0x30363c, roughness: 0.51, metalness: 0.30, envMapIntensity: 0.95 },
    rubber:      { color: 0x0f1114, roughness: 0.95, metalness: 0.0, envMapIntensity: 0.5 },
    rubberSoft:  { color: 0x1a1d21, roughness: 1.0, metalness: 0.0, envMapIntensity: 0.4 },
    alu:         { color: 0xafb5bb, roughness: 0.30, metalness: 1.0, envMapIntensity: 1.15 },
    aluDark:     { color: 0x6f757c, roughness: 0.36, metalness: 1.0, envMapIntensity: 1.05 },
    aluBrushed:  { color: 0x9aa0a7, roughness: 0.44, metalness: 1.0, envMapIntensity: 1.05 },
    plasticDark: { color: 0x191c20, roughness: 0.62, metalness: 0.10, envMapIntensity: 0.6 },
    pcb:         { color: 0x1d5540, roughness: 0.62, metalness: 0.05, envMapIntensity: 0.5 },
    chip:        { color: 0x15181c, roughness: 0.45, metalness: 0.35, envMapIntensity: 0.7 },
    connector:   { color: 0x14171a, roughness: 0.48, metalness: 0.35, envMapIntensity: 0.8 },
    green:       { color: 0x2c7a4b, roughness: 0.55, metalness: 0.10, envMapIntensity: 0.7 },
    glass:       { color: 0x04070a, roughness: 0.05, metalness: 0.10, envMapIntensity: 1.5 },
    redEStop:    { color: 0xc02a1c, roughness: 0.34, metalness: 0.05, envMapIntensity: 0.9 },
    yellow:      { color: 0xe3ab16, roughness: 0.38, metalness: 0.05, envMapIntensity: 0.9 },
    platform:    { color: 0x4a5056, roughness: 0.72, metalness: 0.05, envMapIntensity: 0.8 },
    /* 状态灯（DNA ②，仅用于细小光带） */
    ledCyan: 0x3ec6e8,
    ledGreen: 0x3fe39b,
    ledWhite: 0xdce9f4
  };

  /* 探针 / 适配器配色（红 蓝 黄 绿 环形标识） */
  RE.PROBE_COLORS = [0xd6453a, 0x3b7fd4, 0xe0b32a, 0x37a86a];

  RE.M = RE.buildMaterials(RE.CMF);

  /* 外壳在爆炸图中会露出内壁，需要双面渲染 */
  RE.M.shell.side = THREE.DoubleSide;

})(window.RE);
