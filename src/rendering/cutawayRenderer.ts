import { Application, Container, Graphics, Sprite, Text } from 'pixi.js';
import { createBuildPreview } from '@/simulation/placement';
import { getHour, getSkyColor } from '@/simulation/time';
import {
  type Agent,
  type AgentType,
  BUILDINGS,
  type BuildDrag,
  CELL_SIZE,
  type ClockState,
  type EconomyState,
  type ElevatorCar,
  type ElevatorShaft,
  type GridCell,
  type MacroState,
  type OperationsState,
  type TowerRoom,
  type TowerState,
  type ViewState,
} from '@/simulation/types';
import { NormalTowerBaseTracker } from './renderSignatures';
import { createRoomComposition, type VectorPlacement } from './roomCompositions';
import { type AgentVectorKey, type UiVectorKey, VectorAssetLibrary } from './vectorAssets';

function colorNumber(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mixColor(a: number, b: number, amount: number): number {
  const t = clamp(amount, 0, 1);
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}

function seedNoise(seed: number, offset: number): number {
  return (Math.sin(seed * 9_973 + offset * 1_337) + 1) / 2;
}

function agentVectorKey(type: AgentType): AgentVectorKey {
  if (type === 'janitor') return 'agent-janitor';
  if (type === 'guest') return 'agent-guest';
  if (type === 'visitor') return 'agent-visitor';
  return 'agent-worker';
}

const MATERIAL = {
  void: 0x020617,
  shadow: 0x111a20,
  shell: 0x2c3841,
  floor: 0x34414a,
  lobby: 0x839aa1,
  glass: 0x86a4b2,
  office: 0x526879,
  condo: 0x5d6f61,
  cafe: 0x6e5946,
  hotel: 0x5c5668,
  service: 0x6e6852,
  steel: 0x73808a,
  brass: 0xa8894c,
  cream: 0xd6c8a5,
  terracotta: 0x8f5f49,
  plant: 0x58735c,
  mutedGreen: 0x78a87f,
  mutedRed: 0xb66a62,
  mutedCyan: 0x8ec7d2,
  mutedGold: 0xd3b15d,
} as const;

const ROOM_MATERIALS = {
  floor: MATERIAL.floor,
  lobby: MATERIAL.lobby,
  office: MATERIAL.office,
  condo: MATERIAL.condo,
  cafe: MATERIAL.cafe,
  hotel: MATERIAL.hotel,
  maint: MATERIAL.service,
  utilities: 0x62717a,
  restroom: 0x6f8587,
  security: 0x5d6375,
  mechanical: 0x56615e,
  eventHall: 0x765647,
  retail: 0x73694f,
  skyGarden: 0x60755c,
  observation: 0x747966,
  conference: 0x626b7c,
  clinic: 0x65817b,
  gallery: 0x7a6369,
  luxurySuite: 0x806f54,
  weatherCore: 0x5d7480,
  elevator: MATERIAL.terracotta,
  stairs: MATERIAL.steel,
} as const;

const PRIVACY_SENSITIVE_ROOMS = new Set(['office', 'condo', 'hotel', 'conference', 'luxurySuite']);
const NOISE_SOURCE_ROOMS = new Set(['cafe', 'eventHall', 'retail', 'mechanical', 'observation']);
const PRIVACY_SUPPORT_ROOMS = new Set(['security', 'skyGarden', 'restroom', 'gallery']);

export interface RenderInput {
  tower: TowerState;
  economy: EconomyState;
  macro: MacroState;
  operations: OperationsState;
  clock: ClockState;
  view: ViewState;
  drag: BuildDrag | null;
}

export interface RenderStats {
  frames: number;
  normalBaseRebuilds: number;
  normalBaseHits: number;
  lensBaseDraws: number;
  dynamicOverlayFrames: number;
}

function createRenderStats(): RenderStats {
  return {
    frames: 0,
    normalBaseRebuilds: 0,
    normalBaseHits: 0,
    lensBaseDraws: 0,
    dynamicOverlayFrames: 0,
  };
}

export class CutawayRenderer {
  private app: Application | null = null;
  private backdropLayer = new Container();
  private stageRoot = new Container();
  private gridLayer = new Container();
  private groundLayer = new Container();
  private cloudLayer = new Container();
  private shaftsLayer = new Container();
  private roomsLayer = new Container();
  private roomOverlayLayer = new Container();
  private agentsLayer = new Container();
  private overlayLayer = new Container();
  private vectorAssets = new VectorAssetLibrary();
  private parent: HTMLElement | null = null;
  private normalTowerBase = new NormalTowerBaseTracker();
  private renderStats = createRenderStats();

  async init(parent: HTMLElement): Promise<void> {
    this.parent = parent;
    await this.vectorAssets.load();
    const app = new Application();
    await app.init({ resizeTo: parent, backgroundAlpha: 0, antialias: true });
    if (this.parent !== parent) {
      app.destroy(true);
      return;
    }
    this.app = app;
    app.canvas.className = 'game-canvas';
    parent.appendChild(app.canvas);
    this.stageRoot.addChild(
      this.gridLayer,
      this.groundLayer,
      this.cloudLayer,
      this.shaftsLayer,
      this.roomsLayer,
      this.roomOverlayLayer,
      this.agentsLayer,
      this.overlayLayer,
    );
    app.stage.addChild(this.backdropLayer, this.stageRoot);
  }

  screenToGrid(clientX: number, clientY: number, view: ViewState): GridCell {
    if (!this.parent) return { gx: 0, gy: 0 };
    const rect = this.parent.getBoundingClientRect();
    const wx = (clientX - rect.left - rect.width / 2 - view.panX) / view.zoom;
    const wy = (clientY - rect.top - rect.height / 2 - view.panY) / view.zoom;
    return { gx: Math.round(wx / CELL_SIZE.w), gy: Math.round(-wy / CELL_SIZE.h) };
  }

  render(input: RenderInput): void {
    if (!this.app || !this.parent) return;
    const { tower, economy, macro, operations, clock, view, drag } = input;
    this.renderStats.frames += 1;
    this.renderStats.dynamicOverlayFrames += 1;
    this.parent.style.background = view.lensMode === 'normal' ? getSkyColor(clock.tick) : '#07111f';
    this.stageRoot.position.set(
      this.app.screen.width / 2 + view.panX,
      this.app.screen.height / 2 + view.panY,
    );
    this.stageRoot.scale.set(view.zoom, view.zoom);

    this.backdropLayer.removeChildren();
    this.gridLayer.removeChildren();
    this.groundLayer.removeChildren();
    this.cloudLayer.removeChildren();
    this.roomOverlayLayer.removeChildren();
    this.agentsLayer.removeChildren();
    this.overlayLayer.removeChildren();

    this.drawBackdrop(clock, view);
    this.drawWeatherOverlay(macro, operations, clock, view);
    this.drawGround(view, tower.rooms.length === 0);
    if (view.selectedTool && view.lensMode === 'normal') this.drawBlueprintGrid();
    for (const cloud of tower.clouds)
      this.drawCloud(cloud.x, cloud.y, cloud.scale, cloud.opacity, view);

    const baseEvaluation = this.normalTowerBase.evaluate(tower, clock, view.lensMode);
    if (baseEvaluation.decision === 'hit') this.renderStats.normalBaseHits += 1;
    else if (baseEvaluation.decision === 'rebuild') this.renderStats.normalBaseRebuilds += 1;
    else this.renderStats.lensBaseDraws += 1;

    if (baseEvaluation.decision !== 'hit') {
      this.shaftsLayer.removeChildren();
      this.roomsLayer.removeChildren();
      for (const shaft of tower.shafts) this.drawShaft(shaft, view);
      for (const room of tower.rooms)
        this.drawRoom(room, tower.agents, economy, operations, clock, view);
    }

    if (view.lensMode === 'normal') {
      for (const room of tower.rooms) {
        if (BUILDINGS[room.type].cat !== 'trans' && room.dirt > 0) {
          this.drawDirt(
            room,
            room.x * CELL_SIZE.w,
            -(room.y + room.height) * CELL_SIZE.h,
            room.width * CELL_SIZE.w,
            room.height * CELL_SIZE.h,
            room.dirt / 100,
          );
        }
      }
    }

    for (const elevator of tower.elevators) this.drawElevator(elevator, view);
    for (const agent of tower.agents) this.drawAgent(agent, view);
    for (const particle of tower.particles)
      this.drawParticle(particle.x, particle.y, particle.text, particle.color);

    const preview = createBuildPreview(tower, economy, view.selectedTool, drag);
    for (const item of preview.items)
      this.drawGhost(item.x, item.y, item.width, item.height, item.valid, item.reason);
  }

  destroy(): void {
    this.app?.destroy(true);
    this.app = null;
    this.parent = null;
    this.normalTowerBase.reset();
  }

  getRenderStats(): RenderStats {
    return { ...this.renderStats };
  }

  resetRenderStats(): void {
    this.renderStats = createRenderStats();
  }

  private drawBackdrop(clock: ClockState, view: ViewState): void {
    if (!this.app) return;
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const hour = getHour(clock.tick);
    const night = hour < 6 || hour > 19;
    const graphics = new Graphics();
    graphics
      .rect(0, 0, w, h)
      .fill(view.lensMode === 'normal' ? colorNumber(getSkyColor(clock.tick)) : 0x07111f);
    graphics
      .rect(0, 0, w, h * 0.54)
      .fill({ color: night ? 0x0f172a : 0x9fc6d1, alpha: night ? 0.22 : 0.14 });
    graphics
      .rect(0, h * 0.54, w, h * 0.46)
      .fill({ color: 0x020617, alpha: view.lensMode === 'normal' ? 0.24 : 0.55 });

    const sunRatio = clock.tick / 2_000;
    const sunX = w * sunRatio;
    const sunY = h * (0.42 - Math.sin(sunRatio * Math.PI) * 0.26);
    graphics.circle(sunX, sunY, night ? 20 : 34).fill({
      color: night ? 0xdce3e8 : MATERIAL.mutedGold,
      alpha: view.lensMode === 'normal' ? 0.78 : 0.16,
    });
    graphics.circle(sunX, sunY, night ? 46 : 82).fill({
      color: night ? 0x718096 : 0xc99652,
      alpha: view.lensMode === 'normal' ? 0.08 : 0.03,
    });

    const skylineSprites: Sprite[] = [];
    const skylineTexture = this.vectorAssets.environmentTexture('skyline-tower');
    for (let i = 0; i < 18; i += 1) {
      const bw = 32 + (i % 5) * 16;
      const bh = 100 + ((i * 37) % 180);
      const bx = ((i * 97 + 40) % Math.max(1, w + 140)) - 70;
      const by = h - 86 - bh;
      const alpha = view.lensMode === 'normal' ? 0.14 + (i % 3) * 0.035 : 0.08;
      if (skylineTexture) {
        const sprite = new Sprite(skylineTexture);
        sprite.position.set(bx, by);
        sprite.setSize(bw, bh);
        sprite.alpha = alpha * 1.35;
        skylineSprites.push(sprite);
      } else {
        graphics.rect(bx, by, bw, bh).fill({ color: 0x12313d, alpha });
        for (let wy = by + 18; wy < by + bh - 12; wy += 18) {
          for (let wx = bx + 8; wx < bx + bw - 8; wx += 14) {
            if ((i + wx + wy) % 4 < 1)
              graphics
                .rect(wx, wy, 4, 7)
                .fill({ color: night ? 0xe6cf92 : 0xd6e5e9, alpha: night ? 0.2 : 0.065 });
          }
        }
      }
    }
    this.backdropLayer.addChild(graphics);
    for (const sprite of skylineSprites) this.backdropLayer.addChild(sprite);
  }

  private drawWeatherOverlay(
    macro: MacroState,
    operations: OperationsState,
    clock: ClockState,
    view: ViewState,
  ): void {
    if (!this.app || view.lensMode !== 'normal') return;
    const exposure = clamp(macro.weatherRisk * 0.7 + operations.heightRisk * 0.3, 0, 100);
    if (exposure < 30) return;

    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const severity = (exposure - 30) / 70;
    const graphics = new Graphics();
    graphics.rect(0, 0, w, h).fill({ color: 0x31505d, alpha: 0.04 + severity * 0.1 });
    graphics.rect(0, 0, w, h * 0.44).fill({ color: 0xd6e5e9, alpha: 0.025 + severity * 0.055 });

    const streaks = Math.round(12 + severity * 44);
    for (let i = 0; i < streaks; i += 1) {
      const x = ((i * 97 + clock.tick * (0.18 + severity * 0.42)) % (w + 240)) - 120;
      const y = ((i * 53 + clock.tick * (0.05 + severity * 0.16)) % (h * 0.62)) - 30;
      const length = 18 + severity * 34 + (i % 5) * 3;
      graphics
        .moveTo(x, y)
        .lineTo(x - length * 0.7, y + length)
        .stroke({ width: 1, color: 0xdbeafe, alpha: 0.08 + severity * 0.22 });
    }

    if (operations.heightRisk > 55) {
      const bandCount = Math.round(2 + severity * 4);
      for (let i = 0; i < bandCount; i += 1) {
        const y = h * (0.2 + i * 0.07) + Math.sin(clock.tick * 0.02 + i) * 8;
        graphics
          .moveTo(0, y)
          .bezierCurveTo(w * 0.24, y - 18, w * 0.48, y + 16, w, y - 10)
          .stroke({ width: 2, color: 0xeff6ff, alpha: 0.04 + severity * 0.12 });
      }
    }

    if (exposure > 78 && clock.tick % 220 < 18) {
      const x = w * (0.22 + seedNoise(clock.day, clock.tick) * 0.56);
      graphics
        .moveTo(x, 0)
        .lineTo(x - 24, h * 0.18)
        .lineTo(x + 18, h * 0.18)
        .lineTo(x - 8, h * 0.34)
        .stroke({ width: 2, color: 0xf8fafc, alpha: 0.32 + severity * 0.28 });
    }

    this.backdropLayer.addChild(graphics);
  }

  private drawBlueprintGrid(): void {
    const graphics = new Graphics();
    for (let x = -120; x <= 120; x += 1) {
      graphics
        .moveTo(x * CELL_SIZE.w, -1_900)
        .lineTo(x * CELL_SIZE.w, 240)
        .stroke({ width: 1, color: 0xffffff, alpha: x === 0 ? 0.18 : 0.06 });
    }
    for (let y = -6; y <= 80; y += 1) {
      graphics
        .moveTo(-3_840, -y * CELL_SIZE.h)
        .lineTo(3_840, -y * CELL_SIZE.h)
        .stroke({ width: 1, color: 0xffffff, alpha: y === 0 ? 0.22 : 0.06 });
    }
    this.gridLayer.addChild(graphics);
  }

  private drawGround(view: ViewState, emptyLot: boolean): void {
    const ground = new Graphics();
    ground.rect(-5_000, 0, 10_000, 2_000).fill(view.lensMode === 'normal' ? 0x101417 : 0x0f172a);
    ground.rect(-5_000, -10, 10_000, 10).fill(view.lensMode === 'normal' ? 0x273239 : 0x334155);
    ground
      .rect(-5_000, -2, 10_000, 2)
      .fill({ color: MATERIAL.mutedCyan, alpha: view.lensMode === 'normal' ? 0.16 : 0.1 });
    for (let x = -240; x < 240; x += 3) {
      ground.rect(x * CELL_SIZE.w, 6, CELL_SIZE.w * 1.5, 2).fill({ color: 0x475569, alpha: 0.28 });
    }
    const airRightsTexture = emptyLot
      ? this.vectorAssets.environmentTexture('air-rights-marker')
      : null;
    if (emptyLot && !airRightsTexture) {
      ground
        .rect(-102, -34, 204, 30)
        .fill({ color: MATERIAL.mutedGold, alpha: 0.12 })
        .stroke({ width: 1, color: MATERIAL.mutedGold, alpha: 0.62 });
      ground.rect(-86, -26, 172, 12).fill({ color: 0x020617, alpha: 0.42 });
    }
    if (emptyLot) {
      const text = new Text({
        text: 'SURVEYED AIR RIGHTS',
        style: { fill: 0xe8dcc2, fontSize: 9, fontWeight: '700', letterSpacing: 2 },
      });
      text.anchor.set(0.5, 0.5);
      text.position.set(0, -20);
      this.overlayLayer.addChild(text);
      for (let x = -96; x <= 96; x += 32) {
        ground
          .moveTo(x, -4)
          .lineTo(x + 16, -34)
          .stroke({ width: 2, color: MATERIAL.mutedGold, alpha: 0.38 });
      }
    }
    this.groundLayer.addChild(ground);
    if (airRightsTexture) {
      const marker = new Sprite(airRightsTexture);
      marker.position.set(-102, -34);
      marker.setSize(204, 34);
      marker.alpha = view.lensMode === 'normal' ? 0.92 : 0.42;
      this.groundLayer.addChild(marker);
    }
  }

  private drawCloud(
    xPct: number,
    yPct: number,
    scale: number,
    opacity: number,
    view: ViewState,
  ): void {
    if (view.lensMode !== 'normal') return;
    const x = xPct * 14;
    const y = -270 - yPct;
    const texture = this.vectorAssets.environmentTexture('cloud-bank');
    if (texture) {
      const cloud = new Sprite(texture);
      cloud.position.set(x - 64 * scale, y - 24 * scale);
      cloud.setSize(128 * scale, 48 * scale);
      cloud.alpha = opacity;
      this.cloudLayer.addChild(cloud);
      return;
    }
    const cloud = new Graphics();
    cloud.alpha = opacity;
    cloud.ellipse(x, y, 34 * scale, 12 * scale).fill(0xffffff);
    cloud.circle(x - 18 * scale, y - 4 * scale, 12 * scale).fill(0xffffff);
    cloud.circle(x + 8 * scale, y - 8 * scale, 16 * scale).fill(0xffffff);
    cloud.circle(x + 24 * scale, y - 2 * scale, 10 * scale).fill(0xffffff);
    this.cloudLayer.addChild(cloud);
  }

  private drawShaft(shaft: ElevatorShaft, view: ViewState): void {
    const graphics = new Graphics();
    const x = shaft.x * CELL_SIZE.w + 4;
    const y = -(shaft.max + 1) * CELL_SIZE.h;
    const h = (shaft.max - shaft.min + 1) * CELL_SIZE.h;
    const transit = view.lensMode === 'transit';
    graphics
      .rect(x, y, CELL_SIZE.w - 8, h)
      .fill({ color: transit ? 0x2c6d78 : MATERIAL.void, alpha: transit ? 0.32 : 0.42 });
    graphics
      .rect(x + 5, y, 2, h)
      .fill({ color: transit ? MATERIAL.mutedCyan : MATERIAL.steel, alpha: transit ? 0.76 : 0.42 });
    graphics
      .rect(x + CELL_SIZE.w - 15, y, 2, h)
      .fill({ color: transit ? MATERIAL.mutedCyan : MATERIAL.steel, alpha: transit ? 0.76 : 0.42 });
    for (let floor = shaft.min; floor <= shaft.max; floor += 1) {
      const fy = -(floor + 1) * CELL_SIZE.h;
      graphics
        .rect(x, fy + CELL_SIZE.h - 2, CELL_SIZE.w - 8, 2)
        .fill({ color: transit ? 0xc1dce2 : 0x334155, alpha: transit ? 0.58 : 0.42 });
    }
    this.shaftsLayer.addChild(graphics);

    const texture = this.vectorAssets.coreTexture('shaft');
    if (!texture || transit) return;
    const sprite = new Sprite(texture);
    sprite.position.set(x, y);
    sprite.setSize(CELL_SIZE.w - 8, h);
    sprite.alpha = 0.55;
    this.shaftsLayer.addChild(sprite);
  }

  private drawRoom(
    room: TowerRoom,
    agents: Agent[],
    economy: EconomyState,
    operations: OperationsState,
    clock: ClockState,
    view: ViewState,
  ): void {
    if (BUILDINGS[room.type].cat === 'trans') {
      this.drawShaftCell(room, view);
      return;
    }

    const graphics = new Graphics();
    const x = room.x * CELL_SIZE.w;
    const y = -(room.y + room.height) * CELL_SIZE.h;
    const w = room.width * CELL_SIZE.w;
    const h = room.height * CELL_SIZE.h;
    const base = this.getRoomColor(room, economy, operations, view);
    const side = mixColor(base, 0x020617, 0.42);
    const top = mixColor(base, 0xffffff, 0.22);

    graphics.rect(x + 4, y + 4, w, h).fill({ color: 0x020617, alpha: 0.34 });
    graphics.rect(x, y, w, h).fill(side).stroke({ width: 1, color: 0x020617, alpha: 0.76 });
    graphics.rect(x + 2, y + 2, w - 4, h - 4).fill(base);
    graphics.rect(x + 2, y + 2, w - 4, 4).fill({ color: top, alpha: 0.86 });
    graphics.rect(x + 2, y + h - 5, w - 4, 3).fill({ color: 0x020617, alpha: 0.34 });
    this.drawMaterialBreakup(graphics, room, base, x, y, w, h);

    if (view.lensMode === 'normal') {
      this.roomsLayer.addChild(graphics);
      this.drawInterior(room, agents, clock, x, y, w, h);
      return;
    }

    this.drawLensDetail(graphics, room, economy, operations, view, x, y, w, h);
    this.roomOverlayLayer.addChild(graphics);
  }

  private drawMaterialBreakup(
    graphics: Graphics,
    room: TowerRoom,
    base: number,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const seam = mixColor(base, MATERIAL.void, 0.46);
    const highlight = mixColor(base, 0xffffff, 0.18);
    for (let col = 1; col < room.width; col += 1) {
      const px = x + col * CELL_SIZE.w;
      graphics
        .moveTo(px, y + 4)
        .lineTo(px, y + h - 5)
        .stroke({
          width: 1,
          color: seam,
          alpha: room.type === 'floor' ? 0.24 : 0.16,
        });
    }
    for (let col = 0; col < room.width; col += 1) {
      const px = x + col * CELL_SIZE.w;
      const alpha = 0.035 + seedNoise(room.seed, col + room.y * 3) * 0.035;
      graphics.rect(px + 5, y + 6, CELL_SIZE.w - 10, Math.max(3, h - 15)).fill({
        color: seedNoise(room.seed, col + 31) > 0.5 ? highlight : MATERIAL.void,
        alpha,
      });
    }
    if (!['floor', 'lobby'].includes(room.type)) {
      graphics.rect(x + 4, y + 5, w - 8, 1).fill({ color: highlight, alpha: 0.13 });
      graphics.rect(x + 4, y + h - 8, w - 8, 1).fill({ color: MATERIAL.void, alpha: 0.18 });
    }
  }

  private getRoomColor(
    room: TowerRoom,
    economy: EconomyState,
    operations: OperationsState,
    view: ViewState,
  ): number {
    const def = BUILDINGS[room.type];
    if (
      view.lensMode === 'maintenance' &&
      ['office', 'condo', 'cafe', 'hotel'].includes(room.type)
    ) {
      return mixColor(MATERIAL.mutedGreen, MATERIAL.mutedRed, room.dirt / 100);
    }
    if (view.lensMode === 'transit') {
      return BUILDINGS[room.type].cat === 'infra' ? 0x1e293b : 0x0f172a;
    }
    if (view.lensMode === 'value') {
      const value = (def.rent ?? 0) + (def.sale ?? 0) + (def.income ?? 0) * 8;
      const score = value / Math.max(1, economy.dailyRevenue + 12_000);
      return mixColor(0x0f172a, MATERIAL.mutedGold, clamp(score * 6, 0.08, 1));
    }
    if (view.lensMode === 'sentiment') {
      const base = mixColor(
        MATERIAL.mutedRed,
        MATERIAL.mutedGreen,
        economy.tenantSatisfaction / 100,
      );
      const dirtStress = ['infra', 'trans', 'utility'].includes(def.cat) ? 0 : room.dirt / 160;
      return mixColor(base, MATERIAL.void, dirtStress);
    }
    if (view.lensMode === 'privacy') {
      const score = this.getPrivacyScore(room, operations);
      const noiseSource = NOISE_SOURCE_ROOMS.has(room.type);
      const privateRoom = PRIVACY_SENSITIVE_ROOMS.has(room.type);
      const supportRoom = PRIVACY_SUPPORT_ROOMS.has(room.type);
      const base = mixColor(MATERIAL.mutedRed, MATERIAL.mutedCyan, score / 100);
      if (noiseSource) return mixColor(base, MATERIAL.brass, 0.24);
      if (privateRoom) return mixColor(base, MATERIAL.cream, 0.16);
      if (supportRoom) return mixColor(base, MATERIAL.mutedGreen, 0.2);
      return mixColor(base, MATERIAL.void, 0.28);
    }
    if (view.lensMode === 'safety') {
      const protectedRoom = ['security', 'clinic', 'mechanical', 'weatherCore'].includes(room.type);
      const exposure = clamp(room.y / 24, 0, 1);
      return protectedRoom
        ? mixColor(MATERIAL.mutedCyan, MATERIAL.mutedGreen, 0.45)
        : mixColor(0x1e293b, MATERIAL.mutedRed, exposure);
    }
    if (view.lensMode === 'event') {
      const eventKinds = ['event', 'retail', 'food', 'sleep', 'culture', 'observation'];
      return eventKinds.includes(def.kind ?? '')
        ? mixColor(MATERIAL.mutedGold, MATERIAL.cafe, 0.35)
        : mixColor(0x0f172a, MATERIAL.shell, 0.28);
    }
    const material =
      ROOM_MATERIALS[room.type as keyof typeof ROOM_MATERIALS] ?? colorNumber(def.color);
    const verticalShade = room.y % 2 === 0 ? MATERIAL.shell : MATERIAL.shadow;
    return mixColor(material, verticalShade, 0.1 + seedNoise(room.seed, room.y) * 0.12);
  }

  private getPrivacyScore(room: TowerRoom, operations: OperationsState): number {
    const quietScore = operations.noiseControl;
    const privacyScore = operations.privacyComfort;
    const blended = privacyScore * 0.55 + quietScore * 0.45;

    if (NOISE_SOURCE_ROOMS.has(room.type)) {
      return clamp(quietScore - 10 + seedNoise(room.seed, room.y) * 6, 0, 100);
    }
    if (PRIVACY_SENSITIVE_ROOMS.has(room.type)) {
      return clamp(privacyScore * 0.68 + quietScore * 0.32 - room.dirt * 0.12, 0, 100);
    }
    if (PRIVACY_SUPPORT_ROOMS.has(room.type)) {
      return clamp(blended + 12, 0, 100);
    }
    if (BUILDINGS[room.type].cat === 'infra' || BUILDINGS[room.type].cat === 'trans') {
      return clamp(blended * 0.72, 0, 100);
    }
    return clamp(blended, 0, 100);
  }

  private drawShaftCell(room: TowerRoom, view: ViewState): void {
    const graphics = new Graphics();
    const x = room.x * CELL_SIZE.w;
    const y = -(room.y + 1) * CELL_SIZE.h;
    const transit = view.lensMode === 'transit';
    graphics
      .rect(x + 3, y + 1, CELL_SIZE.w - 6, CELL_SIZE.h - 2)
      .fill({ color: transit ? 0x2c6d78 : MATERIAL.void, alpha: transit ? 0.42 : 0.22 });
    graphics
      .rect(x + 8, y + 2, 2, CELL_SIZE.h - 4)
      .fill({ color: transit ? MATERIAL.mutedCyan : 0x475569, alpha: transit ? 0.78 : 0.42 });
    graphics
      .rect(x + CELL_SIZE.w - 10, y + 2, 2, CELL_SIZE.h - 4)
      .fill({ color: transit ? MATERIAL.mutedCyan : 0x475569, alpha: transit ? 0.78 : 0.42 });
    this.roomsLayer.addChild(graphics);
  }

  private drawInterior(
    room: TowerRoom,
    agents: Agent[],
    clock: ClockState,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const hour = getHour(clock.tick);
    const night = hour < 6 || hour > 18;
    const occupied = agents.some(
      (agent) =>
        agent.targetId === room.id && !['walking', 'waiting', 'riding'].includes(agent.state),
    );
    const lit =
      room.type === 'office' ? !night || occupied || seedNoise(room.seed, hour) > 0.62 : occupied;
    const texture = this.vectorAssets.roomTexture(room.type, lit, night);

    if (texture) {
      const sprite = new Sprite(texture);
      sprite.position.set(x + 3, y + 3);
      sprite.setSize(Math.max(1, w - 6), Math.max(1, h - 6));
      sprite.alpha = room.type === 'floor' ? 0.48 : 0.46;
      this.roomsLayer.addChild(sprite);
    }

    for (const placement of createRoomComposition(room, { lit, night })) {
      this.drawVectorElement(placement, x + 3, y + 3, Math.max(1, w - 6), Math.max(1, h - 6));
    }
  }

  private drawVectorElement(
    placement: VectorPlacement,
    roomX: number,
    roomY: number,
    roomWidth: number,
    roomHeight: number,
  ): void {
    const texture = this.vectorAssets.elementTexture(placement.key);
    if (!texture) return;
    const sprite = new Sprite(texture);
    sprite.position.set(
      roomX + (placement.x / 96) * roomWidth,
      roomY + (placement.y / 32) * roomHeight,
    );
    sprite.setSize((placement.width / 96) * roomWidth, (placement.height / 32) * roomHeight);
    sprite.alpha = placement.alpha ?? 1;
    this.roomsLayer.addChild(sprite);
  }

  private drawLensDetail(
    graphics: Graphics,
    room: TowerRoom,
    economy: EconomyState,
    operations: OperationsState,
    view: ViewState,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    if (
      view.lensMode === 'maintenance' &&
      ['office', 'condo', 'cafe', 'hotel'].includes(room.type)
    ) {
      this.drawLensBadge('lens-maintenance', `${Math.round(room.dirt)}%`, x, y, w, h);
    } else if (view.lensMode === 'value') {
      const def = BUILDINGS[room.type];
      const revenue = (def.rent ?? 0) + (def.sale ?? 0) + (def.income ?? 0);
      if (revenue > 0) {
        this.drawLensBadge('lens-value', `$${revenue}`, x, y, w, h);
      }
    } else if (view.lensMode === 'transit') {
      this.drawLensBadge('lens-transit', economy.transitPressure > 65 ? '!' : '', x, y, w, h, 0.72);
      graphics.rect(x + 4, y + h - 6, w - 8, 2).fill({
        color: economy.transitPressure > 65 ? 0xc57d46 : MATERIAL.mutedCyan,
        alpha: 0.5,
      });
    } else if (view.lensMode === 'sentiment') {
      if (BUILDINGS[room.type].cat !== 'infra' && BUILDINGS[room.type].cat !== 'trans') {
        this.drawLensBadge('lens-sentiment', `${economy.tenantSatisfaction}%`, x, y, w, h, 0.78);
      }
    } else if (view.lensMode === 'privacy') {
      const cat = BUILDINGS[room.type].cat;
      if (cat !== 'infra' && cat !== 'trans') {
        const score = Math.round(this.getPrivacyScore(room, operations));
        const stressed =
          score < 55 ||
          (NOISE_SOURCE_ROOMS.has(room.type) && operations.noiseControl < 72) ||
          (PRIVACY_SENSITIVE_ROOMS.has(room.type) && operations.privacyComfort < 62);
        this.drawLensBadge('lens-privacy', stressed ? '!' : `${score}%`, x, y, w, h, 0.82);
        graphics.rect(x + 5, y + h - 7, w - 10, 2).fill({
          color: stressed ? MATERIAL.mutedRed : MATERIAL.mutedCyan,
          alpha: 0.52,
        });
      }
    } else if (view.lensMode === 'safety') {
      const protectedRoom = ['security', 'clinic', 'mechanical', 'weatherCore'].includes(room.type);
      const exposed = room.y >= 8 && !protectedRoom;
      this.drawLensBadge('lens-safety', exposed ? '!' : '', x, y, w, h, 0.78);
    } else if (view.lensMode === 'event') {
      const kind = BUILDINGS[room.type].kind;
      if (['event', 'retail', 'food', 'sleep', 'culture', 'observation'].includes(kind ?? '')) {
        this.drawLensBadge('lens-event', '', x, y, w, h, 0.82);
      }
    }
  }

  private drawLensBadge(
    key: UiVectorKey,
    label: string,
    x: number,
    y: number,
    w: number,
    h: number,
    alpha = 0.94,
  ): void {
    const badgeWidth = clamp(w * 0.74, 24, 44);
    const badgeHeight = badgeWidth * (24 / 44);
    const badgeX = x + w / 2 - badgeWidth / 2;
    const badgeY = y + h / 2 - badgeHeight / 2;
    const texture = this.vectorAssets.uiTexture(key);

    if (texture) {
      const sprite = new Sprite(texture);
      sprite.position.set(badgeX, badgeY);
      sprite.setSize(badgeWidth, badgeHeight);
      sprite.alpha = alpha;
      this.overlayLayer.addChild(sprite);
    }

    if (!label) return;
    const text = new Text({
      text: label,
      style: {
        fill:
          key === 'lens-value' || key === 'lens-event' || key === 'lens-privacy'
            ? 0xf0e0a6
            : 0xdfe7dc,
        fontSize: badgeWidth < 32 ? 7 : 8,
        fontWeight: '900',
        dropShadow: { color: 0x020617, distance: 1, alpha: 0.78 },
      },
    });
    text.anchor.set(0.5, 0.5);
    text.position.set(x + w / 2 + (key === 'lens-maintenance' ? 6 : 0), y + h / 2);
    this.overlayLayer.addChild(text);
  }

  private drawDirt(
    room: TowerRoom,
    x: number,
    y: number,
    w: number,
    h: number,
    dirt: number,
  ): void {
    // Dirt draws every frame, so it must live on an ephemeral layer that
    // gets cleared per-frame — NOT on roomsLayer which is cache-gated.
    // Otherwise each frame stacks a new translucent dirt Graphics on the
    // previous ones and rooms darken into black until the cache rebuilds
    // (the "flashing glitch" players report).
    const graphics = new Graphics();
    graphics
      .rect(x + 2, y + 2, w - 4, h - 4)
      .fill({ color: 0x4b3a31, alpha: Math.min(0.36, dirt * 0.32) });
    const spots = Math.ceil(dirt * 8);
    for (let i = 0; i < spots; i += 1) {
      const sx = x + 5 + seedNoise(room.seed, i) * Math.max(1, w - 10);
      const sy = y + 5 + seedNoise(room.seed, i + 12) * Math.max(1, h - 10);
      graphics
        .circle(sx, sy, 1.3 + dirt * 2.1)
        .fill({ color: 0x3b2e27, alpha: 0.16 + dirt * 0.24 });
    }
    this.roomOverlayLayer.addChild(graphics);
  }

  private drawElevator(elevator: ElevatorCar, view: ViewState): void {
    if (view.lensMode === 'maintenance') return;
    const x = elevator.x * CELL_SIZE.w + 3;
    const y = -(elevator.y + 1) * CELL_SIZE.h + 2;
    const graphics = new Graphics();
    const transit = view.lensMode === 'transit';
    const doorGap =
      elevator.state === 'open' ? clamp((30 - Math.abs(15 - elevator.timer)) / 15, 0, 1) : 0;
    graphics
      .rect(x - 1, y - 1, CELL_SIZE.w - 4, CELL_SIZE.h - 2)
      .fill({ color: transit ? MATERIAL.mutedCyan : MATERIAL.void, alpha: transit ? 0.34 : 0.62 });
    this.agentsLayer.addChild(graphics);

    const texture = this.vectorAssets.coreTexture('elevator-car');
    if (texture) {
      const sprite = new Sprite(texture);
      sprite.position.set(x + 1, y + 1);
      sprite.setSize(CELL_SIZE.w - 6, CELL_SIZE.h - 4);
      sprite.alpha = transit ? 0.42 : 1;
      this.agentsLayer.addChild(sprite);
    } else {
      graphics.rect(x + 2, y + 2, CELL_SIZE.w - 10, CELL_SIZE.h - 8).fill(0xc9d4d7);
    }

    if (doorGap > 0) {
      const doors = new Graphics();
      const gapWidth = (CELL_SIZE.w - 10) * doorGap;
      doors
        .rect(x + CELL_SIZE.w / 2 - gapWidth / 2 - 2, y + 4, gapWidth, CELL_SIZE.h - 11)
        .fill({ color: MATERIAL.void, alpha: 0.68 });
      this.agentsLayer.addChild(doors);
    }

    if (elevator.riders.length > 0) {
      const text = new Text({
        text: String(elevator.riders.length),
        style: { fill: MATERIAL.void, fontSize: 9, fontWeight: '900' },
      });
      text.anchor.set(0.5, 0.5);
      text.position.set(x + CELL_SIZE.w / 2 - 2, y + CELL_SIZE.h / 2 - 2);
      this.agentsLayer.addChild(text);
    }
  }

  private drawAgent(agent: Agent, view: ViewState): void {
    if (view.lensMode === 'maintenance' && agent.type !== 'janitor') return;
    const x = agent.x * CELL_SIZE.w + CELL_SIZE.w / 2;
    const y = -agent.y * CELL_SIZE.h - 6;
    const transit = view.lensMode === 'transit';
    const agentTexture = this.vectorAssets.agentTexture(agentVectorKey(agent.type));

    if (agentTexture) {
      const sprite = new Sprite(agentTexture);
      sprite.anchor.set(0.5, 0.82);
      sprite.position.set(x, y + 10);
      sprite.setSize(agent.type === 'janitor' ? 15 : 13, agent.type === 'janitor' ? 20 : 18);
      sprite.alpha = transit && agent.state !== 'waiting' ? 0.68 : 1;
      this.agentsLayer.addChild(sprite);
    } else {
      const graphics = new Graphics();
      const color = transit && agent.state === 'waiting' ? 0xc57d46 : colorNumber(agent.color);
      graphics.circle(x, y - 6, agent.type === 'janitor' ? 3.2 : 2.8).fill(color);
      graphics.rect(x - 2.5, y - 3, 5, 8).fill(color);
      this.agentsLayer.addChild(graphics);
    }

    if (transit && agent.state === 'waiting') {
      const waitStress = clamp((agent.waitTicks ?? 0) / 120, 0, 1);
      const waitingTexture = this.vectorAssets.agentTexture('agent-waiting-ring');
      if (waitingTexture) {
        const ring = new Sprite(waitingTexture);
        ring.anchor.set(0.5);
        ring.position.set(x, y);
        ring.setSize(22 + waitStress * 10, 22 + waitStress * 10);
        ring.alpha = 0.72 + waitStress * 0.24;
        this.agentsLayer.addChild(ring);
      } else {
        const ring = new Graphics();
        ring.circle(x, y, 10 + waitStress * 5).stroke({
          width: 1 + waitStress,
          color: 0xc57d46,
          alpha: 0.48 + waitStress * 0.28,
        });
        this.agentsLayer.addChild(ring);
      }
    }
  }

  private drawParticle(xGrid: number, yFloor: number, textValue: string, color: string): void {
    const text = new Text({
      text: textValue,
      style: {
        fill: colorNumber(color),
        fontSize: 10,
        fontWeight: '900',
        dropShadow: { color: 0x020617, distance: 1, alpha: 0.8 },
      },
    });
    text.anchor.set(0.5, 0.5);
    text.position.set(xGrid * CELL_SIZE.w + CELL_SIZE.w / 2, -yFloor * CELL_SIZE.h - 18);
    this.overlayLayer.addChild(text);
  }

  private drawGhost(
    x: number,
    y: number,
    width: number,
    height: number,
    valid: boolean,
    reason: string,
  ): void {
    const graphics = new Graphics();
    const left = x * CELL_SIZE.w;
    const top = -(y + height) * CELL_SIZE.h;
    const w = width * CELL_SIZE.w;
    const h = height * CELL_SIZE.h;
    const color = valid ? MATERIAL.mutedGreen : MATERIAL.mutedRed;

    const texture = this.vectorAssets.uiTexture(valid ? 'ghost-valid' : 'ghost-invalid');
    if (texture) {
      const sprite = new Sprite(texture);
      sprite.position.set(left, top);
      sprite.setSize(w, h);
      sprite.alpha = 0.95;
      this.overlayLayer.addChild(sprite);
      graphics.rect(left, top, w, h).stroke({ width: 1.5, color, alpha: 0.72 });
    } else {
      graphics
        .rect(left, top, w, h)
        .fill({ color, alpha: 0.18 })
        .stroke({ width: 2, color, alpha: 0.92 });
      for (let stripe = -h; stripe < w; stripe += 9) {
        graphics
          .moveTo(left + stripe, top + h)
          .lineTo(left + stripe + h, top)
          .stroke({ width: 1, color, alpha: 0.42 });
      }
    }
    if (!valid && reason) {
      const text = new Text({
        text: reason,
        style: { fill: 0xffffff, fontSize: 8, fontWeight: '800' },
      });
      text.position.set(left, top - 14);
      this.overlayLayer.addChild(text);
    }
    this.overlayLayer.addChild(graphics);
  }
}
