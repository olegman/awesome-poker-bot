class Card {
    constructor(suit, value) {
        this.suit = suit; // 'hearts', 'diamonds', 'clubs', 'spades'
        this.value = value; // 2-14 (где 11=J, 12=Q, 13=K, 14=A)
    }

    toString() {
        const suits = {
            'hearts': '♥️',
            'diamonds': '♦️',
            'clubs': '♣️',
            'spades': '♠️'
        };

        const values = {
            11: 'J',
            12: 'Q',
            13: 'K',
            14: 'A'
        };

        const valueStr = values[this.value] || this.value.toString();
        return `${valueStr}${suits[this.suit]}`;
    }
}

class Deck {
    constructor() {
        this.cards = [];
        this.reset();
    }

    reset() {
        this.cards = [];
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];

        for (let suit of suits) {
            for (let value = 2; value <= 14; value++) {
                this.cards.push(new Card(suit, value));
            }
        }

        this.shuffle();
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    dealCard() {
        return this.cards.pop();
    }

    cardsLeft() {
        return this.cards.length;
    }
}

module.exports = { Card, Deck };
