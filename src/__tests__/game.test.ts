import { Player, PokerGame } from '../game';
import { Card } from '../card';

describe('PokerGame', () => {
  let game: PokerGame;

  beforeEach(() => {
    game = new PokerGame(123456);
  });

  describe('constructor', () => {
    it('should create a game with correct initial state', () => {
      expect(game.chatId).toBe(123456);
      expect(game.players.size).toBe(0);
      expect(game.pot).toBe(0);
      expect(game.currentBet).toBe(0);
      expect(game.gameState).toBe('waiting');
      expect(game.communityCards).toEqual([]);
    });
  });

  describe('addPlayer', () => {
    it('should add a player to the game', () => {
      const success = game.addPlayer(1, 'Player1');

      expect(success).toBe(true);
      expect(game.players.size).toBe(1);
      expect(game.players.get(1)?.name).toBe('Player1');
    });

    it('should not add duplicate player', () => {
      game.addPlayer(1, 'Player1');
      const success = game.addPlayer(1, 'Player1Again');

      expect(success).toBe(false);
      expect(game.players.size).toBe(1);
    });

    it('should not add more than 6 players', () => {
      for (let i = 1; i <= 6; i++) {
        game.addPlayer(i, `Player${i}`);
      }

      const success = game.addPlayer(7, 'Player7');
      expect(success).toBe(false);
      expect(game.players.size).toBe(6);
    });
  });

  describe('removePlayer', () => {
    it('should remove a player from the game', () => {
      game.addPlayer(1, 'Player1');
      const success = game.removePlayer(1);

      expect(success).toBe(true);
      expect(game.players.size).toBe(0);
    });

    it('should return false if player not in game', () => {
      const success = game.removePlayer(999);
      expect(success).toBe(false);
    });
  });

  describe('startGame', () => {
    it('should not start with less than 2 players', () => {
      game.addPlayer(1, 'Player1');
      const success = game.startGame();

      expect(success).toBe(false);
      expect(game.gameState).toBe('waiting');
    });

    it('should start game with 2 players', () => {
      game.addPlayer(1, 'Player1');
      game.addPlayer(2, 'Player2');

      const success = game.startGame();

      expect(success).toBe(true);
      expect(game.gameState).toBe('preflop');
      expect(game.pot).toBe(30); // Small blind (10) + Big blind (20)
      expect(game.currentBet).toBe(20);
    });

    it('should deal 2 cards to each player', () => {
      game.addPlayer(1, 'Player1');
      game.addPlayer(2, 'Player2');
      game.startGame();

      expect(game.players.get(1)?.hand.length).toBe(2);
      expect(game.players.get(2)?.hand.length).toBe(2);
    });

    it('should reset game state on start', () => {
      game.addPlayer(1, 'Player1');
      game.addPlayer(2, 'Player2');
      game.startGame();

      expect(game.communityCards).toEqual([]);
      expect(game.sidePots).toEqual([]);
      expect(game.bettingRound).toBe(0);
    });
  });

  describe('setBlinds', () => {
    it('should set small and big blinds correctly', () => {
      game.addPlayer(1, 'Player1');
      game.addPlayer(2, 'Player2');
      game.startGame();

      const players = Array.from(game.players.values());

      // Check that blinds were posted
      expect(game.pot).toBe(30);
      expect(game.currentBet).toBe(20);
      expect(players[0].currentBet).toBe(20);
      expect(players[1].currentBet).toBe(10);
    });
  });

  describe('playerAction', () => {
    beforeEach(() => {
      game.addPlayer(1, 'Player1');
      game.addPlayer(2, 'Player2');
      game.startGame();
    });

    it('should handle fold action', () => {
      const currentPlayer = game.getCurrentPlayer();
      const playerId = currentPlayer!.id;

      const success = game.playerAction(playerId, 'fold');

      expect(success).toBe(true);
      expect(game.players.get(playerId)?.isFolded).toBe(true);
    });

    it('should handle call action', () => {
      const currentPlayer = game.getCurrentPlayer();
      const playerId = currentPlayer!.id;
      const initialChips = currentPlayer!.chips;

      const success = game.playerAction(playerId, 'call');

      expect(success).toBe(true);
      expect(currentPlayer!.chips).toBeLessThan(initialChips);
    });

    it('should handle check action when no bet to call', () => {
      game.currentBet = 0;
      const currentPlayer = game.getCurrentPlayer();
      currentPlayer!.currentBet = 0;
      const success = game.playerAction(currentPlayer!.id, 'check');

      expect(success).toBe(true);
      expect(currentPlayer!.hasActed).toBe(true);
    });

    it('should not allow action from folded player', () => {
      const currentPlayer = game.getCurrentPlayer();
      const playerId = currentPlayer!.id;

      currentPlayer!.fold();
      const success = game.playerAction(playerId, 'call');

      expect(success).toBe(false);
    });
  });

  describe('nextStreet', () => {
    beforeEach(() => {
      game.addPlayer(1, 'Player1');
      game.addPlayer(2, 'Player2');
      game.startGame();
    });

    it('should progress from preflop to flop', () => {
      game.nextStreet();

      expect(game.gameState).toBe('flop');
      expect(game.communityCards.length).toBe(3);
    });

    it('should progress from flop to turn', () => {
      game.nextStreet(); // to flop
      game.nextStreet(); // to turn

      expect(game.gameState).toBe('turn');
      expect(game.communityCards.length).toBe(4);
    });

    it('should progress from turn to river', () => {
      game.nextStreet(); // to flop
      game.nextStreet(); // to turn
      game.nextStreet(); // to river

      expect(game.gameState).toBe('river');
      expect(game.communityCards.length).toBe(5);
    });

    it('should progress from river to showdown', () => {
      game.nextStreet(); // to flop
      game.nextStreet(); // to turn
      game.nextStreet(); // to river
      game.nextStreet(); // to showdown

      expect(game.gameState).toBe('showdown');
    });

    it('should reset betting for new street', () => {
      game.currentBet = 100;
      game.players.get(1)!.currentBet = 100;

      game.nextStreet();

      expect(game.currentBet).toBe(0);
      expect(game.players.get(1)!.currentBet).toBe(0);
    });
  });

  describe('isRoundComplete', () => {
    beforeEach(() => {
      game.addPlayer(1, 'Player1');
      game.addPlayer(2, 'Player2');
      game.startGame();
    });

    it('should return true if only one player left', () => {
      game.players.get(1)!.fold();

      expect(game.isRoundComplete()).toBe(true);
    });

    it('should return false if players have not acted', () => {
      expect(game.isRoundComplete()).toBe(false);
    });

    it('should return true if all players acted and bets equal', () => {
      const player1 = game.players.get(1)!;
      const player2 = game.players.get(2)!;

      player1.hasActed = true;
      player2.hasActed = true;
      player1.currentBet = game.currentBet;
      player2.currentBet = game.currentBet;

      expect(game.isRoundComplete()).toBe(true);
    });
  });

  describe('getCurrentPlayer', () => {
    it('should return current player', () => {
      game.addPlayer(1, 'Player1');
      game.addPlayer(2, 'Player2');
      game.startGame();

      const currentPlayer = game.getCurrentPlayer();

      expect(currentPlayer).toBeDefined();
      expect(currentPlayer).toBeInstanceOf(Player);
    });
  });

  describe('getGameStatus', () => {
    beforeEach(() => {
      game.addPlayer(1, 'Player1');
      game.addPlayer(2, 'Player2');
      game.startGame();
    });

    it('should return current game status', () => {
      const status = game.getGameStatus();

      expect(status).toHaveProperty('gameState');
      expect(status).toHaveProperty('pot');
      expect(status).toHaveProperty('currentBet');
      expect(status).toHaveProperty('communityCards');
      expect(status).toHaveProperty('activePlayers');
      expect(status).toHaveProperty('currentPlayer');

      expect(status.gameState).toBe('preflop');
      expect(status.pot).toBe(30);
      expect(status.activePlayers).toBe(2);
    });
  });

  describe('getCardString', () => {
    it('should format cards correctly', () => {
      const card1 = new Card('hearts', 14);
      const card2 = new Card('spades', 10);
      const card3 = new Card('diamonds', 5);

      expect(game.getCardString(card1)).toBe('A♥️');
      expect(game.getCardString(card2)).toBe('10♠️');
      expect(game.getCardString(card3)).toBe('5♦️');
    });
  });

  describe('createSidePots', () => {
    it('should create main pot when all players have equal bets', () => {
      game.addPlayer(1, 'Player1');
      game.addPlayer(2, 'Player2');
      game.startGame();

      const player1 = game.players.get(1)!;
      const player2 = game.players.get(2)!;

      player1.totalBetThisHand = 100;
      player2.totalBetThisHand = 100;

      game.createSidePots();

      expect(game.sidePots.length).toBeGreaterThan(0);
      expect(game.sidePots[0].isMainPot).toBe(true);
    });

    it('should create side pots for all-in situations', () => {
      game.addPlayer(1, 'Player1');
      game.addPlayer(2, 'Player2');
      game.addPlayer(3, 'Player3');
      game.startGame();

      const player1 = game.players.get(1)!;
      const player2 = game.players.get(2)!;
      const player3 = game.players.get(3)!;

      player1.totalBetThisHand = 50;
      player2.totalBetThisHand = 100;
      player3.totalBetThisHand = 200;

      game.createSidePots();

      expect(game.sidePots.length).toBeGreaterThan(1);
    });
  });

  describe('integration test - full hand', () => {
    it('should play a complete hand', () => {
      // Setup
      game.addPlayer(1, 'Player1');
      game.addPlayer(2, 'Player2');

      // Start game
      expect(game.startGame()).toBe(true);
      expect(game.gameState).toBe('preflop');

      // Players act
      const currentPlayer = game.getCurrentPlayer();
      game.playerAction(currentPlayer!.id, 'fold');

      // Game should recognize round is complete
      expect(game.isRoundComplete()).toBe(true);

      // Winner should be determined
      const results = game.determineWinners();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].winners.length).toBe(1);
    });
  });
});
