import Phaser from 'phaser';
import { SHIELD } from '../config/combatConfig';
import { getBulletDamage } from '../config/combatTuning';
import { COLORS } from '../config/theme';
import type {
  ProjectilePreset,
  ProjectileReflection,
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
  reflectionCount = 0;
  netId = 0;

  private reflectLockRemaining = 0;

  constructor(scene: Phaser.Scene, spawn: ProjectileSpawn) {
    super(scene, spawn.x, spawn.y, spawn.preset.texture);

    this.preset = spawn.preset;
    this.team = spawn.team;
    this.ownerId = spawn.ownerId;
    this.sourceId = spawn.sourceId;
    this.damage = spawn.damage ?? getBulletDamage(spawn.team);

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

  updateTimers(deltaMs: number): void {
    this.reflectLockRemaining = Math.max(
      0,
      this.reflectLockRemaining - deltaMs,
    );
  }

  get isReflectable(): boolean {
    return this.preset.reflectable;
  }

  get isReflectionLocked(): boolean {
    return this.reflectLockRemaining > 0;
  }

  get canReflect(): boolean {
    return this.isReflectable && !this.isReflectionLocked;
  }

  isMovingToward(x: number, y: number): boolean {
    return (
      this.body.velocity.x * (x - this.x) +
        this.body.velocity.y * (y - this.y) >
      0
    );
  }

  reflect(reflection: ProjectileReflection): void {
    const fromAlly = this.team === 'players';
    const damageMultiplier = fromAlly
      ? SHIELD.allyReflectDamageMultiplier
      : SHIELD.enemyReflectDamageMultiplier;
    const scaleMultiplier = fromAlly
      ? SHIELD.allyReflectScale
      : SHIELD.enemyReflectScale;

    this.damage *= damageMultiplier;
    this.setScale(this.scaleX * scaleMultiplier, this.scaleY * scaleMultiplier);
    this.team = reflection.team;
    this.ownerId = reflection.ownerId;
    this.reflectionCount += 1;

    const x = this.x + Math.cos(reflection.angle) * reflection.offset;
    const y = this.y + Math.sin(reflection.angle) * reflection.offset;

    this.body.reset(x, y);
    this.setRotation(reflection.angle);

    const velocity = new Phaser.Math.Vector2().setToPolar(
      reflection.angle,
      this.preset.speed,
    );
    this.setVelocity(velocity.x, velocity.y);

    this.setTint(COLORS.reflectedProjectile);
    this.lockReflection(reflection.lockMs);
  }

  lockReflection(durationMs: number): void {
    this.reflectLockRemaining = durationMs;
  }
}
