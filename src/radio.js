/**
 * Play RTHK HLS with the click that asked for it.
 * Chromium cannot play HLS from a raw m3u8 src. Bundled hls.js (Hls.isSupported)
 * loads the stream; Safari keeps native HLS. audio.play() runs in the click turn.
 */
import Hls from "hls.js";

export function createRadio(root, radioConfig) {
  const stations = radioConfig.stations;
  let activeId = stations[0]?.id;
  let playing = false;
  let hls = null;

  root.innerHTML = `
    <div class="radio-row" role="group" aria-label="電台頻道"></div>
    <button type="button" class="play-btn" data-playing="false" aria-pressed="false">播放</button>
    <p class="radio-status muted" aria-live="polite">撳播放先連線（唔會自動播）</p>
    <p class="radio-fallback"><a href="https://www.rthk.hk/radio" target="_blank" rel="noopener noreferrer">去港台網頁收聽</a></p>
    <audio id="radio-audio" preload="none" playsinline></audio>
  `;

  const stationRow = root.querySelector(".radio-row");
  const playBtn = root.querySelector(".play-btn");
  const status = root.querySelector(".radio-status");
  const audio = root.querySelector("#radio-audio");

  stationRow.innerHTML = stations
    .map(
      (s) => `
      <button type="button" class="station-btn" data-station="${s.id}"
        aria-pressed="${s.id === activeId}">${s.name}</button>`
    )
    .join("");

  const destroyHls = () => {
    if (hls) {
      hls.destroy();
      hls = null;
    }
  };

  const setPlaying = (next) => {
    playing = next;
    playBtn.dataset.playing = String(playing);
    playBtn.setAttribute("aria-pressed", String(playing));
    playBtn.textContent = playing ? "暫停" : "播放";
  };

  const currentStation = () => stations.find((s) => s.id === activeId);

  let playGen = 0;

  const markPlaying = (gen, station) => {
    if (gen !== playGen) return;
    setPlaying(true);
    status.classList.remove("error");
    status.textContent = `播放中 · ${station.name}`;
  };

  const hlsFatalText = (data) => {
    const type = data?.type || "unknown";
    const details = data?.details || "unknown";
    const code = data?.response?.code;
    const http = code ? ` HTTP ${code}` : "";
    return `播放失敗（hls.js ${type} / ${details}${http}）`;
  };

  const markPlayError = (gen, err) => {
    if (gen !== playGen) return;
    setPlaying(false);
    status.classList.add("error");
    if (String(status.textContent || "").includes("hls.js")) return;
    status.textContent =
      err?.name === "NotAllowedError"
        ? "播放失敗（要用戶手勢／檢查網絡）"
        : "播放失敗（檢查網絡或電台串流）";
  };

  const safariNative = () => {
    const ua = navigator.userAgent || "";
    const safari = /safari/i.test(ua) && !/chrome|chromium|crios|android|edg/i.test(ua);
    return safari && !!audio.canPlayType("application/vnd.apple.mpegurl");
  };

  /** Synchronous: must be called directly from the click handler. */
  const play = () => {
    const station = currentStation();
    if (!station) return;
    const gen = ++playGen;
    status.classList.remove("error");
    status.textContent = `連線 ${station.name}…`;
    destroyHls();
    audio.removeAttribute("src");
    audio.load();

    if (!safariNative() && Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hls.loadSource(station.url);
      hls.attachMedia(audio);
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data?.fatal || gen !== playGen) return;
        status.textContent = hlsFatalText(data);
        status.classList.add("error");
        setPlaying(false);
      });
    } else if (audio.canPlayType("application/vnd.apple.mpegurl")) {
      audio.src = station.url;
    } else {
      status.textContent = "呢個瀏覽器暫唔支援 HLS 電台串流";
      status.classList.add("error");
      return;
    }

    const pending = audio.play();
    pending.then(() => markPlaying(gen, station)).catch((err) => {
      if (hls && err?.name !== "NotAllowedError") {
        const retry = () => {
          audio.play().then(() => markPlaying(gen, station)).catch((err2) => markPlayError(gen, err2));
        };
        if (hls.media) hls.once(Hls.Events.MANIFEST_PARSED, retry);
        else retry();
        return;
      }
      markPlayError(gen, err);
    });
  };

  const pause = () => {
    audio.pause();
    setPlaying(false);
    status.textContent = "已暫停";
  };

  stationRow.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-station]");
    if (!btn) return;
    activeId = btn.dataset.station;
    stationRow.querySelectorAll(".station-btn").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.station === activeId));
    });
    if (playing) play();
    else status.textContent = `已選 ${currentStation()?.name} · 撳播放`;
  });

  playBtn.addEventListener("click", () => {
    if (playing) pause();
    else play();
  });

  audio.addEventListener("error", () => {
    if (!playing) return;
    if (String(status.textContent || "").includes("hls.js")) return;
    status.textContent = "音訊中斷，可再撳播放重試";
    status.classList.add("error");
    setPlaying(false);
  });

  return () => {
    pause();
    destroyHls();
  };
}
