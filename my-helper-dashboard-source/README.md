# my helper dashboard

Phone-first PWA（Samsung Galaxy S26）：時鐘、天文台天氣、九巴 ETA（可自選路線／站）、港台電台。  
靜態前端，無帳戶、無 client secrets；適合 **GitHub Pages**。

預期網址：`https://mogtboi.github.io/my-helper-dashboard/`

---

## 本地運行

```bash
npm install
npm run dev
```

瀏覽器打開終端顯示嘅 URL（通常 `http://localhost:5173`）。  
手機同 Wi‑Fi：`vite.config.js` 已開 `host: true`，用電腦 LAN IP。

```bash
npm run build
npm run preview
```

GitHub Pages 用嘅 base path：

```bash
VITE_BASE_PATH=/my-helper-dashboard/ npm run build
```

---

## 巴士設定（只存本機）

- 預設：64K **較寮下**、**坑下甫**（林村）。
- 撳巴士面板「**設定**」→ 移除／新增九巴路線同站。
- **只寫入呢部手機／瀏覽器嘅 `localStorage`**，唔上雲、無帳戶、唔會同步去第二部機。
- Storage key：`lam-tsuen-dashboard.bus.v1`

---

## Samsung S26：加到主畫面

1. Samsung Internet／Chrome 打開 HTTPS 站（Pages 上線後用上面網址）。
2. 選單 → **加到主畫面／安裝應用程式**。
3. 電台要手動撳播放；巴士設定只影響呢部機。

呢個係 PWA 捷徑，**唔係** Android 真主畫面 Widget。

---

## GitHub Pages

1. 喺 [github.com/new](https://github.com/new) 建 **Public** repo，名必須係 `my-helper-dashboard`（空 repo、唔勾 README）。
2. 將本 repo 推上 `main`（見下方 push 指令）。
3. 第一次 push 後：repo → **Settings → Pages** → Source 揀 **GitHub Actions**（workflow 會自動 deploy）。
4. 等 Actions 綠燈後打開：`https://mogtboi.github.io/my-helper-dashboard/`

---

## 安全摘要

- 無 API key／無 client secrets／無 eval  
- CSP meta（GitHub Pages）  
- 巴士偏好只在本機 `localStorage`  
- Service worker 只 cache 靜態殼  

---

## 電台說明

串流來自 RTHK 頻道頁公開 HLS。個人收聽用途；請遵守港台條款。
