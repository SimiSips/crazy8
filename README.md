# CuzCrazy8

An online multiplayer Crazy Eights / UNO-style card game. Create a room, share the code, and play in real time — built with Next.js and Firestore.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Add your Firebase project's web config to `.env.local` in the project root:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```
3. Run the dev server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## How to play

Enter a name on the menu, then either **Play Now** to join a room by code or **Create Private Room** to host one. In the lobby, the host sets the seat limit, card look, and starting hand size, and starts the game once everyone's ready. First to empty their hand wins the round.

## Rules

### Setup
- 2–8 players per room.
- **Deck:** one 52-card deck for 2–4 players; two decks shuffled together (104 cards) for 5–8 players. Each of the 4 colours (red / green / blue / yellow) has number cards 1–7 and 9 (no 8 — that value is reserved for the wild), plus one Skip, one Reverse, and one Draw Two. There are also 4 **Wild 8s** and 4 **Wild Draw Fours**, both colourless ("black") until played — you choose the colour when you play one.
- **Starting hand:** 5, 8, or 10 cards, set by the host (default 8).
- The card that opens the discard pile is always a plain number card.

### Taking a turn
Turns pass clockwise by default (direction can flip — see Reverse below). On your turn, play a legal card or draw one from the deck.

A card is legal if it:
- matches the colour currently in play, **or**
- matches the top card's type/value (e.g. a 7 on a 7, a Skip on a Skip, regardless of colour), **or**
- is a Wild 8 or Wild Draw Four (always playable).

Drawing a card that turns out to be playable lets you play it immediately without losing your turn; otherwise your turn ends.

### Special cards
| Card | Effect |
|---|---|
| **Skip** | The next player's turn is skipped entirely. |
| **Reverse** | Reverses the direction of play. With only 2 players, it acts as a Skip instead. |
| **Draw Two (+2)** | The next player must draw 2 cards, unless they counter (see Stacking below). |
| **Wild 8** | Playable on anything. Choose the new colour. |
| **Wild Draw Four (+4)** | Playable on anything. Choose the new colour, and the next player must draw 4 unless they counter. |

### Stacking a Draw Two / Draw Four
While a +2 or +4 penalty is pending, you can only play:
- another Draw Two or Draw Four (stacking the penalty higher for whoever's next), or
- a **Reverse in the exact colour currently in play** — the +2's own colour, or whatever colour was requested by a +4.

A Reverse doesn't cancel the penalty — it bounces the whole stacked amount back to whoever dealt it and flips the direction of play, so they're the one who now has to draw or counter.

If you can't counter, hit **Draw** to pick up the full stacked amount and pass your turn.

### The "foolish mistake" rule
Tapping a card in your hand is always a real attempt to play it — cards are just dimmed as a hint of what's safe, not disabled.
- Tap a card that doesn't actually match → you pick up 2 cards (plus whatever +2/+4 you were dodging, if it was your turn) and your turn ends.
- Tap any card when it isn't your turn at all → flat 2-card penalty, and it stays whoever's actual turn it is.

### Calling "ONE CARD!"
The moment you're down to your last card, you have **10 seconds** to hit the **ONE CARD!** button.
- Miss the window and you automatically pick up 2.
- Any opponent can also tap your single remaining card before you call it — this "asks: how many cards?" and costs you 2 cards immediately, same as timing out.
- Calling early (while still at 2 cards) counts and carries through to your last card, but resets if your hand grows back past 2.

### Winning
First to empty their hand wins the round. Standings are sorted by cards remaining, and each player's rounds-won count carries across replays in the same room.

### Leaving mid-game
Use the **✕** in the corner of the table to leave.
- **3+ players:** you're removed from the game and play continues without you.
- **Exactly 2 players:** leaving ends the round immediately — the remaining player wins by forfeit.

### Game modes
- **Classic:** the standard game. The 20-second turn timer shown on your turn is a visual pace-setter only — it doesn't auto-skip or auto-draw for you.
- **⚡ Quick Fire:** you get **6 seconds** to act on your turn, and the timer is real. Run out of time and you automatically pick up (1 card normally, or the full stacked +2/+4 penalty if one is pending) and the turn moves on. Everything else — stacking, foolish mistakes, calling ONE CARD! — works the same, just much faster.

### Host lobby settings
- **Game mode:** Classic / ⚡ Quick Fire.
- **Card look:** solid / framed / glass — applies to every player's cards.
- **Starting hand:** 5 / 8 / 10 cards.
- **Seats:** 2–8 players.

## Tech stack

Next.js (App Router) + TypeScript, Framer Motion for animation, Firebase Firestore for realtime multiplayer state.
