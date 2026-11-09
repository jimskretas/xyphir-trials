import Phaser from 'phaser';
import { BOSS } from '../config/combatConfig';
import { ARENA } from '../config/gameplayConfig';
import { Boss } from '../entities/Boss';
import { Grunt } from '../entities/Grunt';
import type { Player } from '../entities/Player';
import { sfx } from './SfxSystem';
import type { ProjectileSpawn } from '../types/combat';

export type EncounterPhase =
  | 'grunts'
  | 'bossTelegraph'
  | 'boss'
  | 'cleared';

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

export class EncounterSystem {
  readonly group: Phaser.GameObjects.Group;

  private readonly grunts: Grunt[] = [];
  private readonly scene: Phaser.Scene;
  private boss: Boss | null = null;
  private bossSpawned = false;
  private bossTelegraph: Phaser.GameObjects.Graphics | null = null;
  private bossTelegraphRemainingMs = 0;
  private currentPhase: EncounterPhase = 'grunts';
  private nextId = 1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.group = scene.add.group();
  }

  get phase(): EncounterPhase {
    return this.currentPhase;
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

  spawnOpeningWave(): void {
    this.currentPhase = 'grunts';

    for (const point of GRUNT_SPAWN_POINTS) {
      this.spawnGrunt(point.x, point.y);
    }
  }

  update(
    deltaMs: number,
    players: readonly Player[],
  ): ProjectileSpawn[] {
    if (this.currentPhase === 'grunts') {
      return this.updateGrunts(deltaMs, players);
    }

    if (this.currentPhase === 'bossTelegraph') {
      this.updateBossTelegraph(deltaMs);
      return [];
    }

    if (this.currentPhase === 'boss') {
      return this.updateBoss(deltaMs, players);
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
    players: readonly Player[],
  ): ProjectileSpawn[] {
    const shots: ProjectileSpawn[] = [];

    for (const grunt of [...this.grunts]) {
      if (!grunt.isAlive) {
        this.removeGrunt(grunt);
        continue;
      }

      shots.push(...grunt.update(deltaMs, players));

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
    players: readonly Player[],
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

    return this.boss.update(deltaMs, players);
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

    const radius = 26 + progress * 110;
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
    sfx.play('bossSpawn');
    this.scene.cameras.main.shake(250, 0.006);
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
