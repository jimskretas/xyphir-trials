import Phaser from 'phaser';
import { VIEWPORT } from '../config/gameplayConfig';
import { SceneKeys } from '../config/sceneKeys';
import { COLORS, UI_COLORS, toCssColor } from '../config/theme';
import {
  isDevelopment,
  isMultiplayerConfigured,
  shouldUseLocalTransport,
} from '../../net/config';
import { createGuestRoom, createHostRoom } from '../../net/createRoom';
import type { RoomSession } from '../../net/RoomSession';
import {
  getRoomSession,
} from '../../net/session';
import { isValidRoomCode, normalizeRoomCode } from '../../net/roomCode';
import { sfx } from '../systems/SfxSystem';

const MONO = 'Consolas, "Courier New", monospace';

type LobbyState =
  | 'menu'
  | 'hosting'
  | 'joining'
  | 'connecting'
  | 'waiting';

interface LobbySceneData {
  notice?: string;
}

export class LobbyScene extends Phaser.Scene {
  private state: LobbyState = 'menu';
  private session: RoomSession | null = null;
  private hostCode = '';
  private joinInput = '';
  private notice = '';
  private connectingCode = '';
  private content: Phaser.GameObjects.Container | null = null;
  private keepSession = false;

  constructor() {
    super(SceneKeys.Lobby);
  }

  create(data: LobbySceneData = {}): void {
    this.notice = data.notice ?? '';
    this.keepSession = false;
    this.state = 'menu';
    this.joinInput = '';
    this.connectingCode = '';

    this.drawBackground();

    const existing = getRoomSession();

    if (existing && existing.role === 'host') {
      this.session = existing;
      this.hostCode = existing.code;
      existing.resetForLobby();
      this.wireHost(existing);
      this.state = 'hosting';
      this.renderHosting();
    } else {
      this.session = null;
      this.renderMenu();
    }

    this.input.keyboard?.on('keydown', this.handleKey, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  private handleKey(event: KeyboardEvent): void {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    void sfx.unlock().catch(() => undefined);

    const key = event.key;

    switch (this.state) {
      case 'menu':
        if (key === 'c' || key === 'C') {
          this.openHostRoom();
        } else if (key === 'j' || key === 'J') {
          this.state = 'joining';
          this.joinInput = '';
          this.notice = '';
          this.renderJoin();
        } else if (key === 's' || key === 'S') {
          this.startSolo();
        }
        break;
      case 'hosting':
        if (key === 's' || key === 'S') {
          this.startHostRun();
        } else if (key === 'Escape') {
          this.cancelSession('Room closed.');
        }
        break;
      case 'joining':
        if (key === 'Escape') {
          this.state = 'menu';
          this.notice = '';
          this.renderMenu();
        } else if (key === 'Enter') {
          void this.joinRoom();
        } else if (key === 'Backspace') {
          this.joinInput = this.joinInput.slice(0, -1);
          this.renderJoin();
        } else if (/^[a-zA-Z0-9]$/.test(key) && this.joinInput.length < 5) {
          this.joinInput += key.toUpperCase();
          this.renderJoin();
        }
        break;
      case 'connecting':
      case 'waiting':
        if (key === 'Escape') {
          this.cancelSession('Left the room.');
        }
        break;
    }
  }

  private openHostRoom(): void {
    if (!isMultiplayerConfigured()) {
      this.notice =
        'Multiplayer is not configured in this build. You can still start solo.';
      this.state = 'menu';
      this.renderMenu();
      return;
    }

    try {
      const room = createHostRoom();

      this.session = room.session;
      this.hostCode = room.code;
      this.state = 'hosting';
      this.notice = '';
      this.wireHost(room.session);
      this.renderHosting();
      document.title = `Xyphir Trials · Room ${room.code}`;

      void room.session.connect().catch((error: unknown) => {
        this.cancelSession(this.errorMessage(error));
      });
    } catch (error: unknown) {
      this.notice = this.errorMessage(error);
      this.state = 'menu';
      this.renderMenu();
    }
  }

  private async joinRoom(): Promise<void> {
    const code = normalizeRoomCode(this.joinInput);

    if (!isValidRoomCode(code)) {
      this.notice = 'Enter the 5-character room code.';
      this.renderJoin();
      return;
    }

    if (!isMultiplayerConfigured()) {
      this.notice = 'Multiplayer is not configured in this build.';
      this.renderJoin();
      return;
    }

    this.connectingCode = code;
    this.state = 'connecting';
    this.notice = '';
    this.renderConnecting();

    try {
      const room = createGuestRoom(code);

      this.session = room.session;
      this.wireGuest(room.session);
      document.title = `Xyphir Trials · Joining ${code}`;

      await room.session.connect();

      if (this.session !== room.session) {
        return;
      }

      this.state = 'waiting';
      this.renderWaiting();
    } catch (error: unknown) {
      if (this.session) {
        this.session.detachCallbacks();
        await this.session.leave().catch(() => undefined);
        this.session = null;
      }
      this.state = 'joining';
      this.notice = this.errorMessage(error);
      this.renderJoin();
    }
  }

  private startHostRun(): void {
    const session = this.session;

    if (!session) {
      return;
    }

    if (session.hasGuest) {
      session.startRun();
      this.keepSession = true;
      this.scene.start(SceneKeys.Arena, {
        mode: 'host',
        runId: session.runId,
      });
      return;
    }

    void session.leave().catch(() => undefined);
    this.session = null;
    this.scene.start(SceneKeys.Arena, { mode: 'solo', runId: 0 });
  }

  private startSolo(): void {
    this.notice = '';
    this.scene.start(SceneKeys.Arena, { mode: 'solo', runId: 0 });
  }

  private cancelSession(message: string): void {
    const session = this.session;

    this.session = null;
    this.keepSession = false;
    this.state = 'menu';
    this.notice = message;
    document.title = 'Xyphir Trials';

    if (session) {
      session.detachCallbacks();
      void session.leave().catch(() => undefined);
    }

    this.renderMenu();
  }

  private wireHost(session: RoomSession): void {
    session.onGuestJoined = () => {
      if (this.state === 'hosting') {
        this.notice = '';
        this.renderHosting();
      }
    };

    session.onGuestLeft = () => {
      if (this.state === 'hosting') {
        this.notice = 'Your partner left the room.';
        this.renderHosting();
      }
    };
  }

  private wireGuest(session: RoomSession): void {
    session.onConnected = () => {
      if (this.session !== session) {
        return;
      }

      this.state = 'waiting';
      this.notice = '';
      this.renderWaiting();
    };

    session.onRejected = (reason) => {
      if (this.session !== session) {
        return;
      }

      this.session = null;
      session.detachCallbacks();
      void session.leave().catch(() => undefined);
      this.state = 'joining';
      this.notice =
        reason === 'full'
          ? 'That room already has a player, or the run has started.'
          : 'No host answered. Check the code and try again.';
      document.title = 'Xyphir Trials';
      this.renderJoin();
    };

    session.onStart = (runId) => {
      this.keepSession = true;
      this.scene.start(SceneKeys.GuestArena, { runId });
    };

    session.onHostLeft = () => {
      this.session = null;
      session.detachCallbacks();
      void session.leave().catch(() => undefined);
      this.state = 'menu';
      this.notice = 'The host left the room.';
      document.title = 'Xyphir Trials';
      this.renderMenu();
    };
  }

  private handleShutdown(): void {
    this.input.keyboard?.off('keydown', this.handleKey, this);

    if (this.session && !this.keepSession) {
      this.session.detachCallbacks();
      void this.session.leave().catch(() => undefined);
      this.session = null;
    }

    this.content?.destroy(true);
    this.content = null;
  }

  private beginContent(): Phaser.GameObjects.Container {
    this.content?.destroy(true);
    this.content = this.add.container(0, 0);
    return this.content;
  }

  private addText(
    x: number,
    y: number,
    value: string,
    size: number,
    color: string,
    originX = 0.5,
  ): Phaser.GameObjects.Text {
    const text = this.add
      .text(x, y, value, {
        fontFamily: MONO,
        fontSize: `${size}px`,
        color,
        align: 'center',
      })
      .setOrigin(originX, 0);

    this.content?.add(text);
    return text;
  }

  private addCard(
    x: number,
    y: number,
    width: number,
    height: number,
    edge: number,
  ): void {
    const graphics = this.add.graphics();

    graphics.fillStyle(0x0b111a, 0.94);
    graphics.fillRoundedRect(x, y, width, height, 10);
    graphics.lineStyle(2, edge, 0.75);
    graphics.strokeRoundedRect(x, y, width, height, 10);
    this.content?.add(graphics);
  }

  private renderMenu(): void {
    this.state = 'menu';
    this.beginContent();
    this.drawHeader('ONLINE CO-OP TRIALS', 'Create a room or join a friend.');

    const cardWidth = 280;
    const cardHeight = 170;
    const gap = 28;
    const total = cardWidth * 3 + gap * 2;
    const startX = (VIEWPORT.width - total) / 2;
    const y = 300;

    const options = [
      { key: 'C', title: 'CREATE GAME', body: 'Open a room and share\nthe 5-letter code.' },
      { key: 'J', title: 'JOIN GAME', body: 'Enter a friend\u2019s room\ncode to connect.' },
      { key: 'S', title: 'START SOLO', body: 'Begin a P1-only run\nright away.' },
    ];

    options.forEach((option, index) => {
      const x = startX + index * (cardWidth + gap);
      this.addCard(x, y, cardWidth, cardHeight, COLORS.playerOneGlow);
      this.addText(x + cardWidth / 2, y + 24, option.key, 34, UI_COLORS.startAccent);
      this.addText(
        x + cardWidth / 2,
        y + 70,
        option.title,
        17,
        UI_COLORS.startTitle,
      );
      this.addText(
        x + cardWidth / 2,
        y + 102,
        option.body,
        13,
        UI_COLORS.startBody,
      );
    });

    this.drawControlsPanel();
    this.drawNotice();
    this.drawFooter('C  CREATE      J  JOIN      S  SOLO');
  }

  private renderHosting(): void {
    this.state = 'hosting';
    this.beginContent();
    this.drawHeader('ROOM OPEN', 'Share this code with your partner.');

    const panelWidth = 560;
    const panelHeight = 250;
    const x = (VIEWPORT.width - panelWidth) / 2;
    const y = 290;

    this.addCard(x, y, panelWidth, panelHeight, COLORS.playerTwoGlow);

    const code = this.hostCode.split('').join('  ');
    this.addText(
      VIEWPORT.width / 2,
      y + 38,
      code,
      56,
      toCssColor(COLORS.playerTwo),
    );

    const hasGuest = this.session?.hasGuest ?? false;
    const status = hasGuest
      ? 'Player 2 connected. Ready when you are.'
      : 'Waiting for a second player\u2026';

    this.addText(
      VIEWPORT.width / 2,
      y + 132,
      status,
      17,
      hasGuest ? '#4ade80' : UI_COLORS.startBody,
    );

    this.addText(
      VIEWPORT.width / 2,
      y + 168,
      hasGuest
        ? 'Press S to begin the run with your partner.'
        : 'Press S to start alone. The room will close.',
      14,
      UI_COLORS.startMuted,
    );

    this.addText(
      VIEWPORT.width / 2,
      y + 200,
      'Keep this tab open. The host simulates the run.',
      12,
      UI_COLORS.startMuted,
    );

    this.drawNotice();
    this.drawFooter('S  START      ESC  CLOSE ROOM');
  }

  private renderJoin(): void {
    this.state = 'joining';
    this.beginContent();
    this.drawHeader('JOIN A ROOM', 'Type the host\u2019s 5-letter code.');

    const panelWidth = 520;
    const panelHeight = 210;
    const x = (VIEWPORT.width - panelWidth) / 2;
    const y = 300;

    this.addCard(x, y, panelWidth, panelHeight, COLORS.playerOneGlow);

    const padded = this.joinInput.padEnd(5, '_').split('').join('  ');
    this.addText(
      VIEWPORT.width / 2,
      y + 34,
      padded,
      50,
      toCssColor(COLORS.playerOne),
    );

    this.addText(
      VIEWPORT.width / 2,
      y + 118,
      this.joinInput.length === 5
        ? 'Press ENTER to connect.'
        : `${5 - this.joinInput.length} character(s) remaining.`,
      15,
      UI_COLORS.startBody,
    );

    this.addText(
      VIEWPORT.width / 2,
      y + 152,
      'Letters and numbers only. Codes never contain I, O, 0 or 1.',
      12,
      UI_COLORS.startMuted,
    );

    this.drawNotice();
    this.drawFooter('TYPE CODE      ENTER  CONNECT      ESC  BACK');
  }

  private renderConnecting(): void {
    this.beginContent();
    this.drawHeader('CONNECTING', `Room ${this.connectingCode}`);

    this.addText(
      VIEWPORT.width / 2,
      330,
      'Waiting for the host to answer\u2026',
      18,
      UI_COLORS.startBody,
    );
    this.addText(
      VIEWPORT.width / 2,
      368,
      'Make sure the host has the room open and the code is correct.',
      13,
      UI_COLORS.startMuted,
    );
    this.drawNotice();
    this.drawFooter('ESC  CANCEL');
  }

  private renderWaiting(): void {
    this.beginContent();
    this.drawHeader('CONNECTED', `Room ${this.connectingCode}`);

    const panelWidth = 560;
    const panelHeight = 170;
    const x = (VIEWPORT.width - panelWidth) / 2;
    const y = 300;

    this.addCard(x, y, panelWidth, panelHeight, COLORS.playerTwoGlow);
    this.addText(
      VIEWPORT.width / 2,
      y + 38,
      'You are Player 2',
      22,
      toCssColor(COLORS.playerTwo),
    );
    this.addText(
      VIEWPORT.width / 2,
      y + 84,
      'Waiting for the host to start the run\u2026',
      16,
      UI_COLORS.startBody,
    );
    this.addText(
      VIEWPORT.width / 2,
      y + 120,
      'Both players move with the arrow keys, C / Q to fight, Space to dash, W / E / R for skills and 1 for auto-fire.',
      12,
      UI_COLORS.startMuted,
    );

    this.drawNotice();
    this.drawFooter('ESC  LEAVE ROOM');
  }

  private drawHeader(title: string, subtitle: string): void {
    this.addText(VIEWPORT.width / 2, 70, 'XYPHIR TRIALS', 46, UI_COLORS.startTitle);
    this.addText(VIEWPORT.width / 2, 128, title, 20, UI_COLORS.startAccent);
    this.addText(VIEWPORT.width / 2, 160, subtitle, 15, UI_COLORS.startBody);
  }

  private drawControlsPanel(): void {
    const width = 820;
    const height = 94;
    const x = (VIEWPORT.width - width) / 2;
    const y = 508;

    this.addCard(x, y, width, height, COLORS.playerOne);

    this.addText(
      VIEWPORT.width / 2,
      y + 14,
      'ARROWS  MOVE     C  FIREBALL     Q  SHIELD     SPACE  DASH',
      13,
      UI_COLORS.startBody,
    );
    this.addText(
      VIEWPORT.width / 2,
      y + 40,
      'W  TURRET     E  WALL     R  WAVE     ESC  LEAVE',
      13,
      UI_COLORS.startBody,
    );
    this.addText(
      VIEWPORT.width / 2,
      y + 66,
      'Face incoming shots and raise your shield to reflect them.',
      12,
      UI_COLORS.startMuted,
    );
  }

  private drawNotice(): void {
    if (this.notice.length === 0) {
      return;
    }

    this.addText(VIEWPORT.width / 2, 236, this.notice, 14, '#fbbf24');
  }

  private drawFooter(value: string): void {
    this.addText(VIEWPORT.width / 2, 648, value, 16, UI_COLORS.startAccent);

    const notes: string[] = [];

    if (shouldUseLocalTransport()) {
      notes.push('LOCAL TEST MODE · open a second tab on this machine');
    } else if (!isMultiplayerConfigured()) {
      notes.push('Multiplayer is not configured · solo is available');
    }

    if (isDevelopment()) {
      notes.push('Dev build');
    }

    this.addText(
      VIEWPORT.width / 2,
      684,
      notes.join('  ·  ') || 'Desktop browser · keyboard only',
      12,
      UI_COLORS.startMuted,
    );
  }

  private drawBackground(): void {
    this.add
      .rectangle(0, 0, VIEWPORT.width, VIEWPORT.height, COLORS.background)
      .setOrigin(0);

    const grid = this.add.graphics();
    grid.lineStyle(1, COLORS.grid, 0.55);

    for (let x = 0; x <= VIEWPORT.width; x += 64) {
      grid.lineBetween(x, 0, x, VIEWPORT.height);
    }

    for (let y = 0; y <= VIEWPORT.height; y += 64) {
      grid.lineBetween(0, y, VIEWPORT.width, y);
    }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return 'Could not connect to the room.';
  }
}
