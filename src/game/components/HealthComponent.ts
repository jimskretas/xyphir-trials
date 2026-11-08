export class HealthComponent {
  private currentHealth: number;
  private invulnerabilityRemaining = 0;
  private dead = false;

  constructor(
    readonly maxHealth: number,
    private readonly invulnerabilityMs = 0,
  ) {
    this.currentHealth = maxHealth;
  }

  get current(): number {
    return this.currentHealth;
  }

  get ratio(): number {
    return this.maxHealth > 0 ? this.currentHealth / this.maxHealth : 0;
  }

  get isAlive(): boolean {
    return !this.dead;
  }

  get isInvulnerable(): boolean {
    return this.invulnerabilityRemaining > 0;
  }

  update(deltaMs: number): void {
    if (this.invulnerabilityRemaining <= 0) {
      return;
    }

    this.invulnerabilityRemaining = Math.max(
      0,
      this.invulnerabilityRemaining - deltaMs,
    );
  }

  damage(amount: number): number {
    if (!this.isAlive || amount <= 0 || this.isInvulnerable) {
      return 0;
    }

    const applied = Math.min(amount, this.currentHealth);
    this.currentHealth -= applied;

    if (this.currentHealth <= 0) {
      this.currentHealth = 0;
      this.dead = true;
    } else {
      this.invulnerabilityRemaining = this.invulnerabilityMs;
    }

    return applied;
  }

  reset(): void {
    this.currentHealth = this.maxHealth;
    this.invulnerabilityRemaining = 0;
    this.dead = false;
  }
}
