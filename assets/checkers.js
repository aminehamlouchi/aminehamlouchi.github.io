(() => {
  const boardEl = document.querySelector("[data-checkers-board]");
  if (!boardEl) return;

  const turnEl = document.querySelector("[data-checkers-turn]");
  const redScoreEl = document.querySelector("[data-checkers-red-score]");
  const blueScoreEl = document.querySelector("[data-checkers-blue-score]");
  const messageEl = document.querySelector("[data-checkers-message]");
  const resetBtn = document.querySelector("[data-checkers-reset]");
  const undoBtn = document.querySelector("[data-checkers-undo]");

  const SIZE = 8;
  const players = {
    red: { label: "Red", direction: -1, crownRow: 0 },
    blue: { label: "Blue", direction: 1, crownRow: SIZE - 1 }
  };

  const state = {
    board: [],
    turn: "red",
    selected: null,
    legal: [],
    forcedFrom: null,
    history: [],
    lastMove: null,
    winner: null
  };

  const inBounds = (row, col) => row >= 0 && row < SIZE && col >= 0 && col < SIZE;
  const isPlayableSquare = (row, col) => (row + col) % 2 === 0;
  const opponent = (color) => (color === "red" ? "blue" : "red");
  const sameSquare = (first, second) => first && second && first.row === second.row && first.col === second.col;

  const cloneBoard = (board) => board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));

  const createBoard = () => {
    const board = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null));
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        if (!isPlayableSquare(row, col)) continue;
        if (row < 3) board[row][col] = { color: "blue", king: false };
        if (row > 4) board[row][col] = { color: "red", king: false };
      }
    }
    return board;
  };

  const snapshot = () => ({
    board: cloneBoard(state.board),
    turn: state.turn,
    selected: state.selected ? { ...state.selected } : null,
    legal: state.legal.map((move) => ({
      to: { ...move.to },
      capture: move.capture ? { ...move.capture } : null
    })),
    forcedFrom: state.forcedFrom ? { ...state.forcedFrom } : null,
    lastMove: state.lastMove
      ? {
          from: { ...state.lastMove.from },
          to: { ...state.lastMove.to },
          capture: state.lastMove.capture ? { ...state.lastMove.capture } : null
        }
      : null,
    winner: state.winner
  });

  const restore = (saved) => {
    state.board = cloneBoard(saved.board);
    state.turn = saved.turn;
    state.selected = saved.selected ? { ...saved.selected } : null;
    state.legal = saved.legal.map((move) => ({
      to: { ...move.to },
      capture: move.capture ? { ...move.capture } : null
    }));
    state.forcedFrom = saved.forcedFrom ? { ...saved.forcedFrom } : null;
    state.lastMove = saved.lastMove
      ? {
          from: { ...saved.lastMove.from },
          to: { ...saved.lastMove.to },
          capture: saved.lastMove.capture ? { ...saved.lastMove.capture } : null
        }
      : null;
    state.winner = saved.winner;
  };

  const directionsFor = (piece) => {
    const forward = players[piece.color].direction;
    const directions = [
      [forward, -1],
      [forward, 1]
    ];
    if (piece.king) {
      directions.push([-forward, -1], [-forward, 1]);
    }
    return directions;
  };

  const getMovesForPiece = (board, row, col, capturesOnly = false) => {
    const piece = board[row][col];
    if (!piece) return [];

    const moves = [];
    for (const [rowDelta, colDelta] of directionsFor(piece)) {
      const nextRow = row + rowDelta;
      const nextCol = col + colDelta;
      const jumpRow = row + rowDelta * 2;
      const jumpCol = col + colDelta * 2;

      if (!capturesOnly && inBounds(nextRow, nextCol) && !board[nextRow][nextCol]) {
        moves.push({ to: { row: nextRow, col: nextCol }, capture: null });
      }

      if (!inBounds(jumpRow, jumpCol) || !inBounds(nextRow, nextCol)) continue;
      const jumpedPiece = board[nextRow][nextCol];
      if (jumpedPiece && jumpedPiece.color !== piece.color && !board[jumpRow][jumpCol]) {
        moves.push({
          to: { row: jumpRow, col: jumpCol },
          capture: { row: nextRow, col: nextCol }
        });
      }
    }

    return moves;
  };

  const getPlayerMoves = (board, color) => {
    const quiet = [];
    const captures = [];
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        const piece = board[row][col];
        if (!piece || piece.color !== color) continue;
        for (const move of getMovesForPiece(board, row, col)) {
          const enriched = { ...move, from: { row, col } };
          if (move.capture) captures.push(enriched);
          else quiet.push(enriched);
        }
      }
    }
    return captures.length ? captures : quiet;
  };

  const getLegalForSelection = (row, col) => {
    const piece = state.board[row][col];
    if (!piece || piece.color !== state.turn || state.winner) return [];
    if (state.forcedFrom && !sameSquare(state.forcedFrom, { row, col })) return [];

    const captures = getMovesForPiece(state.board, row, col, true);
    if (state.forcedFrom) return captures;

    const playerCaptures = getPlayerMoves(state.board, state.turn).filter((move) => move.capture);
    return playerCaptures.length ? captures : getMovesForPiece(state.board, row, col);
  };

  const countPieces = (color) =>
    state.board.flat().filter((piece) => piece && piece.color === color).length;

  const updateWinner = () => {
    const redPieces = countPieces("red");
    const bluePieces = countPieces("blue");
    if (!redPieces) state.winner = "blue";
    if (!bluePieces) state.winner = "red";
    if (state.winner) return;

    if (getPlayerMoves(state.board, state.turn).length === 0) {
      state.winner = opponent(state.turn);
    }
  };

  const selectPiece = (row, col) => {
    const legal = getLegalForSelection(row, col);
    const piece = state.board[row][col];

    if (!piece || piece.color !== state.turn || !legal.length) {
      const captures = getPlayerMoves(state.board, state.turn).filter((move) => move.capture);
      state.selected = null;
      state.legal = [];
      if (captures.length) {
        setMessage(`${players[state.turn].label} has a capture available.`);
      }
      render();
      return;
    }

    state.selected = { row, col };
    state.legal = legal;
    render();
  };

  const switchTurn = () => {
    state.turn = opponent(state.turn);
    state.selected = null;
    state.legal = [];
    state.forcedFrom = null;
    updateWinner();
  };

  const moveSelectedPiece = (move) => {
    const from = state.selected;
    const piece = state.board[from.row][from.col];
    if (!piece) return;

    state.history.push(snapshot());
    state.board[move.to.row][move.to.col] = piece;
    state.board[from.row][from.col] = null;

    if (move.capture) {
      state.board[move.capture.row][move.capture.col] = null;
    }

    const wasCrowned = !piece.king && move.to.row === players[piece.color].crownRow;
    if (wasCrowned) piece.king = true;

    state.lastMove = {
      from: { ...from },
      to: { ...move.to },
      capture: move.capture ? { ...move.capture } : null
    };

    if (move.capture && !wasCrowned) {
      const followUps = getMovesForPiece(state.board, move.to.row, move.to.col, true);
      if (followUps.length) {
        state.selected = { ...move.to };
        state.forcedFrom = { ...move.to };
        state.legal = followUps;
        render();
        return;
      }
    }

    switchTurn();
    render();
  };

  const setMessage = (message) => {
    if (messageEl) messageEl.textContent = message;
  };

  const updateMessage = () => {
    if (state.winner) {
      setMessage(`${players[state.winner].label} wins. New game when you are ready.`);
      return;
    }

    if (state.forcedFrom) {
      setMessage(`${players[state.turn].label} keeps the turn and must finish the jump chain.`);
      return;
    }

    const captures = getPlayerMoves(state.board, state.turn).filter((move) => move.capture);
    if (captures.length) {
      setMessage(`${players[state.turn].label} to move. Capture available.`);
      return;
    }

    setMessage(`${players[state.turn].label} to move.`);
  };

  const isLegalTarget = (row, col) => state.legal.some((move) => move.to.row === row && move.to.col === col);
  const legalMoveFor = (row, col) => state.legal.find((move) => move.to.row === row && move.to.col === col);

  const render = () => {
    const fragment = document.createDocumentFragment();

    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        const square = document.createElement("button");
        const piece = state.board[row][col];
        const legalMove = legalMoveFor(row, col);

        square.type = "button";
        square.className = [
          "checker-square",
          isPlayableSquare(row, col) ? "dark" : "light",
          sameSquare(state.selected, { row, col }) ? "is-selected" : "",
          legalMove ? "is-legal" : "",
          legalMove?.capture ? "is-capture" : "",
          sameSquare(state.lastMove?.from, { row, col }) || sameSquare(state.lastMove?.to, { row, col })
            ? "is-last"
            : ""
        ]
          .filter(Boolean)
          .join(" ");
        square.dataset.row = String(row);
        square.dataset.col = String(col);
        square.setAttribute("aria-label", `Row ${row + 1}, column ${col + 1}`);

        if (piece) {
          const checker = document.createElement("span");
          checker.className = `checker-piece ${piece.color}${piece.king ? " king" : ""}`;
          checker.textContent = piece.king ? "K" : "";
          square.append(checker);
          square.setAttribute(
            "aria-label",
            `${players[piece.color].label}${piece.king ? " king" : ""} on row ${row + 1}, column ${col + 1}`
          );
        }

        fragment.append(square);
      }
    }

    boardEl.replaceChildren(fragment);
    if (turnEl) turnEl.textContent = state.winner ? players[state.winner].label : players[state.turn].label;
    if (redScoreEl) redScoreEl.textContent = String(12 - countPieces("blue"));
    if (blueScoreEl) blueScoreEl.textContent = String(12 - countPieces("red"));
    if (undoBtn) undoBtn.disabled = state.history.length === 0;
    updateMessage();
  };

  const newGame = () => {
    state.board = createBoard();
    state.turn = "red";
    state.selected = null;
    state.legal = [];
    state.forcedFrom = null;
    state.history = [];
    state.lastMove = null;
    state.winner = null;
    render();
  };

  boardEl.addEventListener("click", (event) => {
    const square = event.target.closest(".checker-square");
    if (!square) return;

    const row = Number(square.dataset.row);
    const col = Number(square.dataset.col);
    if (!inBounds(row, col) || state.winner) return;

    if (state.selected && isLegalTarget(row, col)) {
      moveSelectedPiece(legalMoveFor(row, col));
      return;
    }

    selectPiece(row, col);
  });

  resetBtn?.addEventListener("click", newGame);

  undoBtn?.addEventListener("click", () => {
    const previous = state.history.pop();
    if (!previous) return;
    restore(previous);
    render();
  });

  newGame();
})();
