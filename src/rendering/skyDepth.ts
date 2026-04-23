import * as THREE from 'three';
import { getSkyColor } from '@/simulation/time';
import type { ClockState, ViewState } from '@/simulation/types';

export class ThreeSkyDepth {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private sun: THREE.Mesh | null = null;
  private clouds: THREE.Mesh[] = [];

  init(canvas: HTMLCanvasElement): void {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      45,
      canvas.clientWidth / Math.max(1, canvas.clientHeight),
      0.1,
      500,
    );
    this.camera.position.set(0, 0, 120);

    const sunMaterial = new THREE.MeshBasicMaterial({
      color: '#D8B45F',
      transparent: true,
      opacity: 0.8,
    });
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(8, 24, 24), sunMaterial);
    this.scene.add(this.sun);

    const cloudMaterial = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.18,
    });
    for (let i = 0; i < 8; i += 1) {
      const cloud = new THREE.Mesh(
        new THREE.SphereGeometry(7 + i * 0.4, 12, 8),
        cloudMaterial.clone(),
      );
      cloud.position.set(-70 + i * 22, 35 + (i % 3) * 12, -20 - i * 4);
      cloud.scale.set(2.4, 0.55, 0.45);
      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  resize(width: number, height: number): void {
    if (!this.renderer || !this.camera) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  render(clock: ClockState, view: ViewState): void {
    if (!this.renderer || !this.scene || !this.camera) return;
    const hourRatio = clock.tick / 2_000;
    const sunAngle = hourRatio * Math.PI;
    if (this.sun) {
      this.sun.position.set(Math.cos(sunAngle) * 65, Math.sin(sunAngle) * 45 - 2, -35);
      const mat = this.sun.material as THREE.MeshBasicMaterial;
      mat.color.set(getSkyColor(clock.tick));
      mat.opacity = view.lensMode === 'normal' ? 0.9 : 0.18;
    }
    for (const [index, cloud] of this.clouds.entries()) {
      cloud.position.x += 0.015 * (index % 2 === 0 ? 1 : -1);
      if (cloud.position.x > 105) cloud.position.x = -105;
      if (cloud.position.x < -105) cloud.position.x = 105;
    }
    this.renderer.render(this.scene, this.camera);
  }

  destroy(): void {
    this.scene?.traverse((object) => {
      if ('geometry' in object && object.geometry instanceof THREE.BufferGeometry) {
        object.geometry.dispose();
      }
      if ('material' in object) {
        const material = object.material;
        if (Array.isArray(material)) {
          for (const entry of material) entry.dispose();
        } else if (material instanceof THREE.Material) {
          material.dispose();
        }
      }
    });
    this.renderer?.dispose();
    this.scene?.clear();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.sun = null;
    this.clouds = [];
  }
}
