export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

export type GameState = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export type PlayerAction = 'fold' | 'call' | 'check' | 'raise';

export interface ICard {
  suit: Suit;
  value: number;
  toString(): string;
}

export interface IPlayer {
  id: number;
  name: string;
  hand: ICard[];
  chips: number;
  currentBet: number;
  totalBetThisHand: number;
  hasActed: boolean;
  isFolded: boolean;
  isAllIn: boolean;
  getBestHand(communityCards: ICard[]): HandRanking;
  compareHands(hand1: HandRanking, hand2: HandRanking): number;
}

export interface HandRanking {
  rank: number;
  description: string;
  cards: ICard[];
  high?: number | number[];
  low?: number;
  kicker?: number;
  kickers?: number[];
}

export interface GameStatus {
  gameState: GameState;
  pot: number;
  currentBet: number;
  communityCards: string;
  activePlayers: number;
  currentPlayer: string;
}

export interface SidePot<T = IPlayer> {
  amount: number;
  eligiblePlayers: T[];
  isMainPot: boolean;
}

export interface GameResult<T = IPlayer> {
  winners: T[];
  amount: number;
  potType: string;
  winningHand?: HandRanking;
  amountPerWinner?: number;
  reason?: string;
}
