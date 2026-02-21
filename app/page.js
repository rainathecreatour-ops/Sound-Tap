"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const PADS = [
  { id: 0, color: "#22c55e", glow: "#86efac", freq: 261.63, label: "C4" },
  { id: 1, color: "#3b82f6", glow: "#93c5fd", freq: 329.63, label: "E4" },
  { id: 2, color: "#f59e0b", glow: "#fcd34d", freq: 392.00, label: "G4" },
  { id: 3, color: "#ef4444", glow: "#fca5a5", freq: 523.25, label: "C5" },
];

const TONE_DURATION = 0.4;
const TONE_GAP = 0.15;

function useAudio() {
  const ctxRef = useRef(null);

  const getCtx = () => {
    if (!ctxRef.current)
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return ctxRef.current;
  };

  const playTone = useCallback(
    (freq, startTime, duration = TONE_DURATION, muted = false) => {
      if (muted) return;
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.5, startTime + 0.02);
      gain.gain.linearRampToValueAtTime(0, startTime + duration - 0.02);
      osc.start(startTime);
      osc.stop(startTime + duration);
    },
    []
  );

  const currentTime = () => getCtx().currentTime;

  return { playTone, currentTime };
}

export default function SimonGame() {
  const [sequence, setSequence] = useState([]);
  const [userInput, setUserInput] = useState([]);
  const [activePad, setActivePad] = useState(null);
  const [phase, setPhase] = useState("idle"); // idle | playing | input | gameover
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [muted, setMuted] = useState(false);
  const { playTone, currentTime } = useAudio();
  const timeoutsRef = useRef([]);

  useEffect(() => {
    const saved = parseInt(localStorage.getItem("simon_best") || "0", 10);
    setBestScore(saved);
  }, []);

  const clearTimeouts = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  const flashPad = useCallback((padId, delay) => {
    const t = setTimeout(() => setActivePad(padId), delay);
    const t2 = setTimeout(
      () => setActivePad(null),
      delay + TONE_DURATION * 1000 - 30
    );
    timeoutsRef.current.push(t, t2);
  }, []);

  const playSequence = useCallback(
    (seq) => {
      setPhase("playing");
      setActivePad(null);
      clearTimeouts();

      let t = currentTime() + 0.1;
      seq.forEach((padId, i) => {
        const delay = i * (TONE_DURATION + TONE_GAP) * 1000;
        playTone(
          PADS[padId].freq,
          t + i * (TONE_DURATION + TONE_GAP),
          TONE_DURATION,
          muted
        );
        flashPad(padId, delay);
      });

      const totalMs =
        seq.length * (TONE_DURATION + TONE_GAP) * 1000 + 200;
      const done = setTimeout(() => {
        setPhase("input");
        setUserInput([]);
      }, totalMs);
      timeoutsRef.current.push(done);
    },
    [currentTime, flashPad, muted, playTone]
  );

  const startGame = () => {
    clearTimeouts();
    const first = Math.floor(Math.random() * 4);
    const newSeq = [first];
    setSequence(newSeq);
    setScore(0);
    setUserInput([]);
    playSequence(newSeq);
  };

  const replaySequence = () => {
    if (phase === "input" || phase === "idle") playSequence(sequence);
  };

  const handlePadPress = (padId) => {
    if (phase !== "input") return;

    playTone(PADS[padId].freq, currentTime(), 0.25, muted);
    setActivePad(padId);
    setTimeout(() => setActivePad(null), 250);

    const newInput = [...userInput, padId];
    setUserInput(newInput);

    const idx = newInput.length - 1;
    if (newInput[idx] !== sequence[idx]) {
      const newBest = Math.max(score, bestScore);
      setBestScore(newBest);
      localStorage.setItem("simon_best", String(newBest));
      setTimeout(() => setPhase("gameover"), 300);
      return;
    }

    if (newInput.length === sequence.length) {
      const newScore = score + 1;
      setScore(newScore);
      const nextPad = Math.floor(Math.random() * 4);
      const newSeq = [...sequence, nextPad];
      setSequence(newSeq);
      setTimeout(() => playSequence(newSeq), 700);
    }
  };

  const isDisabled = phase === "playing" || phase === "gameover";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        color: "#f8fafc",
        gap: "2rem",
        padding: "1rem",
      }}
    >
      <style>{`
        @keyframes glow-pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.06); }
          100% { transform: scale(1); }
        }
        .pad {
          width: 140px;
          height: 140px;
          border-radius: 16px;
          cursor: pointer;
          border: none;
          outline: none;
          transition: box-shadow 0.1s, filter 0.1s;
          position: relative;
        }
        .pad:active { transform: scale(0.97); }
        .pad.active {
          animation: glow-pulse 0.35s ease;
        }
        .btn {
          padding: 0.5rem 1.4rem;
          border-radius: 8px;
          border: 1px solid #334155;
          background: #1e293b;
          color: #f8fafc;
          font-size: 0.9rem;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .btn:hover { background: #334155; border-color: #64748b; }
        .btn:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "2rem",
            fontWeight: 700,
            letterSpacing: "0.05em",
            color: "#e2e8f0",
          }}
        >
          SIMON
        </h1>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: "#94a3b8" }}>
          Sound Memory Game
        </p>
      </div>

      {/* Score */}
      <div style={{ display: "flex", gap: "2.5rem", textAlign: "center" }}>
        <div>
          <div style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1 }}>
            {score}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem" }}>
            SCORE
          </div>
        </div>
        <div>
          <div
            style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1, color: "#fbbf24" }}
          >
            {bestScore}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem" }}>
            BEST
          </div>
        </div>
      </div>

      {/* Pads */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        {PADS.map((pad) => {
          const isActive = activePad === pad.id;
          return (
            <button
              key={pad.id}
              className={`pad${isActive ? " active" : ""}`}
              disabled={isDisabled}
              onMouseDown={() => handlePadPress(pad.id)}
              onTouchStart={(e) => {
                e.preventDefault();
                handlePadPress(pad.id);
              }}
              style={{
                background: isActive ? pad.color : pad.color + "55",
                boxShadow: isActive
                  ? `0 0 32px 8px ${pad.glow}, 0 0 8px 2px ${pad.color}`
                  : "0 2px 8px rgba(0,0,0,0.4)",
                filter: isActive ? "brightness(1.3)" : "brightness(0.85)",
              }}
            />
          );
        })}
      </div>

      {/* Status */}
      <div style={{ height: "1.5rem", fontSize: "0.9rem", color: "#94a3b8" }}>
        {phase === "playing" && "👀 Watch the sequence..."}
        {phase === "input" &&
          `🎯 Your turn — step ${userInput.length + 1} of ${sequence.length}`}
        {phase === "idle" && "Press Start to play"}
      </div>

      {/* Game Over */}
      {phase === "gameover" && (
        <div
          style={{
            background: "#1e293b",
            border: "1px solid #ef4444",
            borderRadius: "12px",
            padding: "1.5rem 2.5rem",
            textAlign: "center",
            boxShadow: "0 0 24px rgba(239,68,68,0.3)",
          }}
        >
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#ef4444" }}>
            Game Over
          </div>
          <div style={{ marginTop: "0.5rem", color: "#94a3b8" }}>
            Score: <strong style={{ color: "#f8fafc" }}>{score}</strong>
            {score >= bestScore && score > 0 && (
              <span style={{ color: "#fbbf24", marginLeft: "0.5rem" }}>
                🏆 New Best!
              </span>
            )}
          </div>
          <button className="btn" style={{ marginTop: "1rem" }} onClick={startGame}>
            Play Again
          </button>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
        <button className="btn" onClick={startGame}>
          {phase === "idle" || phase === "gameover" ? "▶ Start" : "↺ Restart"}
        </button>
        <button
          className="btn"
          disabled={
            phase === "playing" || phase === "gameover" || sequence.length === 0
          }
          onClick={replaySequence}
        >
          🔁 Replay
        </button>
        <button className="btn" onClick={() => setMuted((m) => !m)}>
          {muted ? "🔇 Unmute" : "🔊 Mute"}
        </button>
      </div>
    </div>
  );
}
