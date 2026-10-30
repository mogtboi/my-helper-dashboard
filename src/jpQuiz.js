/**
 * JP 日文特訓. In-arcade quiz only.
 * Lv.1–3: kana ↔ romaji. No speechSynthesis and no other TTS.
 * Lv.4 choices must not show romaji or pinyin. Prompts and buttons are
 * Japanese (kanji/kana) or Chinese glosses only. Do not append readings.
 * This view never calls playBgm. 基本教學 is optional and not a gate.
 */
import { playSfx, stopBgm } from "./audioEngine.js";

const WRONG_KEY = "my-helper.arcade.jp-wrong.v1";
const ROUND = 10;
const LATIN = /[A-Za-z]/;

/** 46 seion. */
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

/** 25 dakuten + handakuten. ぢ/づ use di/du so each reading has one kana. */
const DAKUON = [
  ["が", "ga"], ["ぎ", "gi"], ["ぐ", "gu"], ["げ", "ge"], ["ご", "go"],
  ["ざ", "za"], ["じ", "ji"], ["ず", "zu"], ["ぜ", "ze"], ["ぞ", "zo"],
  ["だ", "da"], ["ぢ", "di"], ["づ", "du"], ["で", "de"], ["ど", "do"],
  ["ば", "ba"], ["び", "bi"], ["ぶ", "bu"], ["べ", "be"], ["ぼ", "bo"],
  ["ぱ", "pa"], ["ぴ", "pi"], ["ぷ", "pu"], ["ぺ", "pe"], ["ぽ", "po"],
];

/** 33 youon. */
const YOUON = [
  ["きゃ", "kya"], ["きゅ", "kyu"], ["きょ", "kyo"],
  ["しゃ", "sha"], ["しゅ", "shu"], ["しょ", "sho"],
  ["ちゃ", "cha"], ["ちゅ", "chu"], ["ちょ", "cho"],
  ["にゃ", "nya"], ["にゅ", "nyu"], ["にょ", "nyo"],
  ["ひゃ", "hya"], ["ひゅ", "hyu"], ["ひょ", "hyo"],
  ["みゃ", "mya"], ["みゅ", "myu"], ["みょ", "myo"],
  ["りゃ", "rya"], ["りゅ", "ryu"], ["りょ", "ryo"],
  ["ぎゃ", "gya"], ["ぎゅ", "gyu"], ["ぎょ", "gyo"],
  ["じゃ", "ja"], ["じゅ", "ju"], ["じょ", "jo"],
  ["びゃ", "bya"], ["びゅ", "byu"], ["びょ", "byo"],
  ["ぴゃ", "pya"], ["ぴゅ", "pyu"], ["ぴょ", "pyo"],
];

/** 40 N5 words. Japanese form and Chinese gloss only — no romaji field. */
const VOCAB = [
  ["水（みず）", "食水"], ["火（ひ）", "火焰"], ["人（ひと）", "人"],
  ["今日（きょう）", "今天"], ["明日（あした）", "明天"], ["昨日（きのう）", "昨天"],
  ["今（いま）", "而家"], ["時間（じかん）", "鐘"], ["私（わたし）", "我"],
  ["学生（がくせい）", "學生"], ["先生（せんせい）", "老師"], ["学校（がっこう）", "學校"],
  ["友達（ともだち）", "朋友"], ["家族（かぞく）", "家人"], ["父（ちち）", "爸爸"],
  ["母（はは）", "媽媽"], ["食べる（たべる）", "食"], ["飲む（のむ）", "飲"],
  ["見る（みる）", "睇"], ["聞く（きく）", "聽"], ["行く（いく）", "去"],
  ["来る（くる）", "嚟"], ["帰る（かえる）", "返屋企"], ["買う（かう）", "買嘢"],
  ["読む（よむ）", "睇書"], ["書く（かく）", "寫字"], ["話す（はなす）", "講嘢"],
  ["大きい（おおきい）", "大"], ["小さい（ちいさい）", "細"], ["新しい（あたらしい）", "新"],
  ["古い（ふるい）", "舊"], ["高い（たかい）", "貴"], ["安い（やすい）", "平"],
  ["電車（でんしゃ）", "火車"], ["車（くるま）", "汽車"], ["駅（えき）", "車站"],
  ["本（ほん）", "書"], ["名前（なまえ）", "名字"], ["猫（ねこ）", "貓"], ["犬（いぬ）", "狗"],
];

const GOJUON_ROWS = [
  ["あ行", SEION.slice(0, 5)],
  ["か行", SEION.slice(5, 10)],
  ["さ行", SEION.slice(10, 15)],
  ["た行", SEION.slice(15, 20)],
  ["な行", SEION.slice(20, 25)],
  ["は行", SEION.slice(25, 30)],
  ["ま行", SEION.slice(30, 35)],
  ["や行", SEION.slice(35, 38)],
  ["ら行", SEION.slice(38, 43)],
  ["わ行", SEION.slice(43, 46)],
];

const LEVELS = [
  { id: 1, title: "Lv.1 清音", detail: `平假名 ↔ 羅馬字 · ${SEION.length} 音`, mode: "kana", pool: SEION },
  { id: 2, title: "Lv.2 濁音・半濁音", detail: `平假名 ↔ 羅馬字 · ${DAKUON.length} 音`, mode: "kana", pool: DAKUON },
  { id: 3, title: "Lv.3 拗音", detail: `平假名 ↔ 羅馬字 · ${YOUON.length} 音`, mode: "kana", pool: YOUON },
  { id: 4, title: "Lv.4 詞彙", detail: `N5 詞彙 · ${VOCAB.length} 個 · 選項冇羅馬字`, mode: "vocab", pool: VOCAB },
];

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

function rememberWrong(kana, gloss) {
  const book = loadBook();
  const found = book.find((row) => row.kana === kana);
  if (found) found.misses = Number(found.misses || 0) + 1;
  else book.push({ kana, romaji: gloss, misses: 1 });
  try {
    localStorage.setItem(WRONG_KEY, JSON.stringify(book.slice(0, 200)));
  } catch {
    /* the round still finishes */
  }
}

function makeKanaRound(pool) {
  return shuffle(pool).slice(0, ROUND).map(([kana, romaji]) => {
    const askKana = Math.random() < 0.5;
    const distractors = shuffle(pool.filter(([k]) => k !== kana)).slice(0, 3);
    const choices = shuffle([[kana, romaji], ...distractors]).map(([k, r]) => (askKana ? r : k));
    return { kana, romaji, prompt: askKana ? kana : romaji, answer: askKana ? romaji : kana, choices, vocab: false };
  });
}

function makeVocabRound() {
  return shuffle(VOCAB).slice(0, ROUND).map(([jp, zh]) => {
    const askJp = Math.random() < 0.5;
    const distractors = shuffle(VOCAB.filter(([word]) => word !== jp)).slice(0, 3);
    const choices = shuffle([[jp, zh], ...distractors]).map(([word, gloss]) => (askJp ? gloss : word));
    return { kana: jp, romaji: zh, prompt: askJp ? jp : zh, answer: askJp ? zh : jp, choices, vocab: true };
  });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function kanaCell(kana, romaji) {
  const cell = el("span", "jp-kana");
  cell.append(el("span", "jp-kana-char", kana), el("span", "jp-kana-read", romaji));
  return cell;
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

  const header = (title) => {
    const head = el("div", "arcade-head");
    head.append(el("h2", "", title));
    const mute = el("button", "arcade-sfx");
    mute.type = "button";
    bindMute(mute);
    head.append(mute);
    return head;
  };

  const paintLevels = () => {
    clearTimer();
    stopBgm();
    root.replaceChildren();
    const page = el("div", "arcade-page jp-page");
    const back = el("button", "arcade-text-btn", "← 返回 Arcade");
    back.type = "button";
    back.addEventListener("click", leave);
    const note = el("p", "muted arcade-intro", "撳關卡就開始 10 題。基本教學可以跳過。呢度唔播音樂，亦唔會讀出聲。");
    const teach = el("button", "jp-level jp-teach-open", "基本教學");
    teach.type = "button";
    teach.append(el("span", "jp-level-detail", "五十音、濁音、拗音同羅馬字點對"));
    teach.addEventListener("click", paintTeach);
    const list = el("div", "jp-levels");
    for (const level of LEVELS) {
      const btn = el("button", "jp-level");
      btn.type = "button";
      btn.dataset.level = String(level.id);
      btn.append(el("span", "jp-level-title", level.title), el("span", "jp-level-detail", level.detail));
      btn.addEventListener("click", () => paintRound(level));
      list.append(btn);
    }
    const book = loadBook();
    const review = el("div", "jp-review");
    review.append(el("p", "jp-review-title", book.length ? `錯題本 ${book.length} 項` : "錯題本仲係空的"));
    book.slice(0, 6).forEach((row) => {
      review.append(el("p", "jp-review-row", `${row.kana} ${row.romaji}`));
    });
    page.append(header("JP 日文特訓"), back, note, teach, list, review);
    root.append(page);
  };

  const paintTeach = () => {
    clearTimer();
    stopBgm();
    root.replaceChildren();
    const page = el("div", "arcade-page jp-page");
    const back = el("button", "arcade-text-btn", "← 返回關卡");
    back.type = "button";
    back.addEventListener("click", paintLevels);
    const scroller = el("div", "jp-teach");
    scroller.append(el("h3", "jp-teach-h", "五十音 あ～ん"));
    scroller.append(el("p", "jp-teach-p", "清音按行排。每一格上面係假名，下面係羅馬字讀音。"));
    for (const [name, items] of GOJUON_ROWS) {
      scroller.append(el("p", "jp-teach-label", name));
      const row = el("div", "jp-kana-row");
      items.forEach(([kana, romaji]) => row.append(kanaCell(kana, romaji)));
      scroller.append(row);
    }
    scroller.append(el("h3", "jp-teach-h", "濁音"));
    scroller.append(el("p", "jp-teach-p", "清音右上加兩點，讀音由清變濁。例如 か ka 變成 が ga，さ sa 變成 ざ za。"));
    const daku = el("div", "jp-kana-row");
    [["か", "ka"], ["が", "ga"], ["さ", "sa"], ["ざ", "za"], ["た", "ta"], ["だ", "da"]].forEach(([k, r]) => daku.append(kanaCell(k, r)));
    scroller.append(daku);
    scroller.append(el("h3", "jp-teach-h", "半濁音"));
    scroller.append(el("p", "jp-teach-p", "只有は行可以加圓圈，讀成 p。は ha 變成 ぱ pa，ひ hi 變成 ぴ pi。"));
    const handaku = el("div", "jp-kana-row");
    [["は", "ha"], ["ぱ", "pa"], ["ひ", "hi"], ["ぴ", "pi"], ["ほ", "ho"], ["ぽ", "po"]].forEach(([k, r]) => handaku.append(kanaCell(k, r)));
    scroller.append(handaku);
    scroller.append(el("h3", "jp-teach-h", "拗音"));
    scroller.append(el("p", "jp-teach-p", "い段假名加細寫的 ゃ ゅ ょ，合成一個音節。き ki 加 ゃ 讀 きゃ kya，不係 kiya。"));
    const you = el("div", "jp-kana-row");
    [["き", "ki"], ["きゃ", "kya"], ["し", "shi"], ["しゃ", "sha"], ["ち", "chi"], ["ちゃ", "cha"]].forEach(([k, r]) => you.append(kanaCell(k, r)));
    scroller.append(you);
    scroller.append(el("h3", "jp-teach-h", "羅馬字點對"));
    scroller.append(el("p", "jp-teach-p", "羅馬字用拉丁字母寫讀音：清音一音一組，濁音換聲母，半濁音用 p，拗音把 i 收成 y。Lv.1 至 Lv.3 會考假名同羅馬字互換。Lv.4 詞彙的選項只顯示日文或中文，不會出現羅馬字或拼音。"));
    page.append(header("基本教學"), back, scroller);
    root.append(page);
  };

  const paintRound = (level) => {
    stopBgm();
    const questions = level.mode === "vocab" ? makeVocabRound() : makeKanaRound(level.pool);
    let index = 0;
    let correct = 0;
    let locked = false;

    const paintQuestion = () => {
      clearTimer();
      locked = false;
      const q = questions[index];
      root.replaceChildren();
      const page = el("div", "arcade-page jp-page");
      const meta = el("p", "jp-meta", `第 ${index + 1} / ${questions.length} 題`);
      meta.dataset.roundLength = String(questions.length);
      meta.dataset.level = String(level.id);
      const prompt = el("p", "jp-prompt", q.prompt);
      prompt.dataset.prompt = q.prompt;
      if (q.prompt.length > 4) prompt.classList.add("is-long");
      const choices = el("div", "jp-choices");
      const status = el("p", "arcade-status");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      const buttons = q.choices.map((choice) => {
        const btn = el("button", "jp-choice", choice);
        btn.type = "button";
        if (q.vocab) btn.dataset.noReading = LATIN.test(choice) ? "fail" : "ok";
        btn.addEventListener("click", () => answer(choice, buttons, status));
        choices.append(btn);
        return btn;
      });
      const quit = el("button", "arcade-text-btn", "← 返回關卡");
      quit.type = "button";
      quit.addEventListener("click", paintLevels);
      page.append(header(level.title), meta, prompt, choices, status, quit);
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
        status.textContent = q.vocab ? `唔啱 · ${q.answer}` : `唔啱 · ${q.kana} ${q.romaji}`;
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
      const again = el("button", "jp-level", `再練一輪 ${level.title}`);
      again.type = "button";
      again.addEventListener("click", () => paintRound(level));
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
