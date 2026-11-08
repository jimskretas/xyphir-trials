import Phaser from 'phaser';
import { PLAYER } from '../config/gameplayConfig';
import type { PlayerId } from '../config/controls';
import { FacingComponent } from '../components/FacingComponent';
import { HealthComponent } from '../components/HealthComponent';
import { MovementComponent } from '../components/MovementComponent';
import type { MovementInput } from '../components/MovementComponent';
import { TextureKeys } from '../resources/placeholderTextures';

const PLAYER_TEXTURES: Record<PlayerId, string> = {
  p1: TextureKeys.PlayerOne,
  p2: TextureKeys.PlayerTwo,
};

const DOWNED_TINT = 0x64748b;

export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  readonly id: PlayerId;
  readonly health = new HealthComponent(
    PLAYER.maxHealth,
    PLAYER.invulnerabilityMs,
  );

  private readonly movement: MovementComponent;
  private readonly facing: FacingComponent;
  private flashTimer: Phaser.Time.TimerEvent | null = null;

  constructor(
    scene: Phaser.Scene,
    id: PlayerId,
    x: number,
    y: number,
    facingRadians = 0,
  ) {
    super(scene, x, y, PLAYER_TEXTURES[id]);

    this.id = id;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const bodyOffset = this.width / 2 - PLAYER.radius;

    this.setCircle(PLAYER.radius, bodyOffset, bodyOffset);
    this.setDepth(10);

    this.movement = new MovementComponent(this, PLAYER.speed);
    this.facing = new FacingComponent(this, facingRadians);
  }

  update(input: MovementInput, deltaMs: number): void {
    this.health.update(deltaMs);

    if (!this.health.isAlive) {
      this.movement.stop();
      return;
    }

    this.movement.update(input);
    this.facing.update(input);
  }

  takeDamage(amount: number): boolean {
    const applied = this.health.damage(amount);

    if (applied <= 0) {
      return false;
    }

    this.flashDamage();

    if (!this.health.isAlive) {
      this.enterDownedState();
    }

    return true;
  }

  get isAlive(): boolean {
    return this.health.isAlive;
  }

  get movementDirection(): Phaser.Math.Vector2 {
    return this.movement.direction;
  }

  get facingVector(): Phaser.Math.Vector2 {
    return this.facing.direction;
  }

  get facingDegrees(): number {
    return this.facing.facingDegrees;
  }

  override destroy(fromScene?: boolean): void {
    this.flashTimer?.remove();
    this.flashTimer = null;
    super.destroy(fromScene);
  }

  private flashDamage(): void {
    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);

    this.flashTimer?.remove();
    this.flashTimer = this.scene.time.delayedCall(
      PLAYER.damageFlashMs,
      () => {
        this.flashTimer = null;

        if (this.health.isAlive) {
          this.clearTint();
        } else {
          this.setTint(DOWNED_TINT).setTintMode(Phaser.TintModes.MULTIPLY);
        }
      },
    );
  }

  private enterDownedState(): void {
    this.movement.stop();
    this.setAlpha(0.4);
    this.setTint(DOWNED_TINT).setTintMode(Phaser.TintModes.MULTIPLY);
  }
}
