import Phaser from 'phaser';

export interface AimHost {
  x: number;
  y: number;
  rotation: number;
}

export class AimComponent {
  constructor(
    private readonly host: AimHost,
    private readonly turnSpeed: number,
  ) {}

  update(target: Phaser.Math.Vector2, deltaSeconds: number): void {
    const targetAngle = Phaser.Math.Angle.Between(
      this.host.x,
      this.host.y,
      target.x,
      target.y,
    );

    this.host.rotation = Phaser.Math.Angle.RotateTo(
      this.host.rotation,
      targetAngle,
      this.turnSpeed * deltaSeconds,
    );
  }

  get facingDegrees(): number {
    return Phaser.Math.RadToDeg(Phaser.Math.Angle.Normalize(this.host.rotation));
  }
}
