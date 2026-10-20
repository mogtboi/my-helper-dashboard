import { escapeHtml } from "./escapeHtml.js";

const REGIONS = [
  { id: "all", label: "全部" },
  { id: "kln", label: "九龍" },
  { id: "nt", label: "新界" },
  { id: "hki", label: "港島" },
];

const CHAINS = [
  { id: "all", label: "全部院線" },
  { id: "broadway", label: "百老匯" },
  { id: "mcl", label: "MCL" },
  { id: "emperor", label: "英皇" },
  { id: "goldenharvest", label: "嘉禾" },
  { id: "cinemacity", label: "Cinema City" },
  { id: "other", label: "其他" },
];

const CHAIN_LABEL = Object.fromEntries(CHAINS.filter((c) => c.id !== "all").map((c) => [c.id, c.label]));
const REGION_LABEL = Object.fromEntries(REGIONS.filter((r) => r.id !== "all").map((r) => [r.id, r.label]));

const REGION_ORDER = { kln: 0, nt: 1, hki: 2 };
const CHAIN_ORDER = { broadway: 0, mcl: 1, emperor: 2, goldenharvest: 3, cinemacity: 4, other: 5 };

/** Chain homepages. Unknown chains fall back to the cinema's own officialUrl. */
const CHAIN_URL = {
  broadway: "https://www.cinema.com.hk/",
  mcl: "https://www.mclcinema.com/",
  emperor: "https://www.emperorcinemas.com/",
  goldenharvest: "https://www.goldenharvest.com/",
  cinemacity: "https://www.cinemacity.com.hk/",
};

const OFFICIAL_HOSTS = [
  "cinema.com.hk",
  "mclcinema.com",
  "emperorcinemas.com",
  "goldenharvest.com",
  "cinemacity.com.hk",
];

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isListedOfficialHost(url) {
  const host = hostOf(url);
  return OFFICIAL_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

/** https only. Known chains always use the chain site, never a third-party ticker. */
function safeBuyUrl(cinema) {
  const chainUrl = CHAIN_URL[cinema?.chain];
  if (chainUrl && isListedOfficialHost(chainUrl)) return chainUrl;
  const own = String(cinema?.officialUrl || "").trim();
  if (!own) return "";
  try {
    const u = new URL(own);
    if (u.protocol !== "https:" || u.username || u.password) return "";
    return u.href;
  } catch {
    return "";
  }
}

function hktNowMinutes(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function timeToMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function pillLabel(show) {
  const bits = [];
  if (show.house) bits.push(String(show.house));
  if (show.format) bits.push(String(show.format));
  return bits.length ? `${show.time} (${bits.join(" · ")})` : String(show.time || "");
}

function buyLink(url) {
  if (!url) return "";
  const href = escapeHtml(url);
  return `<a class="movies-buy" href="${href}" target="_blank" rel="noopener noreferrer">🎟️ 戲院官網 / 即時買飛 ↗</a>`;
}

function timePill(show, url) {
  const label = escapeHtml(pillLabel(show));
  if (!url) return `<span class="movies-time is-plain">${label}</span>`;
  return `<a class="movies-time" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

function cmpCinema(a, b, sort) {
  const byName = () => String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant");
  if (sort === "name") return byName();
  if (sort === "chain") {
    const d = (CHAIN_ORDER[a.chain] ?? 9) - (CHAIN_ORDER[b.chain] ?? 9);
    return d || byName();
  }
  const d = (REGION_ORDER[a.region] ?? 9) - (REGION_ORDER[b.region] ?? 9);
  return d || byName();
}

export function createMovies(root, { onStatus } = {}) {
  const state = {
    mode: "movie",
    region: "all",
    chain: "all",
    sort: "region",
    hidePast: true,
    query: "",
  };
  let payload = null;
  let loadError = "";
  let started = false;

  const cinemas = () => (Array.isArray(payload?.cinemas) ? payload.cinemas : []);
  const movies = () => (Array.isArray(payload?.movies) ? payload.movies : []);

  const cinemaPasses = (cinema) => {
    if (!cinema) return false;
    if (state.region !== "all" && cinema.region !== state.region) return false;
    if (state.chain !== "all" && cinema.chain !== state.chain) return false;
    return true;
  };

  const showsFor = (movie, cinemaId) => {
    const nowMin = hktNowMinutes();
    return (movie.showtimes || []).filter((show) => {
      if (show.cinemaId !== cinemaId) return false;
      if (!state.hidePast) return true;
      const mins = timeToMinutes(show.time);
      if (mins == null) return false;
      return mins >= nowMin;
    });
  };

  const queryHit = (movie, cinema) => {
    const q = state.query.trim().toLowerCase();
    if (!q) return true;
    return (
      String(movie?.title || "").toLowerCase().includes(q) ||
      String(cinema?.name || "").toLowerCase().includes(q)
    );
  };

  const pairsForMovie = (movie) =>
    cinemas()
      .filter((cinema) => cinemaPasses(cinema) && queryHit(movie, cinema) && showsFor(movie, cinema.id).length)
      .sort((a, b) => cmpCinema(a, b, state.sort));

  const chip = (kind, id, label, pressed) =>
    `<button type="button" class="movies-chip" data-filter="${kind}" data-value="${escapeHtml(id)}" aria-pressed="${pressed ? "true" : "false"}">${escapeHtml(label)}</button>`;

  const shell = () => `
    <div class="movies-page">
      <div class="movies-modes" role="group" aria-label="睇法">
        <button type="button" class="movies-mode" data-mode="movie" aria-pressed="${state.mode === "movie" ? "true" : "false"}">🎬 按電影睇</button>
        <button type="button" class="movies-mode" data-mode="cinema" aria-pressed="${state.mode === "cinema" ? "true" : "false"}">🍿 按戲院睇</button>
      </div>
      <div class="movies-filters">
        <div class="movies-pills" role="group" aria-label="地區">
          ${REGIONS.map((r) => chip("region", r.id, r.label, state.region === r.id)).join("")}
        </div>
        <div class="movies-pills" role="group" aria-label="院線">
          ${CHAINS.map((c) => chip("chain", c.id, c.label, state.chain === c.id)).join("")}
        </div>
        <label class="movies-sort">排序
          <select id="movies-sort" aria-label="排序">
            <option value="region" ${state.sort === "region" ? "selected" : ""}>地區</option>
            <option value="chain" ${state.sort === "chain" ? "selected" : ""}>院線</option>
            <option value="name" ${state.sort === "name" ? "selected" : ""}>戲院名稱</option>
          </select>
        </label>
        <input id="movies-q" class="movies-search" type="search" inputmode="search" placeholder="🔍 搜尋戲名或戲院..." value="${escapeHtml(state.query)}" autocomplete="off" />
        <button type="button" class="movies-hide" data-hide-past aria-pressed="${state.hidePast ? "true" : "false"}">隱藏已開場次</button>
      </div>
      <div id="movies-results"></div>
    </div>
  `;

  const showBlock = (shows, url) => `
    <div class="movies-show-block">
      ${shows.map((show) => timePill(show, url)).join("")}
      ${buyLink(url)}
    </div>
  `;

  const movieHead = (movie) => `
    <div class="movies-title-row">
      <h3>${escapeHtml(movie.title)}</h3>
      ${movie.rating ? `<span class="movies-rating">${escapeHtml(movie.rating)}</span>` : ""}
      ${Number(movie.runtime) > 0 ? `<span class="movies-runtime">${escapeHtml(movie.runtime)} 分鐘</span>` : ""}
    </div>
  `;

  const cinemaHead = (cinema, url, asTitle) => `
    <div class="movies-cinema-head">
      ${asTitle ? `<h3 class="movies-cinema-name">${escapeHtml(cinema.name)}</h3>` : `<span class="movies-cinema-name">${escapeHtml(cinema.name)}</span>`}
      <span class="movies-meta">${escapeHtml(REGION_LABEL[cinema.region] || cinema.region || "")}${CHAIN_LABEL[cinema.chain] ? ` · ${escapeHtml(CHAIN_LABEL[cinema.chain])}` : ""}</span>
      ${buyLink(url)}
    </div>
  `;

  const resultsHtml = () => {
    if (loadError && !payload) return `<p class="error">${escapeHtml(loadError)}</p>`;
    if (!payload) return `<p class="muted">載入場次…</p>`;
    const note = payload.sample
      ? `<p class="movies-sample">${escapeHtml(payload.note || "示範場次。即時抓取空白或失敗時用呢份資料。")}</p>`
      : "";

    if (state.mode === "cinema") {
      const blocks = cinemas()
        .filter((cinema) => cinemaPasses(cinema))
        .sort((a, b) => cmpCinema(a, b, state.sort))
        .map((cinema) => {
          const url = safeBuyUrl(cinema);
          const titles = movies()
            .filter((movie) => queryHit(movie, cinema) && showsFor(movie, cinema.id).length)
            .sort((a, b) => String(a.title).localeCompare(String(b.title), "zh-Hant"));
          if (!titles.length) return "";
          return `
            <article class="movies-card">
              ${cinemaHead(cinema, url, true)}
              ${titles
                .map(
                  (movie) => `
                <div class="movies-block">
                  ${movieHead(movie)}
                  ${showBlock(showsFor(movie, cinema.id), url)}
                </div>`
                )
                .join("")}
            </article>`;
        })
        .filter(Boolean);
      return `${note}${blocks.join("") || `<p class="movies-empty muted">冇符合條件嘅場次</p>`}`;
    }

    const blocks = movies()
      .map((movie) => {
        const rows = pairsForMovie(movie);
        if (!rows.length) return "";
        return `
          <article class="movies-card">
            ${movieHead(movie)}
            ${rows
              .map((cinema) => {
                const url = safeBuyUrl(cinema);
                return `
              <div class="movies-block">
                ${cinemaHead(cinema, url, false)}
                ${showBlock(showsFor(movie, cinema.id), url)}
              </div>`;
              })
              .join("")}
          </article>`;
      })
      .filter(Boolean);
    return `${note}${blocks.join("") || `<p class="movies-empty muted">冇符合條件嘅場次</p>`}`;
  };

  const paintResults = () => {
    const box = root.querySelector("#movies-results");
    if (box) box.innerHTML = resultsHtml();
  };

  const syncPressed = () => {
    root.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.dataset.mode === state.mode ? "true" : "false");
    });
    root.querySelectorAll("[data-filter='region']").forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.dataset.value === state.region ? "true" : "false");
    });
    root.querySelectorAll("[data-filter='chain']").forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.dataset.value === state.chain ? "true" : "false");
    });
    const hide = root.querySelector("[data-hide-past]");
    if (hide) hide.setAttribute("aria-pressed", state.hidePast ? "true" : "false");
    const sort = root.querySelector("#movies-sort");
    if (sort && sort.value !== state.sort) sort.value = state.sort;
  };

  root.addEventListener("click", (e) => {
    const modeBtn = e.target.closest("[data-mode]");
    if (modeBtn) {
      state.mode = modeBtn.dataset.mode === "cinema" ? "cinema" : "movie";
      syncPressed();
      paintResults();
      return;
    }
    const filterBtn = e.target.closest("[data-filter]");
    if (filterBtn) {
      if (filterBtn.dataset.filter === "region") state.region = filterBtn.dataset.value || "all";
      if (filterBtn.dataset.filter === "chain") state.chain = filterBtn.dataset.value || "all";
      syncPressed();
      paintResults();
      return;
    }
    if (e.target.closest("[data-hide-past]")) {
      state.hidePast = !state.hidePast;
      syncPressed();
      paintResults();
    }
  });

  root.addEventListener("change", (e) => {
    if (e.target?.id !== "movies-sort") return;
    state.sort = e.target.value || "region";
    paintResults();
  });

  root.addEventListener("input", (e) => {
    if (e.target?.id !== "movies-q") return;
    state.query = e.target.value;
    paintResults();
  });

  const load = async () => {
    loadError = "";
    try {
      const res = await fetch("./data/movies.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json || !Array.isArray(json.cinemas) || !Array.isArray(json.movies)) {
        throw new Error("場次資料格式唔啱");
      }
      payload = json;
      onStatus?.(payload.sample ? "戲院場次（示範資料）" : "戲院場次已更新");
    } catch (err) {
      payload = null;
      loadError = `場次資料暫無：${err?.message || err}`;
      onStatus?.("戲院場次暫無");
    }
    if (!root.querySelector(".movies-page")) root.innerHTML = shell();
    paintResults();
  };

  return {
    start() {
      if (!root.querySelector(".movies-page")) root.innerHTML = shell();
      paintResults();
      if (!started) {
        started = true;
        load();
      }
    },
  };
}
