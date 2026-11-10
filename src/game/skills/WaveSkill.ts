import Phaser from 'phaser';
import type { PlayerId } from '../config/controls';
import type { WaveSkillDefinition } from '../config/skills';
import { COLORS } from '../config/theme';
import type { Player } from '../entities/Player';
import type { ProjectileSpawn } from '../types/combat';
import {
  Skill,
  type SkillCastContext,
  type SkillModifiers,
  type SkillUpdateContext,
} from './Skill';

const WAVE_COLORS: Record<PlayerId, number> = {
  p1: COLORS.playerOne,
  p2: COLORS.playerTwo,
};

export interface WaveRenderState {
  ownerId: PlayerId;
  x: number;
  y: number;
  radius: number;
  alpha: number;
}

export class WaveSkill extends Skill {
  private caster: Player | null = null;
  private aura: Phaser.GameObjects.Graphics | null = null;
  private remainingMs = 0;
  private elapsedMs = 0;
  private tickTimerMs = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly waveDefinition: WaveSkillDefinition,
    private readonly onTick: (hits: number, kills: number) => void = () =>
      undefined,
    modifierOverrides: Partial<SkillModifiers> = {},
  ) {
    super(waveDefinition, modifierOverrides);
  }

  override update(
    deltaMs: number,
    context: SkillUpdateContext,
  ): ProjectileSpawn[] {
    super.update(deltaMs, context);

    const caster = this.caster;

    if (!caster || !this.aura) {
      return [];
    }

    if (!caster.isAlive) {
      this.end();
      return [];
    }

    this.remainingMs = Math.max(0, this.remainingMs - deltaMs);
    this.elapsedMs += deltaMs;
    this.tickTimerMs += deltaMs;

    const intervalMs = 1000 / this.waveDefinition.ticksPerSecond;
    const radius = this.radius;
    let hits = 0;
    let kills = 0;

    while (this.tickTimerMs >= intervalMs) {
      this.tickTimerMs -= intervalMs;

      for (const enemy of context.enemies) {
        if (!enemy.isAlive || !enemy.active) {
          continue;
        }

        const distance = Phaser.Math.Distance.Between(
          caster.x,
          caster.y,
          enemy.x,
          enemy.y,
        );

        if (distance > radius + enemy.body.halfWidth) {
          continue;
        }

        const applied = enemy.takeDamage(
          this.waveDefinition.damagePerTick * this.modifiers.damage,
        );

        if (applied) {
          hits += 1;

          if (!enemy.isAlive) {
            kills += 1;
          }
        }
      }
    }

    if (hits > 0) {
      this.onTick(hits, kills);
    }

    this.drawAura(caster.x, caster.y);

    if (this.remainingMs <= 0) {
      this.end();
    }

    return [];
  }

  override get isActive(): boolean {
    return this.aura !== null;
  }

  override get activeRatio(): number {
    const durationMs = this.waveDefinition.durationMs * this.modifiers.duration;
    return durationMs > 0 ? this.remainingMs / durationMs : 0;
  }

  get renderState(): WaveRenderState | null {
    const caster = this.caster;

    if (!caster || !this.aura) {
      return null;
    }

    return {
      ownerId: caster.id,
      x: caster.x,
      y: caster.y,
      radius: this.radius,
      alpha: this.pulseAlpha,
    };
  }

  protected override cast(context: SkillCastContext): void {
    this.end();

    this.caster = context.player;
    this.remainingMs =
      this.waveDefinition.durationMs * this.modifiers.duration;
    this.elapsedMs = 0;
    this.tickTimerMs = 0;
    this.aura = this.scene.add.graphics().setDepth(6);
    this.drawAura(context.player.x, context.player.y);
  }

  private get radius(): number {
    return this.waveDefinition.radius * this.modifiers.range;
  }

  private get pulseAlpha(): number {
    return 0.4 + 0.3 * Math.sin(this.elapsedMs / 120);
  }

  private drawAura(x: number, y: number): void {
    const aura = this.aura;
    const caster = this.caster;

    if (!aura || !caster) {
      return;
    }

    const color = WAVE_COLORS[caster.id];
    const radius = this.radius;
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsedMs / 120);

    aura.clear();
    aura.fillStyle(color, 0.07 + pulse * 0.06);
    aura.fillCircle(x, y, radius);
    aura.lineStyle(2, color, 0.45 + pulse * 0.3);
    aura.strokeCircle(x, y, radius);
    aura.lineStyle(1, color, 0.3);
    aura.strokeCircle(x, y, radius * 0.62);
  }

  private end(): void {
    this.aura?.destroy();
    this.aura = null;
    this.caster = null;
    this.remainingMs = 0;
  }
}
