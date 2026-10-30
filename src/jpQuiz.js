/**
 * JP 日文特訓. In-arcade quiz only.
 * Lv.1–3: kana ↔ romaji. Lv.4 choices are Japanese or Chinese only.
 * Choice buttons must not show romaji or pinyin. A Lv.4 reading is shown
 * only after a wrong answer, never on the choices.
 * 基本教學 may speak a tapped kana (ja-JP). Quizzes do not auto-speak.
 * 「聽正解」 speaks only in the wrong-answer reveal. isMuted() blocks TTS.
 * This view never calls playBgm. 基本教學 is optional and not a gate.
 */
import { isMuted, playSfx, stopBgm } from "./audioEngine.js";

const WRONG_KEY = "my-helper.arcade.jp-wrong.v1";
const ROUND = 10;
const LATIN = /[A-Za-z]/;
const ADVANCE_MS = 700;

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

/**
 * N5 words: [japanese with furigana, Chinese gloss, romaji].
 * Romaji is revealed only after a miss. It is never a choice label.
 */
const VOCAB = [
  ["水（みず）", "食水", "mizu"], ["火（ひ）", "火焰", "hi"], ["人（ひと）", "人", "hito"],
  ["今日（きょう）", "今天", "kyou"], ["明日（あした）", "明天", "ashita"], ["昨日（きのう）", "昨天", "kinou"],
  ["今（いま）", "而家", "ima"], ["時間（じかん）", "鐘", "jikan"], ["私（わたし）", "我", "watashi"],
  ["学生（がくせい）", "學生", "gakusei"], ["先生（せんせい）", "老師", "sensei"], ["学校（がっこう）", "學校", "gakkou"],
  ["友達（ともだち）", "朋友", "tomodachi"], ["家族（かぞく）", "家人", "kazoku"], ["父（ちち）", "爸爸", "chichi"],
  ["母（はは）", "媽媽", "haha"], ["食べる（たべる）", "食", "taberu"], ["飲む（のむ）", "飲", "nomu"],
  ["見る（みる）", "睇", "miru"], ["聞く（きく）", "聽", "kiku"], ["行く（いく）", "去", "iku"],
  ["来る（くる）", "嚟", "kuru"], ["帰る（かえる）", "返屋企", "kaeru"], ["買う（かう）", "買嘢", "kau"],
  ["読む（よむ）", "睇書", "yomu"], ["書く（かく）", "寫字", "kaku"], ["話す（はなす）", "講嘢", "hanasu"],
  ["大きい（おおきい）", "大", "ookii"], ["小さい（ちいさい）", "細", "chiisai"], ["新しい（あたらしい）", "新", "atarashii"],
  ["古い（ふるい）", "舊", "furui"], ["高い（たかい）", "貴", "takai"], ["安い（やすい）", "平", "yasui"],
  ["電車（でんしゃ）", "火車", "densha"], ["車（くるま）", "汽車", "kuruma"], ["駅（えき）", "車站", "eki"],
  ["本（ほん）", "書", "hon"], ["名前（なまえ）", "名字", "namae"], ["猫（ねこ）", "貓", "neko"], ["犬（いぬ）", "狗", "inu"],
  ["朝（あさ）", "朝早", "asa"], ["夜（よる）", "夜晚", "yoru"], ["午前（ごぜん）", "上晝", "gozen"],
  ["午後（ごご）", "下晝", "gogo"], ["毎日（まいにち）", "每日", "mainichi"], ["今週（こんしゅう）", "今個星期", "konshuu"],
  ["来週（らいしゅう）", "下星期", "raishuu"], ["山（やま）", "山", "yama"], ["川（かわ）", "河", "kawa"],
  ["海（うみ）", "海", "umi"], ["空（そら）", "天空", "sora"], ["雨（あめ）", "落雨", "ame"],
  ["雪（ゆき）", "落雪", "yuki"], ["花（はな）", "花朵", "hana"], ["木（き）", "樹", "ki"],
  ["魚（さかな）", "鮮魚", "sakana"], ["鳥（とり）", "雀", "tori"], ["目（め）", "眼", "me"],
  ["耳（みみ）", "耳仔", "mimi"], ["口（くち）", "嘴巴", "kuchi"], ["手（て）", "隻手", "te"],
  ["足（あし）", "腳", "ashi"], ["ご飯（ごはん）", "白飯", "gohan"], ["お茶（おちゃ）", "茶", "ocha"],
  ["牛乳（ぎゅうにゅう）", "牛奶", "gyuunyuu"], ["卵（たまご）", "蛋", "tamago"], ["肉（にく）", "肉餸", "niku"],
  ["野菜（やさい）", "蔬菜", "yasai"], ["果物（くだもの）", "生果", "kudamono"], ["家（いえ）", "一間屋", "ie"],
  ["部屋（へや）", "房間", "heya"], ["窓（まど）", "窗", "mado"], ["椅子（いす）", "椅", "isu"],
  ["机（つくえ）", "書桌", "tsukue"], ["電話（でんわ）", "話機", "denwa"], ["映画（えいが）", "電影", "eiga"],
  ["音楽（おんがく）", "音樂", "ongaku"], ["写真（しゃしん）", "相片", "shashin"], ["医者（いしゃ）", "醫生", "isha"],
  ["病院（びょういん）", "醫院", "byouin"], ["会社（かいしゃ）", "公司", "kaisha"], ["仕事（しごと）", "工作", "shigoto"],
  ["銀行（ぎんこう）", "銀號", "ginkou"], ["図書館（としょかん）", "圖書館", "toshokan"], ["上（うえ）", "上面", "ue"],
  ["下（した）", "下面", "shita"], ["左（ひだり）", "左邊", "hidari"], ["右（みぎ）", "右邊", "migi"],
  ["前（まえ）", "前面", "mae"], ["後ろ（うしろ）", "後面", "ushiro"], ["中（なか）", "中間", "naka"],
  ["外（そと）", "外面", "soto"], ["近い（ちかい）", "近", "chikai"], ["遠い（とおい）", "遠", "tooi"],
  ["暑い（あつい）", "天氣熱", "atsui"], ["寒い（さむい）", "凍", "samui"], ["難しい（むずかしい）", "難", "muzukashii"],
  ["好き（すき）", "鍾意", "suki"], ["嫌い（きらい）", "唔鍾意", "kirai"], ["少し（すこし）", "少少", "sukoshi"],
];

const KANA_POOLS = [SEION, DAKUON, YOUON];

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

let speakGen = 0;

function hush() {
  speakGen += 1;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* no speech engine */
  }
}

/** Tap-only ja-JP speech. Mute wins over any in-flight utterance. */
function speakJa(text) {
  if (isMuted() || !text) return;
  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance !== "function") return;
  const gen = ++speakGen;
  try {
    synth.cancel();
  } catch {
    return;
  }
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "ja-JP";
  utter.rate = 0.92;
  window.setTimeout(() => {
    if (gen !== speakGen || isMuted()) return;
    try {
      synth.speak(utter);
    } catch {
      /* the tap still stands */
    }
  }, 0);
}

function furigana(jp) {
  const match = String(jp).match(/（([^）]+)）/);
  return match ? match[1] : jp;
}

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

function saveBook(book) {
  try {
    localStorage.setItem(WRONG_KEY, JSON.stringify(book.slice(0, 200)));
  } catch {
    /* the round still finishes */
  }
}

function rememberWrong(kana, gloss) {
  const book = loadBook();
  const found = book.find((row) => row.kana === kana);
  if (found) found.misses = Number(found.misses || 0) + 1;
  else book.push({ kana, romaji: gloss, misses: 1 });
  saveBook(book);
}

function forgetWrong(kana) {
  saveBook(loadBook().filter((row) => row.kana !== kana));
}

function questionFromKana(pool, [kana, romaji]) {
  const askKana = Math.random() < 0.5;
  const distractors = shuffle(pool.filter(([k]) => k !== kana)).slice(0, 3);
  const choices = shuffle([[kana, romaji], ...distractors]).map(([k, r]) => (askKana ? r : k));
  return {
    kana,
    romaji,
    reading: "",
    speak: kana,
    prompt: askKana ? kana : romaji,
    answer: askKana ? romaji : kana,
    choices,
    vocab: false,
  };
}

function questionFromVocab([jp, zh, reading]) {
  const askJp = Math.random() < 0.5;
  const distractors = shuffle(VOCAB.filter(([word]) => word !== jp)).slice(0, 3);
  const choices = shuffle([[jp, zh], ...distractors]).map(([word, gloss]) => (askJp ? gloss : word));
  return {
    kana: jp,
    romaji: zh,
    reading,
    speak: furigana(jp),
    prompt: askJp ? jp : zh,
    answer: askJp ? zh : jp,
    choices,
    vocab: true,
  };
}

function questionFromBook(row) {
  for (const pool of KANA_POOLS) {
    const hit = pool.find(([kana]) => kana === row.kana);
    if (hit) return questionFromKana(pool, hit);
  }
  const hit = VOCAB.find(([jp]) => jp === row.kana);
  if (hit) return questionFromVocab(hit);
  return null;
}

function makeKanaRound(pool) {
  return shuffle(pool).slice(0, ROUND).map((pair) => questionFromKana(pool, pair));
}

function makeVocabRound() {
  return shuffle(VOCAB).slice(0, ROUND).map((row) => questionFromVocab(row));
}

function makeReviewRound() {
  const questions = [];
  for (const row of shuffle(loadBook())) {
    const question = questionFromBook(row);
    if (!question) continue;
    questions.push(question);
    if (questions.length >= ROUND) break;
  }
  return questions;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function kanaCell(kana, romaji) {
  const cell = el("button", "jp-kana");
  cell.type = "button";
  cell.setAttribute("aria-label", `讀 ${kana}`);
  cell.append(
    el("span", "jp-kana-char", kana),
    el("span", "jp-kana-read", romaji),
    el("span", "jp-kana-say", "讀"),
  );
  cell.addEventListener("click", () => speakJa(kana));
  return cell;
}

export function mountJpQuiz(root, { onBack, bindMute }) {
  stopBgm();
  hush();
  let timer = 0;
  const clearTimer = () => {
    if (timer) window.clearTimeout(timer);
    timer = 0;
  };

  const leave = () => {
    clearTimer();
    hush();
    stopBgm();
    onBack();
  };

  const header = (title) => {
    const head = el("div", "arcade-head");
    head.append(el("h2", "", title));
    const mute = el("button", "arcade-sfx");
    mute.type = "button";
    bindMute(mute);
    mute.addEventListener("click", () => {
      if (isMuted()) hush();
    });
    head.append(mute);
    return head;
  };

  const paintLevels = () => {
    clearTimer();
    hush();
    stopBgm();
    root.replaceChildren();
    const page = el("div", "arcade-page jp-page");
    const back = el("button", "arcade-text-btn", "← 返回 Arcade");
    back.type = "button";
    back.addEventListener("click", leave);
    const note = el(
      "p",
      "muted arcade-intro",
      "撳關卡就開始 10 題。基本教學可以跳過。教學撳格先會讀音；測驗唔會自動讀，答錯先可以聽正解。呢度唔播音樂。",
    );
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
    const playable = book.some((row) => questionFromBook(row));
    const reviewBtn = el("button", "jp-level jp-review-open", "重溫錯題");
    reviewBtn.type = "button";
    reviewBtn.disabled = !playable;
    reviewBtn.append(el("span", "jp-level-detail", playable ? `${book.length} 項` : "未有錯題"));
    reviewBtn.addEventListener("click", () => {
      const questions = makeReviewRound();
      if (!questions.length) return;
      paintRound({ id: "review", title: "重溫錯題", review: true }, questions);
    });
    const review = el("div", "jp-review");
    review.append(el("p", "jp-review-title", book.length ? `錯題本 ${book.length} 項` : "錯題本仲係空的"));
    book.slice(0, 6).forEach((row) => {
      review.append(el("p", "jp-review-row", `${row.kana} ${row.romaji}`));
    });
    page.append(header("JP 日文特訓"), back, note, teach, list, reviewBtn, review);
    root.append(page);
  };

  const paintTeach = () => {
    clearTimer();
    hush();
    stopBgm();
    root.replaceChildren();
    const page = el("div", "arcade-page jp-page");
    const back = el("button", "arcade-text-btn", "← 返回關卡");
    back.type = "button";
    back.addEventListener("click", paintLevels);
    const scroller = el("div", "jp-teach");
    scroller.append(el("h3", "jp-teach-h", "五十音 あ～ん"));
    scroller.append(el("p", "jp-teach-p", "清音按行排。每一格上面係假名，下面係羅馬字。撳一格先讀出嗰個音；靜音就唔出聲。測驗唔會自動讀。"));
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
    scroller.append(el("p", "jp-teach-p", "羅馬字用拉丁字母寫讀音：清音一音一組，濁音換聲母，半濁音用 p，拗音把 i 收成 y。Lv.1 至 Lv.3 會考假名同羅馬字互換。Lv.4 選項只顯示日文或中文，唔會有羅馬字。答錯之後先顯示讀音，亦可以撳聽正解。"));
    page.append(header("基本教學"), back, scroller);
    root.append(page);
  };

  const paintRound = (level, preset) => {
    stopBgm();
    hush();
    const questions = preset || (level.mode === "vocab" ? makeVocabRound() : makeKanaRound(level.pool));
    let index = 0;
    let correct = 0;

    const advance = () => {
      clearTimer();
      hush();
      index += 1;
      if (index < questions.length) paintQuestion();
      else paintResult();
    };

    const paintQuestion = () => {
      clearTimer();
      const q = questions[index];
      let locked = false;
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
      const reveal = el("div", "jp-reveal");
      const actions = el("div", "jp-actions");
      const answer = (choice) => {
        if (locked) return;
        locked = true;
        const hit = choice === q.answer;
        buttons.forEach((btn) => {
          btn.disabled = true;
          if (btn.textContent === q.answer) btn.classList.add("is-ok");
          else if (btn.textContent === choice) btn.classList.add("is-ng");
        });
        if (hit) {
          correct += 1;
          status.textContent = "啱";
          playSfx("ok");
          forgetWrong(q.kana);
          timer = window.setTimeout(advance, ADVANCE_MS);
          return;
        }
        rememberWrong(q.kana, q.romaji);
        playSfx("ng");
        status.textContent = q.vocab ? `唔啱 · ${q.answer}` : `唔啱 · ${q.kana} ${q.romaji}`;
        if (q.vocab && q.reading) reveal.append(el("p", "jp-reading", q.reading));
        const hear = el("button", "arcade-text-btn jp-hear", "聽正解");
        hear.type = "button";
        hear.addEventListener("click", () => speakJa(q.speak));
        const next = el("button", "jp-level jp-next", "下一題");
        next.type = "button";
        next.addEventListener("click", advance);
        actions.append(hear, next);
      };
      const buttons = q.choices.map((choice) => {
        const btn = el("button", "jp-choice", choice);
        btn.type = "button";
        if (q.vocab) btn.dataset.noReading = LATIN.test(choice) ? "fail" : "ok";
        btn.addEventListener("click", () => answer(choice));
        choices.append(btn);
        return btn;
      });
      const quit = el("button", "arcade-text-btn", "← 返回關卡");
      quit.type = "button";
      quit.addEventListener("click", paintLevels);
      page.append(header(level.title), meta, prompt, choices, status, reveal, actions, quit);
      root.append(page);
    };

    const paintResult = () => {
      clearTimer();
      hush();
      stopBgm();
      root.replaceChildren();
      const page = el("div", "arcade-page jp-page");
      page.append(el("h2", "jp-prompt", `${correct} / ${questions.length}`));
      page.append(el("p", "muted arcade-intro", "呢輪完。答啱嘅會喺錯題本刪走。"));
      const again = el("button", "jp-level", level.review ? "再重溫一次" : `再練一輪 ${level.title}`);
      again.type = "button";
      again.addEventListener("click", () => {
        if (!level.review) {
          paintRound(level);
          return;
        }
        const next = makeReviewRound();
        if (!next.length) paintLevels();
        else paintRound(level, next);
      });
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
