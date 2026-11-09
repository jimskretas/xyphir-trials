import Phaser from 'phaser';
import { SceneKeys } from '../config/sceneKeys';
import { DEBUG, VIEWPORT } from '../config/gameplayConfig';
import { UI_COLORS } from '../config/theme';
import { BossHealthBar } from '../ui/BossHealthBar';
import { DamageDebugPanel } from '../ui/DamageDebugPanel';
import { DebugOverlay } from '../ui/DebugOverlay';
import { PlayerHudPanel } from '../ui/PlayerHudPanel';
import { ResultOverlay } from '../ui/ResultOverlay';
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
  private damageDebugPanel: DamageDebugPanel | null = null;
  private resultOverlay!: ResultOverlay;

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
    this.damageDebugPanel = DEBUG.enabled
      ? new DamageDebugPanel(this)
      : null;
    this.resultOverlay = new ResultOverlay(this);
    this.resultOverlay.setHint(this.model.resultHint);

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
    this.resultOverlay.update(this.model.outcome, this.resultSubtitle());
  }

  private resultSubtitle(): string | undefined {
    if (this.model.outcome !== 'defeat') {
      return undefined;
    }

    return this.model.players.length > 1
      ? 'All players have fallen. The trials endure.'
      : 'You have fallen. The trials endure.';
  }

  private handleShutdown(): void {
    for (const panel of this.panels.values()) {
      panel.destroy();
    }

    this.panels.clear();
    this.bossBar.destroy();
    this.objectiveText.destroy();
    this.debugOverlay.destroy();
    this.damageDebugPanel?.destroy();
    this.damageDebugPanel = null;
    this.resultOverlay.destroy();
  }
}
