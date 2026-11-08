import Phaser from 'phaser';

export interface MovementInput {
  x: number;
  y: number;
}

export interface MovementHost {
  body: Phaser.Physics.Arcade.Body;
}

export class MovementComponent {
  readonly direction = new Phaser.Math.Vector2();

  constructor(
    private readonly host: MovementHost,
    private readonly speed: number,
  ) {}

  update(input: MovementInput): void {
    this.direction.set(input.x, input.y);

    if (this.direction.lengthSq() > 0) {
      this.direction.normalize();
    }

    this.host.body.setVelocity(
      this.direction.x * this.speed,
      this.direction.y * this.speed,
    );
  }

  stop(): void {
    this.direction.set(0, 0);
    this.host.body.setVelocity(0, 0);
  }
}
