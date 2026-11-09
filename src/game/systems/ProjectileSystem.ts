import Phaser from 'phaser';
import { Projectile } from '../entities/Projectile';
import type { ProjectileSpawn, Team } from '../types/combat';

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
      projectile.updateTimers(deltaMs);

      if (!projectile.active) {
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

  clearTeam(team: Team): void {
    for (const projectile of [...this.live]) {
      if (projectile.team === team) {
        this.remove(projectile);
      }
    }
  }

  get count(): number {
    return this.live.size;
  }
}
