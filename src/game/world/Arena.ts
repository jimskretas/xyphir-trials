import Phaser from 'phaser';
import { ARENA } from '../config/gameplayConfig';
import { COLORS } from '../config/theme';

type PhysicsRectangle = Phaser.GameObjects.Rectangle & {
  body: Phaser.Physics.Arcade.StaticBody;
};

export class Arena {
  readonly bounds = new Phaser.Geom.Rectangle(0, 0, ARENA.width, ARENA.height);
  readonly walls: Phaser.Physics.Arcade.StaticGroup;

  private readonly floor: Phaser.GameObjects.Rectangle;
  private readonly grid: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene) {
    this.floor = scene.add
      .rectangle(
        ARENA.width / 2,
        ARENA.height / 2,
        ARENA.width,
        ARENA.height,
        COLORS.floor,
      )
      .setDepth(0);

    this.grid = this.createGrid();
    this.walls = this.createWalls();
  }

  destroy(): void {
    this.walls.destroy(true);
    this.floor.destroy();
    this.grid.destroy();
  }

  private createGrid(): Phaser.GameObjects.Graphics {
    const grid = this.scene.add.graphics().setDepth(1);

    grid.lineStyle(1, COLORS.grid, 0.75);

    for (let x = ARENA.gridSize; x < ARENA.width; x += ARENA.gridSize) {
      grid.lineBetween(x, 0, x, ARENA.height);
    }

    for (let y = ARENA.gridSize; y < ARENA.height; y += ARENA.gridSize) {
      grid.lineBetween(0, y, ARENA.width, y);
    }

    grid.lineStyle(2, COLORS.arenaMark, 0.8);
    grid.strokeCircle(ARENA.width / 2, ARENA.height / 2, 90);

    return grid;
  }

  private createWalls(): Phaser.Physics.Arcade.StaticGroup {
    const walls = this.scene.physics.add.staticGroup();
    const thickness = ARENA.wallThickness;
    const halfThickness = thickness / 2;

    const segments = [
      { x: ARENA.width / 2, y: halfThickness, width: ARENA.width, height: thickness },
      {
        x: ARENA.width / 2,
        y: ARENA.height - halfThickness,
        width: ARENA.width,
        height: thickness,
      },
      {
        x: halfThickness,
        y: ARENA.height / 2,
        width: thickness,
        height: ARENA.height - thickness * 2,
      },
      {
        x: ARENA.width - halfThickness,
        y: ARENA.height / 2,
        width: thickness,
        height: ARENA.height - thickness * 2,
      },
    ];

    for (const segment of segments) {
      const wall = this.scene.add
        .rectangle(segment.x, segment.y, segment.width, segment.height, COLORS.wall)
        .setStrokeStyle(2, COLORS.wallEdge)
        .setDepth(2) as PhysicsRectangle;

      walls.add(wall);
      wall.body.updateFromGameObject();
    }

    return walls;
  }
}
