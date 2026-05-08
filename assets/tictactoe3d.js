(() => {
  const boardEl = document.querySelector("[data-ttt-board]");
  if (!boardEl) return;

  const turnEl = document.querySelector("[data-ttt-turn]");
  const xCountEl = document.querySelector("[data-ttt-x-count]");
  const oCountEl = document.querySelector("[data-ttt-o-count]");
  const messageEl = document.querySelector("[data-ttt-message]");
  const resetBtn = document.querySelector("[data-ttt-reset]");
  const undoBtn = document.querySelector("[data-ttt-undo]");

  const SIZE = 3;
  const layerNames = ["Lower", "Middle", "Top"];
  const state = {
    board: Array.from({ length: SIZE * SIZE * SIZE }, () => ""),
    turn: "X",
    history: [],
    winner: null,
    winningLine: [],
    lastMove: null
  };

  const indexFor = (layer, row, col) => layer * SIZE * SIZE + row * SIZE + col;
  const inBounds = (layer, row, col) =>
    layer >= 0 && layer < SIZE && row >= 0 && row < SIZE && col >= 0 && col < SIZE;

  const generateWinningLines = () => {
    const directions = [];
    for (let layerDelta = -1; layerDelta <= 1; layerDelta += 1) {
      for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
        for (let colDelta = -1; colDelta <= 1; colDelta += 1) {
          if (layerDelta === 0 && rowDelta === 0 && colDelta === 0) continue;
          const isCanonical =
            layerDelta > 0 ||
            (layerDelta === 0 && rowDelta > 0) ||
            (layerDelta === 0 && rowDelta === 0 && colDelta > 0);
          if (isCanonical) directions.push([layerDelta, rowDelta, colDelta]);
        }
      }
    }

    const lines = [];
    for (let layer = 0; layer < SIZE; layer += 1) {
      for (let row = 0; row < SIZE; row += 1) {
        for (let col = 0; col < SIZE; col += 1) {
          for (const [layerDelta, rowDelta, colDelta] of directions) {
            const before = [layer - layerDelta, row - rowDelta, col - colDelta];
            if (inBounds(before[0], before[1], before[2])) continue;

            const line = [];
            for (let step = 0; step < SIZE; step += 1) {
              const nextLayer = layer + layerDelta * step;
              const nextRow = row + rowDelta * step;
              const nextCol = col + colDelta * step;
              if (inBounds(nextLayer, nextRow, nextCol)) {
                line.push(indexFor(nextLayer, nextRow, nextCol));
              }
            }
            if (line.length === SIZE) lines.push(line);
          }
        }
      }
    }
    return lines;
  };

  const winningLines = generateWinningLines();

  const snapshot = () => ({
    board: [...state.board],
    turn: state.turn,
    winner: state.winner,
    winningLine: [...state.winningLine],
    lastMove: state.lastMove
  });

  const restore = (saved) => {
    state.board = [...saved.board];
    state.turn = saved.turn;
    state.winner = saved.winner;
    state.winningLine = [...saved.winningLine];
    state.lastMove = saved.lastMove;
  };

  const evaluate = () => {
    for (const line of winningLines) {
      const [first, second, third] = line;
      if (state.board[first] && state.board[first] === state.board[second] && state.board[first] === state.board[third]) {
        state.winner = state.board[first];
        state.winningLine = line;
        return;
      }
    }

    if (state.board.every(Boolean)) {
      state.winner = "Draw";
      state.winningLine = [];
      return;
    }

    state.winner = null;
    state.winningLine = [];
  };

  const updateMessage = () => {
    if (!messageEl) return;
    if (state.winner === "Draw") {
      messageEl.textContent = "Full board, no winner. That is a clean draw.";
      return;
    }
    if (state.winner) {
      messageEl.textContent = `${state.winner} wins across the 3D board.`;
      return;
    }
    messageEl.textContent = `${state.turn} to move. Connect three in any row, column, layer, or 3D diagonal.`;
  };

  const count = (symbol) => state.board.filter((cell) => cell === symbol).length;

  const render = () => {
    const fragment = document.createDocumentFragment();

    for (let layer = 0; layer < SIZE; layer += 1) {
      const layerCard = document.createElement("article");
      layerCard.className = "ttt-layer-card";

      const layerHeader = document.createElement("div");
      layerHeader.className = "ttt-layer-header";

      const title = document.createElement("h2");
      title.textContent = `${layerNames[layer]} layer`;

      const badge = document.createElement("span");
      badge.textContent = `z=${layer}`;

      layerHeader.append(title, badge);

      const grid = document.createElement("div");
      grid.className = "ttt-grid";

      for (let row = 0; row < SIZE; row += 1) {
        for (let col = 0; col < SIZE; col += 1) {
          const index = indexFor(layer, row, col);
          const value = state.board[index];
          const cell = document.createElement("button");
          cell.type = "button";
          cell.className = [
            "ttt-cell",
            value ? `is-${value.toLowerCase()}` : "",
            state.winningLine.includes(index) ? "is-winning" : "",
            state.lastMove === index ? "is-last" : ""
          ]
            .filter(Boolean)
            .join(" ");
          cell.dataset.index = String(index);
          cell.disabled = Boolean(value || state.winner);
          cell.textContent = value;
          cell.setAttribute(
            "aria-label",
            `${value || "Empty"} cell, ${layerNames[layer]} layer, row ${row + 1}, column ${col + 1}`
          );
          grid.append(cell);
        }
      }

      layerCard.append(layerHeader, grid);
      fragment.append(layerCard);
    }

    boardEl.replaceChildren(fragment);
    if (turnEl) turnEl.textContent = state.winner || state.turn;
    if (xCountEl) xCountEl.textContent = String(count("X"));
    if (oCountEl) oCountEl.textContent = String(count("O"));
    if (undoBtn) undoBtn.disabled = state.history.length === 0;
    updateMessage();
  };

  const newGame = () => {
    state.board = Array.from({ length: SIZE * SIZE * SIZE }, () => "");
    state.turn = "X";
    state.history = [];
    state.winner = null;
    state.winningLine = [];
    state.lastMove = null;
    render();
  };

  boardEl.addEventListener("click", (event) => {
    const cell = event.target.closest(".ttt-cell");
    if (!cell || state.winner) return;

    const index = Number(cell.dataset.index);
    if (state.board[index]) return;

    state.history.push(snapshot());
    state.board[index] = state.turn;
    state.lastMove = index;
    evaluate();
    if (!state.winner) state.turn = state.turn === "X" ? "O" : "X";
    render();
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
