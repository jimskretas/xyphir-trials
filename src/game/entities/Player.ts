import Phaser from 'phaser';
import { PLAYER } from '../config/gameplayConfig';
import { AimComponent } from '../components/AimComponent';
import { MovementComponent } from '../components/MovementComponent';
import type { MovementInput } from '../components/MovementComponent';
import { TextureKeys } from '../resources/placeholderTextures';

export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  private readonly movement: MovementComponent;
  private readonly aim: AimComponent;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TextureKeys.Player);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const bodyOffset = this.width / 2 - PLAYER.radius;

    this.setCircle(PLAYER.radius, bodyOffset, bodyOffset);
    this.setDepth(10);

    this.movement = new MovementComponent(this, PLAYER.speed);
    this.aim = new AimComponent(this, PLAYER.turnSpeed);
  }

  update(
    input: MovementInput,
    aimTarget: Phaser.Math.Vector2 | null,
    deltaMs: number,
  ): void {
    this.movement.update(input);

    if (aimTarget) {
      this.aim.update(aimTarget, deltaMs / 1000);
    }
  }

  get movementDirection(): Phaser.Math.Vector2 {
    return this.movement.direction;
  }

  get facingDegrees(): number {
    return this.aim.facingDegrees;
  }
}
