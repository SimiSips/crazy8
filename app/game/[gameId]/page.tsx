'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { subscribeToGame, playCard, drawCard, resetGame } from '@/lib/gameService';
import { fetchAllStats, type PlayerStats } from '@/lib/playerStats';
import { canPlayCard } from '@/lib/gameLogic';
import { PlayingCard, FaceDownCard, CardFan, CARD_BG } from '@/components/PlayingCard';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { ColorPicker } from '@/components/ColorPicker';
import type { GameState, Card, Color } from '@/lib/types';

// ─── Felt table background style ───────────────────────────────────────────────
const TABLE_BG: React.CSSProperties = {
  background: 'radial-gradient(ellipse at 45% 35%, #c0392b 0%, #a93226 40%, #922b21 75%, #7b241c 100%)',
};

// ─── Per-player position around the table ─────────────────────────────────────
// otherPlayers[0] = top, [1] = left, [2] = right
const POSITIONS = ['top', 'left', 'right'] as const;

// ─── Opponent slot ─────────────────────────────────────────────────────────────
function OpponentSlot({
  player,
  wins,
  isCurrent,
  playerIndex,
  position,
}: {
  player: { id: string; name: string; hand: Card[] };
  wins: number;
  isCurrent: boolean;
  playerIndex: number;
  position: 'top' | 'left' | 'right';
}) {
  const fanDir = position === 'top' ? 'horizontal' : 'horizontal';
  const count = player.hand.length;

  const inner = (
    <>
      <CardFan count={count} direction={fanDir} />
      <div className="flex flex-col items-center gap-0.5 mt-1">
        <PlayerAvatar
          name={player.name}
          index={playerIndex}
          wins={wins}
          isCurrentTurn={isCurrent}
          size="sm"
        />
        <span className="text-white text-[11px] font-bold drop-shadow">{player.name}</span>
        {isCurrent && (
          <span className="text-yellow-300 text-[9px] font-black animate-pulse">▼ THEIR TURN</span>
        )}
      </div>
    </>
  );

  if (position === 'top') {
    return (
      <motion.div
        animate={isCurrent ? { scale: 1.04 } : { scale: 1 }}
        className="flex flex-col items-center gap-1"
      >
        {inner}
      </motion.div>
    );
  }

  // left / right: cards on outer edge, avatar inner
  return (
    <motion.div
      animate={isCurrent ? { scale: 1.04 } : { scale: 1 }}
      className={`flex flex-col items-center gap-1 ${position === 'left' ? 'items-start' : 'items-end'}`}
    >
      {inner}
    </motion.div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
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
    setMyId(localStorage.getItem('crazy8_playerId') ?? '');
  }, []);

  useEffect(() => {
    if (!gameId) return;
    const unsub = subscribeToGame(gameId, s => setGame(s));
    return unsub;
  }, [gameId]);

  useEffect(() => {
    if (!game) return;
    fetchAllStats().then(setStats).catch(() => {});
  }, [game?.status, game?.playerOrder.length]);

  useEffect(() => {
    if (!game?.lastAction) return;
    setActionMsg(game.lastAction);
    const t = setTimeout(() => setActionMsg(''), 3000);
    return () => clearTimeout(t);
  }, [game?.lastAction]);

  const isMyTurn = game ? game.playerOrder[game.currentPlayerIndex] === myId : false;
  const myHand = game?.players[myId]?.hand ?? [];
  const topCard = game?.discardPile[game.discardPile.length - 1] ?? null;

  const playable = useCallback((hand: Card[]) => {
    if (!game || !topCard || !isMyTurn) return new Set<string>();
    return new Set(hand.filter(c => canPlayCard(c, topCard, game.currentColor, game.pendingDraw)).map(c => c.id));
  }, [game, topCard, isMyTurn]);

  const playableSet = playable(myHand);

  function handleCardTap(card: Card) {
    if (!playableSet.has(card.id)) return;
    if (selectedCardId === card.id) {
      card.type === 'wild8' ? setShowColorPicker(true) : submitPlay(card.id);
    } else {
      setSelectedCardId(card.id);
    }
  }

  async function submitPlay(cardId: string, color?: Color) {
    setShowColorPicker(false);
    setSelectedCardId(null);
    setError('');
    try { await playCard(gameId, myId, cardId, color); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  }

  async function handleDraw() {
    setSelectedCardId(null);
    setError('');
    try { await drawCard(gameId, myId); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error drawing'); }
  }

  async function handleReset() {
    try { await resetGame(gameId); router.replace(`/lobby/${gameId}`); }
    catch { setError('Error resetting'); }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!game) {
    return (
      <div className="h-full flex items-center justify-center" style={TABLE_BG}>
        <div className="w-8 h-8 rounded-full border-2 border-white border-t-transparent animate-spin" />
      </div>
    );
  }

  // ── Win screen ─────────────────────────────────────────────────────────────
  if (game.status === 'finished') {
    const winner = game.players[game.winner ?? ''];
    const iWon = game.winner === myId;
    const winnerIndex = game.playerOrder.indexOf(game.winner ?? '');
    const winnerWins = stats[game.winner ?? '']?.wins ?? 0;

    return (
      <div className="h-full flex flex-col items-center justify-center px-5" style={TABLE_BG}>
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="text-center w-full max-w-xs"
        >
          <div className="text-7xl mb-4">{iWon ? '🎉' : '😢'}</div>
          <div className="flex justify-center mb-3">
            <PlayerAvatar name={winner?.name ?? '?'} index={winnerIndex} wins={winnerWins} size="lg" />
          </div>
          <h1 className="text-3xl font-black text-white mb-1">
            {iWon ? 'You Win!' : `${winner?.name ?? '?'} Wins!`}
          </h1>
          {winnerWins > 0 && (
            <p className="text-yellow-300 font-bold mb-1 text-sm">
              {winnerWins} total win{winnerWins > 1 ? 's' : ''} 🏆
            </p>
          )}

          {/* All player scores */}
          <div className="flex justify-center gap-5 my-6">
            {game.playerOrder.map((pid, i) => (
              <div key={pid} className="flex flex-col items-center gap-1">
                <PlayerAvatar name={game.players[pid]?.name ?? '?'} index={i} wins={stats[pid]?.wins ?? 0} size="sm" />
                <span className="text-white/70 text-[10px]">{game.players[pid]?.name}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            {game.players[myId]?.isHost && (
              <button onClick={handleReset} className="w-full py-4 rounded-2xl font-black bg-white text-gray-900 active:scale-95 transition-transform shadow-xl">
                Play Again
              </button>
            )}
            <button onClick={() => router.replace('/')} className="w-full py-4 rounded-2xl font-bold border-2 border-white/30 text-white active:scale-95 transition-transform">
              Main Menu
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Game board ─────────────────────────────────────────────────────────────
  const currentPlayerId = game.playerOrder[game.currentPlayerIndex];
  const myIndex = game.playerOrder.indexOf(myId);
  const me = game.players[myId];

  // Order other players: starting from the player after me
  const otherPlayerIds = game.playerOrder
    .filter(id => id !== myId)
    // put them in order: top, left, right
    .slice();

  // Assign up to 3 positions
  const topPlayer = otherPlayerIds[0] ? game.players[otherPlayerIds[0]] : null;
  const leftPlayer = otherPlayerIds[1] ? game.players[otherPlayerIds[1]] : null;
  const rightPlayer = otherPlayerIds[2] ? game.players[otherPlayerIds[2]] : null;

  const colorDotStyle: React.CSSProperties = {
    width: 14, height: 14, borderRadius: '50%',
    background: CARD_BG[game.currentColor],
    boxShadow: `0 0 8px ${CARD_BG[game.currentColor]}`,
    flexShrink: 0,
  };

  return (
    <div className="h-full flex flex-col overflow-hidden relative" style={TABLE_BG}>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-3 flex-shrink-0">
        <div className="bg-black/30 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5">
          <div style={colorDotStyle} />
          <span className="text-white text-xs font-bold capitalize">{game.currentColor}</span>
          {game.pendingDraw > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-black rounded-full px-1.5 py-0.5 ml-1">
              +{game.pendingDraw}
            </span>
          )}
        </div>
        <div className="bg-black/30 backdrop-blur-sm rounded-full px-3 py-1.5">
          <span className="text-white/70 text-[11px] font-bold tracking-wider">{gameId}</span>
        </div>
      </div>

      {/* ── Toast ───────────────────────────────────────────── */}
      <AnimatePresence>
        {actionMsg && (
          <motion.div
            key={actionMsg}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-14 left-4 right-4 z-40 flex justify-center pointer-events-none"
          >
            <div className="bg-black/70 backdrop-blur-sm rounded-full px-4 py-1.5 text-white text-xs font-semibold border border-white/10 max-w-[280px] text-center">
              {actionMsg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top player ──────────────────────────────────────── */}
      <div className="flex-shrink-0 flex justify-center pt-3 pb-1 min-h-[100px]">
        {topPlayer ? (
          <OpponentSlot
            player={topPlayer}
            wins={stats[otherPlayerIds[0]]?.wins ?? 0}
            isCurrent={otherPlayerIds[0] === currentPlayerId}
            playerIndex={game.playerOrder.indexOf(otherPlayerIds[0])}
            position="top"
          />
        ) : (
          <div className="h-[100px]" />
        )}
      </div>

      {/* ── Middle row: left | table | right ────────────────── */}
      <div className="flex-1 flex items-center px-2 gap-2 min-h-0">

        {/* Left player */}
        <div className="flex flex-col items-center justify-center w-16 flex-shrink-0">
          {leftPlayer && (
            <OpponentSlot
              player={leftPlayer}
              wins={stats[otherPlayerIds[1]]?.wins ?? 0}
              isCurrent={otherPlayerIds[1] === currentPlayerId}
              playerIndex={game.playerOrder.indexOf(otherPlayerIds[1])}
              position="left"
            />
          )}
        </div>

        {/* Center table */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          {/* Draw + Discard */}
          <div className="flex items-center gap-5">
            {/* Draw pile */}
            <button
              onClick={isMyTurn ? handleDraw : undefined}
              className={`flex flex-col items-center gap-1 ${isMyTurn ? 'active:scale-95' : ''} transition-transform`}
            >
              <div style={{ position: 'relative' }}>
                <FaceDownCard />
                {/* Stack depth shadow cards */}
                <div style={{ position: 'absolute', top: -2, left: -2, zIndex: -1, transform: 'scale(0.97)', opacity: 0.6 }}>
                  <FaceDownCard />
                </div>
                <div style={{ position: 'absolute', top: -4, left: -4, zIndex: -2, transform: 'scale(0.94)', opacity: 0.3 }}>
                  <FaceDownCard />
                </div>
                {/* Card count */}
                <div style={{
                  position: 'absolute', top: -6, right: -6,
                  background: '#fff', color: '#111', fontSize: 9, fontWeight: 900,
                  borderRadius: '50%', width: 18, height: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                }}>
                  {game.drawPile.length}
                </div>
              </div>
              {isMyTurn && (
                <span className="text-white/80 text-[10px] font-bold">
                  {game.pendingDraw > 0 ? `Draw +${game.pendingDraw}` : 'Draw'}
                </span>
              )}
            </button>

            {/* Discard pile */}
            <div className="flex flex-col items-center gap-1">
              {topCard ? (
                <motion.div
                  key={topCard.id}
                  initial={{ scale: 0.7, rotate: -8, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                >
                  <PlayingCard card={topCard} size="md" />
                </motion.div>
              ) : (
                <div style={{ width: 72, height: 104, borderRadius: 10, border: '2px dashed rgba(255,255,255,0.3)' }} />
              )}
            </div>
          </div>

          {/* Turn indicator pill */}
          <div className={`rounded-full px-4 py-1.5 text-xs font-bold text-center max-w-[200px]
            ${isMyTurn ? 'bg-white text-gray-900 shadow-lg' : 'bg-black/40 text-white/80'}`}
          >
            {isMyTurn
              ? game.pendingDraw > 0
                ? `Draw +${game.pendingDraw} or stack a +2`
                : 'Your turn'
              : `${game.players[currentPlayerId]?.name ?? '...'}'s turn`
            }
          </div>

          {error && <p className="text-red-300 text-[11px] text-center">{error}</p>}
        </div>

        {/* Right player */}
        <div className="flex flex-col items-center justify-center w-16 flex-shrink-0">
          {rightPlayer && (
            <OpponentSlot
              player={rightPlayer}
              wins={stats[otherPlayerIds[2]]?.wins ?? 0}
              isCurrent={otherPlayerIds[2] === currentPlayerId}
              playerIndex={game.playerOrder.indexOf(otherPlayerIds[2])}
              position="right"
            />
          )}
        </div>
      </div>

      {/* ── My area ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 pb-2">
        {/* My avatar */}
        <div className="flex justify-center mb-2">
          <div className="flex flex-col items-center gap-0.5">
            <PlayerAvatar
              name={me?.name ?? ''}
              index={myIndex}
              wins={stats[myId]?.wins ?? 0}
              isCurrentTurn={isMyTurn}
              isYou
              size="sm"
            />
            <span className="text-white text-[11px] font-bold drop-shadow">{me?.name}</span>
          </div>
        </div>

        {/* Hand */}
        <div className="overflow-x-auto scrollbar-hide px-3">
          <div className="flex min-w-max pb-2 pt-1" style={{ gap: 6 }}>
            {myHand.map(card => (
              <PlayingCard
                key={card.id}
                card={card}
                playable={playableSet.has(card.id)}
                selected={selectedCardId === card.id}
                onClick={() => handleCardTap(card)}
                size="md"
              />
            ))}
          </div>
        </div>

        {/* Play / Cancel buttons */}
        <AnimatePresence>
          {selectedCardId && !showColorPicker && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="flex gap-2 px-4 pt-1 pb-1"
            >
              <button
                onClick={() => {
                  const card = myHand.find(c => c.id === selectedCardId);
                  if (card?.type === 'wild8') setShowColorPicker(true);
                  else if (selectedCardId) submitPlay(selectedCardId);
                }}
                className="flex-1 py-3 rounded-2xl font-black text-sm bg-white text-gray-900 active:scale-95 transition-transform shadow-lg"
              >
                Play Card
              </button>
              <button
                onClick={() => setSelectedCardId(null)}
                className="px-5 py-3 rounded-2xl font-bold text-sm bg-black/30 border border-white/20 text-white active:scale-95 transition-transform"
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
        onSelect={color => { if (selectedCardId) submitPlay(selectedCardId, color); }}
      />
    </div>
  );
}
