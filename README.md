# FlipFate

A multiplayer card game built with Node.js, Express, and Socket.IO.

## Features

- Real-time multiplayer gameplay
- Beautiful card animations
- Chat system
- Responsive design
- Multiple game actions based on card values
- Score tracking

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Othdu/FlipFate.git
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to `http://localhost:3000`

## Game Rules

- Each player starts with no cards
- Players take turns drawing cards
- Each card has a special action:
  - Ace: Ask a Question
  - 2: Keep the Card
  - 3: Give the Card
  - 4: Rock-Paper-Scissors
  - 5-7: Quick Reflex
  - 8: Word/Rhyme Challenge
  - 9: Category Challenge
  - 10: Skip
  - Jack: Wildcard
  - Queen: Silence
  - King: Song Chain
  - Joker: Revert Turn

## Technologies Used

- Node.js
- Express
- Socket.IO
- HTML5
- CSS3
- JavaScript

## License

MIT License 