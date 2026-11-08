import Phaser from 'phaser';
import type { MovementInput } from './MovementComponent';

export interface FacingHost {
  rotation: number;
}

export class FacingComponent {
  readonly direction: Phaser.Math.Vector2;

  constructor(
    private readonly host: FacingHost,
    initialRadians = 0,
  ) {
    this.direction = new Phaser.Math.Vector2().setToPolar(initialRadians, 1);
    this.host.rotation = initialRadians;
  }

  update(input: MovementInput): void {
    if (input.x === 0 && input.y === 0) {
      return;
    }

    this.direction.set(input.x, input.y).normalize();
    this.host.rotation = this.direction.angle();
  }

  get facingDegrees(): number {
    return Phaser.Math.RadToDeg(this.direction.angle());
  }
}
