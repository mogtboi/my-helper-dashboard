/**
 * Play RTHK HLS with user gesture.
 * Native HLS (Safari / Samsung Internet) first; else dynamic-import hls.js.
 */
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

  const attachSource = async (url) => {
    destroyHls();
    audio.removeAttribute("src");

    if (audio.canPlayType("application/vnd.apple.mpegurl")) {
      audio.src = url;
      return "native";
    }

    const { default: Hls } = await import("hls.js");
    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });
      hls.loadSource(url);
      hls.attachMedia(audio);
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          status.textContent = "串流錯誤，稍後再試或換台";
          status.classList.add("error");
          setPlaying(false);
        }
      });
      return "hls.js";
    }
    status.textContent = "呢個瀏覽器暫唔支援 HLS 電台串流";
    status.classList.add("error");
    return null;
  };

  const setPlaying = (next) => {
    playing = next;
    playBtn.dataset.playing = String(playing);
    playBtn.setAttribute("aria-pressed", String(playing));
    playBtn.textContent = playing ? "暫停" : "播放";
  };

  const currentStation = () => stations.find((s) => s.id === activeId);

  const play = async () => {
    const station = currentStation();
    if (!station) return;
    status.classList.remove("error");
    status.textContent = `連線 ${station.name}…`;
    let mode;
    try {
      mode = await attachSource(station.url);
    } catch {
      status.textContent = "載入播放器失敗";
      status.classList.add("error");
      return;
    }
    if (!mode) return;
    try {
      await audio.play();
      setPlaying(true);
      status.textContent = `播放中 · ${station.name}`;
    } catch {
      setPlaying(false);
      status.textContent = "播放失敗（要用戶手勢／檢查網絡）";
      status.classList.add("error");
    }
  };

  const pause = () => {
    audio.pause();
    setPlaying(false);
    status.textContent = "已暫停";
  };

  stationRow.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-station]");
    if (!btn) return;
    activeId = btn.dataset.station;
    stationRow.querySelectorAll(".station-btn").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.station === activeId));
    });
    if (playing) {
      await play();
    } else {
      status.textContent = `已選 ${currentStation()?.name} · 撳播放`;
    }
  });

  playBtn.addEventListener("click", async () => {
    if (playing) pause();
    else await play();
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
