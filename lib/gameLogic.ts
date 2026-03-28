import type { Card, Color, CardType, Direction, GameState } from './types';

const COLORS: Color[] = ['red', 'green', 'blue', 'yellow'];

export function createDeck(): Card[] {
  const deck: Card[] = [];

  for (const color of COLORS) {
    // Numbers 1-9 (skip 8 — that's the wild)
    for (let n = 1; n <= 9; n++) {
      if (n === 8) continue;
      deck.push({ id: uid(), color, type: 'number', value: n });
    }
    // Special colored cards
    deck.push({ id: uid(), color, type: 'skip', value: null });
    deck.push({ id: uid(), color, type: 'reverse', value: null });
    deck.push({ id: uid(), color, type: 'draw2', value: null });
    deck.push({ id: uid(), color, type: 'draw2', value: null }); // extra +2 per color
  }

  // Wild 8s (4 of them, no color)
  for (let i = 0; i < 4; i++) {
    deck.push({ id: uid(), color: null, type: 'wild8', value: null });
  }

  return deck;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function canPlayCard(
  card: Card,
  topCard: Card,
  currentColor: Color,
  pendingDraw: number,
): boolean {
  // When there's a stacked draw penalty, only draw2 can counter-stack
  if (pendingDraw > 0) return card.type === 'draw2';
  // Wild 8 is always playable
  if (card.type === 'wild8') return true;
  // Match color
  if (card.color === currentColor) return true;
  // Match type/value (e.g., blue skip on red skip, 7 on 7)
  if (card.type === topCard.type) {
    if (card.type === 'number') return card.value === topCard.value;
    return true; // skip-on-skip, reverse-on-reverse, draw2-on-draw2
  }
  return false;
}

export function applyCardEffects(
  card: Card,
  chosenColor: Color | undefined,
  state: Pick<GameState, 'direction' | 'pendingDraw' | 'playerOrder'>,
): {
  direction: Direction;
  currentColor: Color;
  pendingDraw: number;
  advanceBy: number;
} {
  let direction = state.direction;
  let currentColor: Color = card.color ?? chosenColor ?? 'red';
  let pendingDraw = state.pendingDraw;
  let advanceBy = 1;
  const playerCount = state.playerOrder.length;

  switch (card.type) {
    case 'wild8':
      currentColor = chosenColor ?? 'red';
      break;
    case 'draw2':
      pendingDraw += 2;
      break;
    case 'skip':
      advanceBy = 2;
      break;
    case 'reverse':
      if (playerCount === 2) {
        advanceBy = 2; // acts as skip in 2-player
      } else {
        direction = (direction * -1) as Direction;
      }
      break;
  }

  return { direction, currentColor, pendingDraw, advanceBy };
}

export function advanceTurn(
  currentIndex: number,
  playerCount: number,
  direction: Direction,
  advanceBy: number,
): number {
  let idx = currentIndex;
  for (let i = 0; i < advanceBy; i++) {
    idx = ((idx + direction) + playerCount) % playerCount;
  }
  return idx;
}

export const CARDS_PER_PLAYER = 7;

function uid(): string {
  return crypto.randomUUID();
}
