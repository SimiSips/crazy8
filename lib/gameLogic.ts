import type { Card, Color, Direction, GameState, Player } from './types';

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
  }

  // Wild 8s and wild draw fours (4 of each, no color — chosen when played)
  for (let i = 0; i < 4; i++) {
    deck.push({ id: uid(), color: null, type: 'wild8', value: null });
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ id: uid(), color: null, type: 'draw4', value: null });
  }

  return deck;
}

// Shuffles the deck, deals a fresh hand to every player, and flips the
// opening card. Shared by starting a game from the lobby and restarting
// straight into a new round from the winner screen.
export function dealNewRound(
  state: Pick<GameState, 'playerOrder' | 'players' | 'startingHand'>,
): {
  playerOrder: string[];
  players: Record<string, Player>;
  drawPile: Card[];
  discardPile: Card[];
  currentColor: Color;
} {
  const playerCount = state.playerOrder.length;
  const playerOrder = shuffle([...state.playerOrder]);

  // Use 2 decks for 5+ players so the draw pile stays healthy
  const rawDeck = playerCount >= 5 ? [...createDeck(), ...createDeck()] : createDeck();
  const deck = shuffle(rawDeck);
  const players = { ...state.players };

  const startingHand = state.startingHand ?? 8;
  for (const playerId of playerOrder) {
    players[playerId] = {
      ...players[playerId],
      hand: deck.splice(0, startingHand),
      unoCalled: false,
      playAgain: false,
    };
  }

  // First card must be a plain number card (no wild8, draw2, skip, or reverse)
  let firstCard = deck.shift()!;
  while (firstCard.type !== 'number') {
    deck.push(firstCard);
    firstCard = deck.shift()!;
  }

  return { playerOrder, players, drawPile: deck, discardPile: [firstCard], currentColor: firstCard.color! };
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
  // When there's a stacked draw penalty: draw cards counter-stack, and a reverse
  // matching the penalty colour (the +2's colour, or the colour requested by a +4)
  // bounces the pickup back to the player who played it
  if (pendingDraw > 0) {
    if (card.type === 'draw2' || card.type === 'draw4') return true;
    return card.type === 'reverse' && card.color === currentColor;
  }
  // Wild 8 and wild +4 are always playable
  if (card.type === 'wild8' || card.type === 'draw4') return true;
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
    case 'draw4':
      pendingDraw += 4;
      currentColor = chosenColor ?? 'red';
      break;
    case 'skip':
      advanceBy = 2;
      break;
    case 'reverse':
      if (state.pendingDraw > 0) {
        // Bouncing a +2/+4 back: flip direction and step back exactly one seat,
        // landing on whoever dealt the penalty — regardless of player count.
        direction = (direction * -1) as Direction;
        advanceBy = 1;
      } else if (playerCount === 2) {
        advanceBy = 2; // acts as skip in 2-player
      } else {
        direction = (direction * -1) as Direction;
      }
      break;
  }

  return { direction, currentColor, pendingDraw, advanceBy };
}

// Draws `count` cards, reshuffling the discard pile (minus its top card)
// back into the draw pile first if there isn't enough left to deal.
export function drawFromPile(
  drawPile: Card[],
  discardPile: Card[],
  count: number,
): { drawPile: Card[]; discardPile: Card[]; drawnCards: Card[] } {
  let pile = [...drawPile];
  let discard = [...discardPile];
  if (pile.length < count) {
    const top = discard.pop()!;
    pile = [...pile, ...shuffle(discard)];
    discard = [top];
  }
  const drawnCards = pile.splice(0, Math.min(count, pile.length));
  return { drawPile: pile, discardPile: discard, drawnCards };
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

// A player's "called it" flag survives while they're at 1-2 cards (so an early
// call still counts once they play down to 1), but resets once their hand
// grows past 2 — they'll need to call it again next time they get low.
export function nextUnoCalled(currentlyCalled: boolean | undefined, newHandLength: number): boolean {
  if (newHandLength > 2) return false;
  return !!currentlyCalled;
}

// Restarting from the winner screen needs the host plus at least one other
// player to vote "play again" — except after a 2-player forfeit, where the
// player who left is gone for good, so whoever remains is enough on their own.
export function playAgainThresholdMet(
  players: Record<string, Player>,
  playerOrder: string[],
  endedByLeave: boolean,
): boolean {
  const votes = playerOrder.filter(id => players[id]?.playAgain).length;
  if (endedByLeave) return votes >= 1;
  const hostId = playerOrder.find(id => players[id]?.isHost);
  const hostVoted = !!hostId && players[hostId]?.playAgain === true;
  return hostVoted && votes >= 2;
}

function uid(): string {
  return crypto.randomUUID();
}
