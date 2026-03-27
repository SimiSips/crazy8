'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { subscribeToGame, playCard, drawCard, resetGame } from '@/lib/gameService';
import { fetchAllStats, type PlayerStats } from '@/lib/playerStats';
import { canPlayCard } from '@/lib/gameLogic';
import { PlayingCard, FaceDownCard } from '@/components/PlayingCard';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { ColorPicker } from '@/components/ColorPicker';
import type { GameState, Card, Color } from '@/lib/types';

const COLOR_RING: Record<Color, string> = {
  red: 'ring-red-400 shadow-red-500/40',
  green: 'ring-green-400 shadow-green-500/40',
  blue: 'ring-blue-400 shadow-blue-500/40',
  yellow: 'ring-yellow-300 shadow-yellow-400/40',
};

const COLOR_LABEL: Record<Color, string> = {
  red: 'bg-red-500',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  yellow: 'bg-yellow-400',
};

export default function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const router = useRouter();
  const [game, setGame] = useState<GameState | null>(null);
  const [stats, setStats] = useState<Record<string, PlayerStats>>({});
  const [myId, setMyId] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  useEffect(() => {
    const id = localStorage.getItem('crazy8_playerId') ?? '';
    setMyId(id);
  }, []);

  useEffect(() => {
    if (!gameId) return;
    const unsub = subscribeToGame(gameId, (state) => {
      setGame(state);
    });
    return unsub;
  }, [gameId]);

  // Fetch stats when game status changes (especially when finished, so new wins show)
  useEffect(() => {
    if (!game) return;
    fetchAllStats().then(setStats).catch(() => {});
  }, [game?.status, game?.playerOrder.length]);

  // Show action messages as a toast
  useEffect(() => {
    if (!game?.lastAction) return;
    setActionMsg(game.lastAction);
    const t = setTimeout(() => setActionMsg(''), 2800);
    return () => clearTimeout(t);
  }, [game?.lastAction]);

  const isMyTurn = game ? game.playerOrder[game.currentPlayerIndex] === myId : false;
  const myHand = game?.players[myId]?.hand ?? [];
  const topCard = game?.discardPile[game.discardPile.length - 1] ?? null;

  const playableCards = useCallback((hand: Card[]) => {
    if (!game || !topCard || !isMyTurn) return new Set<string>();
    return new Set(
      hand
        .filter(c => canPlayCard(c, topCard, game.currentColor, game.pendingDraw))
        .map(c => c.id),
    );
  }, [game, topCard, isMyTurn]);

  const playable = playableCards(myHand);

  function handleCardTap(card: Card) {
    if (!playable.has(card.id)) return;
    if (selectedCardId === card.id) {
      // Second tap: play it
      if (card.type === 'wild8') {
        setShowColorPicker(true);
      } else {
        submitPlay(card.id);
      }
    } else {
      setSelectedCardId(card.id);
    }
  }

  async function submitPlay(cardId: string, color?: Color) {
    setShowColorPicker(false);
    setSelectedCardId(null);
    setError('');
    try {
      await playCard(gameId, myId, cardId, color);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error playing card');
    }
  }

  async function handleDraw() {
    setSelectedCardId(null);
    setError('');
    try {
      await drawCard(gameId, myId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error drawing card');
    }
  }

  async function handleReset() {
    try {
      await resetGame(gameId);
      router.replace(`/lobby/${gameId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }

  if (!game) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-950">
        <div className="w-8 h-8 rounded-full border-2 border-white border-t-transparent animate-spin" />
      </div>
    );
  }

  if (game.status === 'finished') {
    const winner = game.players[game.winner ?? ''];
    const iWon = game.winner === myId;
    const winnerIndex = game.playerOrder.indexOf(game.winner ?? '');
    const winnerWins = stats[game.winner ?? '']?.wins ?? 0;

    return (
      <div className="h-full flex flex-col items-center justify-center px-5 bg-gray-950">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="text-center"
        >
          <div className="text-7xl mb-5">{iWon ? '🎉' : '😢'}</div>

          {/* Winner avatar with badge */}
          <div className="flex justify-center mb-4">
            <PlayerAvatar
              name={winner?.name ?? '?'}
              index={winnerIndex}
              wins={winnerWins}
              size="lg"
            />
          </div>

          <h1 className="text-3xl font-black text-white mb-1">
            {iWon ? 'You Win!' : `${winner?.name ?? 'Someone'} Wins!`}
          </h1>
          {winnerWins > 0 && (
            <p className="text-yellow-400 font-bold mb-1">
              {iWon ? `That's your ${winnerWins} win${winnerWins > 1 ? 's' : ''}! 🏆` : `${winnerWins} total win${winnerWins > 1 ? 's' : ''}`}
            </p>
          )}
          <p className="text-gray-400 mb-8">
            {iWon ? 'Amazing play!' : 'Better luck next time!'}
          </p>

          {/* All player scores */}
          <div className="flex justify-center gap-4 mb-8">
            {game.playerOrder.map((pid, i) => {
              const p = game.players[pid];
              const w = stats[pid]?.wins ?? 0;
              return (
                <div key={pid} className="flex flex-col items-center gap-1">
                  <PlayerAvatar name={p?.name ?? '?'} index={i} wins={w} size="sm" />
                  <span className="text-gray-400 text-[10px]">{p?.name}</span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 w-64">
            {game.players[myId]?.isHost && (
              <button
                onClick={handleReset}
                className="w-full py-4 rounded-2xl font-black bg-white text-gray-900 active:scale-95 transition-transform"
              >
                Play Again
              </button>
            )}
            <button
              onClick={() => router.replace('/')}
              className="w-full py-4 rounded-2xl font-bold border border-gray-700 text-gray-300 active:scale-95 transition-transform"
            >
              Main Menu
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const currentPlayerId = game.playerOrder[game.currentPlayerIndex];
  const otherPlayers = game.playerOrder
    .filter(id => id !== myId)
    .map(id => ({ ...game.players[id], playerIndex: game.playerOrder.indexOf(id) }));

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, #0d2f1a 0%, #071a0e 60%, #030d07 100%)' }}
    >
      {/* Toast */}
      <AnimatePresence>
        {actionMsg && (
          <motion.div
            key={actionMsg}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-3 left-4 right-4 z-40 flex justify-center pointer-events-none"
          >
            <div className="bg-black/80 backdrop-blur-sm rounded-full px-4 py-2 text-white text-xs font-semibold border border-white/10 max-w-xs text-center">
              {actionMsg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Other players */}
      <div className="flex-shrink-0 pt-4 px-4">
        <div className="flex gap-3 justify-center flex-wrap">
          {otherPlayers.map(player => {
            const isCurrent = player.id === currentPlayerId;
            const playerWins = stats[player.id]?.wins ?? 0;
            return (
              <div
                key={player.id}
                className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl border transition-all
                  ${isCurrent
                    ? 'border-white/30 bg-white/10 ring-2 ring-white/20'
                    : 'border-white/10 bg-black/20'
                  }`}
              >
                <PlayerAvatar
                  name={player.name}
                  index={player.playerIndex}
                  wins={playerWins}
                  isCurrentTurn={isCurrent}
                  size="sm"
                />
                <p className="text-white text-[10px] font-semibold max-w-[60px] truncate">{player.name}</p>
                <div className="flex gap-0.5 flex-wrap justify-center max-w-[120px]">
                  {Array.from({ length: Math.min(player.hand.length, 5) }).map((_, i) => (
                    <FaceDownCard key={i} size="sm" />
                  ))}
                  {player.hand.length > 5 && (
                    <div className="w-[46px] h-[64px] rounded-2xl bg-black/40 border-2 border-white/10 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      +{player.hand.length - 5}
                    </div>
                  )}
                </div>
                <p className="text-gray-400 text-[10px]">{player.hand.length} cards</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Center: discard + draw + color indicator */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
        {/* Color indicator */}
        <div className={`rounded-full px-4 py-1.5 ${COLOR_LABEL[game.currentColor]} flex items-center gap-2 shadow-lg`}>
          <span className="text-white font-black text-sm capitalize">{game.currentColor}</span>
          {game.pendingDraw > 0 && (
            <span className="bg-black/30 text-white text-xs font-black rounded-full px-2 py-0.5">
              +{game.pendingDraw} incoming!
            </span>
          )}
        </div>

        <div className="flex items-center gap-6">
          {/* Draw pile */}
          <div className="flex flex-col items-center gap-1">
            <FaceDownCard size="md" count={game.drawPile.length} />
            <p className="text-gray-500 text-[10px]">Draw</p>
          </div>

          {/* Discard pile (top card) */}
          <div className="flex flex-col items-center gap-1">
            {topCard ? (
              <div className={`rounded-3xl ring-4 shadow-2xl ${COLOR_RING[game.currentColor]}`}>
                <PlayingCard card={topCard} size="md" />
              </div>
            ) : (
              <div className="w-[72px] h-[100px] rounded-2xl border-2 border-dashed border-white/20" />
            )}
            <p className="text-gray-500 text-[10px]">Discard</p>
          </div>
        </div>

        {/* Turn indicator */}
        <div className={`rounded-full px-4 py-1.5 text-sm font-bold
          ${isMyTurn ? 'bg-white text-gray-900' : 'bg-white/10 text-gray-300'}`}
        >
          {isMyTurn
            ? game.pendingDraw > 0
              ? `You must draw +${game.pendingDraw} or stack +2!`
              : 'Your turn — tap a card'
            : `${game.players[currentPlayerId]?.name ?? '...'}'s turn`
          }
        </div>

        {error && (
          <p className="text-red-400 text-xs text-center">{error}</p>
        )}
      </div>

      {/* My hand */}
      <div className="flex-shrink-0 pb-safe">
        {/* Hand label + draw button */}
        <div className="flex items-center justify-between px-4 mb-2">
          <p className="text-gray-400 text-xs font-semibold">
            Your hand ({myHand.length})
          </p>
          {isMyTurn && (
            <button
              onClick={handleDraw}
              className="bg-white/10 border border-white/20 text-white text-xs font-bold px-4 py-1.5 rounded-full active:scale-95 transition-transform"
            >
              {game.pendingDraw > 0 ? `Draw +${game.pendingDraw}` : 'Draw Card'}
            </button>
          )}
        </div>

        {/* Cards row */}
        <div className="overflow-x-auto scrollbar-hide pb-4 px-4">
          <div className="flex gap-2 min-w-max">
            {myHand.length === 0 ? (
              <p className="text-gray-600 text-sm py-6 px-4">No cards</p>
            ) : (
              myHand.map(card => (
                <PlayingCard
                  key={card.id}
                  card={card}
                  playable={playable.has(card.id)}
                  selected={selectedCardId === card.id}
                  onClick={() => handleCardTap(card)}
                  size="md"
                />
              ))
            )}
          </div>
        </div>

        {/* Play confirmation for selected non-wild card */}
        <AnimatePresence>
          {selectedCardId && !showColorPicker && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="px-4 pb-2 flex gap-2"
            >
              <button
                onClick={() => {
                  const card = myHand.find(c => c.id === selectedCardId);
                  if (card?.type === 'wild8') {
                    setShowColorPicker(true);
                  } else if (selectedCardId) {
                    submitPlay(selectedCardId);
                  }
                }}
                className="flex-1 py-3 rounded-2xl font-black text-sm bg-white text-gray-900 active:scale-95 transition-transform shadow-lg"
              >
                Play Card
              </button>
              <button
                onClick={() => setSelectedCardId(null)}
                className="px-5 py-3 rounded-2xl font-bold text-sm border border-gray-700 text-gray-400 active:scale-95 transition-transform"
              >
                Cancel
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Color picker modal */}
      <ColorPicker
        open={showColorPicker}
        onSelect={(color) => {
          if (selectedCardId) submitPlay(selectedCardId, color);
        }}
      />
    </div>
  );
}
