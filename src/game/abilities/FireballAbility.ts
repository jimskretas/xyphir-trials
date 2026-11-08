import { FIREBALL } from '../config/combatConfig';
import { Cooldown } from '../components/Cooldown';

export class FireballAbility {
  readonly cooldown = new Cooldown(FIREBALL.cooldownMs);

  update(deltaMs: number): void {
    this.cooldown.update(deltaMs);
  }

  tryUse(): boolean {
    return this.cooldown.tryUse();
  }
}
