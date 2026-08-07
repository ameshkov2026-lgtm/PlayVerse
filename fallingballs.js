/**
 * PlayVerse · Падающие шарики
 * Лови шарики палочкой — с каждым пойманным она растёт до победы.
 */
(function () {
  "use strict";

  const ID = "fallingballs";
  const canvas = document.getElementById(ID + "-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let running = false;
  let raf = 0;
  let score = 0;
  let caught = 0;
  let missed = 0;
  let maxMiss = 8;
  let paddle = { x: 0, w: 56, h: 10 };
  let maxPaddleW = 0;
  let minPaddleW = 56;
  let balls = [];
  let keys = { left: false, right: false };
  let bgImg = null;
  let bgReady = false;

  const bg = new Image();
  bg.src = "assets/fallingballs-bg.png";
  bg.onload = function () { bgReady = true; };

  function diff() {
    return typeof getDiff === "function" ? getDiff(ID) : "normal";
  }

  function settings() {
    const d = diff();
    if (d === "easy") return { fall: 0.85, spawn: 0.035, miss: 12, grow: 28 };
    if (d === "hard") return { fall: 1.35, spawn: 0.055, miss: 5, grow: 18 };
    return { fall: 1, spawn: 0.045, miss: 8, grow: 22 };
  }

  function setHud() {
    const pct = maxPaddleW > minPaddleW
      ? Math.round(((paddle.w - minPaddleW) / (maxPaddleW - minPaddleW)) * 100)
      : 0;
    if (typeof setExtraHud === "function") {
      setExtraHud(ID, score, "Платформа: " + pct + "% · Промах: " + missed + "/" + maxMiss);
    }
  }

  function drawBackground() {
    if (bgReady) {
      ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
      g.addColorStop(0, "#bae6fd");
      g.addColorStop(1, "#ddd6fe");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function spawnBall() {
    const r = 8 + Math.random() * 18;
    balls.push({
      x: r + Math.random() * (canvas.width - r * 2),
      y: -r,
      r: r,
      vy: (1.8 + Math.random() * 2.2) * settings().fall,
      hue: Math.floor(Math.random() * 360)
    });
  }

  function drawBall(b) {
    ctx.save();
    ctx.fillStyle = "hsl(" + b.hue + ", 78%, 58%)";
    ctx.shadowColor = "hsla(" + b.hue + ", 80%, 40%, 0.45)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(b.x - b.r * 0.25, b.y - b.r * 0.25, b.r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPaddle() {
    const y = canvas.height - 28;
    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.15)";
    ctx.beginPath();
    ctx.roundRect(paddle.x + 4, y + 6, paddle.w - 8, 8, 4);
    ctx.fill();
    const grad = ctx.createLinearGradient(paddle.x, y, paddle.x + paddle.w, y);
    grad.addColorStop(0, "#6366f1");
    grad.addColorStop(0.5, "#a855f7");
    grad.addColorStop(1, "#6366f1");
    ctx.fillStyle = grad;
    ctx.strokeStyle = "#c4b5fd";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(paddle.x, y, paddle.w, paddle.h, 5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function growPaddle() {
    const cfg = settings();
    paddle.w = Math.min(maxPaddleW, paddle.w + cfg.grow);
    paddle.x = Math.max(0, Math.min(canvas.width - paddle.w, paddle.x));
    if (paddle.w >= maxPaddleW - 1) finishWin();
  }

  function finishWin() {
    stop();
    score = Math.max(100, caught * 30 + Math.round((paddle.w / maxPaddleW) * 200));
    setHud();
    if (typeof showExtraFinal === "function") {
      showExtraFinal(
        ID, score,
        "Поймано", caught,
        "Платформа", "100%",
        "Платформа растянута!",
        "Ты поймал " + caught + " шариков и растянул платформу на всю ширину!",
        "complete"
      );
    }
  }

  function finishLose() {
    stop();
    score = Math.max(10, caught * 20);
    setHud();
    if (typeof showExtraFinal === "function") {
      showExtraFinal(
        ID, score,
        "Поймано", caught,
        "Промах", missed + "/" + maxMiss,
        "Слишком много промахов",
        "Поймано шариков: " + caught + ". Платформа не успела вырасти.",
        null
      );
    }
  }

  function frame() {
    if (!running) return;
    const cfg = settings();
    if (keys.left) paddle.x -= 7;
    if (keys.right) paddle.x += 7;
    paddle.x = Math.max(0, Math.min(canvas.width - paddle.w, paddle.x));

    if (Math.random() < cfg.spawn) spawnBall();

    const py = canvas.height - 28;
    const next = [];
    balls.forEach(function (b) {
      b.y += b.vy;
      if (b.y - b.r > canvas.height) {
        missed++;
        setHud();
        if (missed >= maxMiss) {
          finishLose();
          return;
        }
        return;
      }
      if (
        b.y + b.r >= py &&
        b.x >= paddle.x &&
        b.x <= paddle.x + paddle.w &&
        b.y - b.r <= py + paddle.h + 4
      ) {
        caught++;
        score += Math.round(20 + b.r);
        growPaddle();
        setHud();
        return;
      }
      next.push(b);
    });
    if (!running) return;
    balls = next;

    drawBackground();
    balls.forEach(drawBall);
    drawPaddle();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    keys.left = keys.right = false;
  }

  function start() {
    stop();
    const cfg = settings();
    maxPaddleW = canvas.width - 16;
    minPaddleW = 56;
    paddle.w = minPaddleW;
    paddle.x = (canvas.width - paddle.w) / 2;
    balls = [];
    score = 0;
    caught = 0;
    missed = 0;
    maxMiss = cfg.miss;
    running = true;
    if (typeof hideExtraOverlay === "function") hideExtraOverlay(ID);
    setHud();
    frame();
  }

  function open() {
    stop();
    if (typeof showScreen === "function") showScreen(ID);
    setHud();
    if (typeof openExtraOverlay === "function") {
      openExtraOverlay(
        ID,
        "Падающие шарики",
        "Лови шарики палочкой внизу. С каждым пойманным она растёт — победа, когда платформа растянется на всю ширину."
      );
    }
  }

  canvas.addEventListener("pointermove", function (e) {
    if (!running) return;
    const rect = canvas.getBoundingClientRect();
    paddle.x = (e.clientX - rect.left) * (canvas.width / rect.width) - paddle.w / 2;
    paddle.x = Math.max(0, Math.min(canvas.width - paddle.w, paddle.x));
  });

  document.addEventListener("keydown", function (e) {
    if (!running || !document.getElementById("screen-" + ID)?.classList.contains("active")) return;
    if (e.key === "ArrowLeft") keys.left = true;
    if (e.key === "ArrowRight") keys.right = true;
  });

  document.addEventListener("keyup", function (e) {
    if (e.key === "ArrowLeft") keys.left = false;
    if (e.key === "ArrowRight") keys.right = false;
  });

  const pad = document.getElementById(ID + "-pad");
  if (pad) {
    pad.addEventListener("pointerdown", function (e) {
      const d = e.target.getAttribute("data-dir");
      if (d === "left") keys.left = true;
      if (d === "right") keys.right = true;
    });
    pad.addEventListener("pointerup", function () { keys.left = keys.right = false; });
  }

  window.FB_EXTRA = { id: ID, stop: stop, start: start, open: open };
})();
