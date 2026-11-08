import Phaser from 'phaser';
import type {
  ProjectilePreset,
  ProjectileSpawn,
  Team,
} from '../types/combat';

export class Projectile extends Phaser.Physics.Arcade.Image {
  declare body: Phaser.Physics.Arcade.Body;

  readonly preset: ProjectilePreset;
  team: Team;
  ownerId: string;
  sourceId: string;
  damage: number;

  private remainingMs: number;
  private reflectLockRemaining = 0;

  constructor(scene: Phaser.Scene, spawn: ProjectileSpawn) {
    super(scene, spawn.x, spawn.y, spawn.preset.texture);

    this.preset = spawn.preset;
    this.team = spawn.team;
    this.ownerId = spawn.ownerId;
    this.sourceId = spawn.sourceId;
    this.damage = spawn.preset.damage;
    this.remainingMs = spawn.preset.lifetimeMs;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(20);
    this.setRotation(spawn.angle);

    const bodyOffset = this.width / 2 - spawn.preset.radius;
    this.body.setCircle(spawn.preset.radius, bodyOffset, bodyOffset);

    const velocity = new Phaser.Math.Vector2().setToPolar(
      spawn.angle,
      spawn.preset.speed,
    );
    this.setVelocity(velocity.x, velocity.y);

    if (spawn.preset.tint !== undefined) {
      this.setTint(spawn.preset.tint);
    }
  }

  updateTimers(deltaMs: number): boolean {
    this.remainingMs -= deltaMs;
    this.reflectLockRemaining = Math.max(
      0,
      this.reflectLockRemaining - deltaMs,
    );

    return this.remainingMs <= 0;
  }

  get canReflect(): boolean {
    return this.preset.reflectable && this.reflectLockRemaining <= 0;
  }

  lockReflection(durationMs: number): void {
    this.reflectLockRemaining = durationMs;
  }
}
