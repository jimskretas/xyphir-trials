import Phaser from 'phaser';
import './style.css';
import { createGameConfig } from './game/config/gameConfig';

const game = new Phaser.Game(createGameConfig());

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.destroy(true);
  });
}
