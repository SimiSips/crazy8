import { doc, setDoc, runTransaction, onSnapshot } from 'firebase/firestore';
import { recordWin } from './playerStats';
import { db } from './firebase';
import {
  canPlayCard,
  applyCardEffects,
  advanceTurn,
  nextUnoCalled,
  drawFromPile,
  dealNewRound,
  playAgainThresholdMet,
} from './gameLogic';
import type { GameState, Card, Color, CardLook } from './types';

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
      [hostId]: { id: hostId, name: hostName, hand: [], isHost: true, ready: true },
    },
    playerOrder: [hostId],
    currentPlayerIndex: 0,
    direction: 1,
    drawPile: [],
    discardPile: [],
    currentColor: 'red',
    pendingDraw: 0,
    winner: null,
    cardLook: 'solid',
    startingHand: 8,
    maxPlayers: 8,
    lastSkippedId: null,
    lastMistakeId: null,
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
    const maxPlayers = state.maxPlayers ?? 8;
    if (Object.keys(state.players).length >= maxPlayers) {
      throw new Error(`Game is full (max ${maxPlayers} players)`);
    }
    if (state.players[playerId]) return;

    tx.update(ref, {
      players: {
        ...state.players,
        [playerId]: { id: playerId, name: playerName, hand: [], isHost: false, ready: true },
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

export async function updateSettings(
  gameId: string,
  hostId: string,
  settings: Partial<{ cardLook: CardLook; startingHand: number; maxPlayers: number }>,
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'games', gameId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Game not found');
    const state = snap.data() as GameState;
    if (!state.players[hostId]?.isHost) throw new Error('Only the host can change settings');
    if (state.status !== 'lobby') throw new Error('Game already started');
    if (settings.maxPlayers !== undefined && settings.maxPlayers < state.playerOrder.length) {
      throw new Error('Cannot set fewer seats than seated players');
    }
    tx.update(ref, settings);
  });
}

export async function setReady(gameId: string, playerId: string, ready: boolean): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'games', gameId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Game not found');
    const state = snap.data() as GameState;
    if (!state.players[playerId]) throw new Error('Not in this game');
    tx.update(ref, { [`players.${playerId}.ready`]: ready });
  });
}

export async function startGame(gameId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'games', gameId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Game not found');
    const state = snap.data() as GameState;
    if (state.status !== 'lobby') throw new Error('Game already started');

    const deal = dealNewRound(state);

    tx.update(ref, {
      status: 'playing',
      ...deal,
      lastAction: 'Game started — good luck!',
      lastSkippedId: null,
      lastMistakeId: null,
      endedByLeave: false,
    });
  });
}

// Voting to play again from the winner screen. Once the host plus at least
// one other player have voted (or, after a 2-player forfeit, just whoever's
// left — the other player is gone for good), a new round is dealt immediately
// and everyone lands straight on the table, skipping the lobby entirely.
export async function votePlayAgain(gameId: string, playerId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'games', gameId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Game not found');
    const state = snap.data() as GameState;
    if (state.status !== 'finished') return;

    const player = state.players[playerId];
    if (!player) throw new Error('Not in this game');

    const nextVoted = !player.playAgain;
    const players = { ...state.players, [playerId]: { ...player, playAgain: nextVoted } };

    if (playAgainThresholdMet(players, state.playerOrder, !!state.endedByLeave)) {
      const deal = dealNewRound({ ...state, players });
      tx.update(ref, {
        status: 'playing',
        winner: null,
        endedByLeave: false,
        ...deal,
        lastAction: 'New round — good luck!',
        lastSkippedId: null,
        lastMistakeId: null,
      });
      return;
    }

    tx.update(ref, { [`players.${playerId}.playAgain`]: nextVoted });
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

    const isReverseBounce = card.type === 'reverse' && state.pendingDraw > 0;
    let actionLabel: string;
    if (isReverseBounce) {
      const targetName = state.players[state.playerOrder[nextIndex]]?.name ?? 'someone';
      actionLabel = `${player.name} reverses the +${state.pendingDraw} back to ${targetName}!`;
    } else {
      const colorLabel = (card.type === 'wild8' || card.type === 'draw4') ? ` → ${effects.currentColor}` : '';
      actionLabel = buildActionLabel(card, player.name) + colorLabel;
    }

    // Determine who gets skipped so the UI can show a visual indicator
    const isSkipEffect = card.type === 'skip' ||
      (card.type === 'reverse' && state.playerOrder.length === 2 && state.pendingDraw === 0);
    const lastSkippedId = isSkipEffect
      ? state.playerOrder[advanceTurn(state.currentPlayerIndex, state.playerOrder.length, state.direction, 1)]
      : null;

    const updates: Record<string, unknown> = {
      [`players.${playerId}.hand`]: newHand,
      [`players.${playerId}.unoCalled`]: nextUnoCalled(player.unoCalled, newHand.length),
      discardPile: [...state.discardPile, card],
      currentPlayerIndex: nextIndex,
      direction: effects.direction,
      currentColor: effects.currentColor,
      pendingDraw: effects.pendingDraw,
      lastAction: actionLabel,
      lastSkippedId,
      lastMistakeId: null,
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
    const { drawPile, discardPile, drawnCards } = drawFromPile(state.drawPile, state.discardPile, drawCount);
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
      [`players.${playerId}.unoCalled`]: nextUnoCalled(player.unoCalled, newHand.length),
      pendingDraw: 0,
      currentPlayerIndex: nextIndex,
      lastAction: actionLabel,
      lastMistakeId: null,
    });
  });
}

// A single tap on a card is a real play attempt. Tapping one that doesn't
// match colour/number/type — or tapping at all when it isn't your turn — is
// a "foolish mistake": pick up 2 (plus whatever +2/+4 stack you failed to
// resolve, if it actually was your turn).
export async function foolishMistake(gameId: string, playerId: string, cardId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'games', gameId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Game not found');
    const state = snap.data() as GameState;
    if (state.status !== 'playing') return;

    const player = state.players[playerId];
    if (!player) throw new Error('Not in this game');
    const card = player.hand.find((c: Card) => c.id === cardId);
    if (!card) throw new Error('Card not in hand');

    const isCurrentPlayer = state.playerOrder[state.currentPlayerIndex] === playerId;

    // Tapped out of turn — flat 2-card penalty that doesn't touch whose turn it is,
    // what's pending, or the discard pile (nothing was actually played).
    if (!isCurrentPlayer) {
      const penalty = 2;
      const { drawPile, discardPile, drawnCards } = drawFromPile(state.drawPile, state.discardPile, penalty);
      const newHand = [...player.hand, ...drawnCards];

      tx.update(ref, {
        drawPile,
        discardPile,
        [`players.${playerId}.hand`]: newHand,
        [`players.${playerId}.unoCalled`]: nextUnoCalled(player.unoCalled, newHand.length),
        lastAction: `${player.name} made a foolish mistake and picked up ${penalty}!`,
        lastMistakeId: playerId,
        lastMistakePenalty: penalty,
      });
      return;
    }

    const topCard = state.discardPile[state.discardPile.length - 1];
    if (canPlayCard(card, topCard, state.currentColor, state.pendingDraw)) {
      throw new Error('That card can actually be played');
    }

    const penalty = 2 + state.pendingDraw;
    const { drawPile, discardPile, drawnCards } = drawFromPile(state.drawPile, state.discardPile, penalty);
    const newHand = [...player.hand, ...drawnCards];
    const nextIndex = advanceTurn(state.currentPlayerIndex, state.playerOrder.length, state.direction, 1);

    tx.update(ref, {
      drawPile,
      discardPile,
      [`players.${playerId}.hand`]: newHand,
      [`players.${playerId}.unoCalled`]: nextUnoCalled(player.unoCalled, newHand.length),
      pendingDraw: 0,
      currentPlayerIndex: nextIndex,
      lastAction: `${player.name} made a foolish mistake and picked up ${penalty}!`,
      lastMistakeId: playerId,
      lastMistakePenalty: penalty,
      lastSkippedId: null,
    });
  });
}

// Down to your last card and didn't hit "ONE CARD!" within the call window —
// pick up 2. Not a turn action: the deadline can (and usually does) expire
// after play has already moved on, so it doesn't touch whose turn it is.
export async function missedUnoCall(gameId: string, playerId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'games', gameId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Game not found');
    const state = snap.data() as GameState;
    if (state.status !== 'playing') return;

    const player = state.players[playerId];
    // Stale timer firing after their hand already changed (played out, drew, etc.) — no-op.
    if (!player || player.hand.length !== 1) return;

    const penalty = 2;
    const { drawPile, discardPile, drawnCards } = drawFromPile(state.drawPile, state.discardPile, penalty);
    const newHand = [...player.hand, ...drawnCards];

    tx.update(ref, {
      drawPile,
      discardPile,
      [`players.${playerId}.hand`]: newHand,
      [`players.${playerId}.unoCalled`]: false,
      lastAction: `${player.name} forgot to call it — pick up 2!`,
    });
  });
}

// Declares "ONE CARD!" — persisted so opponents can see whether you've
// called it (and therefore whether they're allowed to catch you).
export async function callOneCard(gameId: string, playerId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'games', gameId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Game not found');
    const state = snap.data() as GameState;
    if (state.status !== 'playing') return;
    if (!state.players[playerId]) throw new Error('Not in this game');

    tx.update(ref, { [`players.${playerId}.unoCalled`]: true });
  });
}

// Another player taps your one remaining card before you've called it —
// "asks how many cards?" and you pick up 2, same as missing the deadline.
export async function catchMissedCall(gameId: string, catcherId: string, targetId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'games', gameId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Game not found');
    const state = snap.data() as GameState;
    if (state.status !== 'playing') return;
    if (catcherId === targetId) throw new Error("You can't catch yourself");

    const catcher = state.players[catcherId];
    const target = state.players[targetId];
    if (!catcher || !target) throw new Error('Player not in this game');
    if (target.hand.length !== 1 || target.unoCalled) {
      throw new Error('Nothing to catch there');
    }

    const penalty = 2;
    const { drawPile, discardPile, drawnCards } = drawFromPile(state.drawPile, state.discardPile, penalty);
    const newHand = [...target.hand, ...drawnCards];

    tx.update(ref, {
      drawPile,
      discardPile,
      [`players.${targetId}.hand`]: newHand,
      [`players.${targetId}.unoCalled`]: false,
      lastAction: `${catcher.name} asks: how many cards?`,
    });
  });
}

// Leaving mid-game via the table screen's "X". 3+ players: they're removed
// and the game continues. Exactly 2 players: leaving ends the round outright
// (the remaining player wins by forfeit).
export async function leaveGame(gameId: string, playerId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'games', gameId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Game not found');
    const state = snap.data() as GameState;
    if (state.status !== 'playing') return;

    const leaver = state.players[playerId];
    if (!leaver) return;

    if (state.playerOrder.length <= 2) {
      const remainingId = state.playerOrder.find(id => id !== playerId) ?? null;
      tx.update(ref, {
        status: 'finished',
        winner: remainingId,
        endedByLeave: true,
        lastAction: `${leaver.name} has ended the game`,
      });
      return;
    }

    const leaveIdx = state.playerOrder.indexOf(playerId);
    const newPlayerOrder = state.playerOrder.filter(id => id !== playerId);
    const remainingPlayers = Object.fromEntries(
      Object.entries(state.players).filter(([pid]) => pid !== playerId),
    );

    let newIndex = state.currentPlayerIndex;
    if (leaveIdx < state.currentPlayerIndex) newIndex -= 1;
    newIndex = ((newIndex % newPlayerOrder.length) + newPlayerOrder.length) % newPlayerOrder.length;

    // If it was the leaver's own unresolved +2/+4, it doesn't carry over to whoever's left.
    const pendingDraw = leaveIdx === state.currentPlayerIndex ? 0 : state.pendingDraw;

    tx.update(ref, {
      players: remainingPlayers,
      playerOrder: newPlayerOrder,
      currentPlayerIndex: newIndex,
      pendingDraw,
      lastSkippedId: null,
      lastMistakeId: null,
      lastAction: `${leaver.name} has left the game`,
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
  if (card.type === 'draw4') return `${playerName} played +4`;
  if (card.type === 'draw2') return `${playerName} played +2 (${card.color})`;
  if (card.type === 'skip') return `${playerName} played Skip (${card.color})`;
  if (card.type === 'reverse') return `${playerName} played Reverse (${card.color})`;
  return `${playerName} played ${card.value} (${card.color})`;
}
