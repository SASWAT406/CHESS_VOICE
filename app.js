const game = new Chess();
const engine = new Worker("stockfish.js");
let hintsRemaining = 15;
const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const statusText = document.getElementById('status');

// --- CUSTOM MODIFIED PHONETIC MAP ---
const phoneticMap = {
    "alpha": "a", "beta": "b", "cat": "c", "delta": "d",
    "eko": "e", "echo": "e", "fox": "f", "golf": "g", "hotel": "h",
    "one": "1", "two": "2", "to": "2", "too": "2", "three": "3", "tree": "3",
    "four": "4", "for": "4", "five": "5", "six": "6", "seven": "7", "eight": "8"
};

const board = Chessboard('board', {
    draggable: true,
    position: 'start',
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
    onDrop: (source, target) => {
        let move = game.move({ from: source, to: target, promotion: 'q' });
        if (move === null) return 'snapback';
        onMoveComplete();
    }
});

function onMoveComplete() {
    board.position(game.fen());
    updateStats();
    if (!game.game_over()) {
        statusText.innerText = "AI is thinking...";
        setTimeout(playAI, 600);
    } else {
        statusText.innerText = "Game Over!";
        speak("Game Over");
    }
}

// --- Voice Control Logic ---
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'en-US';
recognition.interimResults = true;

document.getElementById('listenBtn').onclick = () => {
    recognition.start();
    statusText.innerText = "Listening... (e.g. 'Beta 1 Cat 3')";
};

recognition.onresult = (event) => {
    let transcript = event.results[0][0].transcript.toLowerCase();
    statusText.innerText = `Heard: ${transcript}`;

    if (event.results[0].isFinal) {
        parseCustomPhonetic(transcript);
    }
};

function parseCustomPhonetic(text) {
    let words = text.replace(/-/g, ' ').split(/\s+/);
    let coords = "";
    
    words.forEach(w => {
        if (phoneticMap[w]) coords += phoneticMap[w];
        else coords += w.replace(/[^a-h1-8]/g, '');
    });

    // Match patterns like b1c3 or e2e4
    const match = coords.match(/([a-h][1-8])([a-h][1-8])/);
    if (match) {
        let move = game.move({ from: match[1], to: match[2], promotion: 'q' });
        if (move) {
            onMoveComplete();
            flashBoard('#2ecc71');
        } else {
            speak("Illegal move");
            flashBoard('#e74c3c');
        }
    }
}

// --- AI Logic ---
function playAI() {
    const skill = document.getElementById('diffSelect').value;
    engine.postMessage(`position fen ${game.fen()}`);
    
    let skillLevel = skill === "easy" ? 0 : (skill === "med" ? 8 : 20);
    let depth = skill === "easy" ? 1 : (skill === "med" ? 8 : 15);

    engine.postMessage(`setoption name Skill Level value ${skillLevel}`);
    engine.postMessage(`go depth ${depth}`);

    engine.onmessage = (e) => {
        if (e.data.startsWith("bestmove")) {
            const m = e.data.split(" ")[1];
            game.move({ from: m.substring(0,2), to: m.substring(2,4), promotion: 'q' });
            board.position(game.fen());
            updateStats();
            speak(`AI moves ${m.substring(0,2)} to ${m.substring(2,4)}`);
            statusText.innerText = "Your turn.";
        }
    };
}

// --- Stats & UI Updates ---
function updateStats() {
    const history = game.history();
    document.getElementById('historyList').innerText = history.join(', ');

    const symbols = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' };
    let score = 0;
    let whiteCap = "", blackCap = "";
    
    const count = { w: {p:0, n:0, b:0, r:0, q:0}, b: {p:0, n:0, b:0, r:0, q:0} };
    game.board().forEach(r => r.forEach(p => { if(p && p.type !== 'k') count[p.color][p.type]++; }));

    const start = {p:8, n:2, b:2, r:2, q:1};
    for (let type in start) {
        for(let i=0; i<(start[type]-count.b[type]); i++) { whiteCap += symbols[type]; score += pieceValues[type]; }
        for(let i=0; i<(start[type]-count.w[type]); i++) { blackCap += symbols[type]; score -= pieceValues[type]; }
    }
    document.getElementById('points').innerText = (score > 0 ? "+" : "") + score;
    document.getElementById('whiteCaptures').innerText = whiteCap;
    document.getElementById('blackCaptures').innerText = blackCap;
}

function flashBoard(color) {
    $('#board').css('border-color', color);
    setTimeout(() => $('#board').css('border-color', '#333'), 600);
}

document.getElementById('hintBtn').onclick = () => {
    if (hintsRemaining > 0 && !game.game_over()) {
        hintsRemaining--;
        document.getElementById('hintCount').innerText = hintsRemaining;
        engine.postMessage(`position fen ${game.fen()}`);
        engine.postMessage(`go depth 15`);
        engine.onmessage = (e) => {
            if (e.data.startsWith("bestmove")) {
                const m = e.data.split(" ")[1];
                speak(`Try ${m.substring(0,2)} to ${m.substring(2,4)}`);
                statusText.innerText = `HINT: ${m.substring(0,2)}-${m.substring(2,4)}`;
            }
        };
    }
};

document.getElementById('resetBtn').onclick = () => {
    if(confirm("Reset the game?")) location.reload();
};

function speak(t) { 
    const utterance = new SpeechSynthesisUtterance(t);
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance); 
}