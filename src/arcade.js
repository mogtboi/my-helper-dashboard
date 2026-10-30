/**
 * Arcade hub. Loaded on the first visit via dynamic import from main.js.
 * Does not autoplay BGM. playBgm is returned for a later 3v3 phase only.
 */
import { isMuted, playBgm, playSfx, setMuted, stopBgm } from "./audioEngine.js";
import { mountJpQuiz } from "./jpQuiz.js";

const GAMES = [
  { id: "duel", title: "3v3", kicker: "對線卡牌", blurb: "對線直擊與戰術換位", soon: true },
  { id: "jp", title: "JP 日文特訓", kicker: "50音・單字", blurb: "Lv.1 平假名同羅馬字", soon: false },
  { id: "pet", title: "口袋像素夥伴", kicker: "點陣育成", blurb: "口袋裡的像素夥伴", soon: true },
  { id: "2048", title: "2048", kicker: "經典益智", blurb: "單手滑動合併", soon: true },
];

function bindMute(btn) {
  const paint = () => {
    const muted = isMuted();
    btn.setAttribute("aria-pressed", muted ? "false" : "true");
    btn.classList.toggle("is-on", !muted);
    btn.textContent = muted ? "音效關" : "音效開";
    btn.setAttribute("aria-label", muted ? "音效，而家靜音" : "音效，而家開咗");
  };
  paint();
  btn.addEventListener("click", () => {
    setMuted(!isMuted());
    paint();
  });
}

export function createArcade(root) {
  let started = false;
  let pulseTimer = 0;

  const showHub = () => {
    stopBgm();
    root.replaceChildren();
    const page = document.createElement("div");
    page.className = "arcade-page";

    const head = document.createElement("div");
    head.className = "arcade-head";
    const title = document.createElement("h2");
    title.id = "arcade-title";
    title.textContent = "Arcade";
    const sfx = document.createElement("button");
    sfx.type = "button";
    sfx.className = "arcade-sfx";
    bindMute(sfx);
    head.append(title, sfx);

    const intro = document.createElement("p");
    intro.className = "muted arcade-intro";
    intro.textContent = "JP 日文特訓可以開始。其他遊戲即將推出。";

    const status = document.createElement("p");
    status.className = "arcade-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    const grid = document.createElement("div");
    grid.className = "arcade-grid";
    grid.setAttribute("role", "list");

    for (const game of GAMES) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "arcade-card";
      card.dataset.game = game.id;
      card.style.setProperty("--arcade-card-bg", "none");
      card.setAttribute("role", "listitem");

      const badge = document.createElement("span");
      badge.className = "arcade-soon";
      badge.textContent = game.soon ? "[Coming Soon]" : "Lv.1";

      const kicker = document.createElement("span");
      kicker.className = "arcade-kicker";
      kicker.textContent = game.kicker;

      const top = document.createElement("span");
      top.className = "arcade-card-top";
      top.append(badge, kicker);

      const name = document.createElement("span");
      name.className = "arcade-card-title";
      name.textContent = game.title;

      const blurb = document.createElement("span");
      blurb.className = "arcade-card-blurb";
      blurb.textContent = game.blurb;

      card.append(top, name, blurb);
      card.addEventListener("click", () => {
        if (!isMuted()) playSfx("tap");
        if (game.id === "jp") {
          mountJpQuiz(root, { onBack: showHub, bindMute });
          return;
        }
        grid.querySelectorAll(".arcade-card").forEach((el) => el.classList.remove("is-pulsing"));
        card.classList.add("is-pulsing");
        status.textContent = `${game.title} 即將推出`;
        window.clearTimeout(pulseTimer);
        pulseTimer = window.setTimeout(() => card.classList.remove("is-pulsing"), 900);
      });
      grid.append(card);
    }

    const foot = document.createElement("p");
    foot.className = "arcade-foot";
    foot.textContent = "進度／設定只存本機，唔會上雲。";

    page.append(head, intro, status, grid, foot);
    root.append(page);
  };

  return {
    start() {
      if (started) return;
      started = true;
      showHub();
    },
    playBgm,
  };
}
