import React, { useState, useEffect, useRef } from "react";
import CrossItLogo from "./components/CrossItLogo";
import "./App.css";

// === CONSTANTS & HELPERS ===
const PLAYER_COLORS = ["#4fc3f7", "#f06292"];
const PLAYER_NAMES = ["Player 1", "Player 2"];
const MOVE_TIME = 15;
const BOARD_SIZE = 10;

function shuffle(array) {
  let arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function generateLatinSquare(size) {
  const baseRow = [...Array(size)].map((_, idx) => idx + 1);
  const board = [];
  for (let i = 0; i < size; i++) {
    const row = baseRow.slice(i).concat(baseRow.slice(0, i));
    board.push(row);
  }
  return board;
}
function randomizeLatinSquare(board) {
  const size = board.length;
  let rowOrder = shuffle([...Array(size).keys()]);
  let colOrder = shuffle([...Array(size).keys()]);
  const newBoard = [];
  for (let i = 0; i < size; i++) {
    newBoard[i] = [];
    for (let j = 0; j < size; j++) {
      newBoard[i][j] = board[rowOrder[i]][colOrder[j]];
    }
  }
  return newBoard;
}
function getAllMoves(board, claims, dice, mode, unavailableNumbers, player) {
  const gridSize = board.length;
  const diceTotal = dice[0] + dice[1];
  const moves = [];
  const unclaimed = [];
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (claims[r][c] === null && !unavailableNumbers.includes(board[r][c])) {
        unclaimed.push({ row: r, col: c, val: board[r][c] });
      }
    }
  }
  for (let i = 0; i < unclaimed.length; i++) {
    for (let j = i + 1; j < unclaimed.length; j++) {
      if (unclaimed[i].val + unclaimed[j].val === diceTotal) {
        moves.push({ type: "claim", cells: [ {row: unclaimed[i].row, col: unclaimed[i].col}, {row: unclaimed[j].row, col: unclaimed[j].col} ] });
      }
    }
  }
  for (let i = 0; i < unclaimed.length; i++) {
    if (unclaimed[i].val === diceTotal) {
      moves.push({ type: "claim", cells: [ {row: unclaimed[i].row, col: unclaimed[i].col} ] });
    }
  }
  if (mode === "remove") {
    const opponent = player === 0 ? 1 : 0;
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (claims[r][c] === opponent) {
          moves.push({ type: "remove", cells: [{ row: r, col: c }] });
        }
      }
    }
  }
  return moves;
}
function applyMove(claims, move, player) {
  const newClaims = claims.map(row => row.slice());
  if (move.type === "claim") {
    for (const cell of move.cells) {
      newClaims[cell.row][cell.col] = player;
    }
  } else if (move.type === "remove") {
    const cell = move.cells[0];
    newClaims[cell.row][cell.col] = null;
  }
  return newClaims;
}
function evaluateBoard(claims, aiPlayer, opponent, gridSize, difficulty = "medium") {
  function shortestPath(claim, player) {
    let visited = Array(gridSize).fill(0).map(() => Array(gridSize).fill(false));
    let queue = [];
    for (let r = 0; r < gridSize; r++) {
      if (claim[r][0] === player) {
        queue.push([r, 0, 0]);
        visited[r][0] = true;
      }
    }
    const DIRS = [
      [0, 1], [1, 0], [0, -1], [-1, 0]
    ];
    while (queue.length > 0) {
      const [r, c, dist] = queue.shift();
      if (c === gridSize - 1) return dist;
      for (let [dr, dc] of DIRS) {
        const nr = r + dr, nc = c + dc;
        if (
          nr >= 0 && nr < gridSize &&
          nc >= 0 && nc < gridSize &&
          !visited[nr][nc] &&
          (claim[nr][nc] === player || claim[nr][nc] === null)
        ) {
          visited[nr][nc] = true;
          queue.push([nr, nc, dist + 1]);
        }
      }
    }
    return Infinity;
  }
  const aiLeftRight = shortestPath(claims, aiPlayer);
  const oppLeftRight = shortestPath(claims, opponent);

  function shortestPathTB(claim, player) {
    let visited = Array(gridSize).fill(0).map(() => Array(gridSize).fill(false));
    let queue = [];
    for (let c = 0; c < gridSize; c++) {
      if (claim[0][c] === player) {
        queue.push([0, c, 0]);
        visited[0][c] = true;
      }
    }
    const DIRS = [
      [0, 1], [1, 0], [0, -1], [-1, 0]
    ];
    while (queue.length > 0) {
      const [r, c, dist] = queue.shift();
      if (r === gridSize - 1) return dist;
      for (let [dr, dc] of DIRS) {
        const nr = r + dr, nc = c + dc;
        if (
          nr >= 0 && nr < gridSize &&
          nc >= 0 && nc < gridSize &&
          !visited[nr][nc] &&
          (claim[nr][nc] === player || claim[nr][nc] === null)
        ) {
          visited[nr][nc] = true;
          queue.push([nr, nc, dist + 1]);
        }
      }
    }
    return Infinity;
  }

  const aiTopBottom = shortestPathTB(claims, aiPlayer);
  const oppTopBottom = shortestPathTB(claims, opponent);

  const MIN_OPP = Math.min(oppLeftRight, oppTopBottom);
  const MIN_AI = Math.min(aiLeftRight, aiTopBottom);

  if (MIN_OPP === 1) return -10000;
  if (MIN_AI === 0) return 10000;
  if (MIN_OPP === 0) return -10000;

  if (difficulty === "hard") {
    return (oppLeftRight + oppTopBottom) * 3 - (aiLeftRight + aiTopBottom);
  } else {
    return (oppLeftRight + oppTopBottom) * 2 - (aiLeftRight + aiTopBottom);
  }
}
function getLongestChain(claims, player) {
  const n = claims.length;
  let maxChain = 0;
  const visited = Array(n)
    .fill(0)
    .map(() => Array(n).fill(false));
  const DIRS = [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0]
  ];
  function dfs(r, c, count) {
    visited[r][c] = true;
    let best = count;
    for (const [dr, dc] of DIRS) {
      const nr = r + dr,
        nc = c + dc;
      if (
        nr >= 0 &&
        nr < n &&
        nc >= 0 &&
        nc < n &&
        claims[nr][nc] === player &&
        !visited[nr][nc]
      ) {
        best = Math.max(best, dfs(nr, nc, count + 1));
      }
    }
    return best;
  }
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (claims[r][c] === player && !visited[r][c]) {
        maxChain = Math.max(maxChain, dfs(r, c, 1));
      }
    }
  }
  return maxChain;
}
function hasPlayerConnected(claims, player, gridSize) {
  const visitedLR = Array(gridSize).fill(0).map(() => Array(gridSize).fill(false));
  let queueLR = [];
  for (let row = 0; row < gridSize; row++) {
    if (claims[row][0] === player) {
      queueLR.push([row, 0]);
      visitedLR[row][0] = true;
    }
  }
  const DIRS = [
    [0, 1], [1, 0], [0, -1], [-1, 0]
  ];
  while (queueLR.length > 0) {
    const [r, c] = queueLR.shift();
    if (c === gridSize - 1) {
      return true;
    }
    for (let [dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc;
      if (
        nr >= 0 && nr < gridSize &&
        nc >= 0 && nc < gridSize &&
        !visitedLR[nr][nc] &&
        claims[nr][nc] === player
      ) {
        visitedLR[nr][nc] = true;
        queueLR.push([nr, nc]);
      }
    }
  }
  const visitedTB = Array(gridSize).fill(0).map(() => Array(gridSize).fill(false));
  let queueTB = [];
  for (let col = 0; col < gridSize; col++) {
    if (claims[0][col] === player) {
      queueTB.push([0, col]);
      visitedTB[0][col] = true;
    }
  }
  while (queueTB.length > 0) {
    const [r, c] = queueTB.shift();
    if (r === gridSize - 1) {
      return true;
    }
    for (let [dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc;
      if (
        nr >= 0 && nr < gridSize &&
        nc >= 0 && nc < gridSize &&
        !visitedTB[nr][nc] &&
        claims[nr][nc] === player
      ) {
        visitedTB[nr][nc] = true;
        queueTB.push([nr, nc]);
      }
    }
  }
  return false;
}

// -- AI move logic
function getAIRandomMove(props) {
  const moves = getAllMoves(
    props.board, props.claims, props.dice, props.mode, props.unavailableNumbers, props.aiPlayer
  );
  if (moves.length === 0) return null;
  return moves[Math.floor(Math.random() * moves.length)];
}
function getAIMoveMedium({ board, claims, dice, mode, unavailableNumbers, aiPlayer }) {
  const gridSize = board.length;
  const opponent = aiPlayer === 0 ? 1 : 0;
  const aiMoves = getAllMoves(board, claims, dice, mode, unavailableNumbers, aiPlayer);
  if (aiMoves.length === 0) return null;
  for (const move of aiMoves) {
    const newClaims = applyMove(claims, move, aiPlayer);
    const oppMoves = getAllMoves(board, newClaims, dice, mode, unavailableNumbers, opponent);
    let opponentCanWin = false;
    for (const oppMove of oppMoves) {
      const oppClaims = applyMove(newClaims, oppMove, opponent);
      if (hasPlayerConnected(oppClaims, opponent, gridSize)) {
        opponentCanWin = true;
        break;
      }
    }
    if (!opponentCanWin) {
      return move;
    }
  }
  let bestBreak = null;
  let bestBreakScore = -Infinity;
  for (const move of aiMoves) {
    const newClaims = applyMove(claims, move, aiPlayer);
    const oppMaxChain = getLongestChain(newClaims, opponent);
    const aiMaxChain = getLongestChain(newClaims, aiPlayer);
    const score = -oppMaxChain + 0.25 * aiMaxChain;
    if (score > bestBreakScore) {
      bestBreakScore = score;
      bestBreak = move;
    }
  }
  if (bestBreak) return bestBreak;
  let bestScore = -Infinity;
  let bestMoves = [];
  for (const move of aiMoves) {
    const newClaims = applyMove(claims, move, aiPlayer);
    const oppMoves = getAllMoves(board, newClaims, dice, mode, unavailableNumbers, opponent);
    let worstScore = Infinity;
    if (oppMoves.length === 0) {
      worstScore = evaluateBoard(newClaims, aiPlayer, opponent, gridSize, "medium");
    } else {
      for (const oppMove of oppMoves) {
        const oppClaims = applyMove(newClaims, oppMove, opponent);
        const score = evaluateBoard(oppClaims, aiPlayer, opponent, gridSize, "medium");
        if (score < worstScore) worstScore = score;
      }
    }
    if (worstScore > bestScore) {
      bestScore = worstScore;
      bestMoves = [move];
    } else if (worstScore === bestScore) {
      bestMoves.push(move);
    }
  }
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}
function getAIMoveTwoPlyLimited(props) {
  const { board, claims, dice, mode, unavailableNumbers, aiPlayer } = props;
  const opponent = aiPlayer === 0 ? 1 : 0;
  const gridSize = board.length;
  const MAX_AI_MOVES = 20;
  const aiMoves = getAllMoves(board, claims, dice, mode, unavailableNumbers, aiPlayer);

  let forkBlockMove = null, maxThreats = 0;
  for (const move of aiMoves) {
    const newClaims = applyMove(claims, move, aiPlayer);
    const oppMoves = getAllMoves(board, newClaims, dice, mode, unavailableNumbers, opponent);
    let winningResponses = 0;
    for (const oppMove of oppMoves) {
      const oppClaims = applyMove(newClaims, oppMove, opponent);
      if (hasPlayerConnected(oppClaims, opponent, gridSize)) {
        winningResponses++;
      }
    }
    if (winningResponses > maxThreats) {
      maxThreats = winningResponses;
      forkBlockMove = move;
    }
  }
  if (maxThreats > 1) {
    return forkBlockMove;
  }
  for (const move of aiMoves) {
    const newClaims = applyMove(claims, move, aiPlayer);
    const oppMoves = getAllMoves(board, newClaims, dice, mode, unavailableNumbers, opponent);
    let opponentCanWin = false;
    for (const oppMove of oppMoves) {
      const oppClaims = applyMove(newClaims, oppMove, opponent);
      if (hasPlayerConnected(oppClaims, opponent, gridSize)) {
        opponentCanWin = true;
        break;
      }
    }
    if (!opponentCanWin) {
      return move;
    }
  }

  let bestScore = -Infinity;
  let bestMoves = [];
  let movesToTry = aiMoves.length > MAX_AI_MOVES ? shuffle(aiMoves).slice(0, MAX_AI_MOVES) : aiMoves;
  for (const move of movesToTry) {
    const newClaims = applyMove(claims, move, aiPlayer);
    let oppMoves = getAllMoves(board, newClaims, dice, mode, unavailableNumbers, opponent);
    if (oppMoves.length > MAX_AI_MOVES) oppMoves = shuffle(oppMoves).slice(0, MAX_AI_MOVES);
    let worstScore = Infinity;
    if (oppMoves.length === 0) {
      worstScore = evaluateBoard(newClaims, aiPlayer, opponent, gridSize, "hard");
    } else {
      for (const oppMove of oppMoves) {
        const oppClaims = applyMove(newClaims, oppMove, opponent);
        let aiMoves2 = getAllMoves(board, oppClaims, dice, mode, unavailableNumbers, aiPlayer);
        if (aiMoves2.length > MAX_AI_MOVES) aiMoves2 = shuffle(aiMoves2).slice(0, MAX_AI_MOVES);
        let bestScore2 = -Infinity;
        if (aiMoves2.length === 0) {
          bestScore2 = evaluateBoard(oppClaims, aiPlayer, opponent, gridSize, "hard");
        } else {
          for (const move2 of aiMoves2) {
            const claims2 = applyMove(oppClaims, move2, aiPlayer);
            const score2 = evaluateBoard(claims2, aiPlayer, opponent, gridSize, "hard");
            if (score2 > bestScore2) bestScore2 = score2;
          }
        }
        if (bestScore2 < worstScore) worstScore = bestScore2;
      }
    }
    if (worstScore > bestScore) {
      bestScore = worstScore;
      bestMoves = [move];
    } else if (worstScore === bestScore) {
      bestMoves.push(move);
    }
  }
  if (bestMoves.length === 0) return aiMoves[0] || null;
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

// === Instructions Modal ===
function InstructionsModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} tabIndex={-1}>
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>How to Play <span role="img" aria-label="dice">🎲</span></h2>
        <ol className="rules-list">
          <li>
            On your turn, press <b>Roll Dice</b>. You’ll get two dice (1–6), and your target number is their sum.
          </li>
          <li>
            <b>Claim tiles:</b> Select one or two unclaimed tiles whose values <b>add up to the dice total</b>. Click <b>Confirm Selection</b> to claim.
          </li>
          <li>
            If you roll an <b>11 or 12</b>, you may instead choose <b>“Remove Opponent”</b> and select an opponent’s tile to remove from the board (or claim as usual).
          </li>
          <li>
            If you roll a <b>12</b>, after your move you immediately take another turn!
          </li>
          <li>
            <b>Numbers that are fully claimed</b> (all their tiles taken) cannot be claimed or used in a sum.
          </li>
          <li>
            The first player to connect a continuous path of their tiles from <b>left to right</b> <i>or</i> <b>top to bottom</b> wins!
          </li>
          <li>
            You have <b>15 seconds</b> per turn. If you run out of time, your turn is skipped.
          </li>
        </ol>
        <div style={{textAlign: "center"}}>
          <button className="close-modal-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}// === App function body, part 2: all state, logic, handlers, effects, and full render ===
function App() {
  // --- State ---
  const [scores, setScores] = useState(() => {
    const saved = localStorage.getItem("crossit-scores");
    return saved ? JSON.parse(saved) : [0, 0];
  });
  const [board, setBoard] = useState(() =>
    randomizeLatinSquare(generateLatinSquare(BOARD_SIZE))
  );
  const [claims, setClaims] = useState(
    Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null))
  );
  const [dice, setDice] = useState([null, null]);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [selectedCells, setSelectedCells] = useState([]);
  const [canRoll, setCanRoll] = useState(true);
  const [mode, setMode] = useState("claim");
  const [winner, setWinner] = useState(null);
  const [difficulty, setDifficulty] = useState("medium");
  const [aiMode, setAiMode] = useState(1);
  const [timer, setTimer] = useState(MOVE_TIME);
  const timerRef = useRef();
  const [showInstructions, setShowInstructions] = useState(false);
  const [popCells, setPopCells] = useState([]);
  const [noMovesMsg, setNoMovesMsg] = useState("");

  // --- Unavailable numbers for sum ---
  const unavailableNumbers = [];
  for (let num = 1; num <= BOARD_SIZE; num++) {
    let allClaimed = true;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] === num && claims[r][c] === null) {
          allClaimed = false;
          break;
        }
      }
      if (!allClaimed) break;
    }
    if (allClaimed) {
      unavailableNumbers.push(num);
    }
  }
  const diceTotal = dice[0] != null && dice[1] != null ? dice[0] + dice[1] : null;
  const allowModeSwitch = diceTotal === 11 || diceTotal === 12;

  // --- Effects: Timer ---
  useEffect(() => {
    if (winner !== null) return;
    if (canRoll) {
      setTimer(MOVE_TIME);
      clearInterval(timerRef.current);
      return;
    }
    setTimer(MOVE_TIME);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          handleTimeout();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [canRoll, winner, currentPlayer, dice[0], dice[1]]);

  function handleTimeout() {
    if (winner !== null) return;
    setSelectedCells([]);
    setDice([null, null]);
    setCanRoll(true);
    setMode("claim");
    setPopCells([]);
    setNoMovesMsg("");
    if (dice[0] != null && dice[1] != null && dice[0] + dice[1] === 12) {
      // Do not change player
    } else {
      setCurrentPlayer((currentPlayer + 1) % 2);
    }
  }

  // --- Roll Dice ---
  function rollDice() {
    if (!canRoll || winner !== null) return;
    const dieOne = Math.floor(Math.random() * 6) + 1;
    const dieTwo = Math.floor(Math.random() * 6) + 1;
    setDice([dieOne, dieTwo]);
    setSelectedCells([]);
    setMode("claim");
    setCanRoll(false);
    setPopCells([]);
    setNoMovesMsg("");
    setTimeout(() => {
      const diceTotal = dieOne + dieTwo;
      const moves = getAllMoves(
        board,
        claims,
        [dieOne, dieTwo],
        (diceTotal === 11 || diceTotal === 12) ? mode : "claim",
        unavailableNumbers,
        currentPlayer
      );
      if (moves.length === 0) {
        const nextPlayer = (diceTotal === 12 ? currentPlayer : (currentPlayer + 1) % 2);
        setNoMovesMsg(
          `No moves available. ${PLAYER_NAMES[nextPlayer]}'s Turn`
        );
        setDice([null, null]);
        setCanRoll(true);
        setSelectedCells([]);
        setMode("claim");
        setPopCells([]);
        setTimer(MOVE_TIME);
        if (diceTotal !== 12) {
          setCurrentPlayer((currentPlayer + 1) % 2);
        }
      }
    }, 0);
  }

  // --- Cell click (selecting for claim/remove) ---
  function handleCellClick(rowIdx, colIdx) {
    if (canRoll || dice[0] == null || dice[1] == null || winner !== null) return;
    const diceTotal = dice[0] + dice[1];
    const cellClaim = claims[rowIdx][colIdx];
    if (mode === "claim") {
      if (cellClaim !== null) return;
      const alreadySelected = selectedCells.some(
        cell => cell.row === rowIdx && cell.col === colIdx
      );
      let newSelection = alreadySelected
        ? selectedCells.filter(cell => !(cell.row === rowIdx && cell.col === colIdx))
        : [...selectedCells, { row: rowIdx, col: colIdx }];
      if (newSelection.length > 2) return;
      const sum = newSelection.reduce(
        (acc, cell) => acc + board[cell.row][cell.col],
        0
      );
      if (sum <= diceTotal) setSelectedCells(newSelection);
    } else if (mode === "remove") {
      if (cellClaim !== null && cellClaim !== currentPlayer) {
        setSelectedCells([{ row: rowIdx, col: colIdx }]);
      }
    }
  }

  // --- Confirm move (claim/remove) ---
  function confirmSelection() {
    if (winner !== null) return;
    const diceTotal = dice[0] + dice[1];
    let isValid = false;
    if (mode === "claim") {
      const sum = selectedCells.reduce(
        (acc, cell) => acc + board[cell.row][cell.col],
        0
      );
      isValid =
        (selectedCells.length === 1 || selectedCells.length === 2) &&
        sum === diceTotal;
      if (isValid) {
        setPopCells(selectedCells.map(cell => ({...cell})));
        const newClaims = claims.map((row, r) =>
          row.map((c, cIdx) =>
            selectedCells.some(cell => cell.row === r && cell.col === cIdx)
              ? currentPlayer
              : c
          )
        );
        setClaims(newClaims);
        setSelectedCells([]);
        setDice([null, null]);
        setCanRoll(true);
        setMode("claim");
        setTimer(MOVE_TIME);
        setNoMovesMsg("");
        if (diceTotal !== 12) {
          setCurrentPlayer((currentPlayer + 1) % 2);
        }
      }
    } else if (mode === "remove") {
      isValid = selectedCells.length === 1;
      if (isValid) {
        setPopCells(selectedCells.map(cell => ({...cell})));
        const { row, col } = selectedCells[0];
        if (claims[row][col] !== null && claims[row][col] !== currentPlayer) {
          const newClaims = claims.map(arr => arr.slice());
          newClaims[row][col] = null;
          setClaims(newClaims);
          setSelectedCells([]);
          setDice([null, null]);
          setCanRoll(true);
          setMode("claim");
          setTimer(MOVE_TIME);
          setNoMovesMsg("");
          if (diceTotal !== 12) {
            setCurrentPlayer((currentPlayer + 1) % 2);
          }
        }
      }
    }
  }

  // --- Helpers for cell selection and move validity ---
  function isCellSelectable(rowIdx, colIdx) {
    if (canRoll || dice[0] == null || dice[1] == null || winner !== null) return false;
    const diceTotal = dice[0] + dice[1];
    const cellClaim = claims[rowIdx][colIdx];
    if (mode === "claim") {
      if (cellClaim !== null) return false;
      if (selectedCells.some(cell => cell.row === rowIdx && cell.col === colIdx))
        return true;
      if (selectedCells.length >= 2) return false;
      const value = board[rowIdx][colIdx];
      const currentSum = selectedCells.reduce(
        (acc, cell) => acc + board[cell.row][cell.col],
        0
      );
      return currentSum + value <= diceTotal;
    } else if (mode === "remove") {
      if (selectedCells.length === 1) return false;
      return cellClaim !== null && cellClaim !== currentPlayer;
    }
    return false;
  }
  function isSelectionValid() {
    if (dice[0] == null || dice[1] == null || winner !== null) return false;
    const diceTotal = dice[0] + dice[1];
    if (mode === "claim") {
      const sum = selectedCells.reduce(
        (acc, cell) => acc + board[cell.row][cell.col],
        0
      );
      return (
        (selectedCells.length === 1 || selectedCells.length === 2) &&
        sum === diceTotal
      );
    } else if (mode === "remove") {
      return selectedCells.length === 1;
    }
    return false;
  }

  // --- AI Effect ---
  useEffect(() => {
    if (
      aiMode === 1 &&
      currentPlayer === 1 &&
      winner === null
    ) {
      if (canRoll && (dice[0] == null || dice[1] == null)) {
        const dieOne = Math.floor(Math.random() * 6) + 1;
        const dieTwo = Math.floor(Math.random() * 6) + 1;
        setDice([dieOne, dieTwo]);
        setSelectedCells([]);
        setMode("claim");
        setCanRoll(false);
        setPopCells([]);
        setNoMovesMsg("");
        setTimeout(() => {
          const diceTotal = dieOne + dieTwo;
          const moves = getAllMoves(
            board,
            claims,
            [dieOne, dieTwo],
            (diceTotal === 11 || diceTotal === 12) ? mode : "claim",
            unavailableNumbers,
            1
          );
          if (moves.length === 0) {
            const nextPlayer = (diceTotal === 12 ? 1 : 0);
            setNoMovesMsg(
              `No moves available. ${PLAYER_NAMES[nextPlayer]}'s Turn`
            );
            setDice([null, null]);
            setCanRoll(true);
            setSelectedCells([]);
            setMode("claim");
            setPopCells([]);
            setTimer(MOVE_TIME);
            if (diceTotal !== 12) {
              setCurrentPlayer(0);
            }
          }
        }, 400);
      } else if (dice[0] != null && dice[1] != null && !canRoll) {
        let aiModeToUse = mode;
        let claimMove = null;
        if ((dice[0] + dice[1] === 11 || dice[0] + dice[1] === 12)) {
          if (difficulty === "easy") {
            claimMove = getAIRandomMove({
              board,
              claims,
              dice,
              mode: "claim",
              unavailableNumbers,
              aiPlayer: 1,
            });
          } else if (difficulty === "medium") {
            claimMove = getAIMoveMedium({
              board,
              claims,
              dice,
              mode: "claim",
              unavailableNumbers,
              aiPlayer: 1,
            });
          } else {
            claimMove = getAIMoveTwoPlyLimited({
              board,
              claims,
              dice,
              mode: "claim",
              unavailableNumbers,
              aiPlayer: 1,
            });
          }
          if (claimMove) {
            aiModeToUse = "claim";
          } else {
            aiModeToUse = "remove";
          }
        }
        let move = null;
        if (difficulty === "easy") {
          move = getAIRandomMove({
            board,
            claims,
            dice,
            mode: aiModeToUse,
            unavailableNumbers,
            aiPlayer: 1,
          });
        } else if (difficulty === "medium") {
          move = getAIMoveMedium({
            board,
            claims,
            dice,
            mode: aiModeToUse,
            unavailableNumbers,
            aiPlayer: 1,
          });
        } else {
          move = getAIMoveTwoPlyLimited({
            board,
            claims,
            dice,
            mode: aiModeToUse,
            unavailableNumbers,
            aiPlayer: 1,
          });
        }
        if (move) {
          setMode(move.type);
          setSelectedCells(move.cells);
          setTimeout(() => {
            confirmSelection();
            setSelectedCells([]);
          }, 700);
        } else {
          setTimeout(() => {
            setSelectedCells([]);
            setDice([null, null]);
            setCanRoll(true);
            setMode("claim");
            setTimer(MOVE_TIME);
            setPopCells([]);
          }, 900);
        }
      }
    }
    // eslint-disable-next-line
  }, [aiMode, currentPlayer, canRoll, dice[0], dice[1], mode, board, claims, unavailableNumbers, winner, difficulty]);

  // --- Winner detection ---
  useEffect(() => {
    if (winner !== null) return;
    for (let player = 0; player < 2; player++) {
      if (hasPlayerConnected(claims, player, BOARD_SIZE)) {
        setWinner(player);
        setCanRoll(false);
        clearInterval(timerRef.current);
        setTimeout(() => setPopCells([]), 900);
        break;
      }
    }
  }, [claims, winner, BOARD_SIZE]);

  // --- Score update on win ---
  useEffect(() => {
    if (winner !== null) {
      setScores((prev) => {
        const newScores = [...prev];
        newScores[winner]++;
        localStorage.setItem("crossit-scores", JSON.stringify(newScores));
        return newScores;
      });
    }
  }, [winner]);

  // --- Reset ---
  function resetBoard() {
    setBoard(randomizeLatinSquare(generateLatinSquare(BOARD_SIZE)));
    setClaims(Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)));
    setDice([null, null]);
    setCurrentPlayer(0);
    setWinner(null);
    setCanRoll(true);
    setSelectedCells([]);
    setMode("claim");
    setPopCells([]);
    setTimer(MOVE_TIME);
    setNoMovesMsg("");
  }
  function resetScores() {
    setScores([0, 0]);
    localStorage.setItem("crossit-scores", JSON.stringify([0, 0]));
  }

  // --- Celebration Modal ---
  function Celebration() {
    if (winner === null) return null;
    return (
      <div className="celebration-modal">
        <div className="celebration-content animate-winner">
          🏆🎉 {PLAYER_NAMES[winner]} wins! 🎉🏆
        </div>
        <button
          className="celebration-btn"
          onClick={resetBoard}
        >
          Play Again
        </button>
      </div>
    );
  }

  useEffect(() => {
    if (popCells.length > 0) {
      const timeout = setTimeout(() => setPopCells([]), 400);
      return () => clearTimeout(timeout);
    }
  }, [popCells]);

  // --- RENDER ---
  return (
    <div className="App" style={{ position: "relative" }}>
      {/* Logo at top */}
      <div style={{ margin: "24px 0 20px 0", display: "flex", justifyContent: "center" }}>
        <CrossItLogo />
      </div>
      <InstructionsModal
        open={showInstructions}
        onClose={() => setShowInstructions(false)}
      />
      <Celebration />
      <div className="flex-row">
        {/* Game Board */}
        <div>
          <table className="game-board">
            <tbody>
              {board.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {row.map((num, colIdx) => {
                    const claim = claims[rowIdx][colIdx];
                    const isClaimed = claim !== null;
                    const isSelected = selectedCells.some(
                      cell => cell.row === rowIdx && cell.col === colIdx
                    );
                    const isUnavailable = unavailableNumbers.includes(num);
                    const isPop =
                      popCells.some(
                        cell => cell.row === rowIdx && cell.col === colIdx
                      );
                    let cellClass = "grid-cell";
                    if (isClaimed) cellClass += ` claimed${claim}`;
                    if (isSelected && !isClaimed) cellClass += ` selected`;
                    if (isUnavailable && !isClaimed) cellClass += " unavailable";
                    if (isPop) cellClass += " pop-cell";
                    return (
                      <td
                        key={colIdx}
                        className={cellClass}
                        onClick={() =>
                          aiMode === 1 && currentPlayer === 1
                            ? undefined
                            : handleCellClick(rowIdx, colIdx)
                        }
                        tabIndex={0}
                      >
                        {num}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Controls Panel */}
        <div className="controls-panel" style={{display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", minWidth: 320}}>
          <div style={{width: "100%"}}>
            <div className="dice-row" style={{ minHeight: "48px", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {dice[0] != null && dice[1] != null ? (
                <>
                  <span className="dice-emoji" role="img" aria-label="Die 1">🎲</span>
                  <span className="dice-value">{dice[0]}</span>
                  <span className="dice-emoji" role="img" aria-label="Die 2" style={{ marginLeft: 16 }}>🎲</span>
                  <span className="dice-value">{dice[1]}</span>
                  <span className="dice-equals">=</span>
                  <span className="dice-total">{dice[0] + dice[1]}</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: "1.45rem", color: "#fff", visibility: "hidden" }}>
                    🎲 0 🎲 0 = 0
                  </span>
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      textAlign: "center",
                      fontSize: "1.3rem",
                      color: "#fff",
                      top: 0,
                    }}
                  >
                    Roll to Start!
                  </span>
                </>
              )}
            </div>
            {noMovesMsg && (
              <div
                style={{
                  background: "#222",
                  color: "#ffee58",
                  borderRadius: 8,
                  padding: "8px 12px",
                  margin: "10px 0",
                  textAlign: "center",
                  fontWeight: "bold",
                  fontSize: "1.1rem",
                  boxShadow: "0 2px 6px #0004"
                }}
              >
                {noMovesMsg}
              </div>
            )}
            <button
              className="roll-btn"
              onClick={rollDice}
              disabled={!canRoll || winner !== null || (aiMode === 1 && currentPlayer === 1)}
              style={{width: "100%"}}
            >
              Roll Dice
            </button>
            <div
              className="turn-banner"
              style={{
                background: `linear-gradient(90deg, ${PLAYER_COLORS[0]} 0%, ${PLAYER_COLORS[1]} 100%)`,
                color: PLAYER_COLORS[currentPlayer],
                border: `2px solid ${PLAYER_COLORS[currentPlayer]}`,
                boxShadow: `0 2px 8px ${PLAYER_COLORS[currentPlayer]}44`,
                width: "100%",
                margin: "12px 0 0 0"
              }}
            >
              {winner === null ? `${PLAYER_NAMES[currentPlayer]}'s turn${aiMode === 1 && currentPlayer === 1 ? " (AI)" : ""}` : ""}
            </div>
            {winner === null && (
              <div
                style={{
                  margin: "10px 0 12px 0",
                  fontSize: "1.45rem",
                  fontWeight: 600,
                  color: timer <= 5 ? "#ff4444" : "#ffee58",
                  transition: "color 0.2s",
                  letterSpacing: 2,
                  textShadow: "0 2px 8px #333c"
                }}
              >
                ⏰ {timer}s
              </div>
            )}
            {diceTotal && (
              <div className="mode-instructions">
                {allowModeSwitch ? (
                  <>
                    Choose up to 2 unclaimed spots that add up to {diceTotal}, <br />
                    or remove 1 of your opponent's spots
                  </>
                ) : (
                  "Pick 1 or 2 unclaimed numbers that add up to the total."
                )}
              </div>
            )}
            {allowModeSwitch && (
              <div className="mode-btns">
                <button
                  className={`mode-btn${mode === "claim" ? " active" : ""}`}
                  onClick={() => { setMode("claim"); setSelectedCells([]);}}
                  disabled={mode === "claim" || (aiMode === 1 && currentPlayer === 1)}
                >
                  Claim Numbers
                </button>
                <button
                  className={`mode-btn${mode === "remove" ? " active" : ""}`}
                  onClick={() => { setMode("remove"); setSelectedCells([]);}}
                  disabled={mode === "remove" || (aiMode === 1 && currentPlayer === 1)}
                >
                  Remove Opponent
                </button>
              </div>
            )}
            <button
              className="confirm-btn"
              onClick={confirmSelection}
              disabled={!isSelectionValid() || winner !== null || (aiMode === 1 && currentPlayer === 1)}
              style={{width: "100%", margin: "8px 0"}}
            >
              Confirm Selection
            </button>
            <button
              className="instructions-btn"
              onClick={() => setShowInstructions(true)}
              style={{width: "100%"}}
            >
              Instructions
            </button>
            <button
              className="instructions-btn"
              onClick={resetBoard}
              style={{ marginTop: 10, width: "100%" }}
            >
              New Game
            </button>
            {unavailableNumbers.length > 0 && (
              <div className="numbers-unavailable">
                Numbers not available: {unavailableNumbers.join(", ")}
              </div>
            )}
          </div>
          {/* Scoreboard and Difficulty/AI below control panel */}
          <div style={{marginTop: 30, width: "100%"}}>
            <div className="scoreboard" style={{justifyContent: "center", margin: "0 0 12px 0"}}>
              <span style={{ color: "#4fc3f7" }}>Player 1: {scores[0]}</span>
              <span style={{ margin: "0 18px" }}></span>
              <span style={{ color: "#f06292" }}>Player 2: {scores[1]}</span>
              <button className="reset-score-btn" onClick={resetScores}>
                Reset Scores
              </button>
            </div>
            <div style={{textAlign: "center", marginTop: 6}}>
              <label style={{fontSize: "1.1rem", color: "#ffee58", fontWeight: "bold"}}>
                <input
                  type="checkbox"
                  checked={aiMode === 1}
                  onChange={e => setAiMode(e.target.checked ? 1 : 0)}
                  style={{marginRight: 8, transform: "scale(1.2)", accentColor: "#4fc3f7"}}
                  disabled={claims.flat().some(c => c !== null)}
                />
                Play against AI
              </label>
              {aiMode === 1 && (
                <span style={{ marginLeft: 18 }}>
                  <label style={{ color: "#ffee58", fontWeight: "bold", marginRight: 10 }}>AI Difficulty:</label>
                  <select
                    value={difficulty}
                    onChange={e => setDifficulty(e.target.value)}
                    disabled={claims.flat().some(c => c !== null)}
                    style={{ fontSize: "1rem", padding: "4px 12px" }}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;