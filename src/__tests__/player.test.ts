import { Player, HAND_RANKINGS } from '../game';
import { Card } from '../card';

describe('Player', () => {
  let player: Player;

  beforeEach(() => {
    player = new Player(12345, 'TestPlayer');
  });

  describe('constructor', () => {
    it('should create a player with correct initial state', () => {
      expect(player.id).toBe(12345);
      expect(player.name).toBe('TestPlayer');
      expect(player.chips).toBe(1000);
      expect(player.currentBet).toBe(0);
      expect(player.totalBetThisHand).toBe(0);
      expect(player.hasActed).toBe(false);
      expect(player.isFolded).toBe(false);
      expect(player.isAllIn).toBe(false);
      expect(player.hand).toEqual([]);
    });
  });

  describe('addCard', () => {
    it('should add a card to player hand', () => {
      const card = new Card('hearts', 10);
      player.addCard(card);

      expect(player.hand).toHaveLength(1);
      expect(player.hand[0]).toBe(card);
    });

    it('should add multiple cards', () => {
      player.addCard(new Card('hearts', 10));
      player.addCard(new Card('spades', 5));

      expect(player.hand).toHaveLength(2);
    });
  });

  describe('bet', () => {
    it('should deduct chips and update currentBet', () => {
      const betAmount = player.bet(100);

      expect(betAmount).toBe(100);
      expect(player.chips).toBe(900);
      expect(player.currentBet).toBe(100);
      expect(player.totalBetThisHand).toBe(100);
      expect(player.hasActed).toBe(true);
    });

    it('should handle all-in when betting more than available chips', () => {
      const betAmount = player.bet(1500);

      expect(betAmount).toBe(1000);
      expect(player.chips).toBe(0);
      expect(player.currentBet).toBe(1000);
      expect(player.isAllIn).toBe(true);
    });

    it('should accumulate bets', () => {
      player.bet(100);
      player.bet(50);

      expect(player.chips).toBe(850);
      expect(player.currentBet).toBe(150);
      expect(player.totalBetThisHand).toBe(150);
    });
  });

  describe('fold', () => {
    it('should mark player as folded', () => {
      player.fold();

      expect(player.isFolded).toBe(true);
      expect(player.hasActed).toBe(true);
    });
  });

  describe('resetForNewRound', () => {
    it('should reset round-specific state', () => {
      player.bet(100);
      player.fold();

      player.resetForNewRound();

      expect(player.currentBet).toBe(0);
      expect(player.hasActed).toBe(false);
      expect(player.isFolded).toBe(false);
      expect(player.chips).toBe(900); // chips should remain
    });
  });

  describe('resetForNewGame', () => {
    it('should reset all player state', () => {
      player.addCard(new Card('hearts', 10));
      player.bet(100);
      player.fold();

      player.resetForNewGame();

      expect(player.hand).toEqual([]);
      expect(player.currentBet).toBe(0);
      expect(player.totalBetThisHand).toBe(0);
      expect(player.hasActed).toBe(false);
      expect(player.isFolded).toBe(false);
      expect(player.isAllIn).toBe(false);
    });
  });

  describe('getHandString', () => {
    it('should return empty string for no cards', () => {
      expect(player.getHandString()).toBe('');
    });

    it('should return formatted cards', () => {
      player.addCard(new Card('hearts', 14));
      player.addCard(new Card('spades', 13));

      expect(player.getHandString()).toBe('A♥️ K♠️');
    });
  });

  describe('evaluateHand', () => {
    it('should recognize Royal Flush', () => {
      const cards = [
        new Card('hearts', 14),
        new Card('hearts', 13),
        new Card('hearts', 12),
        new Card('hearts', 11),
        new Card('hearts', 10),
      ];

      const hand = player.evaluateHand(cards);
      expect(hand.rank).toBe(HAND_RANKINGS.ROYAL_FLUSH);
      expect(hand.description).toBe('Флеш Рояль');
    });

    it('should recognize Straight Flush', () => {
      const cards = [
        new Card('spades', 9),
        new Card('spades', 8),
        new Card('spades', 7),
        new Card('spades', 6),
        new Card('spades', 5),
      ];

      const hand = player.evaluateHand(cards);
      expect(hand.rank).toBe(HAND_RANKINGS.STRAIGHT_FLUSH);
      expect(hand.description).toBe('Стрит Флеш');
    });

    it('should recognize Four of a Kind', () => {
      const cards = [
        new Card('hearts', 10),
        new Card('spades', 10),
        new Card('diamonds', 10),
        new Card('clubs', 10),
        new Card('hearts', 5),
      ];

      const hand = player.evaluateHand(cards);
      expect(hand.rank).toBe(HAND_RANKINGS.FOUR_OF_A_KIND);
      expect(hand.description).toBe('Каре');
    });

    it('should recognize Full House', () => {
      const cards = [
        new Card('hearts', 10),
        new Card('spades', 10),
        new Card('diamonds', 10),
        new Card('clubs', 5),
        new Card('hearts', 5),
      ];

      const hand = player.evaluateHand(cards);
      expect(hand.rank).toBe(HAND_RANKINGS.FULL_HOUSE);
      expect(hand.description).toBe('Фулл Хаус');
    });

    it('should recognize Flush', () => {
      const cards = [
        new Card('hearts', 14),
        new Card('hearts', 10),
        new Card('hearts', 7),
        new Card('hearts', 5),
        new Card('hearts', 2),
      ];

      const hand = player.evaluateHand(cards);
      expect(hand.rank).toBe(HAND_RANKINGS.FLUSH);
      expect(hand.description).toBe('Флеш');
    });

    it('should recognize Straight', () => {
      const cards = [
        new Card('hearts', 9),
        new Card('spades', 8),
        new Card('diamonds', 7),
        new Card('clubs', 6),
        new Card('hearts', 5),
      ];

      const hand = player.evaluateHand(cards);
      expect(hand.rank).toBe(HAND_RANKINGS.STRAIGHT);
      expect(hand.description).toBe('Стрит');
    });

    it('should recognize Three of a Kind', () => {
      const cards = [
        new Card('hearts', 10),
        new Card('spades', 10),
        new Card('diamonds', 10),
        new Card('clubs', 7),
        new Card('hearts', 5),
      ];

      const hand = player.evaluateHand(cards);
      expect(hand.rank).toBe(HAND_RANKINGS.THREE_OF_A_KIND);
      expect(hand.description).toBe('Тройка');
    });

    it('should recognize Two Pair', () => {
      const cards = [
        new Card('hearts', 10),
        new Card('spades', 10),
        new Card('diamonds', 7),
        new Card('clubs', 7),
        new Card('hearts', 5),
      ];

      const hand = player.evaluateHand(cards);
      expect(hand.rank).toBe(HAND_RANKINGS.TWO_PAIR);
      expect(hand.description).toBe('Две Пары');
    });

    it('should recognize Pair', () => {
      const cards = [
        new Card('hearts', 10),
        new Card('spades', 10),
        new Card('diamonds', 7),
        new Card('clubs', 5),
        new Card('hearts', 2),
      ];

      const hand = player.evaluateHand(cards);
      expect(hand.rank).toBe(HAND_RANKINGS.PAIR);
      expect(hand.description).toBe('Пара');
    });

    it('should recognize High Card', () => {
      const cards = [
        new Card('hearts', 14),
        new Card('spades', 10),
        new Card('diamonds', 7),
        new Card('clubs', 5),
        new Card('hearts', 2),
      ];

      const hand = player.evaluateHand(cards);
      expect(hand.rank).toBe(HAND_RANKINGS.HIGH_CARD);
      expect(hand.description).toBe('Старшая карта');
    });

    it('should recognize wheel straight (A-2-3-4-5)', () => {
      const cards = [
        new Card('hearts', 14),
        new Card('spades', 2),
        new Card('diamonds', 3),
        new Card('clubs', 4),
        new Card('hearts', 5),
      ];

      const hand = player.evaluateHand(cards);
      expect(hand.rank).toBe(HAND_RANKINGS.STRAIGHT);
    });
  });

  describe('compareHands', () => {
    it('should compare hands by rank', () => {
      const flush = player.evaluateHand([
        new Card('hearts', 14),
        new Card('hearts', 10),
        new Card('hearts', 7),
        new Card('hearts', 5),
        new Card('hearts', 2),
      ]);

      const pair = player.evaluateHand([
        new Card('hearts', 10),
        new Card('spades', 10),
        new Card('diamonds', 7),
        new Card('clubs', 5),
        new Card('hearts', 2),
      ]);

      expect(player.compareHands(flush, pair)).toBeGreaterThan(0);
      expect(player.compareHands(pair, flush)).toBeLessThan(0);
    });

    it('should compare pairs by high card', () => {
      const highPair = player.evaluateHand([
        new Card('hearts', 14),
        new Card('spades', 14),
        new Card('diamonds', 7),
        new Card('clubs', 5),
        new Card('hearts', 2),
      ]);

      const lowPair = player.evaluateHand([
        new Card('hearts', 10),
        new Card('spades', 10),
        new Card('diamonds', 7),
        new Card('clubs', 5),
        new Card('hearts', 2),
      ]);

      expect(player.compareHands(highPair, lowPair)).toBeGreaterThan(0);
    });
  });
});
