// =================== Конфигурация фигур ===================
const PIECES_CONFIG = {
    K: { kanji: '王', p_kanji: '玉' },
    R: { kanji: '飛', p_kanji: '龍' },
    B: { kanji: '角', p_kanji: '馬' },
    G: { kanji: '金', p_kanji: '金' },
    S: { kanji: '銀', p_kanji: '全' },
    N: { kanji: '桂', p_kanji: '圭' },
    L: { kanji: '香', p_kanji: '杏' },
    P: { kanji: '歩', p_kanji: 'と' }
};

const MOVES = {
    K: [[-1,0],[-1,1],[0,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1]],
    G: [[-1,0],[-1,1],[0,1],[1,0],[0,-1],[-1,-1]],
    S: [[-1,0],[-1,1],[-1,-1],[1,1],[1,-1]],
    N: [[-2,-1],[-2,1]],
    L: [[-1,0]],
    P: [[-1,0]],
    R: [[-1,0],[1,0],[0,-1],[0,1]],
    B: [[-1,-1],[-1,1],[1,-1],[1,1]]
};

let board = Array(9).fill().map(() => Array(9).fill(null));
let hands = { black: [], white: [] };
let turn = 'black';
let selectedCell = null;
let selectedHandIndex = null;
let validMoves = [];

// =================== Инициализация ===================
function initGame() {
    const layout = [
        ['L','N','S','G','K','G','S','N','L'],
        [null,'R',null,null,null,null,null,'B',null],
        ['P','P','P','P','P','P','P','P','P']
    ];
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 9; c++) {
            if (layout[r][c]) board[r][c] = { type: layout[r][c], owner: 'white', promoted: false };
            if (layout[r][c]) board[8-r][8-c] = { type: layout[r][c], owner: 'black', promoted: false };
        }
    }
    render();
}

// =================== ЛОГИКА ХОДОВ (ТВОЯ ИЗ СТАРОГО КОДА) ===================

function getRawMoves(r, c, currentBoard) {
    const piece = currentBoard[r][c];
    if (!piece) return [];
    
    let moves = [];
    const isBlack = piece.owner === 'black';
    const sideDir = isBlack ? 1 : -1; // Чёрные ходят вверх (r - 1), Белые вниз (r + 1)
    
    let mType = (piece.promoted && !['R','B'].includes(piece.type)) ? 'G' : piece.type;

    if (['R','B','L'].includes(mType)) {
        const vectors = MOVES[mType];
        vectors.forEach(v => {
            // Твоя логика: Ланцер зависит от стороны, остальные - нет
            let dr = (mType === 'L') ? -1 * sideDir : v[0];
            let dc = v[1];
            let nr = r + dr, nc = c + dc;

            while(nr >= 0 && nr < 9 && nc >= 0 && nc < 9) {
                if (!currentBoard[nr][nc]) {
                    moves.push([nr, nc]);
                } else {
                    if (currentBoard[nr][nc].owner !== piece.owner) moves.push([nr, nc]);
                    break;
                }
                if (mType === 'L') break;
                // Для R и B продолжаем движение по вектору
                nr += v[0]; nc += v[1];
            }
        });
    } else {
        // Обычные фигуры и конь
        MOVES[mType].forEach(v => {
            const nr = r + v[0] * sideDir;
            const nc = c + v[1];
            if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) {
                if (!currentBoard[nr][nc] || currentBoard[nr][nc].owner !== piece.owner) {
                    moves.push([nr, nc]);
                }
            }
        });
    }

    // Бонусные ходы для превращенной ладьи и слона
    if (piece.promoted && (piece.type === 'R' || piece.type === 'B')) {
        const extra = piece.type === 'R' ? MOVES['B'] : MOVES['R'];
        extra.forEach(v => {
            const nr = r + v[0], nc = c + v[1];
            if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) {
                if (!currentBoard[nr][nc] || currentBoard[nr][nc].owner !== piece.owner) moves.push([nr, nc]);
            }
        });
    }
    return moves;
}

// =================== ПРОВЕРКА ШАХА И БЕЗОПАСНЫХ ХОДОВ ===================

function findKing(owner, currentBoard) {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (currentBoard[r][c]?.type === 'K' && currentBoard[r][c]?.owner === owner) return {r, c};
        }
    }
    return {r:0, c:0};
}

function isAttacked(r, c, attacker, currentBoard) {
    for (let ir = 0; ir < 9; ir++) {
        for (let ic = 0; ic < 9; ic++) {
            const p = currentBoard[ir][ic];
            if (p && p.owner === attacker) {
                if (getRawMoves(ir, ic, currentBoard).some(m => m[0] === r && m[1] === c)) return true;
            }
        }
    }
    return false;
}

function getSafeMoves(r, c) {
    const raw = getRawMoves(r, c, board);
    return raw.filter(([tr, tc]) => {
        const oldPiece = board[tr][tc];
        const piece = board[r][c];
        board[tr][tc] = piece;
        board[r][c] = null;
        const kingPos = findKing(piece.owner, board);
        const safe = !isAttacked(kingPos.r, kingPos.c, piece.owner === 'black' ? 'white' : 'black', board);
        board[r][c] = piece;
        board[tr][tc] = oldPiece;
        return safe;
    });
}

function isCheckmate(player) {
    const king = findKing(player, board);
    if (!isAttacked(king.r, king.c, player === 'black' ? 'white' : 'black', board)) return false;

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r][c]?.owner === player && getSafeMoves(r, c).length > 0) return false;
            if (!board[r][c]) {
                for (let i = 0; i < hands[player].length; i++) {
                    if (canDropSafe(player, r, c, i)) return false;
                }
            }
        }
    }
    return true;
}

function canDropSafe(player, r, c, handIdx) {
    const piece = hands[player][handIdx];
    board[r][c] = { ...piece, owner: player };
    const king = findKing(player, board);
    const safe = !isAttacked(king.r, king.c, player === 'black' ? 'white' : 'black', board);
    board[r][c] = null;
    return safe;
}

// =================== ОБРАБОТЧИКИ (ОСТАЛЬНОЕ) ===================

function handleCellClick(r, c) {
    if (selectedHandIndex !== null) {
        if (validMoves.some(m => m[0] === r && m[1] === c)) dropPiece(r, c);
        else cancelSelection();
    } else if (selectedCell) {
        if (validMoves.some(m => m[0] === r && m[1] === c)) movePiece(selectedCell.r, selectedCell.c, r, c);
        else cancelSelection();
    } else if (board[r][c] && board[r][c].owner === turn) {
        selectedCell = { r, c };
        validMoves = getSafeMoves(r, c);
        render();
    }
}

function handleHandClick(side, index) {
    if (turn !== side) return;
    selectedHandIndex = index;
    selectedCell = null;
    const pieceType = hands[side][index].type;
    validMoves = [];
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (!board[r][c]) {
                if (pieceType === 'P') {
                    if (board.some(row => row[c]?.type === 'P' && row[c]?.owner === side && !row[c]?.promoted)) continue;
                }
                if ((pieceType === 'P' || pieceType === 'L') && (side === 'black' ? r === 0 : r === 8)) continue;
                if (pieceType === 'N' && (side === 'black' ? r <= 1 : r >= 7)) continue;
                if (canDropSafe(side, r, c, index)) validMoves.push([r, c]);
            }
        }
    }
    render();
}

function movePiece(fr, fc, tr, tc) {
    const piece = board[fr][fc], target = board[tr][tc];
    if (target) {
        target.owner = turn;
        target.promoted = false;
        hands[turn].push(target);
    }
    board[tr][tc] = piece;
    board[fr][fc] = null;

    const inZone = turn === 'black' ? tr <= 2 : tr >= 6;
    if (inZone && PIECES_CONFIG[piece.type].p_kanji && !piece.promoted && !['G','K'].includes(piece.type)) {
        if (confirm("Превратить фигуру?")) piece.promoted = true;
    }
    completeTurn();
}

function dropPiece(r, c) {
    const piece = hands[turn][selectedHandIndex];
    board[r][c] = { ...piece, owner: turn, promoted: false };
    hands[turn].splice(selectedHandIndex, 1);
    completeTurn();
}

function completeTurn() {
    turn = turn === 'black' ? 'white' : 'black';
    cancelSelection();
    if (isCheckmate(turn)) {
        setTimeout(() => alert(`МАТ! ${turn === 'white' ? 'Черные' : 'Белые'} победили!`), 100);
    }
    render();
}

function cancelSelection() { selectedCell = null; selectedHandIndex = null; validMoves = []; render(); }

function render() {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';
    const king = findKing(turn, board);
    const isCheck = isAttacked(king.r, king.c, turn === 'black' ? 'white' : 'black', board);

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = document.createElement('div');
            const p = board[r][c];
            const isSel = selectedCell?.r === r && selectedCell?.c === c;
            const isVal = validMoves.some(m => m[0] === r && m[1] === c);
            const isKCheck = isCheck && p?.type === 'K' && p?.owner === turn;

            cell.className = `cell${isSel ? ' selected' : ''}${isVal ? ' valid-move' : ''}${isKCheck ? ' check' : ''}`;
            if (p) {
                const pEl = document.createElement('div');
                pEl.className = `piece ${p.owner}`;
                pEl.innerText = p.promoted ? PIECES_CONFIG[p.type].p_kanji : PIECES_CONFIG[p.type].kanji;
                cell.appendChild(pEl);
            }
            cell.onclick = () => handleCellClick(r, c);
            boardEl.appendChild(cell);
        }
    }

    ['white', 'black'].forEach(side => {
        const container = document.getElementById(`hand-${side}`);
        container.innerHTML = '';
        hands[side].forEach((p, i) => {
            const pEl = document.createElement('div');
            pEl.className = `piece ${side}${selectedHandIndex === i && turn === side ? ' selected' : ''}`;
            pEl.innerText = PIECES_CONFIG[p.type].kanji;
            pEl.onclick = () => handleHandClick(side, i);
            container.appendChild(pEl);
        });
    });
    document.getElementById('status').innerText = (isCheck ? "⚠️ ШАХ! " : "") + `Ход: ${turn === 'black' ? 'Черных' : 'Белых'}`;
}

initGame();


