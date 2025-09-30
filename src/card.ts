import { Suit, ICard } from './types';

export class Card implements ICard {
  constructor(public suit: Suit, public value: number) {}

  toString(): string {
    const suits: Record<Suit, string> = {
      hearts: '♥️',
      diamonds: '♦️',
      clubs: '♣️',
      spades: '♠️',
    };

    const values: Record<number, string> = {
      11: 'J',
      12: 'Q',
      13: 'K',
      14: 'A',
    };

    const valueStr = values[this.value] || this.value.toString();
    return `${valueStr}${suits[this.suit]}`;
  }
}

export class Deck {
  private cards: Card[] = [];

  constructor() {
    this.reset();
  }

  reset(): void {
    this.cards = [];
    const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

    for (const suit of suits) {
      for (let value = 2; value <= 14; value++) {
        this.cards.push(new Card(suit, value));
      }
    }

    this.shuffle();
  }

  shuffle(): void {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  dealCard(): Card {
    const card = this.cards.pop();
    if (!card) {
      throw new Error('No cards left in deck');
    }
    return card;
  }

  cardsLeft(): number {
    return this.cards.length;
  }
}
