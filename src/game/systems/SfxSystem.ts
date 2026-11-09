const MASTER_VOLUME = 0.5;

export type SfxName =
  | 'start'
  | 'fireball'
  | 'shield'
  | 'reflect'
  | 'playerHit'
  | 'enemyHit'
  | 'enemyDeath'
  | 'bossSpawn'
  | 'victory'
  | 'defeat';

type OscillatorShape = OscillatorType;

class SfxSystem {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;

  async unlock(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = MASTER_VOLUME;
      this.master.connect(this.context.destination);
    }

    if (this.context.state === 'suspended') {
      await this.context.resume().catch(() => undefined);
    }
  }

  play(name: SfxName): void {
    const context = this.context;
    const master = this.master;

    if (!context || !master || context.state !== 'running') {
      return;
    }

    switch (name) {
      case 'start':
        this.tone(context, master, 392, 392, 0.14, 'sine', 0.16, 0);
        this.tone(context, master, 523.25, 523.25, 0.2, 'sine', 0.16, 0.12);
        break;
      case 'fireball':
        this.tone(context, master, 540, 220, 0.14, 'triangle', 0.16);
        break;
      case 'shield':
        this.tone(context, master, 320, 680, 0.16, 'sine', 0.14);
        break;
      case 'reflect':
        this.tone(context, master, 1100, 1800, 0.1, 'triangle', 0.18);
        this.noise(context, master, 0.05, 0.08, 4200);
        break;
      case 'playerHit':
        this.tone(context, master, 180, 70, 0.22, 'square', 0.16);
        this.noise(context, master, 0.1, 0.1, 900);
        break;
      case 'enemyHit':
        this.noise(context, master, 0.06, 0.12, 1800);
        break;
      case 'enemyDeath':
        this.tone(context, master, 280, 70, 0.28, 'sawtooth', 0.14);
        this.noise(context, master, 0.2, 0.12, 700);
        break;
      case 'bossSpawn':
        this.tone(context, master, 70, 38, 0.9, 'sine', 0.22);
        this.tone(context, master, 140, 55, 0.7, 'sawtooth', 0.06);
        break;
      case 'victory':
        this.arpeggio(
          context,
          master,
          [523.25, 659.25, 783.99, 1046.5],
          0.12,
        );
        break;
      case 'defeat':
        this.arpeggio(context, master, [330, 262, 196, 131], 0.16, 0.32);
        break;
    }
  }

  private arpeggio(
    context: AudioContext,
    master: GainNode,
    notes: readonly number[],
    spacing: number,
    noteDuration = 0.24,
  ): void {
    notes.forEach((note, index) => {
      this.tone(
        context,
        master,
        note,
        note,
        noteDuration,
        'sine',
        0.14,
        index * spacing,
      );
    });
  }

  private tone(
    context: AudioContext,
    master: GainNode,
    fromHz: number,
    toHz: number,
    duration: number,
    shape: OscillatorShape,
    volume: number,
    delay = 0,
  ): void {
    const start = context.currentTime + delay;
    const end = start + duration;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = shape;
    oscillator.frequency.setValueAtTime(fromHz, start);

    if (fromHz !== toHz) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(1, toHz),
        end,
      );
    }

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain).connect(master);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
    oscillator.onended = () => gain.disconnect();
  }

  private noise(
    context: AudioContext,
    master: GainNode,
    duration: number,
    volume: number,
    cutoffHz: number,
  ): void {
    const frames = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < frames; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / frames);
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();

    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = cutoffHz;
    gain.gain.value = volume;

    source.connect(filter).connect(gain).connect(master);
    source.start();
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
}

export const sfx = new SfxSystem();
