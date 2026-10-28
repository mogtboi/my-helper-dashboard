/**
 * Play RTHK HLS with the click that asked for it.
 * Native HLS first; otherwise the bundled hls.js (static import, no extra host).
 * audio.play() runs in the click turn, before any await, so the user gesture is kept.
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

  const markPlayError = (gen, err) => {
    if (gen !== playGen) return;
    setPlaying(false);
    status.classList.add("error");
    status.textContent =
      err?.name === "NotAllowedError"
        ? "播放失敗（要用戶手勢／檢查網絡）"
        : "播放失敗（檢查網絡或電台串流）";
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

    if (audio.canPlayType("application/vnd.apple.mpegurl")) {
      audio.src = station.url;
    } else if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hls.loadSource(station.url);
      hls.attachMedia(audio);
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data?.fatal || gen !== playGen) return;
        status.textContent = "串流錯誤，稍後再試或換台";
        status.classList.add("error");
        setPlaying(false);
      });
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
    status.textContent = "音訊中斷，可再撳播放重試";
    status.classList.add("error");
    setPlaying(false);
  });

  return () => {
    pause();
    destroyHls();
  };
}
