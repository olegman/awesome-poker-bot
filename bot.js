require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { PokerGame } = require('./game');

// Загружаем токен из переменных окружения
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
    console.error('❌ Ошибка: TELEGRAM_BOT_TOKEN не найден в .env файле');
    process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Хранилище игр для разных чатов
const games = new Map();

// Команда /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
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
        'Для игры нужно минимум 2 игрока!'
    );
});

// Команда /newgame
bot.onText(/\/newgame/, (msg) => {
    const chatId = msg.chat.id;

    if (games.has(chatId)) {
        const keyboard = createGameManagementKeyboard(true, games.get(chatId).players.size);
        bot.sendMessage(chatId, '❌ Игра уже создана в этом чате!', {
            reply_markup: keyboard
        });
        return;
    }

    games.set(chatId, new PokerGame(chatId));
    const keyboard = createGameManagementKeyboard(true, 0);
    bot.sendMessage(chatId, '🎯 Новая игра покера создана! Используйте кнопки ниже для управления игрой.', {
        reply_markup: keyboard
    });
});

// Команда /join
bot.onText(/\/join/, (msg) => {
    const chatId = msg.chat.id;
    const playerId = msg.from.id;
    const playerName = msg.from.first_name || msg.from.username || 'Игрок';

    handleJoinGame(chatId, playerId, playerName);
});

// Команда /leave
bot.onText(/\/leave/, (msg) => {
    const chatId = msg.chat.id;
    const playerId = msg.from.id;

    const game = games.get(chatId);
    if (!game) {
        bot.sendMessage(chatId, '❌ Нет активной игры.');
        return;
    }

    if (game.removePlayer(playerId)) {
        bot.sendMessage(chatId, `👋 ${msg.from.first_name} покинул игру.`);

        if (game.players.size === 0) {
            games.delete(chatId);
            bot.sendMessage(chatId, '🏁 Игра завершена - нет игроков.');
        }
    } else {
        bot.sendMessage(chatId, '❌ Вы не участвуете в игре.');
    }
});

// Команда /startgame
bot.onText(/\/startgame/, (msg) => {
    const chatId = msg.chat.id;
    handleStartGame(chatId);
});

// Команда /status
bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    handleGameStatus(chatId);
});

// Команда /cards
bot.onText(/\/cards/, (msg) => {
    const chatId = msg.chat.id;
    const playerId = msg.from.id;

    const game = games.get(chatId);
    if (!game) {
        bot.sendMessage(chatId, '❌ Нет активной игры.');
        return;
    }

    const player = game.players.get(playerId);
    if (!player) {
        bot.sendMessage(chatId, '❌ Вы не участвуете в игре.');
        return;
    }

    // Отправляем карты в личку
    bot.sendMessage(playerId, `🃏 Ваши карты: ${player.getHandString()}\n💰 Фишки: ${player.chips}`)
        .catch(() => {
            bot.sendMessage(chatId, `${player.name}, не удалось отправить карты в личные сообщения. Напишите боту /start`);
        });
});

// Игровые действия (оставляем для совместимости с командами)
bot.onText(/\/fold/, (msg) => {
    handleInlinePlayerAction(msg.chat.id, msg.from.id, 'fold');
});

bot.onText(/\/call/, (msg) => {
    handleInlinePlayerAction(msg.chat.id, msg.from.id, 'call');
});

bot.onText(/\/check/, (msg) => {
    handleInlinePlayerAction(msg.chat.id, msg.from.id, 'check');
});

bot.onText(/\/raise (.+)/, (msg, match) => {
    const amount = parseInt(match[1]);
    if (isNaN(amount)) {
        bot.sendMessage(msg.chat.id, '❌ Укажите правильную сумму для рейза.');
        return;
    }
    handleInlinePlayerAction(msg.chat.id, msg.from.id, 'raise', amount);
});

function getGameStatusMessage(game) {
    const status = game.getGameStatus();
    let message = `🎯 Статус игры:\n`;
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

function getStageEmoji(stage) {
    const emojis = {
        'waiting': '⏳',
        'preflop': '🎲',
        'flop': '🎯',
        'turn': '🎪',
        'river': '🌊',
        'showdown': '🏆'
    };
    return emojis[stage] || '🎮';
}

// Обработчик inline кнопок
bot.on('callback_query', (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    const chatId = msg.chat.id;
    const playerId = callbackQuery.from.id;
    const playerName = callbackQuery.from.first_name || callbackQuery.from.username || 'Игрок';

    // Отвечаем на callback чтобы убрать "loading" состояние кнопки
    bot.answerCallbackQuery(callbackQuery.id);

    const game = games.get(chatId);

    // Разбираем callback data
    const [action, ...params] = data.split('_');

    switch (action) {
        case 'join':
            handleJoinGame(chatId, playerId, playerName);
            break;
        case 'leave':
            handleLeaveGame(chatId, playerId, playerName);
            break;
        case 'start':
            handleStartGame(chatId);
            break;
        case 'status':
            handleGameStatus(chatId);
            break;
        case 'fold':
            handleInlinePlayerAction(chatId, playerId, 'fold');
            break;
        case 'call':
            handleInlinePlayerAction(chatId, playerId, 'call');
            break;
        case 'check':
            handleInlinePlayerAction(chatId, playerId, 'check');
            break;
        case 'raise':
            if (params.length > 0) {
                const amount = parseInt(params[0]);
                handleInlinePlayerAction(chatId, playerId, 'raise', amount);
            }
            break;
        case 'allin':
            if (game && game.players.has(playerId)) {
                const player = game.players.get(playerId);
                handleInlinePlayerAction(chatId, playerId, 'raise', player.chips + player.currentBet);
            }
            break;
    }
});

// Функции для создания inline клавиатур
function createGameManagementKeyboard(gameExists = false, playersCount = 0) {
    const keyboard = [];

    if (!gameExists) {
        keyboard.push([{ text: '🎯 Создать игру', callback_data: 'newgame' }]);
    } else {
        keyboard.push([
            { text: '✅ Присоединиться', callback_data: 'join' },
            { text: '❌ Покинуть игру', callback_data: 'leave' }
        ]);

        if (playersCount >= 2) {
            keyboard.push([{ text: '🚀 Начать игру', callback_data: 'start' }]);
        }

        keyboard.push([{ text: '📊 Статус игры', callback_data: 'status' }]);
    }

    return { inline_keyboard: keyboard };
}

function createPlayerActionKeyboard(game, playerId) {
    const keyboard = [];
    const player = game.players.get(playerId);

    if (!player || player.isFolded) {
        return null;
    }

    const callAmount = game.currentBet - player.currentBet;
    const canCheck = callAmount === 0;
    const minRaise = Math.max(game.currentBet * 2, game.currentBet + 20);

    // Первая строка: основные действия
    const firstRow = [];
    firstRow.push({ text: '🚫 Сброс', callback_data: 'fold' });

    if (canCheck) {
        firstRow.push({ text: '✅ Чек', callback_data: 'check' });
    } else {
        firstRow.push({ text: `📞 Колл ${callAmount}`, callback_data: 'call' });
    }

    keyboard.push(firstRow);

    // Вторая строка: рейзы
    if (player.chips > callAmount) {
        const raiseRow = [];

        // Минимальный рейз
        if (player.chips + player.currentBet >= minRaise) {
            raiseRow.push({ text: `📈 Рейз ${minRaise}`, callback_data: `raise_${minRaise}` });
        }

        // Рейз на размер пота
        const potRaise = game.pot + game.currentBet;
        if (potRaise > minRaise && player.chips + player.currentBet >= potRaise) {
            raiseRow.push({ text: `🎯 Пот ${potRaise}`, callback_data: `raise_${potRaise}` });
        }

        // Олл-ин
        raiseRow.push({ text: '🔥 Олл-ин', callback_data: 'allin' });

        if (raiseRow.length > 0) {
            keyboard.push(raiseRow);
        }
    }

    return { inline_keyboard: keyboard };
}

function createQuickRaiseKeyboard(game, playerId) {
    const keyboard = [];
    const player = game.players.get(playerId);

    if (!player) return null;

    const callAmount = game.currentBet - player.currentBet;
    const availableChips = player.chips;
    const currentPot = game.pot;

    const raises = [];

    // 1/4 пота
    const quarterPot = Math.floor(currentPot / 4);
    if (quarterPot >= game.currentBet && availableChips >= quarterPot - callAmount) {
        raises.push({ text: `1/4 пота (${quarterPot})`, callback_data: `raise_${quarterPot}` });
    }

    // 1/2 пота
    const halfPot = Math.floor(currentPot / 2);
    if (halfPot >= game.currentBet && availableChips >= halfPot - callAmount) {
        raises.push({ text: `1/2 пота (${halfPot})`, callback_data: `raise_${halfPot}` });
    }

    // Размер пота
    if (availableChips >= currentPot - callAmount) {
        raises.push({ text: `Пот (${currentPot})`, callback_data: `raise_${currentPot}` });
    }

    // Разбиваем кнопки по 2 в ряд
    for (let i = 0; i < raises.length; i += 2) {
        const row = raises.slice(i, i + 2);
        keyboard.push(row);
    }

    return { inline_keyboard: keyboard };
}

// Обновленные обработчики действий
function handleJoinGame(chatId, playerId, playerName) {
    const game = games.get(chatId);
    if (!game) {
        bot.sendMessage(chatId, '❌ Нет активной игры. Используйте /newgame для создания.');
        return;
    }

    if (game.addPlayer(playerId, playerName)) {
        const keyboard = createGameManagementKeyboard(true, game.players.size);
        bot.sendMessage(chatId, `✅ ${playerName} присоединился к игре! (${game.players.size}/6 игроков)`, {
            reply_markup: keyboard
        });
    } else {
        bot.sendMessage(chatId, '❌ Не удалось присоединиться (игрок уже в игре или достигнут лимит игроков).');
    }
}

function handleLeaveGame(chatId, playerId, playerName) {
    const game = games.get(chatId);
    if (!game) {
        bot.sendMessage(chatId, '❌ Нет активной игры.');
        return;
    }

    if (game.removePlayer(playerId)) {
        bot.sendMessage(chatId, `👋 ${playerName} покинул игру.`);

        if (game.players.size === 0) {
            games.delete(chatId);
            bot.sendMessage(chatId, '🏁 Игра завершена - нет игроков.');
        } else {
            const keyboard = createGameManagementKeyboard(true, game.players.size);
            bot.sendMessage(chatId, 'Игра продолжается...', { reply_markup: keyboard });
        }
    } else {
        bot.sendMessage(chatId, '❌ Вы не участвуете в игре.');
    }
}

function handleStartGame(chatId) {
    const game = games.get(chatId);
    if (!game) {
        bot.sendMessage(chatId, '❌ Нет активной игры. Используйте /newgame для создания.');
        return;
    }

    if (game.startGame()) {
        bot.sendMessage(chatId, '🚀 Игра началась! Карты розданы.\n\n' + getGameStatusMessage(game));

        // Отправляем карты каждому игроку в личные сообщения
        for (let [playerId, player] of game.players) {
            bot.sendMessage(playerId, `🃏 Ваши карты: ${player.getHandString()}\n💰 Фишки: ${player.chips}`)
                .catch(() => {
                    bot.sendMessage(chatId, `@${player.name}, проверьте личные сообщения для получения карт или напишите боту /start`);
                });
        }

        // Показываем кнопки для текущего игрока
        const currentPlayer = game.getCurrentPlayer();
        if (currentPlayer) {
            const keyboard = createPlayerActionKeyboard(game, currentPlayer.id);
            bot.sendMessage(chatId, `⏰ Ходит: ${currentPlayer.name}`, {
                reply_markup: keyboard
            });
        }
    } else {
        bot.sendMessage(chatId, '❌ Нельзя начать игру (нужно минимум 2 игрока).');
    }
}

function handleGameStatus(chatId) {
    const game = games.get(chatId);
    if (!game) {
        bot.sendMessage(chatId, '❌ Нет активной игры.');
        return;
    }

    const statusMessage = getGameStatusMessage(game);
    const keyboard = game.gameState === 'waiting'
        ? createGameManagementKeyboard(true, game.players.size)
        : null;

    bot.sendMessage(chatId, statusMessage, keyboard ? { reply_markup: keyboard } : {});
}

function handleInlinePlayerAction(chatId, playerId, action, amount = 0) {
    const game = games.get(chatId);
    if (!game) {
        bot.sendMessage(chatId, '❌ Нет активной игры.');
        return;
    }

    if (game.gameState === 'waiting' || game.gameState === 'showdown') {
        bot.sendMessage(chatId, '❌ Сейчас нельзя делать ходы.');
        return;
    }

    const player = game.players.get(playerId);
    if (!player) {
        bot.sendMessage(chatId, '❌ Вы не участвуете в игре.');
        return;
    }

    const currentPlayer = game.getCurrentPlayer();
    if (currentPlayer.id !== playerId) {
        bot.sendMessage(chatId, `❌ Сейчас ходит ${currentPlayer.name}.`);
        return;
    }

    if (game.playerAction(playerId, action, amount)) {
        let actionMessage = `${player.name} `;
        switch (action) {
            case 'fold':
                actionMessage += 'сбросил карты 🚫';
                break;
            case 'call':
                const callAmount = game.currentBet - player.currentBet;
                actionMessage += `сделал колл (${callAmount} фишек) 📞`;
                break;
            case 'check':
                actionMessage += 'сделал чек ✅';
                break;
            case 'raise':
                actionMessage += `поднял до ${amount} фишек 📈`;
                break;
        }

        bot.sendMessage(chatId, actionMessage);

        // Переход к следующему игроку или следующему кругу
        if (game.isRoundComplete()) {
            const activePlayers = Array.from(game.players.values()).filter(p => !p.isFolded);

            if (activePlayers.length <= 1 || game.gameState === 'river') {
                // Игра завершена - определяем победителей
                const results = game.determineWinners();
                const resultsMessage = game.formatGameResults(results);

                bot.sendMessage(chatId, resultsMessage);

                // Показываем карты всех игроков, которые дошли до showdown
                if (game.gameState === 'river' && activePlayers.length > 1) {
                    let handsMessage = '🃏 КАРТЫ ИГРОКОВ:\n\n';
                    for (let player of activePlayers) {
                        const bestHand = player.getBestHand(game.communityCards);
                        const handCards = bestHand.cards.map(c => game.getCardString(c)).join(' ');
                        handsMessage += `${player.name}:\n`;
                        handsMessage += `  Карты: ${player.getHandString()}\n`;
                        handsMessage += `  Лучшая комбинация: ${bestHand.description}\n`;
                        handsMessage += `  5 карт: ${handCards}\n\n`;
                    }
                    bot.sendMessage(chatId, handsMessage);
                }

                // Убираем игроков без фишек
                for (let [playerId, player] of game.players) {
                    if (player.chips <= 0) {
                        game.removePlayer(playerId);
                        bot.sendMessage(chatId, `💸 ${player.name} выбывает из игры (закончились фишки)`);
                    }
                }

                if (game.players.size <= 1) {
                    games.delete(chatId);
                    bot.sendMessage(chatId, '🏁 Игра полностью завершена!');
                } else {
                    const keyboard = createGameManagementKeyboard(true, game.players.size);
                    bot.sendMessage(chatId, '🔄 Готовы к новой раздаче? Используйте кнопку ниже:', {
                        reply_markup: keyboard
                    });
                    game.gameState = 'waiting';
                }
            } else {
                game.nextStreet();
                bot.sendMessage(chatId, getGameStatusMessage(game));

                // Показать кнопки для следующего этапа
                const nextPlayer = game.getCurrentPlayer();
                if (nextPlayer) {
                    const keyboard = createPlayerActionKeyboard(game, nextPlayer.id);
                    bot.sendMessage(chatId, `⏰ Ходит: ${nextPlayer.name}`, {
                        reply_markup: keyboard
                    });
                }
            }
        } else {
            // Переход к следующему игроку
            do {
                game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.size;
            } while (Array.from(game.players.values())[game.currentPlayerIndex].isFolded);

            const nextPlayer = game.getCurrentPlayer();
            const keyboard = createPlayerActionKeyboard(game, nextPlayer.id);
            bot.sendMessage(chatId, `⏰ Ходит: ${nextPlayer.name}`, {
                reply_markup: keyboard
            });
        }
    }
}

// Обработка ошибок
bot.on('polling_error', (error) => {
    console.log('Polling error:', error);
});

console.log('🤖 Покер бот запущен!');
