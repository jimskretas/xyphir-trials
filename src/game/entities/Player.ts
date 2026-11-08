import Phaser from 'phaser';
import { PLAYER } from '../config/gameplayConfig';
import type { PlayerId } from '../config/controls';
import { FacingComponent } from '../components/FacingComponent';
import { MovementComponent } from '../components/MovementComponent';
import type { MovementInput } from '../components/MovementComponent';
import { TextureKeys } from '../resources/placeholderTextures';

const PLAYER_TEXTURES: Record<PlayerId, string> = {
  p1: TextureKeys.PlayerOne,
  p2: TextureKeys.PlayerTwo,
};

export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  readonly id: PlayerId;

  private readonly movement: MovementComponent;
  private readonly facing: FacingComponent;

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

  update(input: MovementInput): void {
    this.movement.update(input);
    this.facing.update(input);
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
}
