import Phaser from 'phaser';
import { SceneKeys } from '../config/sceneKeys';
import { VIEWPORT } from '../config/gameplayConfig';
import { UI_COLORS } from '../config/theme';
import { BossHealthBar } from '../ui/BossHealthBar';
import { DebugOverlay } from '../ui/DebugOverlay';
import { PlayerHudPanel } from '../ui/PlayerHudPanel';
import type { HudModel } from '../ui/HudModel';

interface HudSceneData {
  model: HudModel;
}

export class HudScene extends Phaser.Scene {
  private model!: HudModel;
  private readonly panels = new Map<string, PlayerHudPanel>();
  private bossBar!: BossHealthBar;
  private objectiveText!: Phaser.GameObjects.Text;
  private debugOverlay!: DebugOverlay;

  constructor() {
    super(SceneKeys.Hud);
  }

  create(data: HudSceneData): void {
    this.model = data.model;

    this.objectiveText = this.add
      .text(VIEWPORT.width / 2, 20, '', {
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '15px',
        color: UI_COLORS.objectiveText,
      })
      .setOrigin(0.5, 0)
      .setDepth(1000);

    for (const state of this.model.players) {
      this.panels.set(
        state.id,
        new PlayerHudPanel(
          this,
          state,
          state.id === 'p1' ? 'left' : 'right',
        ),
      );
    }

    this.bossBar = new BossHealthBar(this);
    this.debugOverlay = new DebugOverlay(this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.scene.bringToTop();
  }

  update(): void {
    this.objectiveText.setText(this.model.objective);

    for (const state of this.model.players) {
      this.panels.get(state.id)?.update(state);
    }

    this.bossBar.update(this.model.boss);
    this.debugOverlay.update(this.model.debug);
  }

  private handleShutdown(): void {
    for (const panel of this.panels.values()) {
      panel.destroy();
    }

    this.panels.clear();
    this.bossBar.destroy();
    this.objectiveText.destroy();
    this.debugOverlay.destroy();
  }
}
