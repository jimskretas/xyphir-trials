import Phaser from 'phaser';
import { CAMERA, VIEWPORT } from '../config/gameplayConfig';
import { COLORS, toCssColor } from '../config/theme';

export interface CameraFocus {
  x: number;
  y: number;
}

export class CoopCamera {
  private readonly target: Phaser.GameObjects.Zone;
  private readonly midpoint = new Phaser.Math.Vector2();

  constructor(
    scene: Phaser.Scene,
    private readonly camera: Phaser.Cameras.Scene2D.Camera,
    bounds: Phaser.Geom.Rectangle,
  ) {
    this.target = scene.add.zone(bounds.centerX, bounds.centerY, 1, 1);

    camera.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
    camera.setBackgroundColor(toCssColor(COLORS.background));
    camera.startFollow(
      this.target,
      false,
      CAMERA.followLerp,
      CAMERA.followLerp,
    );
  }

  update(players: readonly CameraFocus[]): void {
    if (players.length === 0) {
      return;
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const player of players) {
      minX = Math.min(minX, player.x);
      minY = Math.min(minY, player.y);
      maxX = Math.max(maxX, player.x);
      maxY = Math.max(maxY, player.y);
    }

    this.midpoint.set((minX + maxX) / 2, (minY + maxY) / 2);
    this.target.setPosition(this.midpoint.x, this.midpoint.y);

    const spanX = maxX - minX + CAMERA.padding * 2;
    const spanY = maxY - minY + CAMERA.padding * 2;
    const desiredZoom = Phaser.Math.Clamp(
      Math.min(VIEWPORT.width / spanX, VIEWPORT.height / spanY),
      CAMERA.minZoom,
      1,
    );

    this.camera.setZoom(
      Phaser.Math.Linear(this.camera.zoom, desiredZoom, CAMERA.zoomLerp),
    );
  }

  destroy(): void {
    this.target.destroy();
  }
}
