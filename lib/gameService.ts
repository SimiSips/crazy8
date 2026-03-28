import { doc, setDoc, runTransaction, onSnapshot } from 'firebase/firestore';
import { recordWin } from './playerStats';
import { db } from './firebase';
import {
  createDeck,
  shuffle,
  canPlayCard,
  applyCardEffects,
  advanceTurn,
  CARDS_PER_PLAYER,
} from './gameLogic';
import type { GameState, Card, Color } from './types';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function createGame(hostId: string, hostName: string): Promise<string> {
  const gameId = generateRoomCode();
  const state: GameState = {
    id: gameId,
    status: 'lobby',
    players: {
      [hostId]: { id: hostId, name: hostName, hand: [], isHost: true },
    },
    playerOrder: [hostId],
    currentPlayerIndex: 0,
    direction: 1,
    drawPile: [],
    discardPile: [],
    currentColor: 'red',
    pendingDraw: 0,
    winner: null,
    createdAt: Date.now(),
    lastAction: `${hostName} created the game`,
  };
  await setDoc(doc(db, 'games', gameId), state);
  return gameId;
}

export async function joinGame(gameId: string, playerId: string, playerName: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'games', gameId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Game not found');
    const state = snap.data() as GameState;
    if (state.status !== 'lobby') throw new Error('Game already started');
    if (Object.keys(state.players).length >= 8) throw new Error('Game is full (max 8 players)');
    if (state.players[playerId]) return;

    tx.update(ref, {
      players: {
        ...state.players,
        [playerId]: { id: playerId, name: playerName, hand: [], isHost: false },
      },
      playerOrder: [...state.playerOrder, playerId],
      lastAction: `${playerName} joined`,
    });
  });
}

export async function removePlayer(gameId: string, hostId: string, targetId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'games', gameId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Game not found');
    const state = snap.data() as GameState;
    if (!state.players[hostId]?.isHost) throw new Error('Only the host can remove players');
    if (state.status !== 'lobby') throw new Error('Cannot remove players once the game has started');
    if (targetId === hostId) throw new Error('Cannot remove yourself');

    const { [targetId]: removed, ...remainingPlayers } = state.players;
    tx.update(ref, {
      players: remainingPlayers,
      playerOrder: state.playerOrder.filter(id => id !== targetId),
      lastAction: `${removed?.name ?? 'Player'} was removed from the lobby`,
    });
  });
}

export async function startGame(gameId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'games', gameId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Game not found');
    const state = snap.data() as GameState;
    if (state.status !== 'lobby') throw new Error('Game already started');

    const playerCount = state.playerOrder.length;
    // Randomise who goes first
    const playerOrder = shuffle([...state.playerOrder]);

    // Use 2 decks for 5+ players so the draw pile stays healthy
    const rawDeck = playerCount >= 5 ? [...createDeck(), ...createDeck()] : createDeck();
    let deck = shuffle(rawDeck);
    const players = { ...state.players };

    for (const playerId of playerOrder) {
      players[playerId] = {
        ...players[playerId],
        hand: deck.splice(0, CARDS_PER_PLAYER),
      };
    }

    // First card must be a plain number card (no wild8, draw2, skip, or reverse)
    let firstCard = deck.shift()!;
    while (firstCard.type !== 'number') {
      deck.push(firstCard);
      firstCard = deck.shift()!;
    }

    tx.update(ref, {
      status: 'playing',
      players,
      playerOrder,
      drawPile: deck,
      discardPile: [firstCard],
      currentColor: firstCard.color!,
      lastAction: 'Game started — good luck!',
    });
  });
}

export async function playCard(
  gameId: string,
  playerId: string,
  cardId: string,
  chosenColor?: Color,
): Promise<void> {
  // Track win info so we can record it after the transaction commits
  let winnerName: string | null = null;

  await runTransaction(db, async (tx) => {
    winnerName = null; // reset on each transaction attempt
    const ref = doc(db, 'games', gameId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Game not found');
    const state = snap.data() as GameState;

    if (state.playerOrder[state.currentPlayerIndex] !== playerId) {
      throw new Error('Not your turn');
    }

    const player = state.players[playerId];
    const card = player.hand.find((c: Card) => c.id === cardId);
    if (!card) throw new Error('Card not in hand');

    const topCard = state.discardPile[state.discardPile.length - 1];
    if (!canPlayCard(card, topCard, state.currentColor, state.pendingDraw)) {
      throw new Error('Cannot play that card');
    }

    const newHand = player.hand.filter((c: Card) => c.id !== cardId);
    const effects = applyCardEffects(card, chosenColor, state);
    const nextIndex = advanceTurn(
      state.currentPlayerIndex,
      state.playerOrder.length,
      effects.direction,
      effects.advanceBy,
    );

    const colorLabel = card.type === 'wild8' ? ` → ${effects.currentColor}` : '';
    const actionLabel = buildActionLabel(card, player.name) + colorLabel;

    const updates: Record<string, unknown> = {
      [`players.${playerId}.hand`]: newHand,
      discardPile: [...state.discardPile, card],
      currentPlayerIndex: nextIndex,
      direction: effects.direction,
      currentColor: effects.currentColor,
      pendingDraw: effects.pendingDraw,
      lastAction: actionLabel,
    };

    if (newHand.length === 0) {
      updates.winner = playerId;
      updates.status = 'finished';
      updates.lastAction = `🎉 ${player.name} wins!`;
      winnerName = player.name;
    }

    tx.update(ref, updates);
  });

  // Record win after transaction commits (best-effort)
  if (winnerName) {
    await recordWin(playerId, winnerName).catch(() => {});
  }
}

export async function drawCard(gameId: string, playerId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'games', gameId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Game not found');
    const state = snap.data() as GameState;

    if (state.playerOrder[state.currentPlayerIndex] !== playerId) {
      throw new Error('Not your turn');
    }

    const drawCount = state.pendingDraw > 0 ? state.pendingDraw : 1;
    let drawPile = [...state.drawPile];
    let discardPile = [...state.discardPile];

    // Reshuffle discard into draw pile if needed
    if (drawPile.length < drawCount) {
      const top = discardPile.pop()!;
      drawPile = [...drawPile, ...shuffle(discardPile)];
      discardPile = [top];
    }

    const drawnCards = drawPile.splice(0, Math.min(drawCount, drawPile.length));
    const player = state.players[playerId];
    const newHand = [...player.hand, ...drawnCards];

    // If drawing due to a penalty (+2 stack), always advance turn.
    // If drawing normally (1 card), keep the turn so the player can play it if it matches.
    const forcedDraw = state.pendingDraw > 0;
    const topCard = state.discardPile[state.discardPile.length - 1];
    const drawnCard = drawnCards[0];
    const drawnIsPlayable = !forcedDraw && drawnCard
      ? canPlayCard(drawnCard, topCard, state.currentColor, 0)
      : false;

    const nextIndex = forcedDraw || !drawnIsPlayable
      ? advanceTurn(state.currentPlayerIndex, state.playerOrder.length, state.direction, 1)
      : state.currentPlayerIndex; // stay on player's turn so they can play the drawn card

    const actionLabel = forcedDraw
      ? `${player.name} was hit with +${drawCount}!`
      : drawnIsPlayable
      ? `${player.name} drew a playable card!`
      : `${player.name} drew a card`;

    tx.update(ref, {
      drawPile,
      discardPile,
      [`players.${playerId}.hand`]: newHand,
      pendingDraw: 0,
      currentPlayerIndex: nextIndex,
      lastAction: actionLabel,
    });
  });
}

export async function resetGame(gameId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'games', gameId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Game not found');
    const state = snap.data() as GameState;

    const clearedPlayers = Object.fromEntries(
      Object.entries(state.players).map(([pid, p]) => [pid, { ...p, hand: [] }]),
    );

    tx.update(ref, {
      status: 'lobby',
      players: clearedPlayers,
      drawPile: [],
      discardPile: [],
      currentPlayerIndex: 0,
      direction: 1,
      pendingDraw: 0,
      winner: null,
      lastAction: 'Ready for another round!',
    });
  });
}

export function subscribeToGame(gameId: string, callback: (state: GameState) => void) {
  return onSnapshot(doc(db, 'games', gameId), (snap) => {
    if (snap.exists()) callback(snap.data() as GameState);
  });
}

function buildActionLabel(card: Card, playerName: string): string {
  if (card.type === 'wild8') return `${playerName} played Wild 8`;
  if (card.type === 'draw2') return `${playerName} played +2 (${card.color})`;
  if (card.type === 'skip') return `${playerName} played Skip (${card.color})`;
  if (card.type === 'reverse') return `${playerName} played Reverse (${card.color})`;
  return `${playerName} played ${card.value} (${card.color})`;
}
