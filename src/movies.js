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

const LISTS = [
  { id: "now", label: "即日/預售" },
  { id: "coming", label: "不日上映" },
  { id: "special", label: "特備節目" },
];

const PAGE_SIZE = 30;

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

/** https chain hosts only. Unknown chains may use officialUrl when that host is listed. */
function safeBuyUrl(cinema) {
  const chainUrl = CHAIN_URL[cinema?.chain];
  if (chainUrl && isListedOfficialHost(chainUrl)) return chainUrl;
  const own = String(cinema?.officialUrl || "").trim();
  if (!own || !isListedOfficialHost(own)) return "";
  try {
    const u = new URL(own);
    if (u.protocol !== "https:" || u.username || u.password) return "";
    return u.href;
  } catch {
    return "";
  }
}

function safePosterUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password) return "";
    return u.href;
  } catch {
    return "";
  }
}

function hktToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong" }).format(now);
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function addHktDays(date, days) {
  const next = new Date(`${date}T04:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function weekdayMark(date) {
  const next = new Date(`${date}T04:00:00Z`);
  return WEEKDAYS[next.getUTCDay()] || "";
}

function dateChipLabel(date, count, today) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ""));
  if (!parts) return "";
  const tail = `${Number(parts[2])}/${Number(parts[3])} (${weekdayMark(date)}) · ${count}場`;
  if (date === today) return `今日 ${tail}`;
  if (date === addHktDays(today, 1)) return `聽日 ${tail}`;
  return tail;
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

/** 00:00–04:59 belongs to the business night, so it sorts after the evening shows. */
function businessMinutes(hhmm) {
  const mins = timeToMinutes(hhmm);
  if (mins == null) return null;
  if (mins < 300) return mins + 1440;
  return mins;
}

function seatText(show) {
  const remaining = Number(show?.remaining);
  const total = Number(show?.totalSeats);
  if (Number.isFinite(remaining)) {
    if (remaining === 0) return "🔴 滿座";
    const share = Number.isFinite(total) && total > 0 ? remaining / total : null;
    let band = show?.seat;
    if (share != null) {
      if (share <= 0.1) band = "few";
      else if (share <= 0.3) band = "low";
      else band = "ok";
    }
    if (band === "few") return `🟠 僅餘 ${remaining} 位`;
    if (band === "low") return `🟡 剩 ${remaining} 位`;
    return `🟢 剩 ${remaining} 位`;
  }
  if (show?.seat === "soldout") return "🔴 滿座";
  if (show?.seat === "low" || show?.seat === "few") return "🟡 尚餘少量";
  if (show?.seat === "ok") return "🟢 充足";
  return "";
}

function listOf(movie) {
  if (movie?.list === "coming" || movie?.list === "special") return movie.list;
  return "now";
}

function scoreOf(movie) {
  if (movie?.score == null || movie.score === "") return null;
  const n = Number(movie.score);
  if (!Number.isFinite(n) || n < 0 || n > 10) return null;
  return n;
}

function countOf(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

function houseLabel(house) {
  const text = String(house || "").trim();
  if (!text) return "";
  const numbered = /^(?:house|院)\s*(\d+)$/i.exec(text) || /^(\d+)\s*院$/.exec(text);
  if (numbered) return `${numbered[1]}院`;
  return text;
}

function datePrefix(date, today) {
  if (!date || date === today) return "";
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!parts) return "";
  return `${Number(parts[2])}/${Number(parts[3])} `;
}

function pillLabel(show, today) {
  const bits = [`${datePrefix(show.date, today)}${show.time || ""}`.trim()];
  const house = houseLabel(show.house);
  if (house) bits.push(house);
  if (show.format) bits.push(String(show.format));
  const price = Number(show.price);
  if (Number.isFinite(price) && price > 0) bits.push(`$${Math.round(price)}`);
  const seats = seatText(show);
  if (seats) bits.push(seats);
  return bits.filter(Boolean).join(" · ");
}

function buyLink(url) {
  if (!url) return "";
  const href = escapeHtml(url);
  return `<a class="movies-buy" href="${href}" target="_blank" rel="noopener noreferrer">去戲院官網</a>`;
}

function timePill(show, url, today) {
  const label = escapeHtml(pillLabel(show, today));
  const sold = Number(show?.remaining) === 0 || show?.seat === "soldout" ? " is-soldout" : "";
  if (!url) return `<span class="movies-time is-plain${sold}">${label}</span>`;
  return `<a class="movies-time${sold}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

/** Deep link only when this show has its own https booking URL. No cinema-site fallback. */
function safeShowUrl(show) {
  const raw = String(show?.bookingUrl || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol === "https:" && !url.username && !url.password && isListedOfficialHost(raw)) return url.href;
  } catch {
    return "";
  }
  return "";
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

function badgeText(cinema) {
  const region = REGION_LABEL[cinema.region] || "";
  const chain = CHAIN_LABEL[cinema.chain] || "";
  return [region, chain].filter(Boolean).join(" · ");
}

function starsHtml(score) {
  const filled = score == null ? 0 : Math.max(0, Math.min(5, Math.round(score / 2)));
  const marks = [0, 1, 2, 3, 4]
    .map((i) => `<span class="${i < filled ? "is-on" : ""}">★</span>`)
    .join("");
  return `<span class="movies-stars" aria-hidden="true">${marks}</span>`;
}

function scoreRow(movie, hideScore) {
  if (hideScore) return "";
  const score = scoreOf(movie);
  const num = score == null ? "--" : score.toFixed(1);
  return `<span class="movies-score-num${score == null ? " is-empty" : ""}">${escapeHtml(num)}</span>${starsHtml(score)}`;
}

function fallbackHtml(title, rating) {
  return `<div class="movies-fallback"><span class="movies-fallback-title">${escapeHtml(title)}</span>${
    rating ? `<span class="movies-rating">${escapeHtml(rating)}</span>` : ""
  }</div>`;
}

function posterHtml(movie) {
  const title = String(movie.title || "");
  const rating = String(movie.rating || "");
  const url = safePosterUrl(movie.posterUrl);
  if (!url) return `<div class="movies-poster">${fallbackHtml(title, rating)}</div>`;
  return `<div class="movies-poster"><img class="movies-poster-img" src="${escapeHtml(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-title="${escapeHtml(title)}" data-rating="${escapeHtml(rating)}"></div>`;
}

export function createMovies(root, { onStatus } = {}) {
  const state = {
    mode: "movie",
    list: "now",
    view: "grid",
    region: "all",
    chain: "all",
    sort: "region",
    hidePast: true,
    searchOpen: false,
    query: "",
    movieId: "",
    cinemaId: "",
    showRest: false,
    shown: PAGE_SIZE,
    selectedDate: "",
  };
  let payload = null;
  let loadError = "";
  let started = false;
  let listObserver = null;

  const isHkCinema = (cinema) => {
    const name = String(cinema?.name || "");
    if (name.includes("澳門") || name.includes("葡京")) return false;
    return cinema?.region === "kln" || cinema?.region === "nt" || cinema?.region === "hki";
  };

  const cinemas = () => (Array.isArray(payload?.cinemas) ? payload.cinemas.filter(isHkCinema) : []);
  const movies = () => {
    const rows = Array.isArray(payload?.movies) ? payload.movies : [];
    const allowed = new Set(cinemas().map((cinema) => cinema.id));
    for (const movie of rows) {
      if (movie._hkShows) continue;
      movie.showtimes = (movie.showtimes || []).filter((show) => allowed.has(show.cinemaId));
      movie._hkShows = true;
    }
    return rows;
  };

  const cinemaPasses = (cinema) => {
    if (!cinema) return false;
    if (state.region !== "all" && cinema.region !== state.region) return false;
    if (state.chain !== "all" && cinema.chain !== state.chain) return false;
    return true;
  };

  const showVisible = (show, { todayOnly }) => {
    const today = hktToday();
    const date = show?.date || today;
    if (date < today) return false;
    if (todayOnly && date !== today) return false;
    if (!state.hidePast || date !== today) return true;
    const mins = businessMinutes(show.time);
    if (mins == null) return false;
    return mins >= hktNowMinutes();
  };

  /** Clock filter only for the selected day when that day is today. */
  const showOnDate = (show, date) => {
    const today = hktToday();
    const showDate = String(show?.date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(showDate) || showDate < today) return false;
    if (date && showDate !== date) return false;
    if (!state.hidePast || showDate !== today || (date && date !== today)) return true;
    const mins = businessMinutes(show.time);
    if (mins == null) return false;
    return mins >= hktNowMinutes();
  };

  const showsFor = (movie, cinemaId, date) =>
    (movie.showtimes || [])
      .filter((show) => show.cinemaId === cinemaId && showOnDate(show, date))
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || String(a.time).localeCompare(String(b.time)));

  /**
   * Calendar today, unless the file has no show on that date.
   * After midnight, before the next refresh, this is the earliest later date.
   */
  const activeScheduleDate = () => {
    const today = hktToday();
    let earliest = "";
    for (const movie of movies()) {
      for (const show of movie.showtimes || []) {
        const date = String(show?.date || "");
        if (date === today) return today;
        if (date > today && (!earliest || date < earliest)) earliest = date;
      }
    }
    return earliest || today;
  };

  const query = () => state.query.trim().toLowerCase();

  const cinemaCount = (movie) => {
    const ids = new Set();
    for (const show of movie.showtimes || []) {
      if (!showVisible(show, { todayOnly: false })) continue;
      if (show.cinemaId) ids.add(show.cinemaId);
    }
    return ids.size;
  };

  const scoresAreFallback = () => {
    const rows = movies();
    if (!rows.length) return false;
    const scores = rows.map((movie) => scoreOf(movie));
    if (scores.some((score) => score == null)) return false;
    return scores.every((score) => score === scores[0]);
  };

  const metaHtml = (movie) => {
    if (scoresAreFallback()) {
      const stats = todayStats(movie);
      if (stats.shows === 0 && presaleCount(movie) > 0) {
        return escapeHtml(`📅 預售 · 共 ${presaleCount(movie)} 場`);
      }
      const today = hktToday();
      const day = activeScheduleDate();
      const when = day === today ? "今日" : `${Number(day.slice(5, 7))}/${Number(day.slice(8))}`;
      return escapeHtml(`🎬 ${stats.cinemas}間上映 · ${when} ${stats.shows}場`);
    }
    const likes = countOf(movie.likeCount);
    const comments = countOf(movie.commentCount);
    if (likes != null || comments != null) {
      const bits = [];
      if (likes != null) bits.push(`👍 ${likes}`);
      if (comments != null) bits.push(`💬 ${comments}`);
      return escapeHtml(bits.join("  "));
    }
    return `🎬 ${escapeHtml(cinemaCount(movie))}間上映`;
  };

  const todayStats = (movie) => {
    const today = activeScheduleDate();
    const ids = new Set();
    let shows = 0;
    for (const show of movie.showtimes || []) {
      const date = show.date || "";
      if (date !== today) continue;
      shows += 1;
      if (show.cinemaId) ids.add(show.cinemaId);
    }
    const rating = scoreOf(movie);
    return { cinemas: ids.size, shows, rating: rating == null ? -1 : rating };
  };

  const presaleCount = (movie) => {
    const day = activeScheduleDate();
    let total = 0;
    for (const show of movie.showtimes || []) {
      if (String(show.date || "") > day) total += 1;
    }
    return total;
  };

  const markHot = () => {
    const ranked = movies()
      .filter((movie) => listOf(movie) === "now")
      .map((movie) => ({ movie, ...todayStats(movie) }))
      .filter((row) => row.shows > 0)
      .sort((a, b) => b.shows - a.shows || b.cinemas - a.cinemas || b.rating - a.rating);
    const hot = new Set(ranked.slice(0, 6).map((row) => row.movie.id));
    for (const movie of movies()) {
      if (listOf(movie) !== "now") continue;
      movie.hot = hot.has(movie.id);
    }
  };

  const titleHtml = (movie) => {
    const hot = movie.hot === true ? "🔥 " : "";
    return `${hot}${escapeHtml(movie.title || "")}`;
  };

  const filmsForTab = () => {
    const q = query();
    const matched = movies().filter((movie) => {
      if (listOf(movie) !== state.list) return false;
      if (!q) return true;
      return String(movie.title || "").toLowerCase().includes(q);
    });
    if (state.list !== "now") return matched;
    return matched.slice().sort((a, b) => {
      const sa = todayStats(a);
      const sb = todayStats(b);
      const aZero = sa.cinemas === 0 ? 1 : 0;
      const bZero = sb.cinemas === 0 ? 1 : 0;
      if (aZero !== bZero) return aZero - bZero;
      return sb.cinemas - sa.cinemas || sb.shows - sa.shows || sb.rating - sa.rating;
    });
  };

  const cinemasForFilm = (movie) => {
    const q = query();
    const titleHit = Boolean(q) && String(movie.title || "").toLowerCase().includes(q);
    return cinemas()
      .filter((cinema) => {
        if (!cinemaPasses(cinema) || !showsFor(movie, cinema.id, state.selectedDate).length) return false;
        if (!q || titleHit) return true;
        return String(cinema.name || "").toLowerCase().includes(q);
      })
      .sort((a, b) => cmpCinema(a, b, state.sort));
  };

  const cinemaRows = () => {
    const q = query();
    const todayFilms = movies().filter((movie) => listOf(movie) !== "coming");
    return cinemas()
      .filter((cinema) => cinemaPasses(cinema))
      .map((cinema) => {
        const titles = todayFilms
          .filter((movie) => {
            if (!showsFor(movie, cinema.id, state.selectedDate).length) return false;
            if (!q) return true;
            return (
              String(movie.title || "").toLowerCase().includes(q) ||
              String(cinema.name || "").toLowerCase().includes(q)
            );
          })
          .sort((a, b) => String(a.title).localeCompare(String(b.title), "zh-Hant"));
        return { cinema, titles };
      })
      .filter((row) => {
        const listed = movies().some((movie) => (movie.showtimes || []).some((show) => show.cinemaId === row.cinema.id));
        if (listed && !row.titles.length) return false;
        const q = query();
        if (!q) return true;
        return (
          String(row.cinema.name || "").toLowerCase().includes(q) ||
          row.titles.some((movie) => String(movie.title || "").toLowerCase().includes(q))
        );
      })
      .sort((a, b) => cmpCinema(a.cinema, b.cinema, state.sort));
  };

  const chip = (kind, id, label, pressed) =>
    `<button type="button" class="movies-chip" data-filter="${kind}" data-value="${escapeHtml(id)}" aria-pressed="${pressed ? "true" : "false"}">${escapeHtml(label)}</button>`;

  const dateRowsFrom = (shows) => {
    const today = hktToday();
    const map = new Map();
    for (const show of shows) {
      const date = String(show?.date || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) continue;
      const row = map.get(date) || { date, count: 0, remaining: 0 };
      row.count += 1;
      if (showOnDate(show, date)) row.remaining += 1;
      map.set(date, row);
    }
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  };

  const useScheduleDate = (rows) => {
    const today = hktToday();
    if (!(state.selectedDate && rows.some((row) => row.date === state.selectedDate))) {
      const next = rows.find((row) => row.remaining > 0) || rows[0];
      state.selectedDate = next?.date || today;
    }
    return state.selectedDate;
  };

  const datePillsHtml = (rows) => {
    if (!rows.length) return "";
    const today = hktToday();
    const selected = useScheduleDate(rows);
    return `<div class="movies-pills movies-dates" role="group" aria-label="日期">${rows
      .map(
        (row) =>
          `<button type="button" class="movies-chip" data-show-date="${escapeHtml(row.date)}" aria-pressed="${row.date === selected ? "true" : "false"}">${escapeHtml(dateChipLabel(row.date, row.count, today))}</button>`
      )
      .join("")}</div>`;
  };

  const showsForMovieScope = (movie) => {
    const q = query();
    const titleHit = Boolean(q) && String(movie.title || "").toLowerCase().includes(q);
    const out = [];
    for (const show of movie.showtimes || []) {
      const cinema = cinemas().find((item) => item.id === show.cinemaId);
      if (!cinema || !cinemaPasses(cinema)) continue;
      if (q && !titleHit && !String(cinema.name || "").toLowerCase().includes(q)) continue;
      out.push(show);
    }
    return out;
  };

  const showsForCinemaPage = () => {
    const q = query();
    const out = [];
    for (const movie of movies()) {
      if (listOf(movie) === "coming") continue;
      const titleHit = Boolean(q) && String(movie.title || "").toLowerCase().includes(q);
      for (const show of movie.showtimes || []) {
        const cinema = cinemas().find((item) => item.id === show.cinemaId);
        if (!cinema || !cinemaPasses(cinema)) continue;
        if (q && !titleHit && !String(cinema.name || "").toLowerCase().includes(q)) continue;
        out.push(show);
      }
    }
    return out;
  };

  const shell = () => `
    <div class="movies-page">
      <div class="movies-top">
        <div class="movies-modes" role="group" aria-label="睇法">
          <button type="button" class="movies-mode" data-mode="movie" aria-pressed="${state.mode === "movie" ? "true" : "false"}">電影</button>
          <button type="button" class="movies-mode" data-mode="cinema" aria-pressed="${state.mode === "cinema" ? "true" : "false"}">戲院資訊</button>
        </div>
        <div class="movies-tools">
          <button type="button" class="movies-tool" data-search-toggle aria-pressed="${state.searchOpen ? "true" : "false"}" aria-label="搜尋">🔍</button>
          <button type="button" class="movies-tool" data-view-toggle aria-pressed="${state.view === "list" ? "true" : "false"}" aria-label="${state.view === "list" ? "海報" : "列表"}">${state.view === "list" ? "▦" : "☰"}</button>
        </div>
      </div>
      <div id="movies-search" class="movies-search-panel" ${state.searchOpen ? "" : "hidden"}>
        <input id="movies-q" class="movies-search" type="search" inputmode="search" placeholder="關鍵字" value="${escapeHtml(state.query)}" autocomplete="off" enterkeyhint="search" />
        <button type="button" class="movies-hide" data-hide-past aria-pressed="${state.hidePast ? "true" : "false"}">隱藏已開場次</button>
      </div>
      <div id="movies-tabs" class="movies-tabs" role="tablist" aria-label="上映"></div>
      <div id="movies-results"></div>
    </div>
  `;

  const filtersHtml = () => `
    <div class="movies-filters">
      <div class="movies-pills" role="group" aria-label="地區">
        ${REGIONS.map((r) => chip("region", r.id, r.label, state.region === r.id)).join("")}
      </div>
      <div class="movies-filter-row">
        <label class="movies-sort">排序
          <select id="movies-sort" aria-label="排序">
            <option value="region" ${state.sort === "region" ? "selected" : ""}>地區</option>
            <option value="chain" ${state.sort === "chain" ? "selected" : ""}>院線</option>
            <option value="name" ${state.sort === "name" ? "selected" : ""}>名稱</option>
          </select>
        </label>
        <button type="button" class="movies-hide" data-hide-past aria-pressed="${state.hidePast ? "true" : "false"}">隱藏已開場次</button>
      </div>
    </div>
  `;

  const filmCell = (movie) => `
    <button type="button" class="movies-cell" data-open-movie="${escapeHtml(movie.id)}">
      ${posterHtml(movie)}
      <span class="movies-cell-title">${titleHtml(movie)}</span>
      <span class="movies-cell-score">${scoreRow(movie, scoresAreFallback())}</span>
      <span class="movies-cell-meta">${metaHtml(movie)}</span>
    </button>
  `;

  const filmListRow = (movie) => `
    <button type="button" class="movies-row" data-open-movie="${escapeHtml(movie.id)}">
      ${posterHtml(movie)}
      <span class="movies-row-copy">
        <span class="movies-cell-title">${titleHtml(movie)}</span>
        <span class="movies-cell-score">${scoreRow(movie, scoresAreFallback())}</span>
        <span class="movies-cell-meta">${metaHtml(movie)}</span>
      </span>
    </button>
  `;

  const cinemaCard = (cinema, movie) => {
    const url = safeBuyUrl(cinema);
    const shows = showsFor(movie, cinema.id, state.selectedDate);
    const where = badgeText(cinema);
    return `
      <article class="movies-card">
        <h3 class="movies-cinema-name">${escapeHtml(cinema.name)}</h3>
        ${where ? `<p class="movies-where">${escapeHtml(where)}</p>` : ""}
        ${buyLink(url)}
        <div class="movies-show-block">
          ${shows.map((show) => timePill(show, safeShowUrl(show), state.selectedDate)).join("")}
        </div>
      </article>
    `;
  };

  const drillHtml = (movie) => {
    const runtime = Number(movie.runtime) > 0 ? `<span class="movies-runtime">${escapeHtml(movie.runtime)} 分鐘</span>` : "";
    const rating = movie.rating ? `<span class="movies-rating">${escapeHtml(movie.rating)}</span>` : "";
    const dateRows = dateRowsFrom(showsForMovieScope(movie));
    useScheduleDate(dateRows);
    const rows = cinemasForFilm(movie);
    const cards = rows.map((cinema) => cinemaCard(cinema, movie)).join("");
    return `
      <button type="button" class="movies-back" data-back>← 返回電影列表</button>
      <div class="movies-drill-head">
        ${posterHtml(movie)}
        <div class="movies-drill-copy">
          <h3 class="movies-drill-title">${titleHtml(movie)}</h3>
          <div class="movies-drill-meta">${rating}${runtime}</div>
          <div class="movies-cell-score">${scoreRow(movie, scoresAreFallback())}</div>
        </div>
      </div>
      ${datePillsHtml(dateRows)}
      ${filtersHtml()}
      ${cards || `<p class="movies-empty muted">冇符合條件嘅場次</p>`}
    `;
  };

  const resultsHtml = () => {
    if (loadError && !payload) return `<p class="error">${escapeHtml(loadError)}</p>`;
    if (!payload) return `<p class="muted">載入場次…</p>`;
    markHot();
    const note = payload.sample
      ? `<p class="movies-sample">${escapeHtml(payload.note || "示範場次。即時抓取空白或失敗時用呢份資料。")}</p>`
      : "";

    if (state.mode === "cinema") {
      const dateRows = dateRowsFrom(showsForCinemaPage());
      useScheduleDate(dateRows);
      const rows = cinemaRows();
      const body = rows
        .map((row) => {
          const open = row.cinema.id === state.cinemaId;
          const url = safeBuyUrl(row.cinema);
          const where = badgeText(row.cinema);
          const detail = open
            ? `<div class="movies-expand">
                ${where ? `<p class="movies-where">${escapeHtml(where)}</p>` : ""}
                ${buyLink(url)}
                ${row.titles
                  .map((movie) => {
                    const shows = showsFor(movie, row.cinema.id, state.selectedDate);
                    return `<div class="movies-block">
                      <h4>${escapeHtml(movie.title)}</h4>
                      <div class="movies-show-block">${shows.map((show) => timePill(show, safeShowUrl(show), state.selectedDate)).join("")}</div>
                    </div>`;
                  })
                  .join("")}
              </div>`
            : "";
          return `<article class="movies-card movies-cinema-item">
            <button type="button" class="movies-cinema-toggle" data-pick-cinema="${escapeHtml(row.cinema.id)}" aria-expanded="${open ? "true" : "false"}">
              <span class="movies-cinema-name">${escapeHtml(row.cinema.name)}</span>
              ${where ? `<span class="movies-where">${escapeHtml(where)}</span>` : ""}
            </button>
            ${detail}
          </article>`;
        })
        .join("");
      return `${note}${datePillsHtml(dateRows)}${filtersHtml()}${body || `<p class="movies-empty muted">冇符合條件嘅戲院</p>`}`;
    }

    if (state.movieId) {
      const movie = movies().find((item) => item.id === state.movieId);
      if (!movie) return `${note}<button type="button" class="movies-back" data-back>← 返回電影列表</button><p class="movies-empty muted">搵唔到呢套戲</p>`;
      return `${note}${drillHtml(movie)}`;
    }

    return note;
  };

  const filmPools = () => {
    const rows = filmsForTab();
    if (state.list !== "now") return { live: rows, rest: [] };
    const live = [];
    const rest = [];
    for (const movie of rows) {
      if (todayStats(movie).shows === 0 && presaleCount(movie) === 0) rest.push(movie);
      else live.push(movie);
    }
    return { live, rest };
  };

  const appendFilmNodes = (grid, films) => {
    const frag = document.createDocumentFragment();
    for (const movie of films) {
      const holder = document.createElement("div");
      holder.innerHTML = state.view === "list" ? filmListRow(movie) : filmCell(movie);
      if (holder.firstElementChild) frag.append(holder.firstElementChild);
    }
    grid.append(frag);
  };

  const disconnectList = () => {
    listObserver?.disconnect();
    listObserver = null;
  };

  const paintFilmGrid = () => {
    disconnectList();
    state.shown = PAGE_SIZE;
    const box = root.querySelector("#movies-results");
    if (!box) return;
    const { live, rest } = filmPools();
    const pool = () => live;
    box.replaceChildren();
    if (payload?.sample) {
      const sample = document.createElement("p");
      sample.className = "movies-sample";
      sample.textContent = payload.note || "示範場次。即時抓取空白或失敗時用呢份資料。";
      box.append(sample);
    }
    const grid = document.createElement("div");
    grid.className = state.view === "list" ? "movies-list" : "movies-grid";
    grid.id = "movies-film-grid";
    const first = pool().slice(0, PAGE_SIZE);
    appendFilmNodes(grid, first);
    state.shown = first.length;
    box.append(grid);
    if (!pool().length) {
      const empty = document.createElement("p");
      empty.className = "movies-empty muted";
      empty.textContent = "呢個分類暫時冇電影";
      box.append(empty);
    }
    const more = document.createElement("div");
    more.className = "movies-more";
    const sentinel = document.createElement("div");
    sentinel.className = "movies-sentinel";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "movies-more-btn";
    btn.textContent = "載入更多 (+30)";
    more.append(sentinel, btn);
    box.append(more);
    const updateMore = () => {
      const done = state.shown >= pool().length;
      btn.hidden = done;
      sentinel.hidden = done;
    };
    const loadMore = () => {
      const rows = pool();
      if (state.shown >= rows.length) {
        updateMore();
        return;
      }
      const next = rows.slice(state.shown, state.shown + PAGE_SIZE);
      appendFilmNodes(grid, next);
      state.shown += next.length;
      updateMore();
    };
    btn.addEventListener("click", loadMore);
    updateMore();
    if (state.shown < pool().length) {
      listObserver = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      }, { rootMargin: "240px" });
      listObserver.observe(sentinel);
    }
    if (state.list === "now" && rest.length) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "movies-rest";
      toggle.dataset.showRest = "1";
      toggle.setAttribute("aria-pressed", state.showRest ? "true" : "false");
      toggle.textContent = `顯示其餘 ${rest.length} 套無今日場次電影`;
      box.append(toggle);
      if (state.showRest) {
        const restGrid = document.createElement("div");
        restGrid.className = grid.className;
        let restShown = 0;
        const appendRest = () => {
          const next = rest.slice(restShown, restShown + PAGE_SIZE);
          appendFilmNodes(restGrid, next);
          restShown += next.length;
          restBtn.hidden = restShown >= rest.length;
        };
        const restBtn = document.createElement("button");
        restBtn.type = "button";
        restBtn.className = "movies-more-btn";
        restBtn.textContent = "載入更多 (+30)";
        restBtn.addEventListener("click", appendRest);
        appendRest();
        box.append(restGrid, restBtn);
      }
    }
  };

  const paintTabs = () => {
    const box = root.querySelector("#movies-tabs");
    if (!box) return;
    const show = state.mode === "movie" && !state.movieId;
    box.hidden = !show;
    if (!show) {
      box.innerHTML = "";
      return;
    }
    box.innerHTML = LISTS.map(
      (tab) =>
        `<button type="button" class="movies-tab" role="tab" data-list="${escapeHtml(tab.id)}" aria-selected="${state.list === tab.id ? "true" : "false"}">${escapeHtml(tab.label)}</button>`
    ).join("");
  };

  const paintResults = () => {
    const box = root.querySelector("#movies-results");
    const filmGrid = state.mode === "movie" && !state.movieId && payload && !loadError;
    if (filmGrid) paintFilmGrid();
    else if (box) {
      disconnectList();
      box.innerHTML = resultsHtml();
    }
    paintTabs();
    syncPressed();
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
    root.querySelectorAll("[data-hide-past]").forEach((btn) => {
      btn.setAttribute("aria-pressed", state.hidePast ? "true" : "false");
    });
    const search = root.querySelector("[data-search-toggle]");
    if (search) search.setAttribute("aria-pressed", state.searchOpen ? "true" : "false");
    const view = root.querySelector("[data-view-toggle]");
    if (view) {
      const list = state.view === "list";
      view.setAttribute("aria-pressed", list ? "true" : "false");
      view.setAttribute("aria-label", list ? "海報" : "列表");
      view.textContent = list ? "▦" : "☰";
      view.hidden = state.mode !== "movie" || Boolean(state.movieId);
    }
    const panel = root.querySelector("#movies-search");
    if (panel) panel.hidden = !state.searchOpen;
    root.querySelectorAll("#movies-sort").forEach((sort) => {
      if (sort.value !== state.sort) sort.value = state.sort;
    });
  };

  root.addEventListener(
    "error",
    (event) => {
      const img = event.target;
      if (!(img instanceof Element) || img.tagName !== "IMG" || !img.classList.contains("movies-poster-img")) return;
      const box = img.parentElement;
      if (!box) return;
      const title = img.getAttribute("data-title") || "";
      const rating = img.getAttribute("data-rating") || "";
      const fallback = document.createElement("div");
      fallback.className = "movies-fallback";
      const name = document.createElement("span");
      name.className = "movies-fallback-title";
      name.textContent = title;
      fallback.append(name);
      if (rating) {
        const badge = document.createElement("span");
        badge.className = "movies-rating";
        badge.textContent = rating;
        fallback.append(badge);
      }
      box.replaceChildren(fallback);
    },
    true
  );

  root.addEventListener("click", (e) => {
    const modeBtn = e.target.closest("[data-mode]");
    if (modeBtn && root.contains(modeBtn)) {
      state.mode = modeBtn.dataset.mode === "cinema" ? "cinema" : "movie";
      state.movieId = "";
      state.cinemaId = "";
      paintResults();
      return;
    }
    if (e.target.closest("[data-search-toggle]")) {
      state.searchOpen = !state.searchOpen;
      syncPressed();
      if (state.searchOpen) root.querySelector("#movies-q")?.focus();
      return;
    }
    if (e.target.closest("[data-view-toggle]")) {
      state.view = state.view === "list" ? "grid" : "list";
      paintResults();
      return;
    }
    const tab = e.target.closest("[data-list]");
    if (tab && root.contains(tab)) {
      state.list = LISTS.some((item) => item.id === tab.dataset.list) ? tab.dataset.list : "now";
      state.movieId = "";
      state.showRest = false;
      paintResults();
      return;
    }
    if (e.target.closest("[data-show-rest]")) {
      state.showRest = !state.showRest;
      paintResults();
      return;
    }
    const dateBtn = e.target.closest("[data-show-date]");
    if (dateBtn && root.contains(dateBtn)) {
      state.selectedDate = dateBtn.dataset.showDate || "";
      paintResults();
      return;
    }
    if (e.target.closest("[data-back]")) {
      state.movieId = "";
      paintResults();
      return;
    }
    const openMovie = e.target.closest("[data-open-movie]");
    if (openMovie && root.contains(openMovie)) {
      state.movieId = openMovie.dataset.openMovie || "";
      paintResults();
      return;
    }
    const cinemaBtn = e.target.closest("[data-pick-cinema]");
    if (cinemaBtn && root.contains(cinemaBtn)) {
      const id = cinemaBtn.dataset.pickCinema || "";
      state.cinemaId = state.cinemaId === id ? "" : id;
      paintResults();
      return;
    }
    const filterBtn = e.target.closest("[data-filter]");
    if (filterBtn && root.contains(filterBtn)) {
      if (filterBtn.dataset.filter === "region") state.region = filterBtn.dataset.value || "all";
      if (filterBtn.dataset.filter === "chain") state.chain = filterBtn.dataset.value || "all";
      paintResults();
      return;
    }
    if (e.target.closest("[data-hide-past]")) {
      state.hidePast = !state.hidePast;
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
