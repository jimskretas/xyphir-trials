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
    this.setDirection(input.x, input.y);
  }

  setDirection(x: number, y: number): void {
    if (x === 0 && y === 0) {
      return;
    }

    this.direction.set(x, y).normalize();
    this.host.rotation = this.direction.angle();
  }

  get facingDegrees(): number {
    return Phaser.Math.RadToDeg(this.direction.angle());
  }
}
