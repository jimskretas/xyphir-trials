import Phaser from 'phaser';
import { BOSS } from '../config/combatConfig';
import { ARENA } from '../config/gameplayConfig';
import { Boss } from '../entities/Boss';
import { Grunt } from '../entities/Grunt';
import type { EnemyBase } from '../entities/EnemyBase';
import type { EnemyTarget } from '../entities/EnemyBase';
import { sfx } from './SfxSystem';
import type { SfxName } from './SfxSystem';
import type { ProjectileSpawn } from '../types/combat';

export type EncounterPhase =
  | 'grunts'
  | 'bossTelegraph'
  | 'boss'
  | 'cleared';

export interface TelegraphState {
  x: number;
  y: number;
  radius: number;
  progress: number;
}

export const GRUNT_SPAWN_POINTS = [
  { x: 480, y: 360 },
  { x: 1440, y: 360 },
  { x: 480, y: 920 },
  { x: 1440, y: 920 },
] as const;

const BOSS_SPAWN = {
  x: ARENA.width / 2,
  y: 300,
} as const;

const TELEGRAPH_COLOR = 0xf472b6;
const TELEGRAPH_BASE_RADIUS = 26;
const TELEGRAPH_GROWTH_RADIUS = 110;

export class EncounterSystem {
  readonly group: Phaser.GameObjects.Group;

  private readonly grunts: Grunt[] = [];
  private readonly scene: Phaser.Scene;
  private readonly onSfx: ((name: SfxName) => void) | null;
  private boss: Boss | null = null;
  private bossSpawned = false;
  private bossTelegraph: Phaser.GameObjects.Graphics | null = null;
  private bossTelegraphRemainingMs = 0;
  private currentPhase: EncounterPhase = 'grunts';
  private nextId = 1;

  constructor(
    scene: Phaser.Scene,
    onSfx: ((name: SfxName) => void) | null = null,
  ) {
    this.scene = scene;
    this.onSfx = onSfx;
    this.group = scene.add.group();
  }

  get phase(): EncounterPhase {
    return this.currentPhase;
  }

  get telegraphState(): TelegraphState | null {
    if (this.currentPhase !== 'bossTelegraph') {
      return null;
    }

    const progress = Phaser.Math.Clamp(
      1 - this.bossTelegraphRemainingMs / BOSS.spawnTelegraphMs,
      0,
      1,
    );

    return {
      x: BOSS_SPAWN.x,
      y: BOSS_SPAWN.y,
      radius: TELEGRAPH_BASE_RADIUS + progress * TELEGRAPH_GROWTH_RADIUS,
      progress,
    };
  }

  get activeBoss(): Boss | null {
    return this.boss;
  }

  get bossDefeated(): boolean {
    return this.bossSpawned && this.currentPhase === 'cleared';
  }

  get aliveCount(): number {
    return this.grunts.length;
  }

  get enemies(): readonly EnemyBase[] {
    return this.boss ? [...this.grunts, this.boss] : this.grunts;
  }

  spawnOpeningWave(): void {
    this.currentPhase = 'grunts';

    for (const point of GRUNT_SPAWN_POINTS) {
      this.spawnGrunt(point.x, point.y);
    }
  }

  update(
    deltaMs: number,
    targets: readonly EnemyTarget[],
  ): ProjectileSpawn[] {
    if (this.currentPhase === 'grunts') {
      return this.updateGrunts(deltaMs, targets);
    }

    if (this.currentPhase === 'bossTelegraph') {
      this.updateBossTelegraph(deltaMs);
      return [];
    }

    if (this.currentPhase === 'boss') {
      return this.updateBoss(deltaMs, targets);
    }

    return [];
  }

  destroyAll(): void {
    for (const grunt of [...this.grunts]) {
      grunt.destroy();
    }

    this.grunts.length = 0;

    this.boss?.destroy();
    this.boss = null;
    this.bossTelegraph?.destroy();
    this.bossTelegraph = null;
    this.currentPhase = 'cleared';
  }

  private updateGrunts(
    deltaMs: number,
    targets: readonly EnemyTarget[],
  ): ProjectileSpawn[] {
    const shots: ProjectileSpawn[] = [];

    for (const grunt of [...this.grunts]) {
      if (!grunt.isAlive) {
        this.removeGrunt(grunt);
        continue;
      }

      shots.push(...grunt.update(deltaMs, targets));

      if (!grunt.isAlive) {
        this.removeGrunt(grunt);
      }
    }

    if (this.grunts.length === 0) {
      this.beginBossTelegraph();
    }

    return shots;
  }

  private updateBoss(
    deltaMs: number,
    targets: readonly EnemyTarget[],
  ): ProjectileSpawn[] {
    if (!this.boss) {
      return [];
    }

    if (!this.boss.isAlive) {
      this.boss.destroy();
      this.boss = null;
      this.currentPhase = 'cleared';
      return [];
    }

    return this.boss.update(deltaMs, targets);
  }

  private beginBossTelegraph(): void {
    this.currentPhase = 'bossTelegraph';
    this.bossTelegraphRemainingMs = BOSS.spawnTelegraphMs;
    this.bossTelegraph = this.scene.add.graphics().setDepth(5);
    this.drawBossTelegraph(0);
  }

  private updateBossTelegraph(deltaMs: number): void {
    this.bossTelegraphRemainingMs -= deltaMs;

    const progress = Phaser.Math.Clamp(
      1 - this.bossTelegraphRemainingMs / BOSS.spawnTelegraphMs,
      0,
      1,
    );

    this.drawBossTelegraph(progress);

    if (this.bossTelegraphRemainingMs > 0) {
      return;
    }

    this.spawnBoss();
  }

  private drawBossTelegraph(progress: number): void {
    if (!this.bossTelegraph) {
      return;
    }

    const radius = TELEGRAPH_BASE_RADIUS + progress * TELEGRAPH_GROWTH_RADIUS;
    const graphics = this.bossTelegraph;

    graphics.clear();
    graphics.fillStyle(TELEGRAPH_COLOR, 0.06 + progress * 0.12);
    graphics.fillCircle(BOSS_SPAWN.x, BOSS_SPAWN.y, radius);
    graphics.lineStyle(3, TELEGRAPH_COLOR, 0.9 - progress * 0.4);
    graphics.strokeCircle(BOSS_SPAWN.x, BOSS_SPAWN.y, radius);
    graphics.lineStyle(1, TELEGRAPH_COLOR, 0.5);
    graphics.strokeCircle(BOSS_SPAWN.x, BOSS_SPAWN.y, radius * 0.6);
  }

  private spawnBoss(): void {
    this.bossTelegraph?.destroy();
    this.bossTelegraph = null;

    this.boss = new Boss(this.scene, 'boss', BOSS_SPAWN.x, BOSS_SPAWN.y);
    this.bossSpawned = true;
    this.group.add(this.boss);
    this.currentPhase = 'boss';
    this.playSfx('bossSpawn');
    this.scene.cameras.main.shake(250, 0.006);
  }

  private playSfx(name: SfxName): void {
    if (this.onSfx) {
      this.onSfx(name);
      return;
    }

    sfx.play(name);
  }

  private spawnGrunt(x: number, y: number): void {
    const grunt = new Grunt(this.scene, `grunt-${this.nextId++}`, x, y);

    this.group.add(grunt);
    this.grunts.push(grunt);
  }

  private removeGrunt(grunt: Grunt): void {
    const index = this.grunts.indexOf(grunt);

    if (index === -1) {
      return;
    }

    this.grunts.splice(index, 1);
    grunt.destroy();
  }
}
