const socket = io();

// Game state
let gameId = null;
let playerId = null;
let playerName = null;
let isHost = false;
let currentTurn = null;
let playerHand = [];
let opponentCardCount = 0;

// DOM Elements
const welcomeScreen = document.getElementById('welcome-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const playerNameInput = document.getElementById('player-name');
const gameIdInput = document.getElementById('game-id');
const createGameBtn = document.getElementById('create-game');
const joinGameBtn = document.getElementById('join-game');
const startGameBtn = document.getElementById('start-game');
const quitGameBtn = document.getElementById('quit-game');
const gameCodeDisplay = document.getElementById('game-code');
const playersList = document.getElementById('players-list');
const currentCard = document.getElementById('current-card');
const drawDeck = document.getElementById('draw-deck');
const playerHandElement = document.querySelector('.player-hand');
const opponentCards = document.querySelector('.opponent-cards');
const player1Score = document.getElementById('player1-score');
const player2Score = document.getElementById('player2-score');
const actionButtons = document.getElementById('action-buttons');
const timer = document.getElementById('timer');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');

// Event Listeners
createGameBtn.addEventListener('click', createGame);
joinGameBtn.addEventListener('click', joinGame);
startGameBtn.addEventListener('click', startGame);
quitGameBtn.addEventListener('click', quitGame);
drawDeck.addEventListener('click', drawCard);
chatInput.addEventListener('keypress', handleChatInput);

function createGame() {
    playerName = playerNameInput.value.trim();
    if (!playerName) {
        alert('Please enter your name');
        return;
    }
    socket.emit('createGame', playerName);
}

function joinGame() {
    playerName = playerNameInput.value.trim();
    const gameIdToJoin = gameIdInput.value.trim();
    if (!playerName || !gameIdToJoin) {
        alert('Please enter both your name and game code');
        return;
    }
    socket.emit('joinGame', { gameId: gameIdToJoin, playerName });
}

function startGame() {
    if (isHost) {
        socket.emit('startGame', gameId);
    }
}

function quitGame() {
    if (confirm('Are you sure you want to quit the game?')) {
        socket.emit('quitGame', gameId);
        showScreen(welcomeScreen);
        resetGameState();
    }
}

function resetGameState() {
    gameId = null;
    playerId = null;
    isHost = false;
    currentTurn = null;
    playerHand = [];
    opponentCardCount = 0;
    updateUI();
}

function showScreen(screen) {
    welcomeScreen.classList.remove('active');
    lobbyScreen.classList.remove('active');
    gameScreen.classList.remove('active');
    screen.classList.add('active');
}

function updatePlayersList(players) {
    playersList.innerHTML = '';
    players.forEach(([id, player]) => {
        const playerElement = document.createElement('div');
        playerElement.classList.add('player');
        playerElement.textContent = `${player.name}${player.isHost ? ' (Host)' : ''}`;
        playersList.appendChild(playerElement);
    });
}

function createCardElement(card, faceDown = false) {
    const cardElement = document.createElement('div');
    cardElement.classList.add('card');
    
    const cardBack = document.createElement('div');
    cardBack.classList.add('card-back');
    cardBack.style.backgroundImage = 'url("/cards/ace_of_spades2.png")';
    
    const cardFront = document.createElement('div');
    cardFront.classList.add('card-front');
    
    if (!faceDown && card) {
        cardFront.style.backgroundImage = `url("/cards/${card.image}")`;
        cardElement.dataset.value = card.value;
        cardElement.dataset.action = card.action;
        
        if (currentTurn === playerId) {
            cardElement.addEventListener('click', () => playCard(card));
        }
    }
    
    cardElement.appendChild(cardBack);
    cardElement.appendChild(cardFront);
    
    return cardElement;
}

function updateUI() {
    // Update player's hand (start with no cards)
    playerHandElement.innerHTML = '';
    if (playerHand.length > 0) {
        playerHand.forEach(card => {
            const cardElement = createCardElement(card);
            cardElement.classList.add('dealing');
            playerHandElement.appendChild(cardElement);
            // Flip the card after it's dealt
            setTimeout(() => {
                cardElement.classList.add('flipped');
            }, 100);
        });
    }

    // Update opponent's cards
    opponentCards.innerHTML = '';
    for (let i = 0; i < opponentCardCount; i++) {
        const cardElement = createCardElement(null, true);
        cardElement.classList.add('dealing');
        opponentCards.appendChild(cardElement);
    }

    // Update deck
    drawDeck.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        const cardElement = createCardElement(null, true);
        drawDeck.appendChild(cardElement);
    }
}

function drawCard() {
    if (currentTurn === playerId) {
        const deck = document.getElementById('draw-deck');
        // Add drawing animation
        deck.classList.add('drawing');
        setTimeout(() => {
            deck.classList.remove('drawing');
            socket.emit('drawCard', gameId);
        }, 300);
    }
}

function playCard(card) {
    if (currentTurn === playerId) {
        socket.emit('playCard', { gameId, card });
    }
}

function handleChatInput(event) {
    if (event.key === 'Enter' && chatInput.value.trim()) {
        const message = chatInput.value.trim();
        socket.emit('chatMessage', { gameId, message });
        chatInput.value = '';
    }
}

function addChatMessage(message, sender) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message');
    messageElement.textContent = `${sender}: ${message}`;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function startTimer(duration) {
    timer.classList.remove('hidden');
    let timeLeft = duration;
    timer.textContent = timeLeft;

    const timerInterval = setInterval(() => {
        timeLeft--;
        timer.textContent = timeLeft;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timer.classList.add('hidden');
        }
    }, 1000);
}

function displayCard(card) {
    const cardElement = createCardElement(card);
    cardElement.classList.add('dealing');
    
    // Clear previous card
    const playedCards = document.getElementById('played-cards');
    playedCards.innerHTML = '';
    playedCards.appendChild(cardElement);
    
    // Add flip animation after a short delay
    setTimeout(() => {
        cardElement.classList.add('flipped');
    }, 100);
}

// Socket event handlers
socket.on('gameCreated', ({ gameId: newGameId, playerId: newPlayerId }) => {
    gameId = newGameId;
    playerId = newPlayerId;
    isHost = true;
    gameCodeDisplay.textContent = `Game Code: ${gameId}`;
    startGameBtn.classList.remove('hidden');
    showScreen(lobbyScreen);
});

socket.on('gameJoined', ({ gameId: newGameId, playerId: newPlayerId }) => {
    gameId = newGameId;
    playerId = newPlayerId;
    gameCodeDisplay.textContent = `Game Code: ${gameId}`;
    showScreen(lobbyScreen);
});

socket.on('playerList', (players) => {
    updatePlayersList(players);
});

socket.on('gameStarted', ({ firstPlayer, initialCards }) => {
    currentTurn = firstPlayer;
    playerHand = initialCards;
    showScreen(gameScreen);
    updateUI();
});

socket.on('cardDrawn', ({ card, currentPlayer, opponentCardCount: newOpponentCardCount }) => {
    if (currentPlayer === playerId) {
        playerHand.push(card);
    } else {
        opponentCardCount = newOpponentCardCount;
    }
    updateUI();
});

socket.on('cardPlayed', ({ card, currentPlayer, opponentCardCount: newOpponentCardCount }) => {
    displayCard(card);
    if (currentPlayer === playerId) {
        playerHand = playerHand.filter(c => c.value !== card.value);
    } else {
        opponentCardCount = newOpponentCardCount;
    }
    updateUI();
});

socket.on('turnChanged', ({ currentPlayer }) => {
    currentTurn = currentPlayer;
    updateUI();
});

socket.on('chatMessage', ({ sender, message }) => {
    addChatMessage(message, sender);
});

socket.on('error', (message) => {
    alert(message);
});

// Add CSS class for deck drawing animation
const style = document.createElement('style');
style.textContent = `
    .deck.drawing {
        transform: translateY(-20px);
        transition: transform 0.3s ease;
    }
`;
document.head.appendChild(style); 