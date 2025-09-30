import { Deck, Card } from './card';
import { IPlayer, ICard, GameState, PlayerAction, HandRanking, GameStatus, SidePot, GameResult } from './types';

// Константы для покерных комбинаций
export const HAND_RANKINGS = {
  HIGH_CARD: 1,
  PAIR: 2,
  TWO_PAIR: 3,
  THREE_OF_A_KIND: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  FOUR_OF_A_KIND: 8,
  STRAIGHT_FLUSH: 9,
  ROYAL_FLUSH: 10,
} as const;

export class Player implements IPlayer {
  hand: Card[] = [];
  chips = 1000;
  currentBet = 0;
  totalBetThisHand = 0;
  hasActed = false;
  isFolded = false;
  isAllIn = false;

  constructor(public id: number, public name: string) {}

  addCard(card: Card): void {
    this.hand.push(card);
  }

  clearHand(): void {
    this.hand = [];
  }

  bet(amount: number): number {
    const betAmount = Math.min(amount, this.chips);
    this.chips -= betAmount;
    this.currentBet += betAmount;
    this.totalBetThisHand += betAmount;
    this.hasActed = true;

    if (this.chips === 0) {
      this.isAllIn = true;
    }

    return betAmount;
  }

  fold(): void {
    this.isFolded = true;
    this.hasActed = true;
  }

  resetForNewRound(): void {
    this.currentBet = 0;
    this.hasActed = false;
    this.isFolded = false;
  }

  resetForNewGame(): void {
    this.hand = [];
    this.currentBet = 0;
    this.totalBetThisHand = 0;
    this.hasActed = false;
    this.isFolded = false;
    this.isAllIn = false;
  }

  getBestHand(communityCards: Card[]): HandRanking {
    const allCards = [...this.hand, ...communityCards];
    return this.evaluateBestHand(allCards);
  }

  evaluateBestHand(cards: Card[]): HandRanking {
    const combinations = this.getAllCombinations(cards, 5);
    let bestHand: HandRanking | null = null;
    let bestRank = 0;

    for (const combo of combinations) {
      const handRank = this.evaluateHand(combo);
      if (
        handRank.rank > bestRank ||
        (handRank.rank === bestRank && bestHand && this.compareHands(handRank, bestHand) > 0)
      ) {
        bestHand = handRank;
        bestRank = handRank.rank;
      }
    }

    return bestHand!;
  }

  getAllCombinations(cards: Card[], n: number): Card[][] {
    if (n === 1) return cards.map((c) => [c]);
    if (n === cards.length) return [cards];

    const combinations: Card[][] = [];
    for (let i = 0; i <= cards.length - n; i++) {
      const smaller = this.getAllCombinations(cards.slice(i + 1), n - 1);
      combinations.push(...smaller.map((combo) => [cards[i], ...combo]));
    }
    return combinations;
  }

  evaluateHand(cards: Card[]): HandRanking {
    const sortedCards = [...cards].sort((a, b) => b.value - a.value);
    const values = sortedCards.map((c) => c.value);
    const suits = sortedCards.map((c) => c.suit);

    const valueCounts: Record<number, number> = {};
    values.forEach((v) => (valueCounts[v] = (valueCounts[v] || 0) + 1));

    const counts = Object.values(valueCounts).sort((a, b) => b - a);
    const uniqueValues = Object.keys(valueCounts)
      .map(Number)
      .sort((a, b) => b - a);

    const isFlush = suits.every((suit) => suit === suits[0]);
    const isStraight = this.isStraight(values);
    const isRoyalStraight = values.join(',') === '14,13,12,11,10';

    if (isFlush && isRoyalStraight) {
      return { rank: HAND_RANKINGS.ROYAL_FLUSH, description: 'Флеш Рояль', cards: sortedCards };
    }

    if (isFlush && isStraight) {
      return {
        rank: HAND_RANKINGS.STRAIGHT_FLUSH,
        description: 'Стрит Флеш',
        high: Math.max(...values),
        cards: sortedCards,
      };
    }

    if (counts[0] === 4) {
      const fourKind = uniqueValues.find((v) => valueCounts[v] === 4)!;
      const kicker = uniqueValues.find((v) => valueCounts[v] === 1);
      return {
        rank: HAND_RANKINGS.FOUR_OF_A_KIND,
        description: 'Каре',
        high: fourKind,
        kicker,
        cards: sortedCards,
      };
    }

    if (counts[0] === 3 && counts[1] === 2) {
      const trips = uniqueValues.find((v) => valueCounts[v] === 3)!;
      const pair = uniqueValues.find((v) => valueCounts[v] === 2)!;
      return {
        rank: HAND_RANKINGS.FULL_HOUSE,
        description: 'Фулл Хаус',
        high: trips,
        low: pair,
        cards: sortedCards,
      };
    }

    if (isFlush) {
      return { rank: HAND_RANKINGS.FLUSH, description: 'Флеш', high: values, cards: sortedCards };
    }

    if (isStraight) {
      return { rank: HAND_RANKINGS.STRAIGHT, description: 'Стрит', high: Math.max(...values), cards: sortedCards };
    }

    if (counts[0] === 3) {
      const trips = uniqueValues.find((v) => valueCounts[v] === 3)!;
      const kickers = uniqueValues.filter((v) => valueCounts[v] === 1).sort((a, b) => b - a);
      return { rank: HAND_RANKINGS.THREE_OF_A_KIND, description: 'Тройка', high: trips, kickers, cards: sortedCards };
    }

    if (counts[0] === 2 && counts[1] === 2) {
      const pairs = uniqueValues.filter((v) => valueCounts[v] === 2).sort((a, b) => b - a);
      const kicker = uniqueValues.find((v) => valueCounts[v] === 1);
      return {
        rank: HAND_RANKINGS.TWO_PAIR,
        description: 'Две Пары',
        high: pairs[0],
        low: pairs[1],
        kicker,
        cards: sortedCards,
      };
    }

    if (counts[0] === 2) {
      const pair = uniqueValues.find((v) => valueCounts[v] === 2)!;
      const kickers = uniqueValues.filter((v) => valueCounts[v] === 1).sort((a, b) => b - a);
      return { rank: HAND_RANKINGS.PAIR, description: 'Пара', high: pair, kickers, cards: sortedCards };
    }

    return { rank: HAND_RANKINGS.HIGH_CARD, description: 'Старшая карта', high: values, cards: sortedCards };
  }

  isStraight(values: number[]): boolean {
    const uniqueValues = [...new Set(values)].sort((a, b) => a - b);
    if (uniqueValues.length !== 5) return false;

    for (let i = 1; i < uniqueValues.length; i++) {
      if (uniqueValues[i] !== uniqueValues[i - 1] + 1) {
        return uniqueValues.join(',') === '2,3,4,5,14';

      }
    }
    return true;
  }

  compareHands(hand1: HandRanking, hand2: HandRanking): number {
    if (hand1.rank !== hand2.rank) {
      return hand1.rank - hand2.rank;
    }

    switch (hand1.rank) {
      case HAND_RANKINGS.STRAIGHT_FLUSH:
      case HAND_RANKINGS.STRAIGHT:
        return (hand1.high as number) - (hand2.high as number);

      case HAND_RANKINGS.FOUR_OF_A_KIND:
        if (hand1.high !== hand2.high) return (hand1.high as number) - (hand2.high as number);
        return (hand1.kicker || 0) - (hand2.kicker || 0);

      case HAND_RANKINGS.FULL_HOUSE:
        if (hand1.high !== hand2.high) return (hand1.high as number) - (hand2.high as number);
        return (hand1.low || 0) - (hand2.low || 0);

      case HAND_RANKINGS.FLUSH:
      case HAND_RANKINGS.HIGH_CARD:
        const high1 = hand1.high as number[];
        const high2 = hand2.high as number[];
        for (let i = 0; i < high1.length; i++) {
          if (high1[i] !== high2[i]) {
            return high1[i] - high2[i];
          }
        }
        return 0;

      case HAND_RANKINGS.THREE_OF_A_KIND:
        if (hand1.high !== hand2.high) return (hand1.high as number) - (hand2.high as number);
        return this.compareKickers(hand1.kickers || [], hand2.kickers || []);

      case HAND_RANKINGS.TWO_PAIR:
        if (hand1.high !== hand2.high) return (hand1.high as number) - (hand2.high as number);
        if (hand1.low !== hand2.low) return (hand1.low || 0) - (hand2.low || 0);
        return (hand1.kicker || 0) - (hand2.kicker || 0);

      case HAND_RANKINGS.PAIR:
        if (hand1.high !== hand2.high) return (hand1.high as number) - (hand2.high as number);
        return this.compareKickers(hand1.kickers || [], hand2.kickers || []);
    }

    return 0;
  }

  compareKickers(kickers1: number[], kickers2: number[]): number {
    for (let i = 0; i < Math.min(kickers1.length, kickers2.length); i++) {
      if (kickers1[i] !== kickers2[i]) {
        return kickers1[i] - kickers2[i];
      }
    }
    return 0;
  }

  getHandString(): string {
    return this.hand.map((card) => card.toString()).join(' ');
  }
}

export class PokerGame {
  players = new Map<number, Player>();
  deck = new Deck();
  communityCards: Card[] = [];
  pot = 0;
  currentBet = 0;
  dealerPosition = 0;
  currentPlayerIndex = 0;
  gameState: GameState = 'waiting';
  bettingRound = 0;
  sidePots: SidePot<Player>[] = [];

  constructor(public chatId: number) {}

  addPlayer(playerId: number, playerName: string): boolean {
    if (this.players.has(playerId)) {
      return false;
    }

    if (this.players.size >= 6) {
      return false;
    }

    this.players.set(playerId, new Player(playerId, playerName));
    return true;
  }

  removePlayer(playerId: number): boolean {
    return this.players.delete(playerId);
  }

  startGame(): boolean {
    if (this.players.size < 2) {
      return false;
    }

    this.gameState = 'preflop';
    this.deck.reset();
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.bettingRound = 0;
    this.sidePots = [];

    for (const player of this.players.values()) {
      player.resetForNewGame();
    }

    this.dealHoleCards();
    this.setBlinds();

    return true;
  }

  dealHoleCards(): void {
    for (let i = 0; i < 2; i++) {
      for (const player of this.players.values()) {
        player.addCard(this.deck.dealCard());
      }
    }
  }

  setBlinds(): void {
    const playerArray = Array.from(this.players.values());
    const smallBlindAmount = 10;
    const bigBlindAmount = 20;

    if (playerArray.length >= 2) {
      const smallBlindIndex = (this.dealerPosition + 1) % playerArray.length;
      const bigBlindIndex = (this.dealerPosition + 2) % playerArray.length;

      playerArray[smallBlindIndex].bet(smallBlindAmount);
      playerArray[bigBlindIndex].bet(bigBlindAmount);

      this.pot += smallBlindAmount + bigBlindAmount;
      this.currentBet = bigBlindAmount;
      this.currentPlayerIndex = (this.dealerPosition + 3) % playerArray.length;
    }
  }

  dealCommunityCards(count: number): void {
    for (let i = 0; i < count; i++) {
      this.communityCards.push(this.deck.dealCard());
    }
  }

  nextStreet(): void {
    switch (this.gameState) {
      case 'preflop':
        this.dealCommunityCards(3);
        this.gameState = 'flop';
        break;
      case 'flop':
        this.dealCommunityCards(1);
        this.gameState = 'turn';
        break;
      case 'turn':
        this.dealCommunityCards(1);
        this.gameState = 'river';
        break;
      case 'river':
        this.gameState = 'showdown';
        break;
    }

    this.currentBet = 0;
    this.bettingRound++;
    for (const player of this.players.values()) {
      player.resetForNewRound();
    }
    this.currentPlayerIndex = (this.dealerPosition + 1) % this.players.size;
  }

  playerAction(playerId: number, action: PlayerAction, amount = 0): boolean {
    const player = this.players.get(playerId);
    if (!player || player.isFolded) {
      return false;
    }

    switch (action) {
      case 'fold':
        player.fold();
        break;
      case 'call':
        const callAmount = this.currentBet - player.currentBet;
        const actualBet = player.bet(callAmount);
        this.pot += actualBet;
        break;
      case 'raise':
        const raiseAmount = Math.max(amount, this.currentBet * 2);
        const totalBet = player.bet(raiseAmount - player.currentBet);
        this.pot += totalBet;
        this.currentBet = raiseAmount;
        break;
      case 'check':
        if (player.currentBet === this.currentBet) {
          player.hasActed = true;
        }
        break;
    }

    return true;
  }

  isRoundComplete(): boolean {
    const activePlayers = Array.from(this.players.values()).filter((p) => !p.isFolded);

    if (activePlayers.length <= 1) {
      return true;
    }

    return activePlayers.every((p) => p.hasActed && (p.currentBet === this.currentBet || p.isAllIn));
  }

  getCurrentPlayer(): Player | undefined {
    const playerArray = Array.from(this.players.values());
    return playerArray[this.currentPlayerIndex];
  }

  getCommunityCardsString(): string {
    return this.communityCards.map((card) => card.toString()).join(' ');
  }

  getGameStatus(): GameStatus {
    const activePlayers = Array.from(this.players.values()).filter((p) => !p.isFolded);

    return {
      gameState: this.gameState,
      pot: this.pot,
      currentBet: this.currentBet,
      communityCards: this.getCommunityCardsString(),
      activePlayers: activePlayers.length,
      currentPlayer: this.getCurrentPlayer()?.name || 'None',
    };
  }

  createSidePots(): void {
    const activePlayers = Array.from(this.players.values()).filter((p) => !p.isFolded);

    const playerBets = activePlayers
      .map((p) => ({
        player: p,
        totalBet: p.totalBetThisHand,
      }))
      .sort((a, b) => a.totalBet - b.totalBet);

    this.sidePots = [];
    let previousBet = 0;

    for (let i = 0; i < playerBets.length; i++) {
      const currentBet = playerBets[i].totalBet;
      const betDifference = currentBet - previousBet;

      if (betDifference > 0) {
        const eligiblePlayers = playerBets.slice(i).map((pb) => pb.player);
        const potAmount = betDifference * (playerBets.length - i);

        this.sidePots.push({
          amount: potAmount,
          eligiblePlayers: eligiblePlayers,
          isMainPot: i === 0,
        });
      }

      previousBet = currentBet;
    }
  }

  determineWinners(): GameResult<Player>[] {
    this.createSidePots();
    const results: GameResult<Player>[] = [];

    for (const pot of this.sidePots) {
      const activePlayers = pot.eligiblePlayers.filter((p) => !p.isFolded);

      if (activePlayers.length === 0) continue;

      if (activePlayers.length === 1) {
        const winner = activePlayers[0];
        winner.chips += pot.amount;
        results.push({
          winners: [winner],
          amount: pot.amount,
          potType: pot.isMainPot ? 'основной' : 'сайд',
          reason: 'единственный оставшийся игрок',
        });
        continue;
      }

      const playerHands = activePlayers.map((player) => ({
        player: player,
        hand: player.getBestHand(this.communityCards),
      }));

      let bestHand = playerHands[0].hand;
      for (const ph of playerHands) {
        if (ph.player.compareHands(ph.hand, bestHand) > 0) {
          bestHand = ph.hand;
        }
      }

      const winners = playerHands
        .filter((ph) => ph.player.compareHands(ph.hand, bestHand) === 0)
        .map((ph) => ph.player);

      const winAmount = Math.floor(pot.amount / winners.length);
      const remainder = pot.amount % winners.length;

      winners.forEach((winner, index) => {
        const extraChip = index < remainder ? 1 : 0;
        winner.chips += winAmount + extraChip;
      });

      results.push({
        winners: winners,
        amount: pot.amount,
        potType: pot.isMainPot ? 'основной' : 'сайд',
        winningHand: bestHand,
        amountPerWinner: winAmount,
      });
    }

    return results;
  }

  getCardString(card: ICard): string {
    const values: Record<number, string> = {
      11: 'J',
      12: 'Q',
      13: 'K',
      14: 'A',
    };
    return (values[card.value] || card.value.toString()) + card.toString().slice(-2);
  }

  formatGameResults(results: GameResult<Player>[]): string {
    let message = '🏆 РЕЗУЛЬТАТЫ ИГРЫ:\n\n';

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const potName = result.potType.charAt(0).toUpperCase() + result.potType.slice(1);

      message += `💰 ${potName} пот (${result.amount} фишек):\n`;

      if (result.reason) {
        message += `👑 ${result.winners[0].name} - ${result.reason}\n`;
      } else {
        if (result.winners.length === 1) {
          message += `👑 Победитель: ${result.winners[0].name}\n`;
        } else {
          message += `👑 Победители: ${result.winners.map((w) => w.name).join(', ')}\n`;
        }

        if (result.winningHand) {
          const handCards = result.winningHand.cards.map((c) => this.getCardString(c)).join(' ');
          message += `🃏 Комбинация: ${result.winningHand.description}\n`;
          message += `🎯 Карты: ${handCards}\n`;
        }

        if (result.winners.length > 1) {
          message += `💵 По ${result.amountPerWinner} фишек каждому\n`;
        }
      }
      message += '\n';
    }

    message += '💰 ФИНАЛЬНЫЕ БАЛАНСЫ:\n';
    const playerArray = Array.from(this.players.values());
    playerArray.forEach((player) => {
      message += `${player.name}: ${player.chips} фишек\n`;
    });

    return message;
  }
}
