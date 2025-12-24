// --- 1. Initialize Game Logic and Board UI ---
const game = new Chess();

const boardConfig = {
    draggable: true,
    position: 'start',
    // Uses online images for pieces
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
    onDrop: (source, target) => {
        // Attempt the move in the logic engine
        let move = game.move({ 
            from: source, 
            to: target, 
            promotion: 'q' 
        });

        // If move is illegal, return piece to original square
        if (move === null) return 'snapback';

        // Update board to reflect captures/state and trigger AI
        board.position(game.fen());
        window.setTimeout(makeBestMove, 250);
    }
};

const board = Chessboard('board', boardConfig);

// Load the local Stockfish worker
const engine = new Worker("stockfish.js");

// --- 2. Voice Recognition Setup ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.lang = 'en-US';
recognition.continuous = false;

const statusText = document.getElementById('status');
const listenBtn = document.getElementById('listenBtn');

listenBtn.onclick = () => {
    recognition.start();
    statusText.innerText = "Listening... (Say squares like 'E2 E4')";
};

recognition.onresult = (event) => {
    let transcript = event.results[0][0].transcript.toLowerCase();
    console.log("Speech Received:", transcript);
    statusText.innerText = `I heard: "${transcript}"`;
    parseVoiceMove(transcript);
};

// --- 3. Smart Voice Parser ---
function parseVoiceMove(text) {
    // Dictionary to fix common speech-to-text mistakes
    const replacements = {
        "for": "4", "four": "4", "to": "2", "two": "2", "too": "2",
        "ate": "8", "eight": "8", "see": "c", "sea": "c", "be": "b", 
        "bee": "b", "one": "1", "won": "1", "doux": "d2", "before": "b4"
    };

    let cleaned = text;
    for (const [word, num] of Object.entries(replacements)) {
        cleaned = cleaned.replace(new RegExp(word, 'g'), num);
    }
    
    // Extract only valid chess coordinates (e.g., e2e4)
    cleaned = cleaned.replace(/[^a-h1-8]/g, '');

    if (cleaned.length >= 4) {
        const from = cleaned.substring(0, 2);
        const to = cleaned.substring(2, 4);
        handleMove(from, to);
    } else {
        statusText.innerText = `Could not parse "${text}". Please say squares like 'E2 E4'.`;
        speak("Try again");
    }
}

// --- 4. Move Execution & AI ---
function handleMove(from, to) {
    const move = game.move({ from: from, to: to, promotion: 'q' });

    if (move === null) {
        statusText.innerText = `Illegal move: ${from} to ${to}`;
        speak("That is not a legal move.");
    } else {
        // board.position(game.fen()) is CRITICAL for showing captures
        board.position(game.fen());
        statusText.innerText = "AI is thinking...";
        window.setTimeout(makeBestMove, 500);
    }
}

function makeBestMove() {
    if (game.game_over()) {
        const result = game.in_checkmate() ? "Checkmate!" : "Draw!";
        statusText.innerText = `Game Over: ${result}`;
        speak(`Game over. ${result}`);
        return;
    }

    // Tell Stockfish the current board state
    engine.postMessage("position fen " + game.fen());
    engine.postMessage("go depth 12"); // Search 12 moves deep

    engine.onmessage = (event) => {
        if (event.data.startsWith("bestmove")) {
            const moveData = event.data.split(" ")[1];
            const from = moveData.substring(0, 2);
            const to = moveData.substring(2, 4);

            game.move({ from: from, to: to, promotion: 'q' });
            board.position(game.fen()); // Refreshes UI to show the AI's move and any captures
            
            speak(`AI plays ${from} to ${to}`);
            statusText.innerText = "Your turn!";
        }
    };
}

function speak(text) {
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}