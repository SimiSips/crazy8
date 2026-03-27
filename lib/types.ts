export type Color = 'red' | 'green' | 'blue' | 'yellow';
export type CardType = 'number' | 'skip' | 'reverse' | 'draw2' | 'wild8';
export type Direction = 1 | -1;
export type GameStatus = 'lobby' | 'playing' | 'finished';

export interface Card {
  id: string;
  color: Color | null; // null for wild8
  type: CardType;
  value: number | null; // 1-9 for number cards, null for others
}

export interface Player {
  id: string;
  name: string;
  hand: Card[];
  isHost: boolean;
}

export interface GameState {
  id: string;
  status: GameStatus;
  players: Record<string, Player>;
  playerOrder: string[];
  currentPlayerIndex: number;
  direction: Direction;
  drawPile: Card[];
  discardPile: Card[];
  currentColor: Color;
  pendingDraw: number;
  winner: string | null;
  createdAt: number;
  lastAction: string;
}
