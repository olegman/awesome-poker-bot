import 'dotenv/config';
import { Bot, Context, InlineKeyboard } from 'grammy';
import { PokerGame } from './game';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ Ошибка: TELEGRAM_BOT_TOKEN не найден в .env файле');
  process.exit(1);
}

const bot = new Bot(BOT_TOKEN);

// Хранилище игр для разных чатов
const games = new Map<number, PokerGame>();

// Команда /start
bot.command('start', async (ctx): Promise<void> => {
  await ctx.reply(
    '🃏 Добро пожаловать в покер-бота!\n\n' +
      'Доступные команды:\n' +
      '/newgame - Создать новую игру\n' +
      '/join - Присоединиться к игре\n' +
      '/leave - Покинуть игру\n' +
      '/startgame - Начать игру\n' +
      '/status - Статус игры\n' +
      '/cards - Показать ваши карты\n' +
      '/fold - Сброс\n' +
      '/call - Колл\n' +
      '/check - Чек\n' +
      '/raise [сумма] - Рейз\n\n' +
      'Для игры нужно минимум 2 игрока!',
  );
});

// Команда /newgame
bot.command('newgame', async (ctx): Promise<void> => {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    return;
  }

  if (games.has(chatId)) {
    const game = games.get(chatId);
    const keyboard = createGameManagementKeyboard(true, game?.players.size ?? 0);
    await ctx.reply('❌ Игра уже создана в этом чате!', {
      reply_markup: keyboard,
    });
    return;
  }

  games.set(chatId, new PokerGame(chatId));
  const keyboard = createGameManagementKeyboard(true, 0);
  await ctx.reply('🎯 Новая игра покера создана! Используйте кнопки ниже для управления игрой.', {
    reply_markup: keyboard,
  });
});

// Команда /join
bot.command('join', async (ctx): Promise<void> => {
  const chatId = ctx.chat?.id;
  const playerId = ctx.from?.id;
  const playerName = ctx.from?.first_name ?? ctx.from?.username ?? 'Игрок';

  if (!chatId || !playerId) {
    return;
  }
  await handleJoinGame(ctx, chatId, playerId, playerName);
});

// Команда /leave
bot.command('leave', async (ctx): Promise<void> => {
  const chatId = ctx.chat?.id;
  const playerId = ctx.from?.id;

  if (!chatId || !playerId) {
    return;
  }

  const game = games.get(chatId);
  if (!game) {
    await ctx.reply('❌ Нет активной игры.');
    return;
  }

  if (game.removePlayer(playerId)) {
    await ctx.reply(`👋 ${ctx.from?.first_name} покинул игру.`);

    if (game.players.size === 0) {
      games.delete(chatId);
      await ctx.reply('🏁 Игра завершена - нет игроков.');
    }
  } else {
    await ctx.reply('❌ Вы не участвуете в игре.');
  }
});

// Команда /startgame
bot.command('startgame', async (ctx): Promise<void> => {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    return;
  }
  await handleStartGame(ctx, chatId);
});

// Команда /status
bot.command('status', async (ctx): Promise<void> => {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    return;
  }
  await handleGameStatus(ctx, chatId);
});

// Команда /cards
bot.command('cards', async (ctx): Promise<void> => {
  const chatId = ctx.chat?.id;
  const playerId = ctx.from?.id;

  if (!chatId || !playerId) {
    return;
  }

  const game = games.get(chatId);
  if (!game) {
    await ctx.reply('❌ Нет активной игры.');
    return;
  }

  const player = game.players.get(playerId);
  if (!player) {
    await ctx.reply('❌ Вы не участвуете в игре.');
    return;
  }

  try {
    await bot.api.sendMessage(playerId, `🃏 Ваши карты: ${player.getHandString()}\n💰 Фишки: ${player.chips}`);
  } catch {
    await ctx.reply(`${player.name}, не удалось отправить карты в личные сообщения. Напишите боту /start`);
  }
});

// Игровые действия
bot.command('fold', async (ctx): Promise<void> => {
  const chatId = ctx.chat?.id;
  const playerId = ctx.from?.id;
  if (!chatId || !playerId) {
    return;
  }
  await handleInlinePlayerAction(ctx, chatId, playerId, 'fold');
});

bot.command('call', async (ctx): Promise<void> => {
  const chatId = ctx.chat?.id;
  const playerId = ctx.from?.id;
  if (!chatId || !playerId) {
    return;
  }
  await handleInlinePlayerAction(ctx, chatId, playerId, 'call');
});

bot.command('check', async (ctx): Promise<void> => {
  const chatId = ctx.chat?.id;
  const playerId = ctx.from?.id;
  if (!chatId || !playerId) {
    return;
  }
  await handleInlinePlayerAction(ctx, chatId, playerId, 'check');
});

bot.command('raise', async (ctx): Promise<void> => {
  const chatId = ctx.chat?.id;
  const playerId = ctx.from?.id;
  if (!chatId || !playerId) {
    return;
  }

  const match = ctx.message?.text?.match(/\/raise\s+(\d+)/);
  const amount = match ? parseInt(match[1]) : 0;

  if (isNaN(amount) || amount <= 0) {
    await ctx.reply('❌ Укажите правильную сумму для рейза.');
    return;
  }

  await handleInlinePlayerAction(ctx, chatId, playerId, 'raise', amount);
});

// Обработчик callback query
bot.on('callback_query:data', async (ctx): Promise<void> => {
  const chatId = ctx.chat?.id;
  const playerId = ctx.from?.id;
  const playerName = ctx.from?.first_name ?? ctx.from?.username ?? 'Игрок';
  const data = ctx.callbackQuery.data;

  if (!chatId || !playerId) {
    return;
  }

  await ctx.answerCallbackQuery();

  const [action, ...params] = data.split('_');

  switch (action) {
    case 'join':
      await handleJoinGame(ctx, chatId, playerId, playerName);
      break;
    case 'leave':
      await handleLeaveGame(ctx, chatId, playerId, playerName);
      break;
    case 'start':
      await handleStartGame(ctx, chatId);
      break;
    case 'status':
      await handleGameStatus(ctx, chatId);
      break;
    case 'fold':
      await handleInlinePlayerAction(ctx, chatId, playerId, 'fold');
      break;
    case 'call':
      await handleInlinePlayerAction(ctx, chatId, playerId, 'call');
      break;
    case 'check':
      await handleInlinePlayerAction(ctx, chatId, playerId, 'check');
      break;
    case 'raise': {
      if (params.length > 0) {
        const amount = parseInt(params[0], 10);
        await handleInlinePlayerAction(ctx, chatId, playerId, 'raise', amount);
      }
      break;
    }
    case 'allin': {
      const game = games.get(chatId);
      if (game?.players.has(playerId)) {
        const player = game.players.get(playerId);
        if (player) {
          await handleInlinePlayerAction(ctx, chatId, playerId, 'raise', player.chips + player.currentBet);
        }
      }
      break;
    }
  }
});

// Вспомогательные функции
function getGameStatusMessage(game: PokerGame): string {
  const status = game.getGameStatus();
  let message = '🎯 Статус игры:\n';
  message += `💰 Банк: ${status.pot}\n`;
  message += `📊 Текущая ставка: ${status.currentBet}\n`;
  message += `🎪 Стадия: ${getStageEmoji(status.gameState)} ${status.gameState}\n`;
  message += `👥 Активных игроков: ${status.activePlayers}\n`;

  if (status.communityCards) {
    message += `🃏 Общие карты: ${status.communityCards}\n`;
  }

  if (status.currentPlayer !== 'None') {
    message += `⏰ Ходит: ${status.currentPlayer}`;
  }

  return message;
}

function getStageEmoji(stage: string): string {
  const emojis: Record<string, string> = {
    waiting: '⏳',
    preflop: '🎲',
    flop: '🎯',
    turn: '🎪',
    river: '🌊',
    showdown: '🏆',
  };
  return emojis[stage] ?? '🎮';
}

function createGameManagementKeyboard(gameExists = false, playersCount = 0): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (!gameExists) {
    keyboard.text('🎯 Создать игру', 'newgame');
  } else {
    keyboard.text('✅ Присоединиться', 'join').text('❌ Покинуть игру', 'leave');
    keyboard.row();

    if (playersCount >= 2) {
      keyboard.text('🚀 Начать игру', 'start');
      keyboard.row();
    }

    keyboard.text('📊 Статус игры', 'status');
  }

  return keyboard;
}

function createPlayerActionKeyboard(game: PokerGame, playerId: number): InlineKeyboard | null {
  const player = game.players.get(playerId);

  if (!player || player.isFolded) {
    return null;
  }

  const keyboard = new InlineKeyboard();
  const callAmount = game.currentBet - player.currentBet;
  const canCheck = callAmount === 0;
  const minRaise = Math.max(game.currentBet * 2, game.currentBet + 20);

  keyboard.text('🚫 Сброс', 'fold');

  if (canCheck) {
    keyboard.text('✅ Чек', 'check');
  } else {
    keyboard.text(`📞 Колл ${callAmount}`, 'call');
  }

  keyboard.row();

  if (player.chips > callAmount) {
    if (player.chips + player.currentBet >= minRaise) {
      keyboard.text(`📈 Рейз ${minRaise}`, `raise_${minRaise}`);
    }

    const potRaise = game.pot + game.currentBet;
    if (potRaise > minRaise && player.chips + player.currentBet >= potRaise) {
      keyboard.text(`🎯 Пот ${potRaise}`, `raise_${potRaise}`);
    }

    keyboard.text('🔥 Олл-ин', 'allin');
  }

  return keyboard;
}

async function handleJoinGame(ctx: Context, chatId: number, playerId: number, playerName: string): Promise<void> {
  const game = games.get(chatId);
  if (!game) {
    await ctx.reply('❌ Нет активной игры. Используйте /newgame для создания.');
    return;
  }

  if (game.addPlayer(playerId, playerName)) {
    const keyboard = createGameManagementKeyboard(true, game.players.size);
    await ctx.reply(`✅ ${playerName} присоединился к игре! (${game.players.size}/6 игроков)`, {
      reply_markup: keyboard,
    });
  } else {
    await ctx.reply('❌ Не удалось присоединиться (игрок уже в игре или достигнут лимит игроков).');
  }
}

async function handleLeaveGame(ctx: Context, chatId: number, playerId: number, playerName: string): Promise<void> {
  const game = games.get(chatId);
  if (!game) {
    await ctx.reply('❌ Нет активной игры.');
    return;
  }

  if (game.removePlayer(playerId)) {
    await ctx.reply(`👋 ${playerName} покинул игру.`);

    if (game.players.size === 0) {
      games.delete(chatId);
      await ctx.reply('🏁 Игра завершена - нет игроков.');
    } else {
      const keyboard = createGameManagementKeyboard(true, game.players.size);
      await ctx.reply('Игра продолжается...', { reply_markup: keyboard });
    }
  } else {
    await ctx.reply('❌ Вы не участвуете в игре.');
  }
}

async function handleStartGame(ctx: Context, chatId: number): Promise<void> {
  const game = games.get(chatId);
  if (!game) {
    await ctx.reply('❌ Нет активной игры. Используйте /newgame для создания.');
    return;
  }

  if (game.startGame()) {
    await ctx.reply(`🚀 Игра началась! Карты розданы.\n\n${getGameStatusMessage(game)}`);

    for (const [playerId, player] of game.players) {
      try {
        await bot.api.sendMessage(playerId, `🃏 Ваши карты: ${player.getHandString()}\n💰 Фишки: ${player.chips}`);
      } catch {
        await ctx.reply(`@${player.name}, проверьте личные сообщения для получения карт или напишите боту /start`);
      }
    }

    const currentPlayer = game.getCurrentPlayer();
    if (currentPlayer) {
      const keyboard = createPlayerActionKeyboard(game, currentPlayer.id);
      await ctx.reply(`⏰ Ходит: ${currentPlayer.name}`, {
        reply_markup: keyboard ?? undefined,
      });
    }
  } else {
    await ctx.reply('❌ Нельзя начать игру (нужно минимум 2 игрока).');
  }
}

async function handleGameStatus(ctx: Context, chatId: number): Promise<void> {
  const game = games.get(chatId);
  if (!game) {
    await ctx.reply('❌ Нет активной игры.');
    return;
  }

  const statusMessage = getGameStatusMessage(game);
  const keyboard = game.gameState === 'waiting' ? createGameManagementKeyboard(true, game.players.size) : undefined;

  await ctx.reply(statusMessage, keyboard ? { reply_markup: keyboard } : {});
}

async function handleInlinePlayerAction(
  ctx: Context,
  chatId: number,
  playerId: number,
  action: 'fold' | 'call' | 'check' | 'raise',
  amount = 0,
): Promise<void> {
  const game = games.get(chatId);
  if (!game) {
    await ctx.reply('❌ Нет активной игры.');
    return;
  }

  if (game.gameState === 'waiting' || game.gameState === 'showdown') {
    await ctx.reply('❌ Сейчас нельзя делать ходы.');
    return;
  }

  const player = game.players.get(playerId);
  if (!player) {
    await ctx.reply('❌ Вы не участвуете в игре.');
    return;
  }

  const currentPlayer = game.getCurrentPlayer();
  if (!currentPlayer || currentPlayer.id !== playerId) {
    await ctx.reply(`❌ Сейчас ходит ${currentPlayer?.name ?? 'неизвестный игрок'}.`);
    return;
  }

  if (game.playerAction(playerId, action, amount)) {
    let actionMessage = `${player.name} `;
    switch (action) {
      case 'fold': {
        actionMessage += 'сбросил карты 🚫';
        break;
      }
      case 'call': {
        const callAmount = game.currentBet - player.currentBet;
        actionMessage += `сделал колл (${callAmount} фишек) 📞`;
        break;
      }
      case 'check': {
        actionMessage += 'сделал чек ✅';
        break;
      }
      case 'raise': {
        actionMessage += `поднял до ${amount} фишек 📈`;
        break;
      }
    }

    await ctx.reply(actionMessage);

    if (game.isRoundComplete()) {
      const activePlayers = Array.from(game.players.values()).filter((p) => !p.isFolded);

      if (activePlayers.length <= 1 || game.gameState === 'river') {
        const results = game.determineWinners();
        const resultsMessage = game.formatGameResults(results);

        await ctx.reply(resultsMessage);

        if (game.gameState === 'river' && activePlayers.length > 1) {
          let handsMessage = '🃏 КАРТЫ ИГРОКОВ:\n\n';
          for (const player of activePlayers) {
            const bestHand = player.getBestHand(game.communityCards);
            const handCards = bestHand.cards.map((c) => game.getCardString(c)).join(' ');
            handsMessage += `${player.name}:\n`;
            handsMessage += `  Карты: ${player.getHandString()}\n`;
            handsMessage += `  Лучшая комбинация: ${bestHand.description}\n`;
            handsMessage += `  5 карт: ${handCards}\n\n`;
          }
          await ctx.reply(handsMessage);
        }

        for (const [playerId, player] of game.players) {
          if (player.chips <= 0) {
            game.removePlayer(playerId);
            await ctx.reply(`💸 ${player.name} выбывает из игры (закончились фишки)`);
          }
        }

        if (game.players.size <= 1) {
          games.delete(chatId);
          await ctx.reply('🏁 Игра полностью завершена!');
        } else {
          const keyboard = createGameManagementKeyboard(true, game.players.size);
          await ctx.reply('🔄 Готовы к новой раздаче? Используйте кнопку ниже:', {
            reply_markup: keyboard,
          });
          game.gameState = 'waiting';
        }
      } else {
        game.nextStreet();
        await ctx.reply(getGameStatusMessage(game));

        const nextPlayer = game.getCurrentPlayer();
        if (nextPlayer) {
          const keyboard = createPlayerActionKeyboard(game, nextPlayer.id);
          await ctx.reply(`⏰ Ходит: ${nextPlayer.name}`, {
            reply_markup: keyboard ?? undefined,
          });
        }
      }
    } else {
      do {
        game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.size;
      } while (Array.from(game.players.values())[game.currentPlayerIndex].isFolded);

      const nextPlayer = game.getCurrentPlayer();
      if (nextPlayer) {
        const keyboard = createPlayerActionKeyboard(game, nextPlayer.id);
        await ctx.reply(`⏰ Ходит: ${nextPlayer.name}`, {
          reply_markup: keyboard ?? undefined,
        });
      }
    }
  }
}

// Запуск бота
void bot.start({
  onStart: (): void => {
    console.info('🤖 Покер бот запущен!');
  },
});

// Обработка ошибок
bot.catch((err): void => {
  console.error('Ошибка бота:', err);
});
