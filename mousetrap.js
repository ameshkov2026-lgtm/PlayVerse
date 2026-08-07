/**
 * PlayVerse · Мышеловка
 * Кот на курсоре ловит мышек на поле за отведённое время.
 */
(function () {
  "use strict";

  const ID = "mousetrap";
  const canvas = document.getElementById(ID + "-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let running = false;
  let raf = 0;
  let score = 0;
  let caught = 0;
  let target = 10;
  let timeLeft = 45;
  let timerId = 0;
  let mice = [];
  let cat = { x: 240, y: 240 };
  let pointerInside = false;
  let bgImg = null;
  let bgReady = false;
  let spawnTimer = 0;

  const bg = new Image();
  bg.src = "assets/mousetrap-field-bg.png";
  bg.onload = function () { bgReady = true; };

  function diff() {
    return typeof getDiff === "function" ? getDiff(ID) : "normal";
  }

  function settings() {
    const d = diff();
    if (d === "easy") return { time: 60, target: 6, speed: 0.7, spawn: 2.2, max: 4 };
    if (d === "hard") return { time: 30, target: 14, speed: 1.35, spawn: 1.1, max: 7 };
    return { time: 45, target: 10, speed: 1, spawn: 1.6, max: 5 };
  }

  function setHud() {
    if (typeof setExtraHud === "function") {
      setExtraHud(ID, score, "Мыши: " + caught + "/" + target + " · " + timeLeft + "с");
    }
  }

  function spawnMouse() {
    const edge = Math.floor(Math.random() * 4);
    let x, y, vx, vy;
    const spd = (0.4 + Math.random() * 0.5) * settings().speed;
    if (edge === 0) { x = Math.random() * canvas.width; y = -16; vx = (Math.random() - 0.5) * spd; vy = spd; }
    else if (edge === 1) { x = canvas.width + 16; y = Math.random() * canvas.height; vx = -spd; vy = (Math.random() - 0.5) * spd; }
    else if (edge === 2) { x = Math.random() * canvas.width; y = canvas.height + 16; vx = (Math.random() - 0.5) * spd; vy = -spd; }
    else { x = -16; y = Math.random() * canvas.height; vx = spd; vy = (Math.random() - 0.5) * spd; }
    mice.push({ x: x, y: y, vx: vx, vy: vy, wiggle: Math.random() * Math.PI * 2 });
  }

  function drawBackground() {
    if (bgReady) {
      ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
      g.addColorStop(0, "#7dd3fc");
      g.addColorStop(0.35, "#86efac");
      g.addColorStop(1, "#4ade80");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function drawMouse(m) {
    ctx.save();
    ctx.translate(m.x, m.y);
    const dir = Math.atan2(m.vy, m.vx);
    ctx.rotate(dir);
    ctx.fillStyle = "#9ca3af";
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fca5a5";
    ctx.beginPath();
    ctx.arc(10, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#6b7280";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, -6); ctx.quadraticCurveTo(-16, -12, -10, -4);
    ctx.moveTo(-8, 6); ctx.quadraticCurveTo(-16, 12, -10, 4);
    ctx.stroke();
    ctx.fillStyle = "#374151";
    ctx.beginPath();
    ctx.arc(12, -2, 1.5, 0, Math.PI * 2);
    ctx.arc(12, 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCat() {
    ctx.save();
    ctx.translate(cat.x, cat.y);
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.ellipse(0, 18, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fb923c";
    ctx.beginPath();
    ctx.ellipse(0, 0, 24, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fdba74";
    ctx.beginPath();
    ctx.ellipse(0, 6, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fb923c";
    ctx.beginPath();
    ctx.moveTo(-14, -10); ctx.lineTo(-18, -24); ctx.lineTo(-6, -14); ctx.closePath();
    ctx.moveTo(14, -10); ctx.lineTo(18, -24); ctx.lineTo(6, -14); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(-8, -2, 3, 0, Math.PI * 2);
    ctx.arc(8, -2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fef3c7";
    ctx.beginPath();
    ctx.moveTo(-4, 4); ctx.lineTo(0, 8); ctx.lineTo(4, 4); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#ea580c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, 6); ctx.quadraticCurveTo(0, 12, 10, 6);
    ctx.stroke();
    ctx.restore();
  }

  function drawComputerMouse() {
    ctx.save();
    ctx.translate(cat.x, cat.y + 34);
    ctx.fillStyle = "#e5e7eb";
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-16, -10, 32, 22, 10);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#cbd5e1";
    ctx.beginPath();
    ctx.moveTo(0, -10); ctx.lineTo(0, 4);
    ctx.stroke();
    ctx.fillStyle = "#64748b";
    ctx.beginPath();
    ctx.arc(0, 14, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function finishWin() {
    stop();
    score = Math.max(50, caught * 25 + timeLeft * 5);
    setHud();
    if (typeof showExtraFinal === "function") {
      showExtraFinal(
        ID, score,
        "Поймано", caught + "/" + target,
        "Время", timeLeft + "с",
        caught >= target ? "Охотник на мышей" : "Мышеловка",
        "Кот поймал всех мышек! Счёт: " + score + ".",
        "complete"
      );
    }
  }

  function finishLose(reason) {
    stop();
    score = Math.max(10, caught * 20);
    setHud();
    if (typeof showExtraFinal === "function") {
      showExtraFinal(
        ID, score,
        "Поймано", caught + "/" + target,
        "Причина", reason,
        "Не успел",
        "Поймано мышей: " + caught + " из " + target + ".",
        null
      );
    }
  }

  function tickTimer() {
    if (!running) return;
    timeLeft--;
    setHud();
    if (timeLeft <= 0) finishLose("Время вышло");
  }

  function frame() {
    if (!running) return;
    const cfg = settings();
    spawnTimer -= 1 / 60;
    if (spawnTimer <= 0 && mice.length < cfg.max && caught + mice.length < target) {
      spawnMouse();
      spawnTimer = cfg.spawn;
    }

    mice.forEach(function (m) {
      m.wiggle += 0.08;
      m.x += m.vx + Math.sin(m.wiggle) * 0.15;
      m.y += m.vy + Math.cos(m.wiggle) * 0.15;
      if (m.x < -30 || m.x > canvas.width + 30 || m.y < -30 || m.y > canvas.height + 30) {
        m.off = true;
      }
    });
    mice = mice.filter(function (m) { return !m.off; });

    const catchR = 28;
    mice = mice.filter(function (m) {
      const dx = m.x - cat.x;
      const dy = m.y - cat.y;
      if (dx * dx + dy * dy < catchR * catchR) {
        caught++;
        score += 25;
        setHud();
        if (caught >= target) finishWin();
        return false;
      }
      return true;
    });

    drawBackground();
    mice.forEach(drawMouse);
    drawComputerMouse();
    drawCat();

    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (timerId) {
      clearInterval(timerId);
      timerId = 0;
    }
  }

  function start() {
    stop();
    const cfg = settings();
    score = 0;
    caught = 0;
    target = cfg.target;
    timeLeft = cfg.time;
    mice = [];
    spawnTimer = 0.5;
    cat.x = canvas.width / 2;
    cat.y = canvas.height / 2;
    running = true;
    if (typeof hideExtraOverlay === "function") hideExtraOverlay(ID);
    setHud();
    timerId = setInterval(tickTimer, 1000);
    frame();
  }

  function open() {
    stop();
    if (typeof showScreen === "function") showScreen(ID);
    setHud();
    if (typeof openExtraOverlay === "function") {
      openExtraOverlay(
        ID,
        "Мышеловка",
        "На поле бегают мышки. Веди кота компьютерной мышкой и лови их за отведённое время."
      );
    }
  }

  canvas.addEventListener("pointermove", function (e) {
    if (!running) return;
    const rect = canvas.getBoundingClientRect();
    cat.x = (e.clientX - rect.left) * (canvas.width / rect.width);
    cat.y = (e.clientY - rect.top) * (canvas.height / rect.height);
    cat.x = Math.max(24, Math.min(canvas.width - 24, cat.x));
    cat.y = Math.max(24, Math.min(canvas.height - 24, cat.y));
    pointerInside = true;
  });

  canvas.addEventListener("pointerleave", function () {
    pointerInside = false;
  });

  window.MT_EXTRA = { id: ID, stop: stop, start: start, open: open };
})();
