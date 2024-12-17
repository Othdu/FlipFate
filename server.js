const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const cors = require('cors');

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

// Game state
const games = new Map();

class Game {
    constructor(hostId) {
        this.players = new Map();
        this.deck = this.createDeck();
        this.currentTurn = null;
        this.hostId = hostId;
        this.gameState = 'waiting'; // waiting, playing, finished
        this.playedCards = [];
        this.scores = new Map();
    }

    createDeck() {
        const cards = [];
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
        const values = {
            'ace': 1,
            '2': 2,
            '3': 3,
            '4': 4,
            '5': 5,
            '6': 6,
            '7': 7,
            '8': 8,
            '9': 9,
            '10': 10,
            'jack': 11,
            'queen': 12,
            'king': 13
        };

        // Add numbered and face cards
        for (const suit of suits) {
            for (const [valueName, valueNumber] of Object.entries(values)) {
                cards.push({
                    value: valueNumber,
                    displayValue: valueName,
                    suit: suit,
                    action: this.getCardAction(valueNumber),
                    image: `${valueName}_of_${suit}.png`
                });
            }
        }

        // Add jokers
        cards.push({
            value: 14,
            displayValue: 'joker',
            suit: 'red',
            action: 'Revert Turn',
            image: 'red_joker.png'
        });
        cards.push({
            value: 14,
            displayValue: 'joker',
            suit: 'black',
            action: 'Revert Turn',
            image: 'black_joker.png'
        });

        return this.shuffle(cards);
    }

    getCardAction(value) {
        const actions = {
            1: 'Ask a Question',
            2: 'Keep the Card',
            3: 'Give the Card',
            4: 'Rock-Paper-Scissors',
            5: 'Quick Reflex',
            6: 'Quick Reflex',
            7: 'Quick Reflex',
            8: 'Word/Rhyme Challenge',
            9: 'Category Challenge',
            10: 'Skip',
            11: 'Wildcard',    // Jack
            12: 'Silence',     // Queen
            13: 'Song Chain',  // King
            14: 'Revert Turn'  // Joker
        };
        return actions[value];
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    addPlayer(playerId, playerName) {
        this.players.set(playerId, {
            name: playerName,
            cards: [],
            isHost: playerId === this.hostId
        });
        this.scores.set(playerId, 0);
    }

    dealInitialCards() {
        const initialCards = 7;
        this.players.forEach((player, playerId) => {
            player.cards = this.deck.splice(0, initialCards);
        });
        // Place first card face up
        this.playedCards.push(this.deck.pop());
    }

    drawCard(playerId) {
        if (this.currentTurn !== playerId) return null;
        if (this.deck.length === 0) {
            this.deck = this.shuffle(this.playedCards.slice(0, -1));
            this.playedCards = [this.playedCards[this.playedCards.length - 1]];
        }
        const card = this.deck.pop();
        this.players.get(playerId).cards.push(card);
        return card;
    }

    playCard(playerId, card) {
        if (this.currentTurn !== playerId) return false;
        
        const player = this.players.get(playerId);
        const cardIndex = player.cards.findIndex(c => c.value === card.value);
        
        if (cardIndex === -1) return false;
        
        const topCard = this.playedCards[this.playedCards.length - 1];
        if (card.value === 'JOKER' || card.value === topCard.value || card.action === topCard.action) {
            const playedCard = player.cards.splice(cardIndex, 1)[0];
            this.playedCards.push(playedCard);
            return true;
        }
        
        return false;
    }

    nextTurn() {
        const playerIds = Array.from(this.players.keys());
        const currentIndex = playerIds.indexOf(this.currentTurn);
        this.currentTurn = playerIds[(currentIndex + 1) % playerIds.length];
        return this.currentTurn;
    }

    getPlayerCardCount(playerId) {
        return this.players.get(playerId).cards.length;
    }

    addScore(playerId, points) {
        this.scores.set(playerId, this.scores.get(playerId) + points);
    }
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('createGame', (playerName) => {
        const gameId = Math.random().toString(36).substring(2, 8);
        const game = new Game(socket.id);
        game.addPlayer(socket.id, playerName);
        games.set(gameId, game);
        socket.join(gameId);
        socket.emit('gameCreated', { gameId, playerId: socket.id });
    });

    socket.on('joinGame', ({ gameId, playerName }) => {
        const game = games.get(gameId);
        if (game && game.gameState === 'waiting') {
            game.addPlayer(socket.id, playerName);
            socket.join(gameId);
            socket.emit('gameJoined', { gameId, playerId: socket.id });
            io.to(gameId).emit('playerList', Array.from(game.players.entries()));
        } else {
            socket.emit('error', 'Game not found or already started');
        }
    });

    socket.on('startGame', (gameId) => {
        const game = games.get(gameId);
        if (game && socket.id === game.hostId) {
            game.gameState = 'playing';
            game.dealInitialCards();
            game.currentTurn = Array.from(game.players.keys())[0];
            
            // Send initial game state to all players
            game.players.forEach((player, playerId) => {
                io.to(playerId).emit('gameStarted', {
                    firstPlayer: game.currentTurn,
                    initialCards: player.cards,
                    topCard: game.playedCards[game.playedCards.length - 1]
                });
            });
        }
    });

    socket.on('drawCard', (gameId) => {
        const game = games.get(gameId);
        if (game && game.gameState === 'playing') {
            const card = game.drawCard(socket.id);
            if (card) {
                socket.emit('cardDrawn', { 
                    card,
                    currentPlayer: socket.id
                });
                socket.to(gameId).emit('cardDrawn', {
                    currentPlayer: socket.id,
                    opponentCardCount: game.getPlayerCardCount(socket.id)
                });
                
                // Move to next turn after drawing
                const nextPlayer = game.nextTurn();
                io.to(gameId).emit('turnChanged', { currentPlayer: nextPlayer });
            }
        }
    });

    socket.on('playCard', ({ gameId, card }) => {
        const game = games.get(gameId);
        if (game && game.gameState === 'playing') {
            if (game.playCard(socket.id, card)) {
                io.to(gameId).emit('cardPlayed', {
                    card,
                    currentPlayer: socket.id,
                    opponentCardCount: game.getPlayerCardCount(socket.id)
                });

                // Check for win condition
                if (game.getPlayerCardCount(socket.id) === 0) {
                    game.addScore(socket.id, 1);
                    game.gameState = 'finished';
                    io.to(gameId).emit('gameOver', {
                        winner: socket.id,
                        scores: Array.from(game.scores.entries())
                    });
                } else {
                    // Move to next turn
                    const nextPlayer = game.nextTurn();
                    io.to(gameId).emit('turnChanged', { currentPlayer: nextPlayer });
                }
            }
        }
    });

    socket.on('quitGame', (gameId) => {
        const game = games.get(gameId);
        if (game) {
            if (socket.id === game.hostId) {
                // If host quits, end the game
                io.to(gameId).emit('gameEnded', { reason: 'Host left the game' });
                games.delete(gameId);
            } else {
                // If player quits, remove them from the game
                game.players.delete(socket.id);
                socket.leave(gameId);
                io.to(gameId).emit('playerLeft', { playerId: socket.id });
            }
        }
    });

    socket.on('chatMessage', ({ gameId, message }) => {
        const game = games.get(gameId);
        if (game) {
            const player = game.players.get(socket.id);
            io.to(gameId).emit('chatMessage', {
                sender: player.name,
                message
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Find and handle any games this player was in
        games.forEach((game, gameId) => {
            if (game.players.has(socket.id)) {
                if (socket.id === game.hostId) {
                    io.to(gameId).emit('gameEnded', { reason: 'Host disconnected' });
                    games.delete(gameId);
                } else {
                    game.players.delete(socket.id);
                    io.to(gameId).emit('playerLeft', { playerId: socket.id });
                }
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 