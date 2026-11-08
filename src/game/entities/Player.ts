import Phaser from 'phaser';
import { FIREBALL, SHIELD } from '../config/combatConfig';
import { PLAYER } from '../config/gameplayConfig';
import type { PlayerId } from '../config/controls';
import { COLORS } from '../config/theme';
import { FireballAbility } from '../abilities/FireballAbility';
import { FacingComponent } from '../components/FacingComponent';
import { HealthComponent } from '../components/HealthComponent';
import { MovementComponent } from '../components/MovementComponent';
import type { MovementInput } from '../components/MovementComponent';
import { ShieldComponent } from '../components/ShieldComponent';
import { TextureKeys } from '../resources/textureKeys';
import type { ProjectileSpawn } from '../types/combat';

const PLAYER_TEXTURES: Record<PlayerId, string> = {
  p1: TextureKeys.PlayerOne,
  p2: TextureKeys.PlayerTwo,
};

const PLAYER_COLORS: Record<PlayerId, number> = {
  p1: COLORS.playerOne,
  p2: COLORS.playerTwo,
};

const DOWNED_TINT = 0x64748b;

export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  readonly id: PlayerId;
  readonly health = new HealthComponent(
    PLAYER.maxHealth,
    PLAYER.invulnerabilityMs,
  );
  readonly fireball = new FireballAbility();
  readonly shield = new ShieldComponent(
    SHIELD.durationMs,
    SHIELD.cooldownMs,
    Phaser.Math.DegToRad(SHIELD.arcDegrees),
  );

  private readonly movement: MovementComponent;
  private readonly facing: FacingComponent;
  private readonly shieldColor: number;
  private readonly shieldGraphic: Phaser.GameObjects.Graphics;
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
    this.shieldColor = PLAYER_COLORS[id];

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const bodyOffset = this.width / 2 - PLAYER.radius;

    this.setCircle(PLAYER.radius, bodyOffset, bodyOffset);
    this.setDepth(10);

    this.movement = new MovementComponent(this, PLAYER.speed);
    this.facing = new FacingComponent(this, facingRadians);
    this.shieldGraphic = scene.add.graphics().setDepth(11);
  }

  update(input: MovementInput, deltaMs: number): void {
    this.fireball.update(deltaMs);
    this.health.update(deltaMs);
    this.shield.update(deltaMs);

    if (!this.health.isAlive) {
      this.movement.stop();
      this.shield.cancel();
      this.drawShield();
      return;
    }

    this.movement.update(input);
    this.facing.update(input);
    this.drawShield();
  }

  tryFire(): ProjectileSpawn | null {
    if (!this.health.isAlive || !this.fireball.tryUse()) {
      return null;
    }

    const facing = this.facing.direction;

    return {
      x: this.x + facing.x * FIREBALL.spawnOffset,
      y: this.y + facing.y * FIREBALL.spawnOffset,
      angle: facing.angle(),
      team: 'players',
      ownerId: this.id,
      sourceId: this.id,
      preset: FIREBALL.projectile,
    };
  }

  tryShield(): boolean {
    if (!this.health.isAlive || !this.shield.tryActivate()) {
      return false;
    }

    this.drawShield();
    return true;
  }

  flashShield(): void {
    this.shield.flash(SHIELD.flashMs);
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
    this.shieldGraphic.destroy();
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

  private drawShield(): void {
    this.shieldGraphic.clear();

    if (!this.shield.isActive) {
      return;
    }

    const angle = this.facingVector.angle();
    const halfArc = this.shield.arcRadians / 2;
    const startAngle = angle - halfArc;
    const endAngle = angle + halfArc;
    const radius = SHIELD.visualRadius;
    const flashing = this.shield.isFlashing;

    this.shieldGraphic.fillStyle(this.shieldColor, flashing ? 0.28 : 0.12);
    this.shieldGraphic.beginPath();
    this.shieldGraphic.arc(
      this.x,
      this.y,
      radius,
      startAngle,
      endAngle,
      false,
    );
    this.shieldGraphic.lineTo(this.x, this.y);
    this.shieldGraphic.closePath();
    this.shieldGraphic.fillPath();

    this.shieldGraphic.lineStyle(
      flashing ? 6 : 4,
      flashing ? 0xffffff : this.shieldColor,
      flashing ? 1 : 0.85,
    );
    this.shieldGraphic.beginPath();
    this.shieldGraphic.arc(
      this.x,
      this.y,
      radius,
      startAngle,
      endAngle,
      false,
    );
    this.shieldGraphic.strokePath();
  }
}
