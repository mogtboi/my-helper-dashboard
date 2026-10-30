/**
 * JP 日文特訓. In-arcade quiz only.
 * Lv.1–3: no speechSynthesis and no other TTS.
 * Lv.4 is not built. When it is, answer choices must not show romaji or pinyin.
 * This view never calls playBgm.
 */
import { playSfx, stopBgm } from "./audioEngine.js";

const WRONG_KEY = "my-helper.arcade.jp-wrong.v1";

/** 46 seion. Lv.1 only. */
const SEION = [
  ["あ", "a"], ["い", "i"], ["う", "u"], ["え", "e"], ["お", "o"],
  ["か", "ka"], ["き", "ki"], ["く", "ku"], ["け", "ke"], ["こ", "ko"],
  ["さ", "sa"], ["し", "shi"], ["す", "su"], ["せ", "se"], ["そ", "so"],
  ["た", "ta"], ["ち", "chi"], ["つ", "tsu"], ["て", "te"], ["と", "to"],
  ["な", "na"], ["に", "ni"], ["ぬ", "nu"], ["ね", "ne"], ["の", "no"],
  ["は", "ha"], ["ひ", "hi"], ["ふ", "fu"], ["へ", "he"], ["ほ", "ho"],
  ["ま", "ma"], ["み", "mi"], ["む", "mu"], ["め", "me"], ["も", "mo"],
  ["や", "ya"], ["ゆ", "yu"], ["よ", "yo"],
  ["ら", "ra"], ["り", "ri"], ["る", "ru"], ["れ", "re"], ["ろ", "ro"],
  ["わ", "wa"], ["を", "wo"], ["ん", "n"],
];

const LEVELS = [
  { id: 1, title: "Lv.1 清音", detail: "平假名 ↔ 羅馬字 · 10 題", playable: true },
  { id: 2, title: "Lv.2 濁音・半濁音", detail: "即將推出", playable: false },
  { id: 3, title: "Lv.3 拗音", detail: "即將推出", playable: false },
  { id: 4, title: "Lv.4 詞彙", detail: "即將推出", playable: false },
];

const ROUND = 10;

function shuffle(list) {
  const next = list.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function loadBook() {
  try {
    const parsed = JSON.parse(localStorage.getItem(WRONG_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row) => row && typeof row.kana === "string" && typeof row.romaji === "string");
  } catch {
    return [];
  }
}

function rememberWrong(kana, romaji) {
  const book = loadBook();
  const found = book.find((row) => row.kana === kana);
  if (found) found.misses = Number(found.misses || 0) + 1;
  else book.push({ kana, romaji, misses: 1 });
  try {
    localStorage.setItem(WRONG_KEY, JSON.stringify(book.slice(0, SEION.length)));
  } catch {
    /* the round still finishes */
  }
}

function makeRound() {
  const picked = shuffle(SEION).slice(0, ROUND);
  return picked.map(([kana, romaji]) => {
    const askKana = Math.random() < 0.5;
    const distractors = shuffle(SEION.filter(([k]) => k !== kana)).slice(0, 3);
    const choices = shuffle([[kana, romaji], ...distractors]).map(([k, r]) => (askKana ? r : k));
    return {
      kana,
      romaji,
      prompt: askKana ? kana : romaji,
      answer: askKana ? romaji : kana,
      choices,
    };
  });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function mountJpQuiz(root, { onBack, bindMute }) {
  stopBgm();
  let timer = 0;
  const clearTimer = () => {
    if (timer) window.clearTimeout(timer);
    timer = 0;
  };

  const leave = () => {
    clearTimer();
    stopBgm();
    onBack();
  };

  const paintLevels = () => {
    clearTimer();
    stopBgm();
    root.replaceChildren();
    const page = el("div", "arcade-page jp-page");
    const head = el("div", "arcade-head");
    head.append(el("h2", "", "JP 日文特訓"));
    const mute = el("button", "arcade-sfx");
    mute.type = "button";
    bindMute(mute);
    head.append(mute);

    const back = el("button", "arcade-text-btn", "← 返回 Arcade");
    back.type = "button";
    back.addEventListener("click", leave);

    const note = el("p", "muted arcade-intro", "Lv.1 係平假名同羅馬字。呢度唔播背景音樂，亦唔會讀出聲。");
    const list = el("div", "jp-levels");
    for (const level of LEVELS) {
      const btn = el("button", "jp-level");
      btn.type = "button";
      btn.append(el("span", "jp-level-title", level.title), el("span", "jp-level-detail", level.detail));
      if (!level.playable) {
        btn.disabled = true;
        btn.classList.add("is-locked");
        btn.append(el("span", "arcade-soon", "[Coming Soon]"));
      } else {
        btn.addEventListener("click", () => paintRound());
      }
      list.append(btn);
    }

    const book = loadBook();
    const review = el("div", "jp-review");
    review.append(el("p", "jp-review-title", book.length ? `錯題本 ${book.length} 項` : "錯題本仲係空的"));
    book.slice(0, 6).forEach((row) => {
      review.append(el("p", "jp-review-row", `${row.kana} ${row.romaji}`));
    });

    page.append(head, back, note, list, review);
    root.append(page);
  };

  const paintRound = () => {
    stopBgm();
    const questions = makeRound();
    let index = 0;
    let correct = 0;
    let locked = false;

    const paintQuestion = () => {
      clearTimer();
      locked = false;
      const q = questions[index];
      root.replaceChildren();
      const page = el("div", "arcade-page jp-page");
      const head = el("div", "arcade-head");
      head.append(el("h2", "", "Lv.1 清音"));
      const mute = el("button", "arcade-sfx");
      mute.type = "button";
      bindMute(mute);
      head.append(mute);

      const meta = el("p", "jp-meta", `第 ${index + 1} / ${questions.length} 題`);
      meta.dataset.roundLength = String(questions.length);
      const prompt = el("p", "jp-prompt", q.prompt);
      prompt.dataset.prompt = q.prompt;
      const choices = el("div", "jp-choices");
      const status = el("p", "arcade-status");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");

      const buttons = q.choices.map((choice) => {
        const btn = el("button", "jp-choice", choice);
        btn.type = "button";
        btn.addEventListener("click", () => answer(choice, buttons, status));
        choices.append(btn);
        return btn;
      });

      const quit = el("button", "arcade-text-btn", "← 返回關卡");
      quit.type = "button";
      quit.addEventListener("click", paintLevels);
      page.append(head, meta, prompt, choices, status, quit);
      root.append(page);
    };

    const answer = (choice, buttons, status) => {
      if (locked) return;
      locked = true;
      const q = questions[index];
      const hit = choice === q.answer;
      if (hit) {
        correct += 1;
        playSfx("ok");
        status.textContent = "啱";
      } else {
        rememberWrong(q.kana, q.romaji);
        playSfx("ng");
        status.textContent = `唔啱 · ${q.kana} ${q.romaji}`;
      }
      buttons.forEach((btn) => {
        btn.disabled = true;
        if (btn.textContent === q.answer) btn.classList.add("is-ok");
        else if (btn.textContent === choice) btn.classList.add("is-ng");
      });
      timer = window.setTimeout(() => {
        index += 1;
        if (index < questions.length) paintQuestion();
        else paintResult();
      }, 700);
    };

    const paintResult = () => {
      clearTimer();
      stopBgm();
      root.replaceChildren();
      const page = el("div", "arcade-page jp-page");
      page.append(el("h2", "jp-prompt", `${correct} / ${questions.length}`));
      page.append(el("p", "muted arcade-intro", "呢輪完。錯咗嘅會留喺呢部機嘅錯題本。"));
      const again = el("button", "jp-level", "再練一輪 Lv.1");
      again.type = "button";
      again.addEventListener("click", paintRound);
      const back = el("button", "arcade-text-btn", "← 返回關卡");
      back.type = "button";
      back.addEventListener("click", paintLevels);
      const hub = el("button", "arcade-text-btn", "← 返回 Arcade");
      hub.type = "button";
      hub.addEventListener("click", leave);
      page.append(again, back, hub);
      root.append(page);
    };

    paintQuestion();
  };

  paintLevels();
}
