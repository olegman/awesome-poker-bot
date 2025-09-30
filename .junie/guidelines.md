# Project Development Guidelines (awesome-poker-bot)

These notes capture project-specific details to speed up future development and debugging. Audience: experienced Node.js developers.

## Build & Runtime Configuration

- Node.js: recommend v18+ (tested locally with system Node; project has no engines field). Uses ESM-incompatible CommonJS require.
- Install dependencies:
  - npm install
  - Note: bot.js calls require('dotenv').config(); but package.json does not list dotenv. Install it explicitly in your environment if you plan to run the bot process: npm i dotenv
- Environment:
  - TELEGRAM_BOT_TOKEN must be provided via .env at repo root:
    TELEGRAM_BOT_TOKEN=your_token_here
- Start commands (package.json):
  - Production: npm start → node bot.js
  - Dev (auto-reload): npm run dev → nodemon bot.js
- Telegram transport: long polling (node-telegram-bot-api, polling: true). No webhook setup is present. If you switch to webhooks, ensure to gate polling vs webhook mode via env flags.

## Repository Structure (high-level)

- bot.js — Telegram command layer, chat/game orchestration, keyboards. Avoid coupling tests to this file.
- game.js — Core poker domain: Player, PokerGame classes, hand evaluation, betting rounds, side pots. Export: { PokerGame, Player }.
- card.js — Card and Deck (52-card deck, shuffle via Fisher–Yates), export: { Card, Deck }.
- README.md — Russian user-facing instructions and feature list.
- package.json — scripts: start, dev; deps: node-telegram-bot-api; devDeps: nodemon. Missing dotenv (see above).

## Testing Strategy (no framework dependency)

The project does not ship with a test runner. Core logic (card.js, game.js) is framework-free and can be tested with plain Node + assert. Avoid tests that require Telegram I/O or randomness.

Recommended approach for quick, local tests:

- Create a temporary test script that imports { Card, Deck } and { Player } and exercises pure logic (hand evaluation, combinations, deck behavior). Use Node’s built‑in assert.
- Run it with node, then delete the script to keep the repo clean (see deletion policy below).

Verified example (manually executed during preparation of these guidelines):

- Example test content (save as test_sanity.js temporarily):
  const assert = require('assert');
  const { Deck, Card } = require('./card');
  const { Player } = require('./game');

  (function testDeck() {
    const d = new Deck();
    assert.strictEqual(d.cardsLeft(), 52);
    d.dealCard();
    assert.strictEqual(d.cardsLeft(), 51);
  })();

  (function testEvaluateHandRoyalFlush() {
    const p = new Player(1, 'T');
    const hand = [
      new Card('hearts', 14),
      new Card('hearts', 13),
      new Card('hearts', 12),
      new Card('hearts', 11),
      new Card('hearts', 10),
    ];
    const res = p.evaluateHand(hand);
    assert.strictEqual(res.description, 'Флеш Рояль');
  })();

  (function testBestOfSeven() {
    const p = new Player(2, 'X');
    const seven = [
      new Card('spades', 10),
      new Card('clubs', 11),
      new Card('spades', 12),
      new Card('diamonds', 13),
      new Card('hearts', 14),
      new Card('spades', 2),
      new Card('spades', 3),
    ];
    const best = p.evaluateBestHand(seven);
    assert.strictEqual(best.description, 'Стрит');
    assert.strictEqual(best.high, 14);
  })();

  (function testAceLowStraight() {
    const p = new Player(3, 'Y');
    const hand = [
      new Card('clubs', 14),
      new Card('hearts', 2),
      new Card('hearts', 3),
      new Card('hearts', 4),
      new Card('hearts', 5),
    ];
    const res = p.evaluateHand(hand);
    assert.strictEqual(res.description, 'Стрит');
  })();

  console.log('OK: test_sanity passed');

- Run: node test_sanity.js
- Expected: OK: test_sanity passed
- Cleanup: rm test_sanity.js

Guidelines for adding more tests:

- Keep tests deterministic. Avoid relying on Deck.shuffle() and Math.random(). Prefer building explicit Card arrays.
- To exercise PokerGame without Telegram:
  - Instantiate PokerGame with a dummy chatId (e.g., 1), add players via addPlayer, then stub deck by assigning a prebuilt Deck with a custom cards array (e.g., reverse push order so deck.pop() yields desired sequence).
  - Advance state using startGame(), nextStreet(), and playerAction(). Validate pot/currentBet/sidePots and hand evaluation via getBestHand.
- If you need a formal test runner, consider adding vitest or jest, but that would extend package.json and CI. Given minimalism, plain node + assert is sufficient.

## Domain/Implementation Notes (useful for debugging)

- Hand ranking constants (HAND_RANKINGS) are internal to game.js. Player.evaluateHand returns shape with rank, description, plus fields per combination: high, low, kicker(s); compareHands implements tie-break logic. Royal flush check is a special case (values must match 14..10 straight in one suit).
- A-2-3-4-5 straight is supported (Ace treated low via special-case in isStraight). Ensure tests cover this edge.
- Player state tracks both currentBet (street) and totalBetThisHand. All-in sets isAllIn=true; isRoundComplete considers hasActed and bet matching or all-in.
- Blinds: small=10, big=20; dealerPosition rotates via indices; currentPlayerIndex initialized to first player after big blind on new hand. Pot and currentBet are updated in setBlinds.
- Side pots: data structure sidePots exists; review payout logic before altering betting semantics (look around showdown resolution).
- Deck.reset builds 52 cards and shuffles; deal order is pop() from the end. When injecting a rigged deck for tests, push in reverse order of intended dealing.
- bot.js is stateful (in-memory Map chatId → PokerGame) and uses polling; restarts drop state. If persistence is added, abstract storage behind an interface so tests can provide an in-memory fake.
- Localization: user strings are Russian. Keep new messages consistent. Card.toString renders unicode suits and J/Q/K/A labels.

## Operational Tips

- When running the bot in groups, ensure privacy mode and group permissions are configured for command recognition. BotFather can toggle privacy.
- Avoid running multiple bot instances with the same token in polling mode.
- For reproducible debugging of game flow, add a debug command guarded by an env flag to dump internal state (players, pot, communityCards) — do not expose by default in production chats.

## Deletion Policy for Temporary Artifacts

- Do not commit or leave behind test scaffolding. Any examples created to validate logic should be removed after execution. The only file intentionally added by this process is .junie/guidelines.md.
