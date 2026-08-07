/**
 * PlayVerse · Викторина
 * 4 цветные кнопки, таймер, очки за скорость.
 */
(function () {
  "use strict";

  const ID = "kahoot";
  const TOTAL_Q = 12;

  const KH_COLORS = [
    { cls: "kh-red", bg: "#e21b3c", shape: "▲", key: "1" },
    { cls: "kh-blue", bg: "#1368ce", shape: "◆", key: "2" },
    { cls: "kh-yellow", bg: "#d89e00", shape: "●", key: "3" },
    { cls: "kh-green", bg: "#26890c", shape: "■", key: "4" }
  ];

  const QUESTIONS = [
    { q: "Столица Франции?", a: ["Париж", "Лондон", "Берлин", "Мадрид"], c: 0 },
    { q: "Сколько планет в Солнечной системе?", a: ["7", "8", "9", "10"], c: 1 },
    { q: "Какой газ мы вдыхаем?", a: ["Азот", "Кислород", "CO₂", "Гелий"], c: 1 },
    { q: "2 + 2 × 2 = ?", a: ["6", "8", "4", "10"], c: 0 },
    { q: "Самое большое млекопитающее?", a: ["Слон", "Синий кит", "Жираф", "Бегемот"], c: 1 },
    { q: "Химический символ золота?", a: ["Go", "Gd", "Au", "Ag"], c: 2 },
    { q: "Сколько континентов на Земле?", a: ["5", "6", "7", "8"], c: 2 },
    { q: "Кто написал «Мастер и Маргарита»?", a: ["Толстой", "Булгаков", "Достоевский", "Пушкин"], c: 1 },
    { q: "Столица Японии?", a: ["Сеул", "Пекин", "Токио", "Бангкок"], c: 2 },
    { q: "Сколько минут в одном часе?", a: ["30", "60", "100", "45"], c: 1 },
    { q: "Какая планета — «Красная»?", a: ["Венера", "Марс", "Юпитер", "Сатурн"], c: 1 },
    { q: "Сколько сторон у шестиугольника?", a: ["5", "6", "7", "8"], c: 1 },
    { q: "Какой океан самый большой?", a: ["Атлантический", "Тихий", "Индийский", "Северный Ледовитый"], c: 1 },
    { q: "100 − 37 = ?", a: ["53", "63", "73", "43"], c: 1 },
    { q: "Столица России?", a: ["Москва", "Киев", "Минск", "Казань"], c: 0 },
    { q: "Сколько дней в високосном году?", a: ["365", "366", "364", "360"], c: 1 },
    { q: "Какой инструмент измеряет температуру?", a: ["Барометр", "Термометр", "Компас", "Линейка"], c: 1 },
    { q: "Самая длинная река в мире?", a: ["Амазонка", "Нил", "Волга", "Янцзы"], c: 1 },
    { q: "Сколько игроков в футбольной команде на поле?", a: ["9", "10", "11", "12"], c: 2 },
    { q: "Какой цвет получится из синего + жёлтого?", a: ["Оранжевый", "Зелёный", "Фиолетовый", "Коричневый"], c: 1 }
  ];

  const FB_MS = 1500;
  const SCORE_FLASH_MS = 2000;

  let running = false;
  let timerId = 0;
  let qIndex = 0;
  let score = 0;
  let correct = 0;
  let streak = 0;
  let maxStreak = 0;
  let questions = [];
  let timeLeft = 0;
  let maxTime = 20;
  let locked = false;
  let keyHandler = null;

  function $(sel) { return document.querySelector(sel); }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function timerSec() {
    if (typeof getDiff !== "function") return 20;
    const d = getDiff(ID);
    return d === "easy" ? 25 : d === "hard" ? 12 : 18;
  }

  function prepQuestions() {
    questions = shuffle(QUESTIONS).slice(0, TOTAL_Q).map(function (item) {
      const order = shuffle([0, 1, 2, 3]);
      const answers = order.map(function (i) { return item.a[i]; });
      const correct = order.indexOf(item.c);
      return { q: item.q, answers: answers, correct: correct };
    });
  }

  function setHud() {
    if (typeof setExtraHud === "function") {
      setExtraHud(ID, score, correct + "/" + TOTAL_Q);
    }
    const extra = document.getElementById(ID + "-extra");
    if (extra) extra.textContent = "Серия: " + streak;
  }

  function updateTimerBar() {
    const fill = document.getElementById("kh-timer-fill");
    if (fill) fill.style.width = Math.max(0, (timeLeft / maxTime) * 100) + "%";
    const num = document.getElementById("kh-timer-num");
    if (num) num.textContent = Math.ceil(timeLeft);
  }

  function clearTimer() {
    clearInterval(timerId);
    timerId = 0;
  }

  function hidePanels() {
    ["kh-stage", "kh-feedback", "kh-score-flash"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.classList.add("profile-hidden");
    });
  }

  function showStage() {
    hidePanels();
    const stage = document.getElementById("kh-stage");
    if (stage) stage.classList.remove("profile-hidden");
  }

  function showAnswerFeedback(ok, pts, timedOut) {
    hidePanels();
    const fb = document.getElementById("kh-feedback");
    const title = document.getElementById("kh-fb-title");
    const ptsEl = document.getElementById("kh-fb-pts");
    const streakEl = document.getElementById("kh-fb-streak");
    if (!fb) return;
    fb.classList.remove("profile-hidden");
    if (title) {
      title.textContent = ok ? "Верно!" : (timedOut ? "Время вышло!" : "Неверно!");
      title.className = "kh-fb-title " + (ok ? "ok" : "bad");
    }
    if (ptsEl) {
      ptsEl.textContent = ok ? ("+" + pts + " очков за ответ") : "0 очков за ответ";
      ptsEl.className = "kh-fb-pts" + (ok ? "" : " zero");
    }
    if (streakEl) {
      streakEl.textContent = ok && streak > 0
        ? ("Подряд верно: " + streak)
        : "Подряд верно: 0";
    }
  }

  function showScoreFlash(done) {
    hidePanels();
    const flash = document.getElementById("kh-score-flash");
    const total = document.getElementById("kh-sf-total");
    if (total) total.textContent = String(score);
    if (flash) flash.classList.remove("profile-hidden");
    setTimeout(function () {
      if (done) done();
    }, SCORE_FLASH_MS);
  }

  function afterAnswer(ok, pts, timedOut) {
    showAnswerFeedback(ok, pts, timedOut);
    setTimeout(function () {
      if (!running) return;
      showScoreFlash(function () {
        if (!running) return;
        qIndex++;
        if (qIndex >= questions.length) return finishGame();
        renderQuestion();
      });
    }, FB_MS);
  }

  function highlightCorrect(idx) {
    document.querySelectorAll(".kh-ans").forEach(function (btn, i) {
      btn.classList.toggle("correct", i === idx);
      btn.classList.toggle("wrong", i !== idx && btn.classList.contains("picked"));
    });
  }

  function answer(pick) {
    if (!running || locked) return;
    locked = true;
    clearTimer();
    const q = questions[qIndex];
    const ok = pick === q.correct;
    document.querySelectorAll(".kh-ans").forEach(function (btn, i) {
      if (i === pick) btn.classList.add("picked");
    });

    let pts = 0;
    if (ok) {
      correct++;
      streak++;
      if (streak > maxStreak) maxStreak = streak;
      pts = Math.round(800 + 700 * (timeLeft / maxTime) + streak * 50);
      score += pts;
    } else {
      streak = 0;
    }
    setHud();
    highlightCorrect(q.correct);
    afterAnswer(ok, pts, false);
  }

  function onTimerTick() {
    timeLeft -= 0.1;
    updateTimerBar();
    if (timeLeft <= 0) {
      clearTimer();
      locked = true;
      streak = 0;
      setHud();
      highlightCorrect(questions[qIndex].correct);
      afterAnswer(false, 0, true);
    }
  }

  function renderQuestion() {
    locked = false;
    showStage();
    const q = questions[qIndex];
    maxTime = timerSec();
    timeLeft = maxTime;

    const qEl = document.getElementById("kh-question");
    const nEl = document.getElementById("kh-q-num");
    if (qEl) qEl.textContent = q.q;
    if (nEl) nEl.textContent = (qIndex + 1) + " / " + questions.length;

    const grid = document.getElementById("kh-answers");
    if (!grid) return;
    grid.innerHTML = "";
    q.answers.forEach(function (text, i) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "kh-ans " + KH_COLORS[i].cls;
      btn.innerHTML =
        '<span class="kh-shape" aria-hidden="true">' + KH_COLORS[i].shape + '</span>' +
        '<span class="kh-ans-text">' + text + '</span>';
      btn.addEventListener("click", function () { answer(i); });
      grid.appendChild(btn);
    });

    updateTimerBar();
    clearTimer();
    timerId = setInterval(onTimerTick, 100);
  }

  function finishGame() {
    running = false;
    clearTimer();
    if (keyHandler) {
      document.removeEventListener("keydown", keyHandler);
      keyHandler = null;
    }
    const pct = Math.round((correct / TOTAL_Q) * 100);
    const title = pct >= 80 ? "Отлично!" : pct >= 50 ? "Неплохо!" : "Попробуй ещё!";
    if (typeof showExtraFinal === "function") {
      showExtraFinal(
        ID, score,
        "Верно", correct + "/" + TOTAL_Q,
        "Точность", pct + "%",
        title,
        "Викторина завершена. Чем быстрее отвечаешь — тем больше очков!",
        correct >= Math.ceil(TOTAL_Q * 0.5) ? "complete" : null
      );
    }
  }

  function stop() {
    running = false;
    locked = true;
    clearTimer();
    hidePanels();
    if (keyHandler) {
      document.removeEventListener("keydown", keyHandler);
      keyHandler = null;
    }
  }

  function start() {
    stop();
    running = true;
    score = 0;
    correct = 0;
    streak = 0;
    maxStreak = 0;
    qIndex = 0;
    prepQuestions();
    if (typeof hideExtraOverlay === "function") hideExtraOverlay(ID);
    setHud();
    renderQuestion();

    keyHandler = function (e) {
      if (!running || locked) return;
      const map = { "1": 0, "2": 1, "3": 2, "4": 3, Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 };
      if (map[e.key] != null) {
        e.preventDefault();
        answer(map[e.key]);
      }
    };
    document.addEventListener("keydown", keyHandler);
  }

  function open() {
    stop();
    if (typeof showScreen === "function") showScreen(ID);
    if (typeof openExtraOverlay === "function") {
      openExtraOverlay(ID, "Викторина", "12 вопросов, 4 цветных ответа и таймер. Быстрые ответы дают больше очков.");
    }
  }

  window.KH_EXTRA = { id: ID, stop: stop, start: start, open: open };
})();
