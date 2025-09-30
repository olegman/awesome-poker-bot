import { Card, Deck } from '../card';

describe('Card', () => {
  describe('constructor', () => {
    it('should create a card with suit and value', () => {
      const card = new Card('hearts', 10);
      expect(card.suit).toBe('hearts');
      expect(card.value).toBe(10);
    });
  });

  describe('toString', () => {
    it('should format number cards correctly', () => {
      const card = new Card('hearts', 7);
      expect(card.toString()).toBe('7♥️');
    });

    it('should format Jack correctly', () => {
      const card = new Card('spades', 11);
      expect(card.toString()).toBe('J♠️');
    });

    it('should format Queen correctly', () => {
      const card = new Card('diamonds', 12);
      expect(card.toString()).toBe('Q♦️');
    });

    it('should format King correctly', () => {
      const card = new Card('clubs', 13);
      expect(card.toString()).toBe('K♣️');
    });

    it('should format Ace correctly', () => {
      const card = new Card('hearts', 14);
      expect(card.toString()).toBe('A♥️');
    });

    it('should handle all suits correctly', () => {
      expect(new Card('hearts', 2).toString()).toContain('♥️');
      expect(new Card('diamonds', 2).toString()).toContain('♦️');
      expect(new Card('clubs', 2).toString()).toContain('♣️');
      expect(new Card('spades', 2).toString()).toContain('♠️');
    });
  });
});

describe('Deck', () => {
  describe('constructor and reset', () => {
    it('should create a deck with 52 cards', () => {
      const deck = new Deck();
      expect(deck.cardsLeft()).toBe(52);
    });

    it('should reset deck to 52 cards', () => {
      const deck = new Deck();
      deck.dealCard();
      deck.dealCard();
      expect(deck.cardsLeft()).toBe(50);

      deck.reset();
      expect(deck.cardsLeft()).toBe(52);
    });
  });

  describe('dealCard', () => {
    it('should deal a card and reduce deck size', () => {
      const deck = new Deck();
      const card = deck.dealCard();

      expect(card).toBeInstanceOf(Card);
      expect(deck.cardsLeft()).toBe(51);
    });

    it('should throw error when no cards left', () => {
      const deck = new Deck();

      // Deal all cards
      for (let i = 0; i < 52; i++) {
        deck.dealCard();
      }

      expect(() => deck.dealCard()).toThrow('No cards left in deck');
    });

    it('should deal unique cards', () => {
      const deck = new Deck();
      const dealtCards = new Set<string>();

      for (let i = 0; i < 52; i++) {
        const card = deck.dealCard();
        const cardKey = `${card.suit}-${card.value}`;
        expect(dealtCards.has(cardKey)).toBe(false);
        dealtCards.add(cardKey);
      }
    });
  });

  describe('shuffle', () => {
    it('should shuffle cards (statistical test)', () => {
      const deck1 = new Deck();
      const deck2 = new Deck();

      // Deal first 10 cards from each deck
      const cards1 = [];
      const cards2 = [];

      for (let i = 0; i < 10; i++) {
        cards1.push(deck1.dealCard());
        cards2.push(deck2.dealCard());
      }

      // Check if at least one card is different
      let hasDifference = false;
      for (let i = 0; i < 10; i++) {
        if (cards1[i].suit !== cards2[i].suit || cards1[i].value !== cards2[i].value) {
          hasDifference = true;
          break;
        }
      }

      // With proper shuffling, this should almost always be true
      expect(hasDifference).toBe(true);
    });
  });

  describe('cardsLeft', () => {
    it('should return correct number of cards left', () => {
      const deck = new Deck();

      expect(deck.cardsLeft()).toBe(52);
      deck.dealCard();
      expect(deck.cardsLeft()).toBe(51);
      deck.dealCard();
      deck.dealCard();
      expect(deck.cardsLeft()).toBe(49);
    });
  });
});
