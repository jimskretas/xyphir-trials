export class Cooldown {
  private remainingMs = 0;

  constructor(readonly durationMs: number) {}

  get isReady(): boolean {
    return this.remainingMs <= 0;
  }

  get remaining(): number {
    return this.remainingMs;
  }

  get readyRatio(): number {
    if (this.durationMs <= 0) {
      return 1;
    }

    return 1 - this.remainingMs / this.durationMs;
  }

  update(deltaMs: number): void {
    this.remainingMs = Math.max(0, this.remainingMs - deltaMs);
  }

  tryUse(): boolean {
    if (!this.isReady) {
      return false;
    }

    this.remainingMs = this.durationMs;
    return true;
  }

  reset(): void {
    this.remainingMs = 0;
  }
}
