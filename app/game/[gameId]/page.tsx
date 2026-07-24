'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  subscribeToGame,
  playCard,
  drawCard,
  votePlayAgain,
  foolishMistake,
  missedUnoCall,
  callOneCard,
  catchMissedCall,
  leaveGame,
  turnTimedOut,
} from '@/lib/gameService';
import { fetchAllStats, type PlayerStats } from '@/lib/playerStats';
import { canPlayCard } from '@/lib/gameLogic';
import { CardFace, CardFan, DrawDeck, CARD_COLORS } from '@/components/PlayingCard';
import { WildPicker } from '@/components/WildPicker';
import { PickupOverlay } from '@/components/PickupOverlay';
import { Wordmark, Watermark8 } from '@/components/Wordmark';
import type { GameState, Card, Color, CardLook, Player } from '@/lib/types';

const TURN_SECONDS = 20;
const QUICKFIRE_SECONDS = 6;
const QUICKFIRE_BACKSTOP_SECONDS = 2; // extra grace before opponents enforce a timeout

// "take two for your foolish mistake" — phrased for the tapper, third-person for everyone else
function mistakeMessage(name: string, penalty: number, isSelf: boolean): string {
  const word = penalty === 2 ? 'two' : String(penalty);
  return isSelf ? `You take ${word} for your foolish mistake!` : `${name} takes ${word} for a foolish mistake!`;
}

// ─── Opponent seat (desktop)  ────────────
function OpponentSeat({
  player,
  isCurrent,
  isSkipped,
  wins,
  side,
  catchable,
  onCatch,
}: {
  player: Player;
  isCurrent: boolean;
  isSkipped: boolean;
  wins: number;
  side: 'top' | 'left' | 'right';
  catchable: boolean;
  onCatch: () => void;
}) {
  const label = (
    <div
      className="heading"
      style={{
        fontSize: 12,
        letterSpacing: '.05em',
        whiteSpace: 'nowrap',
        color: isCurrent ? 'var(--color-accent)' : 'color-mix(in srgb,#f4efe7 65%,transparent)',
        textShadow: isCurrent ? '0 0 12px color-mix(in srgb,var(--color-accent) 60%,transparent)' : 'none',
      }}
    >
      {player.name.toUpperCase()} · {player.hand.length}
      <span style={{ color: 'var(--color-gold)' }}> {wins > 0 ? `★${wins}` : '★'}</span>
      {isSkipped && <span style={{ color: 'var(--color-accent)' }}> · ⊘</span>}
      {catchable && <span style={{ color: 'var(--color-accent)' }}> · ASK?</span>}
    </div>
  );

  const fan = (
    <CardFan
      count={player.hand.length}
      direction={side === 'top' ? 'horizontal' : 'vertical'}
      w={side === 'top' ? 44 : 54}
      h={side === 'top' ? 64 : 78}
    />
  );

  const stack = (
    <div style={{ position: 'relative' }}>
      {catchable ? (
        <motion.button
          type="button"
          onClick={onCatch}
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
          aria-label={`Ask ${player.name} how many cards`}
          style={{
            border: 0,
            padding: 2,
            background: 'none',
            cursor: 'pointer',
            borderRadius: 10,
            boxShadow: '0 0 0 2px var(--color-accent), 0 0 16px color-mix(in srgb,var(--color-accent) 55%,transparent)',
          }}
        >
          {fan}
        </motion.button>
      ) : (
        fan
      )}
      <AnimatePresence>
        {isSkipped && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 20,
            }}
          >
            <span
              className="heading"
              style={{
                color: 'var(--color-accent)',
                fontSize: 34,
                textShadow: '0 2px 8px rgba(0,0,0,.6)',
              }}
            >
              ✕
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (side === 'top') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        {stack}
        {label}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {side === 'left' && label}
      {stack}
      {side === 'right' && label}
    </div>
  );
}

// ─── Opponent chip (mobile) ───────────────────────────────────────────────────
function OppChip({
  player,
  isCurrent,
  isSkipped,
  catchable,
  onCatch,
}: {
  player: Player;
  isCurrent: boolean;
  isSkipped: boolean;
  catchable: boolean;
  onCatch: () => void;
}) {
  const chipStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '7px 10px',
    background: 'rgba(0,0,0,.32)',
    border: isCurrent || catchable ? '1.5px solid var(--color-accent)' : '1px solid rgba(248,244,244,.18)',
    borderRadius: 14,
    color: '#f4efe7',
    cursor: catchable ? 'pointer' : 'default',
    boxShadow: catchable
      ? '0 0 0 2px rgba(248,244,244,.4), 0 0 14px color-mix(in srgb,var(--color-accent) 55%,transparent)'
      : isCurrent ? '0 0 14px color-mix(in srgb,var(--color-accent) 45%,transparent)' : 'none',
    opacity: isSkipped ? 0.55 : 1,
    fontFamily: 'inherit',
  };

  const content = (
    <>
      <div
        style={{
          width: 16,
          height: 24,
          borderRadius: 3,
          background: '#141110',
          backgroundImage: 'repeating-linear-gradient(45deg,#161616 0px,#161616 3px,#262626 3px,#262626 6px)',
          border: '1px solid #333',
          flex: 'none',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
        <span className="heading" style={{ fontSize: 11, maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {player.name.toUpperCase()}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-gold)' }}>
          {player.hand.length} cards
        </span>
      </div>
      {isSkipped ? (
        <span className="heading" style={{ color: 'var(--color-accent)', fontSize: 12 }}>✕</span>
      ) : catchable ? (
        <span className="heading" style={{ color: 'var(--color-accent)', fontSize: 9, letterSpacing: '.04em' }}>ASK?</span>
      ) : (
        player.hand.length === 1 && (
          <span
            style={{
              background: 'var(--color-accent)',
              color: '#fff',
              fontSize: 8,
              fontWeight: 800,
              padding: '2px 5px',
              borderRadius: 8,
              letterSpacing: '.06em',
            }}
          >
            UNO
          </span>
        )
      )}
    </>
  );

  if (catchable) {
    return (
      <motion.button
        type="button"
        onClick={onCatch}
        aria-label={`Ask ${player.name} how many cards`}
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
        style={chipStyle}
      >
        {content}
      </motion.button>
    );
  }
  return <div style={chipStyle}>{content}</div>;
}

// ─── UNO! button ──────────────────────────────────────────────────────────────
function UnoButton({
  armed,
  called,
  onClick,
  compact,
}: {
  armed: boolean;
  called: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={armed ? onClick : undefined}
      style={{
        width: compact ? 128 : 150,
        height: compact ? 48 : 72,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? 2 : 3,
        flex: 'none',
        cursor: armed ? 'pointer' : 'default',
        borderRadius: compact ? 14 : 16,
        border: armed || called ? 0 : `${compact ? 1.5 : 2}px solid rgba(248,244,244,.22)`,
        background: called ? '#141110' : armed ? 'var(--color-accent)' : 'transparent',
        color: armed || called ? '#f8f4f4' : 'rgba(248,244,244,.45)',
        fontFamily: 'var(--font-heading)',
        fontWeight: 800,
        fontStyle: 'italic',
        boxShadow: armed
          ? compact
            ? '0 0 0 2px rgba(248,244,244,.8), 0 6px 16px rgba(0,0,0,.4)'
            : '0 0 0 3px rgba(248,244,244,.85), 0 0 26px color-mix(in srgb,var(--color-accent) 60%,transparent)'
          : 'none',
        animation: armed ? 'unopulse 1s ease-in-out infinite' : 'none',
      }}
    >
      <span style={{ fontSize: compact ? 15 : 22, lineHeight: 1 }}>{called ? 'CALLED ✓' : 'ONE CARD!'}</span>
    </button>
  );
}

// ─── Hand fan ─────────────────────────────────────────────────────────────────
function HandFan({
  hand,
  playableSet,
  look,
  onPlay,
  w,
  h,
  overlap,
  arc,
}: {
  hand: Card[];
  playableSet: Set<string>;
  look: CardLook;
  onPlay: (card: Card) => void;
  w: number;
  h: number;
  overlap: number;
  arc: number;
}) {
  const n = hand.length;
  const mid = (n - 1) / 2;
  // Tighten overlap for very large hands so the fan stays on screen
  const ov = n > 14 ? Math.round(w * 0.72) : overlap;

  return (
    <div
      className="scrollbar-hide"
      style={{
        display: 'flex',
        justifyContent: 'safe center',
        alignItems: 'flex-end',
        minHeight: h + 30,
        overflowX: 'auto',
        overflowY: 'visible',
        paddingTop: 50,
      }}
    >
      {hand.map((card, i) => {
        // Every card is tappable — a tap is a play attempt. Dimming is just a
        // hint of what's safe to play; tapping a dim card still counts (mistake rule).
        const ok = playableSet.has(card.id);
        const rot = (i - mid) * 3.2;
        const lift = Math.abs(i - mid) * arc;
        return (
          <motion.button
            key={card.id}
            type="button"
            onClick={() => onPlay(card)}
            initial={false}
            animate={{ rotate: rot, y: lift + (ok ? -14 : 0) }}
            whileHover={ok ? { rotate: rot, y: -46, scale: 1.06, zIndex: 80 } : { scale: 1.03, zIndex: 80 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            style={{
              marginLeft: i > 0 ? -ov : 0,
              zIndex: i + 1,
              transformOrigin: 'bottom center',
              cursor: 'pointer',
              border: 0,
              padding: 0,
              background: 'none',
              opacity: ok ? 1 : 0.55,
              filter: ok ? 'none' : 'saturate(.8)',
              flex: '0 0 auto',
            }}
          >
            <CardFace card={card} w={w} h={h} look={look} />
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const router = useRouter();
  const [game, setGame] = useState<GameState | null>(null);
  const [stats, setStats] = useState<Record<string, PlayerStats>>({});
  const [myId, setMyId] = useState('');
  const [pendingColorId, setPendingColorId] = useState<string | null>(null);
  const [pendingCardId, setPendingCardId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [skippedPlayerId, setSkippedPlayerId] = useState<string | null>(null);
  const [unoCalled, setUnoCalled] = useState(false);
  const [timer, setTimer] = useState(TURN_SECONDS);
  const [pickup, setPickup] = useState<{ n: number; who: string } | null>(null);
  const prevHandsRef = useRef<Record<string, number> | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  const unoDeadlineRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionInFlightRef = useRef(false);
  const actionMsgTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function flashMessage(msg: string) {
    setActionMsg(msg);
    if (actionMsgTimeoutRef.current) clearTimeout(actionMsgTimeoutRef.current);
    actionMsgTimeoutRef.current = setTimeout(() => setActionMsg(''), 3000);
  }
  useEffect(() => () => { if (actionMsgTimeoutRef.current) clearTimeout(actionMsgTimeoutRef.current); }, []);

  useEffect(() => {
    if (!game?.lastAction) return;
    if (game.lastMistakeId) {
      const isSelf = game.lastMistakeId === myId;
      const name = game.players[game.lastMistakeId]?.name ?? 'Someone';
      flashMessage(mistakeMessage(name, game.lastMistakePenalty ?? 2, isSelf));
    } else {
      flashMessage(game.lastAction);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.lastAction, game?.lastMistakeId, game?.lastMistakePenalty, myId]);

  // Skip indicator on the affected player
  useEffect(() => {
    if (!game?.lastSkippedId) return;
    setSkippedPlayerId(game.lastSkippedId);
    const t = setTimeout(() => setSkippedPlayerId(null), 1800);
    return () => clearTimeout(t);
  }, [game?.lastSkippedId]);

  // When host resets the game, everyone returns to the lobby
  useEffect(() => {
    if (game?.status === 'lobby') router.replace(`/lobby/${gameId}`);
  }, [game?.status, gameId, router]);

  // Pickup animation: fire when any player's hand grows mid-game
  useEffect(() => {
    if (!game) return;
    const lengths = Object.fromEntries(
      game.playerOrder.map(id => [id, game.players[id]?.hand.length ?? 0]),
    );
    const prev = prevHandsRef.current;
    const statusChanged = prevStatusRef.current !== game.status;
    prevHandsRef.current = lengths;
    prevStatusRef.current = game.status;
    if (game.status !== 'playing' || !prev || statusChanged) return;

    for (const id of game.playerOrder) {
      const grew = lengths[id] - (prev[id] ?? lengths[id]);
      if (grew > 0) {
        const who = id === myId ? 'YOU' : (game.players[id]?.name ?? 'PLAYER').toUpperCase();
        setPickup({ n: grew, who });
        const t = setTimeout(() => setPickup(null), 1500);
        return () => clearTimeout(t);
      }
    }
  }, [game, myId]);

  // Turn timer — cosmetic 20 s in classic, a very real 6 s in Quick Fire.
  // Also re-arms when the current player's hand size changes (drawing a
  // playable card keeps the turn, so the clock has to restart).
  const quickFire = game?.gameMode === 'quickfire';
  const turnSeconds = quickFire ? QUICKFIRE_SECONDS : TURN_SECONDS;
  const currentTurnId = game?.playerOrder[game.currentPlayerIndex] ?? null;
  const currentTurnHandLen = (currentTurnId && game?.players[currentTurnId]?.hand.length) || 0;
  useEffect(() => {
    setTimer(turnSeconds);
  }, [currentTurnId, currentTurnHandLen, turnSeconds]);
  useEffect(() => {
    if (!game || game.status !== 'playing' || currentTurnId !== myId) return;
    const iv = setInterval(() => setTimer(t => Math.max(0, Math.round((t - 0.1) * 10) / 10)), 100);
    return () => clearInterval(iv);
  }, [game?.status, currentTurnId, currentTurnHandLen, myId]);

  // Quick Fire enforcement: when the clock expires, the current player's own
  // client submits the timeout (draw + lose the turn). Everyone else fires a
  // couple of seconds later as a backstop in case that client disconnected —
  // the transaction no-ops if the turn has already moved on.
  useEffect(() => {
    if (!game || game.status !== 'playing' || !quickFire || !currentTurnId) return;
    const graceMs = currentTurnId === myId ? 0 : QUICKFIRE_BACKSTOP_SECONDS * 1000;
    const t = setTimeout(() => { void turnTimedOut(gameId, currentTurnId); }, QUICKFIRE_SECONDS * 1000 + graceMs);
    return () => clearTimeout(t);
  }, [game?.status, quickFire, currentTurnId, currentTurnHandLen, myId, gameId]);

  const isMyTurn = game ? currentTurnId === myId : false;
  const myHand = useMemo(() => game?.players[myId]?.hand ?? [], [game, myId]);
  // Optimistic: hide the card being submitted instantly, don't wait on the round trip
  const displayHand = useMemo(
    () => (pendingCardId ? myHand.filter(c => c.id !== pendingCardId) : myHand),
    [myHand, pendingCardId],
  );
  const topCard = game?.discardPile[game.discardPile.length - 1] ?? null;

  // Re-arm the UNO button whenever the hand grows past 2 again
  useEffect(() => {
    if (myHand.length > 2 && unoCalled) setUnoCalled(false);
  }, [myHand.length, unoCalled]);

  // Down to your last card and haven't called it — 10 second window before
  // you auto pick up 2. Cancelled by calling it or by the hand count changing
  // (played out to win, drew more cards, the optimistic dip reverting, etc.)
  useEffect(() => {
    if (unoDeadlineRef.current) { clearTimeout(unoDeadlineRef.current); unoDeadlineRef.current = null; }
    if (!game || game.status !== 'playing' || displayHand.length !== 1 || unoCalled) return;
    unoDeadlineRef.current = setTimeout(() => { void missedUnoCall(gameId, myId); }, 10000);
    return () => { if (unoDeadlineRef.current) clearTimeout(unoDeadlineRef.current); };
  }, [displayHand.length, unoCalled, game?.status, gameId, myId]);

  const playableSet = useMemo(() => {
    if (!game || !topCard || !isMyTurn) return new Set<string>();
    return new Set(
      myHand.filter(c => canPlayCard(c, topCard, game.currentColor, game.pendingDraw)).map(c => c.id),
    );
  }, [game, topCard, isMyTurn, myHand]);

  async function submitPlay(cardId: string, color?: Color) {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setPendingColorId(null);
    setError('');
    setPendingCardId(cardId); // hide it from the fan immediately — no waiting on the round trip
    try {
      await playCard(gameId, myId, cardId, color);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setPendingCardId(null);
      actionInFlightRef.current = false;
    }
  }

  async function submitMistake(cardId: string) {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setError('');
    try {
      await foolishMistake(gameId, myId, cardId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      actionInFlightRef.current = false;
    }
  }

  // A tap is a play attempt. Legal card → play it (or open the colour picker
  // for wild8/+4). Illegal card → foolish mistake, pick up 2 (+ any live stack).
  function handlePlay(card: Card) {
    if (pickup || actionInFlightRef.current || pendingColorId) return;
    if (!playableSet.has(card.id)) {
      // Out of turn: flat 2, doesn't touch whatever the actual current player owes.
      const penalty = isMyTurn ? 2 + (game?.pendingDraw ?? 0) : 2;
      flashMessage(mistakeMessage('', penalty, true));
      void submitMistake(card.id);
      return;
    }
    if (card.type === 'wild8' || card.type === 'draw4') { setPendingColorId(card.id); return; }
    void submitPlay(card.id);
  }

  async function handleDraw() {
    if (!isMyTurn || pickup || actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setError('');
    try { await drawCard(gameId, myId); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error drawing'); }
    finally { actionInFlightRef.current = false; }
  }

  async function handleVotePlayAgain() {
    try { await votePlayAgain(gameId, myId); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  }

  // Another player has 1 card and hasn't called it — tap their stack to catch them.
  async function handleCatch(targetId: string) {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setError('');
    try { await catchMissedCall(gameId, myId, targetId); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { actionInFlightRef.current = false; }
  }

  async function handleCallOneCard() {
    setUnoCalled(true); // optimistic — opponents see the real, server-confirmed flag
    try { await callOneCard(gameId, myId); }
    catch (e) { setUnoCalled(false); setError(e instanceof Error ? e.message : 'Error'); }
  }

  async function handleLeave() {
    try { await leaveGame(gameId, myId); } catch { /* best-effort, still navigate away */ }
    router.push('/');
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!game) {
    return (
      <div className="h-full flex items-center justify-center">
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  const look: CardLook = game.cardLook ?? 'solid';
  const me = game.players[myId];
  const myWins = stats[myId]?.wins ?? 0;
  const col = CARD_COLORS[game.currentColor] ?? CARD_COLORS.red;

  // ── Winner screen ──────────────────────────────────────────────────────────
  if (game.status === 'finished') {
    const winner = game.players[game.winner ?? ''];
    const iWon = game.winner === myId;
    const winLine = iWon ? 'YOU WIN' : `${(winner?.name ?? '?').toUpperCase()} WINS`;
    const endedByLeave = !!game.endedByLeave;
    const kicker = endedByLeave ? 'Opponent left' : 'Round complete';
    const subtitleText = endedByLeave
      ? game.lastAction
      : `GG. First to empty the hand takes the round${iWon ? ' — that’s you' : ''}. Run it back?`;
    const standings = game.playerOrder
      .map(id => game.players[id])
      .filter(Boolean)
      .sort((a, b) => a.hand.length - b.hand.length);

    const standingsTable = (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr>
            {['Rank', 'Player', 'Cards left'].map((th, i) => (
              <th
                key={th}
                style={{
                  textAlign: i === 2 ? 'right' : 'left',
                  padding: '0 0 10px',
                  width: i === 0 ? 48 : undefined,
                  borderBottom: '2px solid var(--color-divider)',
                }}
              >
                <span className="field-label" style={{ margin: 0 }}>{th}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {standings.map((p, i) => (
            <tr key={p.id}>
              <td className="heading" style={{ padding: '12px 0', borderBottom: '1px solid var(--color-divider)' }}>{i + 1}</td>
              <td className="heading" style={{ padding: '12px 0', borderBottom: '1px solid var(--color-divider)' }}>
                {p.name.toUpperCase()}
                {p.id === myId && <span className="text-muted" style={{ fontWeight: 400 }}> · YOU</span>}
              </td>
              <td style={{ padding: '12px 0', textAlign: 'right', borderBottom: '1px solid var(--color-divider)' }}>{p.hand.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );

    const totalPlayers = game.playerOrder.length;
    const playAgainVotes = game.playerOrder.filter(id => game.players[id]?.playAgain).length;
    const iVotedPlayAgain = !!game.players[myId]?.playAgain;
    const hostId = game.playerOrder.find(id => game.players[id]?.isHost);
    const hostVoted = !!hostId && !!game.players[hostId]?.playAgain;

    const playAgain = (
      <button
        type="button"
        onClick={handleVotePlayAgain}
        className={iVotedPlayAgain ? 'btn btn-secondary' : 'btn btn-primary'}
        style={{ fontSize: 15, padding: '15px 22px' }}
      >
        {iVotedPlayAgain ? "YOU'RE IN" : 'PLAY AGAIN'} <span>{iVotedPlayAgain ? '✓' : '↻'}</span>
      </button>
    );
    const playAgainStatus = !endedByLeave && (
      <span className="text-muted" style={{ fontSize: 12 }}>
        {hostVoted ? '✓ Host ready' : 'Waiting on host'} · {playAgainVotes}/{totalPlayers} voted to play again
      </span>
    );
    const mainMenu = (
      <button
        type="button"
        onClick={() => router.replace('/')}
        className="btn"
        style={{
          background: 'transparent',
          color: '#f4efe7',
          border: '1px solid color-mix(in srgb,#f4efe7 45%,transparent)',
          fontSize: 15,
          padding: '15px 22px',
        }}
      >
        MAIN MENU
      </button>
    );

    return (
      <div className="h-full relative overflow-hidden">
        {/* Desktop winner */}
        <div className="hidden lg:grid absolute inset-0" style={{ gridTemplateColumns: '1.1fr 1fr' }}>
          <div
            style={{
              background: 'linear-gradient(155deg,#2a221c,#161210)',
              padding: '56px 48px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
              borderRight: '2px solid var(--color-divider)',
            }}
          >
            <Watermark8 size={400} opacity={0.13} right={-40} bottom={-100} />
            <div className="kicker" style={{ marginBottom: 16, position: 'relative' }}>{kicker}</div>
            <div
              className="heading"
              style={{ fontSize: 'clamp(72px,8vw,120px)', lineHeight: 0.84, letterSpacing: '-.04em', position: 'relative' }}
            >
              {winLine}
            </div>
            <p style={{ fontSize: 18, maxWidth: 380, margin: '26px 0 0', opacity: 0.8, position: 'relative' }}>
              {subtitleText}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 40, position: 'relative' }}>
              <div style={{ display: 'flex', gap: 12 }}>
                {playAgain}
                {mainMenu}
              </div>
              {playAgainStatus}
            </div>
          </div>
          <div style={{ padding: '56px 44px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h4 className="heading" style={{ margin: '0 0 14px', fontSize: 22 }}>Final standings</h4>
            {standingsTable}
          </div>
        </div>

        {/* Mobile winner */}
        <div
          className="lg:hidden absolute inset-0 flex flex-col items-center justify-center"
          style={{ padding: '0 30px', gap: 16, textAlign: 'center' }}
        >
          <div className="kicker" style={{ fontSize: 11 }}>{kicker}</div>
          <div className="heading" style={{ fontSize: 56, lineHeight: 0.9, letterSpacing: '-.03em' }}>
            {iWon ? <>YOU<br />WIN</> : winLine}
          </div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 11px',
              border: '1px solid color-mix(in srgb,#f4b400 55%,transparent)',
              borderRadius: 12,
              color: 'var(--color-gold)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '.06em',
            }}
          >
            ★ {stats[game.winner ?? '']?.wins ?? 0} ROUNDS WON
          </span>
          <div style={{ width: '100%', maxWidth: 320 }}>{standingsTable}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10, width: '100%', maxWidth: 320 }}>
            {playAgain}
            {mainMenu}
            {playAgainStatus}
          </div>
        </div>
      </div>
    );
  }

  // ── Table screen ───────────────────────────────────────────────────────────
  const myIndex = game.playerOrder.indexOf(myId);
  const opponents = (
    myIndex >= 0
      ? [...game.playerOrder.slice(myIndex + 1), ...game.playerOrder.slice(0, myIndex)]
      : game.playerOrder.filter(id => id !== myId)
  ).map(id => game.players[id]).filter(Boolean);

  // Seat distribution: first opponent left, last right, the rest across the top
  let leftOpp: Player[] = [];
  let rightOpp: Player[] = [];
  let topOpp: Player[] = [];
  if (opponents.length <= 2) {
    topOpp = opponents;
  } else {
    leftOpp = [opponents[0]];
    rightOpp = [opponents[opponents.length - 1]];
    topOpp = opponents.slice(1, -1);
  }

  const turnLabel = isMyTurn
    ? `${quickFire ? '⚡ ' : ''}YOUR TURN · ${Math.ceil(timer)}S`
    : `${(game.players[currentTurnId ?? '']?.name ?? '...').toUpperCase()}’S TURN…`;

  const clockwise = game.direction === 1;
  const unoArmed = displayHand.length <= 2 && displayHand.length > 0 && !unoCalled;
  const pendingChip = game.pendingDraw > 0 && (
    <span
      className="heading"
      style={{ color: 'var(--color-gold)', fontSize: 11, letterSpacing: '.1em' }}
    >
      · PICK UP +{game.pendingDraw}
    </span>
  );

  const discardCard = topCard && (
    <motion.div
      key={topCard.id}
      initial={{ scale: 0.7, rotate: -14, opacity: 0 }}
      animate={{ scale: 1, rotate: -5, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 24 }}
    >
      <CardFace card={topCard} w={108} h={158} look={look} />
    </motion.div>
  );

  const toast = (
    <AnimatePresence>
      {actionMsg && (
        <motion.div
          key={actionMsg}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'absolute',
            top: 70,
            left: 0,
            right: 0,
            zIndex: 90,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            className="glass"
            style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, letterSpacing: '.03em', maxWidth: 320, textAlign: 'center' }}
          >
            {actionMsg}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const iconBtn: React.CSSProperties = {
    width: 38,
    height: 38,
    border: '2px solid color-mix(in srgb,#f4efe7 25%,transparent)',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'color-mix(in srgb,#f4efe7 80%,transparent)',
    background: 'transparent',
    cursor: 'pointer',
  };

  return (
    <div className="h-full relative overflow-hidden">
      <Watermark8 />

      {/* ═══ Desktop table ═══════════════════════════════════════════ */}
      <div className="hidden lg:block absolute inset-0">
        {/* Corner controls */}
        <div style={{ position: 'absolute', top: 18, left: 20, display: 'flex', gap: 10, zIndex: 20 }}>
          <button
            type="button"
            style={iconBtn}
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen();
              else document.documentElement.requestFullscreen().catch(() => {});
            }}
            aria-label="Toggle fullscreen"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
            </svg>
          </button>
          <Wordmark size={16} style={{ alignSelf: 'center' }} />
          {quickFire && <span className="tag tag-accent" style={{ alignSelf: 'center' }}>⚡ QUICK FIRE</span>}
        </div>
        <div style={{ position: 'absolute', top: 18, right: 20, display: 'flex', gap: 10, zIndex: 20 }}>
          <button type="button" onClick={handleLeave} style={iconBtn} aria-label="Leave game">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {toast}

        {/* Top opponents */}
        <div style={{ position: 'absolute', top: 64, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 54 }}>
          {topOpp.map(p => (
            <OpponentSeat
              key={p.id}
              player={p}
              side="top"
              isCurrent={p.id === currentTurnId}
              isSkipped={p.id === skippedPlayerId}
              wins={stats[p.id]?.wins ?? 0}
              catchable={p.hand.length === 1 && !p.unoCalled}
              onCatch={() => handleCatch(p.id)}
            />
          ))}
        </div>
        {/* Left opponent */}
        <div style={{ position: 'absolute', left: 44, top: '50%', transform: 'translateY(-50%)' }}>
          {leftOpp.map(p => (
            <OpponentSeat
              key={p.id}
              player={p}
              side="left"
              isCurrent={p.id === currentTurnId}
              isSkipped={p.id === skippedPlayerId}
              wins={stats[p.id]?.wins ?? 0}
              catchable={p.hand.length === 1 && !p.unoCalled}
              onCatch={() => handleCatch(p.id)}
            />
          ))}
        </div>
        {/* Right opponent */}
        <div style={{ position: 'absolute', right: 44, top: '50%', transform: 'translateY(-50%)' }}>
          {rightOpp.map(p => (
            <OpponentSeat
              key={p.id}
              player={p}
              side="right"
              isCurrent={p.id === currentTurnId}
              isSkipped={p.id === skippedPlayerId}
              wins={stats[p.id]?.wins ?? 0}
              catchable={p.hand.length === 1 && !p.unoCalled}
              onCatch={() => handleCatch(p.id)}
            />
          ))}
        </div>

        {/* Center pile */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '46%',
            transform: 'translate(-50%,-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 26,
          }}
        >
          <div
            style={{
              padding: 6,
              borderRadius: 18,
              boxShadow: `0 0 0 2px ${col.bg}, 0 0 34px color-mix(in srgb, ${col.bg} 45%, transparent)`,
            }}
          >
            {discardCard}
          </div>
          <DrawDeck w={104} h={150} onClick={handleDraw} disabled={!isMyTurn || !!pickup} />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              color: 'color-mix(in srgb,#f4efe7 55%,transparent)',
            }}
          >
            <svg
              width="46"
              height="46"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: clockwise ? 'none' : 'scaleX(-1)' }}
            >
              <path d="M21 12a9 9 0 1 1-3-6.7" />
              <path d="M21 3v5h-5" />
            </svg>
            <span style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' }}>
              {clockwise ? 'Clockwise' : 'Anticlockwise'}
            </span>
          </div>
        </div>

        {/* In play row */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 'calc(46% + 122px)',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'color-mix(in srgb,#f4efe7 75%,transparent)',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ width: 14, height: 14, display: 'inline-block', background: col.bg, borderRadius: 3 }} />
          <span style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 600 }}>
            In play · {col.name}
          </span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span
            style={{
              fontSize: 11,
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              fontWeight: 700,
              color: isMyTurn ? 'var(--color-accent)' : 'color-mix(in srgb,#f4efe7 75%,transparent)',
            }}
          >
            {turnLabel}
          </span>
          {pendingChip}
          {error && <span style={{ color: 'var(--color-accent)', fontSize: 11, fontWeight: 700 }}>· {error.toUpperCase()}</span>}
        </div>

        {/* Your zone */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 18,
            display: 'grid',
            gridTemplateColumns: '270px 1fr 270px',
            alignItems: 'end',
            gap: 14,
            padding: '0 30px',
          }}
        >
          {/* You-pod */}
          <div
            className="glass"
            style={{
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              justifySelf: 'start',
              ...(isMyTurn
                ? {
                    border: '1px solid color-mix(in srgb,var(--color-accent) 60%,transparent)',
                    boxShadow: '0 0 20px color-mix(in srgb,var(--color-accent) 25%,transparent)',
                  }
                : {}),
            }}
          >
            <div
              className="heading"
              style={{
                width: 44,
                height: 44,
                flex: 'none',
                borderRadius: 12,
                background: 'var(--color-accent)',
                color: '#f8f4f4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 15,
              }}
            >
              {(me?.name ?? 'P1').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <span className="heading" style={{ fontSize: 15, letterSpacing: '.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {(me?.name ?? '').toUpperCase()} · {displayHand.length} CARDS
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '.06em',
                  color: isMyTurn ? 'var(--color-accent)' : 'color-mix(in srgb,#f4efe7 55%,transparent)',
                }}
              >
                {turnLabel}
              </span>
              <span
                style={{
                  alignSelf: 'flex-start',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '2px 9px',
                  border: '1px solid color-mix(in srgb,#f4b400 55%,transparent)',
                  borderRadius: 12,
                  color: 'var(--color-gold)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '.06em',
                }}
              >
                ★ {myWins} ROUNDS WON
              </span>
            </div>
          </div>

          {/* Hand fan */}
          <HandFan hand={displayHand} playableSet={playableSet} look={look} onPlay={handlePlay} w={88} h={128} overlap={26} arc={4} />

          {/* UNO button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <UnoButton armed={unoArmed} called={unoCalled} onClick={handleCallOneCard} />
          </div>
        </div>
      </div>

      {/* ═══ Mobile table ════════════════════════════════════════════ */}
      <div className="lg:hidden absolute inset-0 overflow-hidden">
        {/* Round header */}
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 10,
            color: 'color-mix(in srgb,#f4efe7 60%,transparent)',
            fontSize: 10,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          {gameId} · Classic ·<span style={{ color: 'var(--color-gold)' }}>★ {myWins} won</span>
        </div>
        <button
          type="button"
          onClick={handleLeave}
          style={{ ...iconBtn, width: 30, height: 30, position: 'absolute', top: 8, right: 10, zIndex: 30 }}
          aria-label="Leave game"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        {toast}

        {/* Opponent chips */}
        <div
          style={{
            position: 'absolute',
            top: 36,
            left: 8,
            right: 8,
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {opponents.map(p => (
            <OppChip
              key={p.id}
              player={p}
              isCurrent={p.id === currentTurnId}
              isSkipped={p.id === skippedPlayerId}
              catchable={p.hand.length === 1 && !p.unoCalled}
              onCatch={() => handleCatch(p.id)}
            />
          ))}
        </div>

        {/* Turn pill */}
        <div style={{ position: 'absolute', top: 108, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <span
            className="heading"
            style={{
              padding: '4px 12px',
              borderRadius: 12,
              fontSize: 10,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              background: isMyTurn ? 'var(--color-accent)' : 'rgba(0,0,0,.35)',
              color: isMyTurn ? '#fff' : 'color-mix(in srgb,#f4efe7 65%,transparent)',
              border: isMyTurn ? 0 : '1px solid rgba(248,244,244,.16)',
            }}
          >
            {turnLabel}
          </span>
        </div>

        {/* Center pile */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '40%',
            transform: 'translate(-50%,-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              padding: 4,
              borderRadius: 14,
              boxShadow: `0 0 0 2px ${col.bg}, 0 0 24px color-mix(in srgb, ${col.bg} 45%, transparent)`,
            }}
          >
            {topCard && (
              <motion.div
                key={topCard.id}
                initial={{ scale: 0.7, rotate: -14, opacity: 0 }}
                animate={{ scale: 1, rotate: -5, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 24 }}
              >
                <CardFace card={topCard} w={74} h={106} look={look} />
              </motion.div>
            )}
          </div>
          <DrawDeck w={62} h={90} onClick={handleDraw} disabled={!isMyTurn || !!pickup} badge={game.drawPile.length} />
        </div>

        {/* In play row */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 'calc(40% + 78px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 6,
            color: 'color-mix(in srgb,#f4efe7 75%,transparent)',
            fontSize: 10,
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          <span style={{ width: 12, height: 12, display: 'inline-block', background: col.bg, borderRadius: 3 }} />
          In play · {col.name}
          {pendingChip}
        </div>
        {error && (
          <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(40% + 98px)', textAlign: 'center', color: 'var(--color-accent)', fontSize: 11, fontWeight: 700 }}>
            {error}
          </div>
        )}

        {/* Name + timer bar */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 196,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span className="heading" style={{ fontSize: 13 }}>{(me?.name ?? '').toUpperCase()}</span>
          <span style={{ fontSize: 11, color: 'color-mix(in srgb,#f4efe7 55%,transparent)' }}>· {displayHand.length} CARDS</span>
        </div>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 186,
            transform: 'translateX(-50%)',
            width: 180,
            height: 4,
            borderRadius: 2,
            background: 'rgba(248,244,244,.14)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${isMyTurn ? Math.max(0, Math.min(100, (timer / turnSeconds) * 100)) : 0}%`,
              background: 'var(--color-accent)',
              borderRadius: 2,
            }}
          />
        </div>

        {/* Hand fan */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 84 }}>
          <HandFan hand={displayHand} playableSet={playableSet} look={look} onPlay={handlePlay} w={56} h={82} overlap={18} arc={3} />
        </div>

        {/* Bottom action bar */}
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 20, display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={handleDraw}
            disabled={!isMyTurn || !!pickup}
            style={{
              flex: 1,
              height: 48,
              border: '1.5px solid rgba(248,244,244,.28)',
              borderRadius: 14,
              background: 'rgba(0,0,0,.3)',
              color: '#f4efe7',
              fontFamily: 'var(--font-heading)',
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '.06em',
              cursor: 'pointer',
              opacity: isMyTurn ? 1 : 0.5,
            }}
          >
            {game.pendingDraw > 0 && isMyTurn ? `DRAW +${game.pendingDraw}` : 'DRAW'}
          </button>
          <UnoButton armed={unoArmed} called={unoCalled} onClick={handleCallOneCard} compact />
        </div>
      </div>

      {/* Pickup animation overlay */}
      {pickup && <PickupOverlay count={pickup.n} who={pickup.who} />}

      {/* Wild / +4 color picker */}
      <WildPicker
        open={pendingColorId !== null}
        subtitle={myHand.find(c => c.id === pendingColorId)?.type === 'draw4' ? 'Request a colour for your +4' : 'Wild card played'}
        onSelect={color => pendingColorId && submitPlay(pendingColorId, color)}
        onCancel={() => setPendingColorId(null)}
      />
    </div>
  );
}
