import Phaser from 'phaser';
import { Projectile } from '../entities/Projectile';
import type { ProjectileSpawn } from '../types/combat';

export class ProjectileSystem {
  readonly group: Phaser.GameObjects.Group;

  private readonly live = new Set<Projectile>();
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.group = scene.add.group();
  }

  spawn(spawn: ProjectileSpawn): Projectile {
    const projectile = new Projectile(this.scene, spawn);

    this.group.add(projectile);
    this.live.add(projectile);

    return projectile;
  }

  update(deltaMs: number): void {
    for (const projectile of [...this.live]) {
      if (projectile.updateTimers(deltaMs) || !projectile.active) {
        this.remove(projectile);
      }
    }
  }

  has(projectile: Projectile): boolean {
    return this.live.has(projectile);
  }

  remove(projectile: Projectile): void {
    if (!this.live.delete(projectile)) {
      return;
    }

    projectile.destroy();
  }

  destroyAll(): void {
    for (const projectile of [...this.live]) {
      this.remove(projectile);
    }

    this.live.clear();
  }

  get count(): number {
    return this.live.size;
  }
}
