import Phaser from 'phaser';
import { Grunt } from '../entities/Grunt';
import type { EnemyBase } from '../entities/EnemyBase';
import type { Player } from '../entities/Player';
import type { ProjectileSpawn } from '../types/combat';

export const GRUNT_SPAWN_POINTS = [
  { x: 480, y: 360 },
  { x: 1440, y: 360 },
  { x: 480, y: 920 },
  { x: 1440, y: 920 },
] as const;

export class EncounterSystem {
  readonly group: Phaser.GameObjects.Group;

  private readonly enemies: EnemyBase[] = [];
  private readonly scene: Phaser.Scene;
  private nextId = 1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.group = scene.add.group();
  }

  spawnOpeningWave(): void {
    for (const point of GRUNT_SPAWN_POINTS) {
      this.spawnGrunt(point.x, point.y);
    }
  }

  update(
    deltaMs: number,
    players: readonly Player[],
  ): ProjectileSpawn[] {
    const shots: ProjectileSpawn[] = [];

    for (const enemy of [...this.enemies]) {
      if (!enemy.isAlive) {
        this.remove(enemy);
        continue;
      }

      const shot = enemy.update(deltaMs, players);

      if (shot) {
        shots.push(shot);
      }

      if (!enemy.isAlive) {
        this.remove(enemy);
      }
    }

    return shots;
  }

  get aliveCount(): number {
    return this.enemies.length;
  }

  destroyAll(): void {
    for (const enemy of [...this.enemies]) {
      enemy.destroy();
    }

    this.enemies.length = 0;
  }

  private spawnGrunt(x: number, y: number): void {
    const grunt = new Grunt(this.scene, `grunt-${this.nextId++}`, x, y);

    this.group.add(grunt);
    this.enemies.push(grunt);
  }

  private remove(enemy: EnemyBase): void {
    const index = this.enemies.indexOf(enemy);

    if (index === -1) {
      return;
    }

    this.enemies.splice(index, 1);
    enemy.destroy();
  }
}
