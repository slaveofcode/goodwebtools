/**
 * 3D Model Viewer — the WebGL stage: renderer, orbit controls, studio/file
 * lighting, grid, wireframe, visibility, animation playback and PNG snapshots.
 * Browser-only (needs WebGL), so it is exercised by the Playwright E2E rather
 * than Vitest; the pure pieces it relies on live in model3d-*.lib.ts.
 * The island dynamic-imports this module, keeping three.js out of its chunk.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { disposeObject, fitCameraParams } from './model3d-scene.lib';
import type { LoadedModel } from './model3d-load.lib';

export class NoWebGLError extends Error {
  constructor() {
    super('WebGL is not available');
    this.name = 'NoWebGLError';
  }
}

export type LightMode = 'studio' | 'file';

export class ModelStage {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
  private readonly controls: OrbitControls;
  private readonly envTexture: THREE.Texture;
  private readonly fillLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
  private readonly resizeObserver: ResizeObserver;
  private readonly timer = new THREE.Timer();
  private model: LoadedModel | null = null;
  private grid: THREE.GridHelper | null = null;
  private gridOn = true;
  private mixer: THREE.AnimationMixer | null = null;
  private action: THREE.AnimationAction | null = null;
  private playing = false;
  private dirty = true;
  private frame = 0;
  private lastTimeReport = 0;
  /** Called ~10×/s while an animation plays, with (time, duration) in seconds. */
  onTime: ((time: number, duration: number) => void) | null = null;

  constructor(private readonly canvas: HTMLCanvasElement, container: HTMLElement) {
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    } catch (e) {
      // three throws "Error creating WebGL context." when WebGL is unavailable.
      if (e instanceof Error && /webgl/i.test(e.message)) throw new NoWebGLError();
      throw e;
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.scene.background = new THREE.Color(0x2a2a2e);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.envTexture = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    this.scene.environment = this.envTexture;
    this.scene.add(this.fillLight);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.addEventListener('change', this.markDirty);

    this.resizeObserver = new ResizeObserver(() => this.resize(container));
    this.resizeObserver.observe(container);
    this.resize(container);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.loop();
  }

  private markDirty = () => { this.dirty = true; };

  private onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    } else if (!this.frame) {
      this.timer.update();
      this.loop();
    }
  };

  private resize(container: HTMLElement) {
    const w = Math.max(container.clientWidth, 1);
    const h = Math.max(container.clientHeight, 1);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  private loop = () => {
    this.frame = requestAnimationFrame(this.loop);
    this.timer.update();
    const dt = this.timer.getDelta();
    const damping = this.controls.update();
    if (this.mixer && this.playing && this.action) {
      this.mixer.update(dt);
      this.dirty = true;
      const now = performance.now();
      if (this.onTime && now - this.lastTimeReport > 100) {
        this.lastTimeReport = now;
        this.onTime(this.action.time, this.action.getClip().duration);
      }
    }
    if (this.dirty || damping) {
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
    }
  };

  /** Replace the displayed model (the previous one is disposed). */
  setModel(model: LoadedModel) {
    this.clearModel();
    this.model = model;
    this.scene.add(model.root);
    model.root.updateMatrixWorld(true);
    if (model.animations.length) this.mixer = new THREE.AnimationMixer(model.root);
    this.rebuildGrid();
    this.fit();
  }

  private clearModel() {
    this.stopAnimation();
    this.mixer = null;
    if (this.model) {
      this.scene.remove(this.model.root);
      disposeObject(this.model.root);
      this.model = null;
    }
  }

  fit() {
    if (!this.model) return;
    const box = new THREE.Box3().setFromObject(this.model.root);
    const p = fitCameraParams(box, this.camera.fov, this.camera.aspect);
    this.camera.near = p.near;
    this.camera.far = p.far;
    this.camera.position.copy(p.center).add(new THREE.Vector3(1, 0.7, 1).normalize().multiplyScalar(p.distance));
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(p.center);
    this.controls.update();
    this.dirty = true;
  }

  private rebuildGrid() {
    if (this.grid) {
      this.scene.remove(this.grid);
      this.grid.geometry.dispose();
      (this.grid.material as THREE.Material).dispose();
      this.grid = null;
    }
    if (!this.model) return;
    const box = new THREE.Box3().setFromObject(this.model.root);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const extent = Math.max(size.x, size.z, 1e-3) * 2;
    const step = 10 ** Math.floor(Math.log10(extent / 10));
    const divisions = Math.min(Math.round(extent / step), 200);
    this.grid = new THREE.GridHelper(divisions * step, divisions, 0x666666, 0x3c3c40);
    this.grid.position.set((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2);
    this.grid.visible = this.gridOn;
    this.scene.add(this.grid);
    this.dirty = true;
  }

  setGrid(on: boolean) {
    this.gridOn = on;
    if (this.grid) this.grid.visible = on;
    this.dirty = true;
  }

  setWireframe(on: boolean) {
    this.model?.root.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        (m as THREE.MeshStandardMaterial).wireframe = on;
      }
    });
    this.dirty = true;
  }

  /** Studio = image-based room lighting; file = the model's own lights. */
  setLightMode(mode: LightMode) {
    const studio = mode === 'studio';
    this.scene.environment = studio ? this.envTexture : null;
    this.fillLight.intensity = studio ? 0.4 : 0.15;
    this.model?.root.traverse(o => {
      if ((o as THREE.Light).isLight) o.visible = !studio;
    });
    this.dirty = true;
  }

  hasFileLights(): boolean {
    let found = false;
    this.model?.root.traverse(o => { if ((o as THREE.Light).isLight) found = true; });
    return found;
  }

  setVisible(uuid: string, visible: boolean) {
    const o = this.model?.root.getObjectByProperty('uuid', uuid);
    if (o) o.visible = visible;
    this.dirty = true;
  }

  /** Select a clip (paused at its start), or null to stop animation. */
  selectClip(index: number | null) {
    this.stopAnimation();
    if (!this.mixer || !this.model || index === null) return;
    const clip = this.model.animations[index];
    if (!clip) return;
    this.action = this.mixer.clipAction(clip);
    this.action.play();
    this.action.paused = true;
    this.mixer.update(0);
    this.dirty = true;
  }

  setPlaying(on: boolean) {
    if (!this.action) return;
    this.playing = on;
    this.action.paused = !on;
    this.timer.update();
  }

  seek(time: number) {
    if (!this.action || !this.mixer) return;
    this.action.time = time;
    this.mixer.update(0);
    this.dirty = true;
  }

  private stopAnimation() {
    this.playing = false;
    if (this.mixer) this.mixer.stopAllAction();
    this.action = null;
  }

  /** Render a fresh frame and capture it (same task, so no preserveDrawingBuffer). */
  snapshot(): Promise<Blob> {
    this.renderer.render(this.scene, this.camera);
    return new Promise((resolve, reject) =>
      this.canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Snapshot failed'))), 'image/png'),
    );
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.resizeObserver.disconnect();
    this.timer.dispose();
    this.clearModel();
    this.rebuildGrid();
    this.controls.removeEventListener('change', this.markDirty);
    this.controls.dispose();
    this.envTexture.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
