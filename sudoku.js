/**
 * PlayVerse · Судоку 9×9
 * Уровни: лёгкая / средняя / сложная
 */
(function () {
  "use strict";

  const ID = "sudoku";
  const N = 9;
  const BOX = 3;

  let running = false;
  let puzzle = [];
  let solution = [];
  let board = [];
  let given = [];
  let selected = -1;
  let mistakes = 0;
  let maxMistakes = 99;
  let score = 0;
  let startedAt = 0;
  let timerId = 0;
  let notesMode = false;
  let keyHandler = null;

  function $(id) { return document.getElementById(id); }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function emptyGrid() {
    return Array.from({ length: N }, () => Array(N).fill(0));
  }

  function cloneGrid(g) {
    return g.map((row) => row.slice());
  }

  function isSafe(grid, r, c, num) {
    for (let i = 0; i < N; i++) {
      if (grid[r][i] === num || grid[i][c] === num) return false;
    }
    const br = Math.floor(r / BOX) * BOX;
    const bc = Math.floor(c / BOX) * BOX;
    for (let i = 0; i < BOX; i++) {
      for (let j = 0; j < BOX; j++) {
        if (grid[br + i][bc + j] === num) return false;
      }
    }
    return true;
  }

  function fillBox(grid, row, col) {
    const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    let k = 0;
    for (let i = 0; i < BOX; i++) {
      for (let j = 0; j < BOX; j++) {
        grid[row + i][col + j] = nums[k++];
      }
    }
  }

  function fillDiagonal(grid) {
    for (let i = 0; i < N; i += BOX) fillBox(grid, i, i);
  }

  function solveGrid(grid) {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (grid[r][c] !== 0) continue;
        const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        for (let i = 0; i < nums.length; i++) {
          const num = nums[i];
          if (!isSafe(grid, r, c, num)) continue;
          grid[r][c] = num;
          if (solveGrid(grid)) return true;
          grid[r][c] = 0;
        }
        return false;
      }
    }
    return true;
  }

  function removeCells(grid, count) {
    let removed = 0;
    const cells = shuffle(Array.from({ length: 81 }, (_, i) => i));
    for (let n = 0; n < cells.length && removed < count; n++) {
      const idx = cells[n];
      const r = Math.floor(idx / 9);
      const c = idx % 9;
      if (grid[r][c] === 0) continue;
      grid[r][c] = 0;
      removed++;
    }
  }

  function cluesForDiff(diff) {
    if (diff === "easy") return 42;
    if (diff === "hard") return 26;
    return 34;
  }

  function mistakesForDiff(diff) {
    if (diff === "easy") return 8;
    if (diff === "hard") return 3;
    return 5;
  }

  function generatePuzzle() {
    const diff = typeof getDiff === "function" ? getDiff(ID) : "normal";
    const full = emptyGrid();
    fillDiagonal(full);
    solveGrid(full);
    solution = cloneGrid(full);
    puzzle = cloneGrid(full);
    removeCells(puzzle, 81 - cluesForDiff(diff));
    board = cloneGrid(puzzle);
    given = puzzle.map((row) => row.map((v) => v !== 0));
    maxMistakes = mistakesForDiff(diff);
    mistakes = 0;
    selected = -1;
    notesMode = false;
  }

  function elapsedSec() {
    if (!startedAt) return 0;
    return Math.floor((Date.now() - startedAt) / 1000);
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ":" + String(s).padStart(2, "0");
  }

  function setHud() {
    const scoreEl = $(ID + "-score");
    const bestEl = $(ID + "-best");
    const extraEl = $(ID + "-extra");
    const timeEl = $(ID + "-time");
    if (scoreEl) scoreEl.textContent = "Счёт: " + score;
    if (bestEl && typeof extraBest !== "undefined") {
      bestEl.textContent = "Рекорд: " + (extraBest[ID] || 0);
    }
    if (extraEl) extraEl.textContent = "Ошибки: " + mistakes + "/" + maxMistakes;
    if (timeEl) timeEl.textContent = "Время: " + formatTime(elapsedSec());
  }

  function clearTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = 0;
    }
  }

  function countFilled() {
    let n = 0;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) if (board[r][c]) n++;
    }
    return n;
  }

  function isComplete() {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (board[r][c] !== solution[r][c]) return false;
      }
    }
    return true;
  }

  function calcScore() {
    const diff = typeof getDiff === "function" ? getDiff(ID) : "normal";
    const base = diff === "easy" ? 400 : diff === "hard" ? 900 : 650;
    const timeBonus = Math.max(0, 300 - elapsedSec());
    const mistakePenalty = mistakes * 40;
    return Math.max(50, base + timeBonus - mistakePenalty);
  }

  function finishWin() {
    running = false;
    clearTimer();
    score = calcScore();
    setHud();
    if (typeof showExtraFinal === "function") {
      showExtraFinal(
        ID, score,
        "Время", formatTime(elapsedSec()),
        "Ошибки", String(mistakes),
        "Судоку решено!",
        "Отличная работа — поле 9×9 заполнено верно.",
        "complete"
      );
    }
  }

  function finishLose() {
    running = false;
    clearTimer();
    score = Math.max(10, calcScore() - 200);
    setHud();
    if (typeof showExtraFinal === "function") {
      showExtraFinal(
        ID, score,
        "Время", formatTime(elapsedSec()),
        "Ошибки", mistakes + "/" + maxMistakes,
        "Слишком много ошибок",
        "Попробуй ещё раз на более лёгкой сложности.",
        null
      );
    }
  }

  function sameUnit(a, b) {
    if (a < 0 || b < 0) return false;
    const ar = Math.floor(a / 9), ac = a % 9;
    const br = Math.floor(b / 9), bc = b % 9;
    if (ar === br || ac === bc) return true;
    return Math.floor(ar / 3) === Math.floor(br / 3) && Math.floor(ac / 3) === Math.floor(bc / 3);
  }

  function renderBoard() {
    const grid = $("sudoku-grid");
    if (!grid) return;
    grid.innerHTML = "";
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const idx = r * 9 + c;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sd-cell";
        if (c % 3 === 0) btn.classList.add("sd-left");
        if (r % 3 === 0) btn.classList.add("sd-top");
        if (c === 8) btn.classList.add("sd-right");
        if (r === 8) btn.classList.add("sd-bottom");
        if (given[r][c]) btn.classList.add("sd-given");
        if (idx === selected) btn.classList.add("sd-selected");
        else if (selected >= 0 && sameUnit(idx, selected)) btn.classList.add("sd-related");
        const val = board[r][c];
        const selR = selected >= 0 ? Math.floor(selected / 9) : -1;
        const selC = selected >= 0 ? selected % 9 : -1;
        const selVal = selR >= 0 ? board[selR][selC] : 0;
        if (val && selVal && val === selVal) btn.classList.add("sd-same");
        if (val && !given[r][c] && val !== solution[r][c]) btn.classList.add("sd-wrong");
        btn.textContent = val ? String(val) : "";
        btn.addEventListener("click", function () {
          if (!running) return;
          selected = idx;
          renderBoard();
        });
        grid.appendChild(btn);
      }
    }
  }

  function placeNumber(num) {
    if (!running || selected < 0) return;
    const r = Math.floor(selected / 9);
    const c = selected % 9;
    if (given[r][c]) return;
    if (num === 0) {
      board[r][c] = 0;
      renderBoard();
      setHud();
      return;
    }
    if (board[r][c] === num) return;
    if (num !== solution[r][c]) {
      board[r][c] = num;
      mistakes++;
      setHud();
      renderBoard();
      if (mistakes >= maxMistakes) finishLose();
      return;
    }
    board[r][c] = num;
    renderBoard();
    setHud();
    if (isComplete()) finishWin();
  }

  function bindPad() {
    document.querySelectorAll("[data-sd-num]").forEach(function (btn) {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", function () {
        placeNumber(Number(btn.getAttribute("data-sd-num")));
      });
    });
    const erase = $("sudoku-erase");
    if (erase && !erase.dataset.bound) {
      erase.dataset.bound = "1";
      erase.addEventListener("click", function () { placeNumber(0); });
    }
  }

  function stop() {
    running = false;
    clearTimer();
    if (keyHandler) {
      document.removeEventListener("keydown", keyHandler);
      keyHandler = null;
    }
  }

  function start() {
    stop();
    running = true;
    score = 0;
    generatePuzzle();
    startedAt = Date.now();
    if (typeof hideExtraOverlay === "function") hideExtraOverlay(ID);
    bindPad();
    renderBoard();
    setHud();
    timerId = setInterval(setHud, 1000);
    keyHandler = function (e) {
      if (!running) return;
      if (e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        placeNumber(Number(e.key));
      } else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
        e.preventDefault();
        placeNumber(0);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        if (selected < 0) selected = 0;
        let r = Math.floor(selected / 9);
        let c = selected % 9;
        if (e.key === "ArrowLeft") c = Math.max(0, c - 1);
        if (e.key === "ArrowRight") c = Math.min(8, c + 1);
        if (e.key === "ArrowUp") r = Math.max(0, r - 1);
        if (e.key === "ArrowDown") r = Math.min(8, r + 1);
        selected = r * 9 + c;
        renderBoard();
      }
    };
    document.addEventListener("keydown", keyHandler);
  }

  function open() {
    stop();
    if (typeof showScreen === "function") showScreen(ID);
    if (typeof openExtraOverlay === "function") {
      openExtraOverlay(
        ID,
        "Судоку",
        "Классическое поле 9×9. Заполни клетки цифрами 1–9 без повторов в строке, столбце и квадрате 3×3."
      );
    }
  }

  window.SD_EXTRA = { id: ID, stop: stop, start: start, open: open };
})();
