const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(3.5, 10, -6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.target.set(3.5, 0, 3.5);
controls.update();

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

const chess = new Chess();
const boardGroup = new THREE.Group();
scene.add(boardGroup);

const pieceGroup = new THREE.Group();
scene.add(pieceGroup);

const squares = {};
let selectedSquare = null;

// Materials
const lightMat = new THREE.MeshStandardMaterial({ color: 0xeeeed2, roughness: 0.8 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x769656, roughness: 0.8 });
const highlightMat = new THREE.MeshStandardMaterial({ color: 0xf6f669, roughness: 0.8, emissive: 0x555500 });
const moveMat = new THREE.MeshStandardMaterial({ color: 0x33aa33, roughness: 0.8, emissive: 0x003300 });

const whitePieceMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.1 });
const blackPieceMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.2, metalness: 0.1 });

// Board
for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
        const isLight = (rank + file) % 2 !== 0;
        const mat = isLight ? lightMat : darkMat;
        const geom = new THREE.BoxGeometry(1, 0.2, 1);
        const square = new THREE.Mesh(geom, mat);
        square.position.set(file, -0.1, rank);
        square.receiveShadow = true;
        
        // attach algebraic name
        const files = "abcdefgh";
        const algebraic = files[file] + (8 - rank);
        square.userData = { algebraic, originalMat: mat };
        
        boardGroup.add(square);
        squares[algebraic] = square;
    }
}

// Pieces using high-quality 2D Sprites (CanvasTexture)
const pieceUnicode = {
    'p': '♟',
    'r': '♜',
    'n': '♞',
    'b': '♝',
    'q': '♛',
    'k': '♚'
};

const pieceTextures = {};

function getPieceTexture(type, colorStr) {
    const key = type + colorStr;
    if (pieceTextures[key]) return pieceTextures[key];
    
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // Transparent background
    ctx.clearRect(0, 0, 256, 256);
    
    // Draw text
    ctx.fillStyle = colorStr === 'w' ? '#ffffff' : '#111111';
    
    // Add a small stroke/glow to make them pop out more
    ctx.strokeStyle = colorStr === 'w' ? '#888888' : '#ffffff';
    ctx.lineWidth = 4;
    
    ctx.font = 'bold 200px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(pieceUnicode[type], 128, 140);
    ctx.fillText(pieceUnicode[type], 128, 140);
    
    const texture = new THREE.CanvasTexture(canvas);
    pieceTextures[key] = texture;
    return texture;
}

function createPieceMesh(type, colorStr) {
    const texture = getPieceTexture(type, colorStr);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.2, 1.2, 1.2); // Adjust size
    sprite.position.y = 0.6; // Hover slightly above board
    return sprite;
}

let pieceMeshes = [];

function renderPieces() {
    // clear existing
    pieceMeshes.forEach(mesh => pieceGroup.remove(mesh));
    pieceMeshes = [];
    
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
            const piece = board[r][f];
            if (piece) {
                const mesh = createPieceMesh(piece.type, piece.color);
                mesh.position.x = f;
                mesh.position.z = r;
                pieceGroup.add(mesh);
                pieceMeshes.push(mesh);
            }
        }
    }
}

renderPieces();

// Raycaster for clicks
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('click', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(boardGroup.children);
    
    if (intersects.length > 0) {
        const squareMesh = intersects[0].object;
        const square = squareMesh.userData.algebraic;
        handleSquareClick(square);
    }
});

function handleSquareClick(square) {
    if (chess.turn() !== 'w') return; // Only allow clicks on White's turn

    // clear highlights
    Object.values(squares).forEach(sq => {
        sq.material = sq.userData.originalMat;
    });
    
    if (selectedSquare) {
        const moves = chess.moves({ square: selectedSquare, verbose: true });
        const move = moves.find(m => m.to === square);
        
        if (move) {
            // handle promotion
            if (move.flags.includes('p') || move.flags.includes('cp')) {
                chess.move({ from: selectedSquare, to: square, promotion: 'q' });
            } else {
                chess.move({ from: selectedSquare, to: square });
            }
            selectedSquare = null;
            renderPieces();
            updateStatus();
            
            // Trigger AI move after a short delay
            setTimeout(makeAIMove, 500);
            
        } else {
            // Check if clicking own piece
            const piece = chess.get(square);
            if (piece && piece.color === chess.turn()) {
                selectSquare(square);
            } else {
                selectedSquare = null;
            }
        }
    } else {
        const piece = chess.get(square);
        if (piece && piece.color === chess.turn()) {
            selectSquare(square);
        }
    }
}

// Simple AI implementation
const pieceValues = {
    'p': 10, 'n': 30, 'b': 30, 'r': 50, 'q': 90, 'k': 900
};

function getPieceValue(piece) {
    if (piece === null) return 0;
    const val = pieceValues[piece.type];
    return piece.color === 'w' ? val : -val;
}

function evaluateBoard(board) {
    let totalEvaluation = 0;
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            totalEvaluation += getPieceValue(board[i][j]);
        }
    }
    return totalEvaluation;
}

function makeAIMove() {
    if (chess.game_over()) return;
    
    const possibleMoves = chess.moves();
    if (possibleMoves.length === 0) return;
    
    let bestMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    let bestValue = 9999; // Black wants to minimize the score
    
    for (let i = 0; i < possibleMoves.length; i++) {
        const move = possibleMoves[i];
        chess.move(move);
        const boardValue = evaluateBoard(chess.board());
        chess.undo();
        
        if (boardValue < bestValue) {
            bestValue = boardValue;
            bestMove = move;
        }
    }
    
    chess.move(bestMove);
    renderPieces();
    updateStatus();
}

function selectSquare(square) {
    selectedSquare = square;
    squares[square].material = highlightMat;
    
    // highlight moves
    const moves = chess.moves({ square: square, verbose: true });
    moves.forEach(m => {
        squares[m.to].material = moveMat;
    });
}

function updateCapturedPieces() {
    const history = chess.history({ verbose: true });
    let whiteCaptures = []; 
    let blackCaptures = []; 
    
    for (let move of history) {
        if (move.captured) {
            if (move.color === 'w') {
                whiteCaptures.push(move.captured);
            } else {
                blackCaptures.push(move.captured);
            }
        }
    }
    
    const sortOrder = { 'p': 1, 'n': 2, 'b': 3, 'r': 4, 'q': 5 };
    whiteCaptures.sort((a, b) => sortOrder[a] - sortOrder[b]);
    blackCaptures.sort((a, b) => sortOrder[a] - sortOrder[b]);
    
    document.getElementById('captured-white').innerText = whiteCaptures.map(p => pieceUnicode[p]).join(' ');
    document.getElementById('captured-black').innerText = blackCaptures.map(p => pieceUnicode[p]).join(' ');
}

function updateStatus() {
    updateCapturedPieces();
    
    const statusEl = document.getElementById('status');
    const gameOverOverlay = document.getElementById('game-over-overlay');
    const gameOverText = document.getElementById('game-over-text');
    
    let status = '';
    let moveColor = chess.turn() === 'w' ? 'White' : 'Black';
    
    if (chess.game_over()) {
        gameOverOverlay.style.display = 'flex';
        if (chess.in_checkmate()) {
            let winner = chess.turn() === 'w' ? 'Black' : 'White';
            gameOverText.innerText = `Checkmate! ${winner} Wins!`;
            status = `Game over, ${moveColor} is in checkmate.`;
        } else if (chess.in_draw()) {
            gameOverText.innerText = `Game Drawn!`;
            status = 'Game over, drawn position';
        } else {
            gameOverText.innerText = `Game Over!`;
            status = 'Game over';
        }
    } else {
        status = `${moveColor} to move`;
        if (chess.in_check()) {
            status += ', ' + moveColor + ' is in check';
        }
    }
    
    statusEl.innerText = status;
}

updateStatus();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();
