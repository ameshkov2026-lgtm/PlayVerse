(function () {
  const ADS_PER_ENTRY = 3;
  const PREMIUM_CODE = "PV#K9M2-QX7L-RP4N";
  const PREMIUM_PRICE = "150 ⭐ / мес";

  const PREMIUM_GAMES = [];

  const PREMIUM_AVATARS = [
    { id: "av_liga_gold", name: "Лига Gold", price: 14, tier: 8, premiumOnly: true, c1: "#422006", c2: "#fbbf24", c3: "#fef9c3", skin: "#e8b88a", shirt: "#fbbf24", pants: "#422006", arms: "#f59e0b", hat: "#fef9c3", acc: "wings", accColor: "#fde047" },
    { id: "av_liga_neon", name: "Лига Neon", price: 16, tier: 8, premiumOnly: true, c1: "#09090b", c2: "#22d3ee", c3: "#d946ef", skin: "#e8b88a", shirt: "#22d3ee", pants: "#09090b", arms: "#d946ef", acc: "aura", accColor: "#22d3ee" },
    { id: "av_liga_crown", name: "Корона Лиги", price: 18, tier: 9, premiumOnly: true, c1: "#1e1b4b", c2: "#eab308", c3: "#fef08a", skin: "#e8b88a", shirt: "#eab308", pants: "#1e1b4b", arms: "#ca8a04", hat: "#fef08a", acc: "cape", accColor: "#fbbf24" }
  ];

  function toast(msg) {
    if (window.PVProfile && PVProfile.toast) PVProfile.toast(msg);
  }

  function currentUser() {
    return window.PVProfile && PVProfile.currentUser ? PVProfile.currentUser() : null;
  }

  function isPremium() {
    const u = currentUser();
    if (!u) return false;
    if (u.role === "superadmin" || u.role === "liga") return true;
    if (u.premium === true) return true;
    if (u.premiumUntil && Number(u.premiumUntil) > Date.now()) return true;
    return false;
  }

  function ensurePremiumFields(u) {
    if (!u) return u;
    if (typeof u.premium !== "boolean") u.premium = false;
    if (typeof u.premiumUntil !== "number") u.premiumUntil = 0;
    if (typeof u.ligaMember !== "boolean") u.ligaMember = false;
    return u;
  }

  function activatePremium() {
    const u = currentUser();
    if (!u) return toast("Сначала войди в аккаунт");
    if (window.PVProfile && PVProfile.saveCurrentUser) {
      PVProfile.saveCurrentUser({
        premium: true,
        premiumUntil: Date.now() + 1000 * 60 * 60 * 24 * 30,
        ligaMember: true,
        role: u.role === "superadmin" ? "superadmin" : "liga"
      });
    }
    toast("Premium активирован! Добро пожаловать в Лигу PlayVerse");
    hidePremiumModal();
    renderPremiumUi();
    if (window.PVProfile && PVProfile.render) PVProfile.render();
  }

  function tryPromoCode(code) {
    if (String(code || "").trim().toUpperCase() === PREMIUM_CODE) {
      activatePremium();
      return true;
    }
    toast("Неверный код. Купи Premium в боте @PlayVerse_super_bot (/premium)");
    return false;
  }

  function getAvatarPrice(item) {
    const base = typeof item.price === "number" ? item.price : 0;
    if (!isPremium()) return base;
    if (item.premiumOnly) return base;
    return Math.max(1, Math.floor(base * 0.5));
  }

  function injectPremiumAvatars() {
    if (!window.PVProfile || !window.AVATAR_SHOP_REF) return;
    PREMIUM_AVATARS.forEach((item) => {
      if (!window.AVATAR_SHOP_REF.find((a) => a.id === item.id)) {
        window.AVATAR_SHOP_REF.push(item);
      }
    });
  }

  function ensureOverlay() {
    if (document.getElementById("pv-ad-overlay")) return;

    const adHtml =
      '<div class="pv-ad-overlay" id="pv-ad-overlay" hidden>' +
      '<div class="pv-ad-card">' +
      '<div class="pv-ad-label">Реклама</div>' +
      '<h3>PlayVerse Premium</h3>' +
      '<p>Супер-сложные уровни, 10 эксклюзивных игр, больше аватаров по сниженной цене и без рекламы.</p>' +
      '<ul class="pv-ad-list">' +
      "<li>10 premium-игр</li>" +
      "<li>Сложный режим во всех играх</li>" +
      "<li>−50% на аватары</li>" +
      "<li>Группа «Лига PlayVerse»</li>" +
      "</ul>" +
      '<div class="pv-ad-actions">' +
      '<button type="button" class="pv-ad-premium-btn" id="pv-ad-premium-btn">Узнать про Premium</button>' +
      '<button type="button" class="pv-ad-close-btn" id="pv-ad-close-btn">Продолжить</button>' +
      "</div>" +
      '<div class="pv-ad-counter" id="pv-ad-counter"></div>' +
      "</div></div>";

    const premiumHtml =
      '<div class="pv-premium-overlay" id="pv-premium-overlay" hidden>' +
      '<div class="pv-premium-card">' +
      '<button type="button" class="pv-premium-close" id="pv-premium-close" aria-label="Закрыть">✕</button>' +
      '<div class="pv-premium-badge">PREMIUM</div>' +
      "<h2>PlayVerse Premium</h2>" +
      "<p>Платная версия с максимумом возможностей</p>" +
      '<ul class="pv-premium-list">' +
      "<li>10 новых premium-игр</li>" +
      "<li>Супер-сложные уровни</li>" +
      "<li>Больше аватаров со скидкой 50%</li>" +
      "<li>Без рекламы при входе</li>" +
      "<li>Доступ в группу «Лига PlayVerse»</li>" +
      "</ul>" +
      '<div class="pv-premium-price">' + PREMIUM_PRICE + "</div>" +
      '<p class="pv-premium-bot">Оплата Stars в боте <b>@PlayVerse_super_bot</b> → /premium</p>' +
      '<input type="text" class="pv-premium-code" id="pv-premium-code" placeholder="Код активации">' +
      '<button type="button" class="pv-premium-activate" id="pv-premium-activate">Активировать Premium</button>' +
      "</div></div>";

    document.body.insertAdjacentHTML("beforeend", adHtml + premiumHtml);

    document.getElementById("pv-ad-close-btn").addEventListener("click", closeAd);
    document.getElementById("pv-ad-premium-btn").addEventListener("click", () => {
      closeAd();
      showPremiumModal();
    });
    document.getElementById("pv-premium-close").addEventListener("click", hidePremiumModal);
    document.getElementById("pv-premium-activate").addEventListener("click", () => {
      const input = document.getElementById("pv-premium-code");
      tryPromoCode(input ? input.value : "");
    });
    document.getElementById("pv-premium-overlay").addEventListener("click", (e) => {
      if (e.target.id === "pv-premium-overlay") hidePremiumModal();
    });
  }

  let adResolve = null;

  function closeAd() {
    const overlay = document.getElementById("pv-ad-overlay");
    if (overlay) overlay.hidden = true;
    if (adResolve) {
      const fn = adResolve;
      adResolve = null;
      fn();
    }
  }

  function showAd(step) {
    ensureOverlay();
    const overlay = document.getElementById("pv-ad-overlay");
    const counter = document.getElementById("pv-ad-counter");
    if (counter) counter.textContent = "Реклама " + step + " из " + ADS_PER_ENTRY;
    overlay.hidden = false;
    return new Promise((resolve) => {
      adResolve = resolve;
    });
  }

  async function runEntryAds(done) {
    if (isPremium()) {
      done();
      return;
    }
    let shown = parseInt(sessionStorage.getItem("pv_ads_shown") || "0", 10);
    while (shown < ADS_PER_ENTRY) {
      shown += 1;
      sessionStorage.setItem("pv_ads_shown", String(shown));
      await showAd(shown);
    }
    done();
  }

  function showPremiumModal() {
    ensureOverlay();
    document.getElementById("pv-premium-overlay").hidden = false;
  }

  function hidePremiumModal() {
    const overlay = document.getElementById("pv-premium-overlay");
    if (overlay) overlay.hidden = true;
  }

  function premiumGameCard(item) {
    const locked = !isPremium();
    return (
      '<button type="button" class="cover-card pv-premium-game' + (locked ? " locked" : "") + '" data-premium-game="' + item.map + '" data-premium-title="' + item.title + '">' +
      '<div class="cover-art" style="background:linear-gradient(145deg,' + item.color + ',#1e1b4b)">' +
      '<h1 class="cover-title"><span>Premium</span>' + item.title + "</h1>" +
      (locked ? '<span class="pv-premium-lock">🔒 Premium</span>' : "") +
      "</div>" +
      '<div class="cover-meta"><h2>' + item.title + "</h2>" +
      "<p>Эксклюзивный режим для участников Premium.</p></div></button>"
    );
  }

  function renderPremiumGames() {
    const grid = document.getElementById("hub-premium-grid");
    if (!grid) return;
    grid.innerHTML = PREMIUM_GAMES.map(premiumGameCard).join("");
    grid.querySelectorAll("[data-premium-game]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!isPremium()) {
          showPremiumModal();
          return;
        }
        const mode = btn.getAttribute("data-premium-game");
        const card = document.getElementById("cover-card-" + mode);
        if (card && typeof launchFromHub === "function") {
          launchFromHub(card, mode);
          return;
        }
        toast("Premium-игра: " + (btn.getAttribute("data-premium-title") || mode));
      });
    });
  }

  function renderPremiumUi() {
    renderPremiumGames();
    const topBtn = document.getElementById("hub-premium-btn");
    if (topBtn) {
      topBtn.textContent = isPremium() ? "Premium ✓" : "Premium";
      topBtn.classList.toggle("active", isPremium());
    }
    const tag = document.getElementById("hub-user-tag");
    if (tag) tag.textContent = isPremium() ? "Лига PlayVerse" : "На PlayVerse";
  }

  function installHooks() {
    if (!window.PVProfile) {
      setTimeout(installHooks, 120);
      return;
    }

    injectPremiumAvatars();

    const originalGoToGames = PVProfile.goToGames;
    if (originalGoToGames && !PVProfile._premiumHooked) {
      PVProfile.goToGames = function () {
        runEntryAds(() => originalGoToGames.call(PVProfile));
      };
      PVProfile._premiumHooked = true;
    }

    PVProfile.isPremium = isPremium;
    PVProfile.ensurePremiumFields = ensurePremiumFields;
    PVProfile.activatePremium = activatePremium;
    PVProfile.getAvatarPrice = getAvatarPrice;
    PVProfile.showPremiumModal = showPremiumModal;

    const premiumBtn = document.getElementById("hub-premium-btn");
    if (premiumBtn && !premiumBtn.dataset.bound) {
      premiumBtn.dataset.bound = "1";
      premiumBtn.addEventListener("click", showPremiumModal);
    }

    document.addEventListener("click", (e) => {
      const hardBtn = e.target.closest('[data-diff="hard"], [data-level="36"]');
      if (!hardBtn || isPremium()) return;
      e.preventDefault();
      e.stopPropagation();
      toast("Сложный уровень — только в Premium");
      showPremiumModal();
    }, true);

    renderPremiumUi();
  }

  window.PVPremium = {
    isPremium,
    activatePremium,
    tryPromoCode,
    showPremiumModal,
    hidePremiumModal,
    runEntryAds,
    getAvatarPrice,
    renderPremiumUi,
    PREMIUM_CODE,
    PREMIUM_GAMES
  };
  window.PVAds = { runEntryAds };

  ensureOverlay();
  installHooks();
})();
