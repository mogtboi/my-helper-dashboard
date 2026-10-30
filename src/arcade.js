/**
 * Arcade hub only. No gameplay, audio, or saved progress.
 * Loaded on the first visit via dynamic import from main.js.
 */

const GAMES = [
  { id: "duel", title: "3v3", kicker: "對線卡牌", blurb: "對線直擊與戰術換位" },
  { id: "jp", title: "JP 日文特訓", kicker: "50音・單字", blurb: "50音、拼音與實用詞彙" },
  { id: "pet", title: "口袋像素夥伴", kicker: "點陣育成", blurb: "口袋裡的像素夥伴" },
  { id: "2048", title: "2048", kicker: "經典益智", blurb: "單手滑動合併" },
];

export function createArcade(root) {
  let started = false;
  let pulseTimer = 0;

  const paint = () => {
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
    sfx.disabled = true;
    sfx.setAttribute("aria-label", "音效（Phase 2 推出）");
    sfx.title = "Phase 2 推出";
    sfx.textContent = "音效";
    head.append(title, sfx);

    const intro = document.createElement("p");
    intro.className = "muted arcade-intro";
    intro.textContent = "單手輕量小遊戲室，四款即將推出。";

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
      badge.textContent = "[Coming Soon]";

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
      paint();
    },
  };
}
