import * as THREE from 'three';
import { noiseTexture } from './helpers';

export type Mats = ReturnType<typeof createMaterials>;

export function createMaterials() {
  const powderRough = noiseTexture(256, 0.55, 0.35, 2);
  powderRough.repeat.set(3, 3);
  const brushed = noiseTexture(256, 0.32, 0.25, 1, 0.8);
  brushed.repeat.set(2, 2);

  // Satin graphite powder-coat housing
  const shell = new THREE.MeshPhysicalMaterial({
    color: 0x2c3138,
    metalness: 0.55,
    roughness: 0.48,
    roughnessMap: powderRough,
    clearcoat: 0.25,
    clearcoatRoughness: 0.45,
  });

  // Slightly darker structural armor (bumpers, frames)
  const armor = new THREE.MeshPhysicalMaterial({
    color: 0x1d2126,
    metalness: 0.6,
    roughness: 0.38,
    roughnessMap: powderRough,
    clearcoat: 0.5,
    clearcoatRoughness: 0.3,
  });

  // Mid grey slate inset panels
  const panel = new THREE.MeshPhysicalMaterial({
    color: 0x353b43,
    metalness: 0.45,
    roughness: 0.55,
    roughnessMap: powderRough,
    clearcoat: 0.15,
  });

  const panelDark = new THREE.MeshStandardMaterial({ color: 0x0e1013, metalness: 0.3, roughness: 0.7 });
  const cavity = new THREE.MeshStandardMaterial({ color: 0x07080a, metalness: 0.1, roughness: 0.9 });

  // Glossy piano-black bezel around the display
  const glossBlack = new THREE.MeshPhysicalMaterial({
    color: 0x07090c,
    metalness: 0.2,
    roughness: 0.15,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
  });

  // Thin reflective cover glass over the display
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x000000,
    metalness: 0.9,
    roughness: 0.04,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });

  const chrome = new THREE.MeshStandardMaterial({ color: 0xf2f4f7, metalness: 1, roughness: 0.1 });
  const aluminum = new THREE.MeshStandardMaterial({
    color: 0xc6ccd3,
    metalness: 1,
    roughness: 0.3,
    roughnessMap: brushed,
  });
  const gunmetal = new THREE.MeshStandardMaterial({ color: 0x4a5058, metalness: 0.9, roughness: 0.32 });

  const rubber = new THREE.MeshStandardMaterial({ color: 0x111214, metalness: 0, roughness: 0.82 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x18191b, metalness: 0, roughness: 0.9 });
  const cable = new THREE.MeshPhysicalMaterial({
    color: 0x0c0d0f,
    metalness: 0,
    roughness: 0.4,
    clearcoat: 0.6,
    clearcoatRoughness: 0.3,
  });

  const eStopRed = new THREE.MeshPhysicalMaterial({
    color: 0xd3121c,
    metalness: 0,
    roughness: 0.25,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
  const yellow = new THREE.MeshPhysicalMaterial({
    color: 0xf3b300,
    metalness: 0,
    roughness: 0.35,
    clearcoat: 0.6,
  });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe0ac4c, metalness: 1, roughness: 0.22 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a248, metalness: 1, roughness: 0.3 });

  const boot = (hex: number) =>
    new THREE.MeshPhysicalMaterial({ color: hex, metalness: 0, roughness: 0.35, clearcoat: 0.7 });
  const boots = {
    orange: boot(0xf26a1b),
    red: boot(0xd8261e),
    yellow: boot(0xf2a516),
    blue: boot(0x1f6fd1),
    grey: boot(0x6b7178),
  };

  // HDR emissive LEDs (values > 1 feed the bloom pass)
  const ledCyan = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x2ae8ff, emissiveIntensity: 4 });
  const ledGreen = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x33ff88, emissiveIntensity: 3 });
  const ledAmber = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffa21a, emissiveIntensity: 3 });

  const pcb = new THREE.MeshStandardMaterial({ color: 0x0d3b2a, metalness: 0.2, roughness: 0.5 });
  const cellBlue = new THREE.MeshPhysicalMaterial({ color: 0x1a4fa0, metalness: 0.3, roughness: 0.3, clearcoat: 1 });
  const copper = new THREE.MeshStandardMaterial({ color: 0xc8743c, metalness: 1, roughness: 0.28 });

  return {
    shell,
    armor,
    panel,
    panelDark,
    cavity,
    glossBlack,
    glass,
    chrome,
    aluminum,
    gunmetal,
    rubber,
    tire,
    cable,
    eStopRed,
    yellow,
    gold,
    brass,
    boots,
    ledCyan,
    ledGreen,
    ledAmber,
    pcb,
    cellBlue,
    copper,
  };
}
