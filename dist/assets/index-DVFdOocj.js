(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))i(a);new MutationObserver(a=>{for(const s of a)if(s.type==="childList")for(const r of s.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&i(r)}).observe(document,{childList:!0,subtree:!0});function n(a){const s={};return a.integrity&&(s.integrity=a.integrity),a.referrerPolicy&&(s.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?s.credentials="include":a.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function i(a){if(a.ep)return;a.ep=!0;const s=n(a);fetch(a.href,s)}})();const R={locale:"zh-HK",timeZone:"Asia/Hong_Kong",weather:{url:"https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc",refreshMs:1200*1e3,iconBase:"https://www.hko.gov.hk/images/HKOWxIconOutline/pic"},radio:{stations:[{id:"rthk1",name:"港台第一台",url:"https://rthkradio1-live.akamaized.net/hls/live/2035313/radio1/master.m3u8"},{id:"rthk2",name:"港台第二台",url:"https://rthkradio2-live.akamaized.net/hls/live/2040078/radio2/master.m3u8"},{id:"rthk3",name:"Radio 3",url:"https://rthkradio3-live.akamaized.net/hls/live/2040079/radio3/master.m3u8"},{id:"rthk5",name:"港台第五台",url:"https://rthkradio5-live.akamaized.net/hls/live/2040081/radio5/master.m3u8"}]}};function Lt({timeEl:t,dateEl:e,locale:n,timeZone:i}){const a=new Intl.DateTimeFormat(n,{timeZone:i,hour:"2-digit",minute:"2-digit",hour12:!1}),s=new Intl.DateTimeFormat(n,{timeZone:i,weekday:"long",year:"numeric",month:"long",day:"numeric"}),r=()=>{const u=new Date;t.textContent=a.format(u),e.textContent=s.format(u)};r();const d=setInterval(r,1e3);return()=>clearInterval(d)}const gt={50:"陽光充沛",51:"間有陽光",52:"短暫陽光",53:"間中有陽光",54:"有煙霞",60:"多雲",61:"陰天",62:"微雨",63:"雨",64:"大雨",65:"雷暴"};function St(t){try{return new Intl.DateTimeFormat("zh-HK",{timeZone:"Asia/Hong_Kong",hour:"2-digit",minute:"2-digit",hour12:!1}).format(new Date(t))}catch{return"—"}}function Et(t,e){return e&&(t.find(n=>n.place===e)||t.find(n=>n.place.includes(e)))||null}function At(t,e){return!e||!t?.length?null:t.find(n=>n.place===e)||t.find(n=>n.place?.includes?.(e.replace("公園","")))||null}function $t(t,e,{onStatus:n,onChangePlace:i}={}){let a=null,s=null,r=null;const d=(g,f)=>{if(!a){t.innerHTML=`
        <p class="muted">請先揀天氣地區</p>
        <button type="button" class="tab" id="weather-pick-btn">揀地區</button>
      `,t.querySelector("#weather-pick-btn")?.addEventListener("click",()=>{i?.()});return}if(f&&!s){t.innerHTML=`<p class="error">天氣暫無資料：${f}</p>`;return}const h=g||s,o=h.temperature?.data||[],S=Et(o,a)||o[0],c=Array.isArray(h.icon)?h.icon[0]:h.icon,k=h.humidity?.data?.[0]?.value,w=At(h.rainfall?.data||[],a),$=(h.warningMessage||[])[0],C=`${e.iconBase}${c}.png`,y=S?.place||a;t.innerHTML=`
      <div class="weather-row">
        <img class="weather-icon" src="${C}" alt="" width="68" height="68" loading="lazy" />
        <div>
          <div class="weather-temp">${S?`${S.value}°`:"—"}</div>
          <div class="weather-meta">
            ${y}
            · ${gt[c]||`圖示 ${c}`}
            ${k!=null?`· 濕度 ${k}%`:""}
          </div>
          ${w?`<div class="muted">雨量 ${w.min??0}–${w.max??0} mm</div>`:""}
        </div>
      </div>
      ${$?`<p class="muted weather-warn">${$}</p>`:""}
      <div class="weather-foot">
        <p class="muted">更新 ${St(h.updateTime)}</p>
        <button type="button" class="ghost-btn" id="weather-change-btn">轉地區</button>
      </div>
      ${f?'<p class="error">刷新失敗，顯示上次資料</p>':""}
    `,t.querySelector("#weather-change-btn")?.addEventListener("click",()=>{i?.()})},u=async()=>{if(!a){d(null,null);return}try{const g=await fetch(e.url,{cache:"no-store"});if(!g.ok)throw new Error(`HTTP ${g.status}`);const f=await g.json();s=f,d(f,null),n?.("天氣已更新")}catch(g){d(null,g.message||"網絡錯誤"),n?.("天氣更新失敗")}},T=g=>{a=g,u()},E=g=>{a=g,u(),r&&clearInterval(r),r=setInterval(u,e.refreshMs),document.addEventListener("visibilitychange",b)},b=()=>{document.visibilityState==="visible"&&u()};return{start:E,setPlace:T,refresh:u,destroy:()=>{r&&clearInterval(r),document.removeEventListener("visibilitychange",b)}}}const _="https://data.etabus.gov.hk/v1/transport/kmb";async function B(t){const e=await fetch(t,{cache:"no-store"});if(!e.ok)throw new Error(`HTTP ${e.status}`);return e.json()}async function wt(t){const e=await B(`${_}/route/`),n=String(t).trim().toUpperCase();return(e.data||[]).filter(i=>i.route===n).map(i=>({route:i.route,bound:i.bound==="I"?"inbound":"outbound",serviceType:String(i.service_type),origTc:i.orig_tc,destTc:i.dest_tc,label:`${i.orig_tc} → ${i.dest_tc}`}))}async function ct(t,e,n){return(await B(`${_}/route-stop/${encodeURIComponent(t)}/${e}/${n}`)).data||[]}async function Ct(t){const e=await B(`${_}/stop/${encodeURIComponent(t)}`);return{stopId:t,nameTc:e.data?.name_tc||t,nameEn:e.data?.name_en||""}}async function dt(t,e=8){const n=[];let i=0;async function a(){for(;i<t.length;){const s=i++,r=t[s],d=await Ct(r.stop);n[s]={seq:r.seq,stopId:r.stop,nameTc:d.nameTc,nameEn:d.nameEn}}}return await Promise.all(Array.from({length:Math.min(e,t.length)},()=>a())),n}async function kt(t,e,n){return(await B(`${_}/eta/${encodeURIComponent(t)}/${encodeURIComponent(e)}/${encodeURIComponent(n)}`)).data||[]}async function It(t,e,n,i,a){const s=n==="inbound"?"outbound":"inbound",r=await ct(t,s,e),u=(await dt(r)).find(T=>T.nameTc===i);return u?{label:a?`往${a}`:s==="inbound"?"往終點":"往起點",stopId:u.stopId,bound:s,serviceType:String(e)}:null}const z="lam-tsuen-dashboard.bus.v1";function U(){return{version:1,stops:[{id:"64k-kau-liu-ha",route:"64K",serviceType:"1",nameTc:"較寮下",nameEn:"Kau Liu Ha",directions:[{label:"往元朗",stopId:"0B786699889F0AEB",bound:"inbound"},{label:"往大埔墟",stopId:"DC6749D20ED5C948",bound:"outbound"}]},{id:"64k-hang-ha-po",route:"64K",serviceType:"1",nameTc:"坑下甫",nameEn:"Hang Ha Po",directions:[{label:"往元朗",stopId:"A53F6592C4173B4E",bound:"inbound"},{label:"往大埔墟",stopId:"BCC83D8C953DC504",bound:"outbound"}]}]}}function ut(t){return t&&t.version===1&&Array.isArray(t.stops)&&t.stops.every(e=>e&&typeof e.id=="string"&&typeof e.route=="string"&&typeof e.nameTc=="string"&&Array.isArray(e.directions)&&e.directions.length>0&&e.directions.every(n=>n&&n.stopId&&n.label))}function Ht(){try{const t=localStorage.getItem(z);if(!t)return U();const e=JSON.parse(t);return!ut(e)||e.stops.length===0?U():e}catch{return U()}}function at(t){if(!ut(t))throw new Error("invalid bus selection");return localStorage.setItem(z,JSON.stringify(t)),t}function st(){return localStorage.removeItem(z),U()}function Mt(t){const e=[...new Set((t.stops||[]).map(n=>n.route))];return e.length?e.join(" · "):""}function Wt(t,e){return`${t.toUpperCase()}-${e}`.replace(/[^A-Za-z0-9_-]/g,"")}function Kt(t,e=Date.now()){if(!t)return null;const n=new Date(t).getTime()-e;return Number.isNaN(n)?null:n<=0?0:Math.round(n/6e4)}function Ot(t){const e=new Map;for(const n of t?.stops||[]){const i=n.route;e.has(i)||e.set(i,[]);for(const a of n.directions||[])e.get(i).push({key:`${n.id}::${a.stopId}::${a.bound||""}`,stop:n,dir:a,label:`${n.nameTc} · ${a.label}`})}return e}function qt(t,e,{onStatus:n,onOpenSettings:i}={}){let a=null,s=null,r=null,d="",u=null,T=new Map;const E=()=>{T=Ot(a);const c=[...T.keys()];(!s||!T.has(s))&&(s=c[0]||null);const k=T.get(s)||[];(!r||!k.some(C=>C.key===r))&&(r=k[0]?.key||null),e&&(e.textContent=`巴士 ${Mt(a)}`);const w=k.length>1;t.innerHTML=`
      <div class="bus-toolbar">
        <div class="route-tiles" role="tablist" aria-label="巴士路線"></div>
        <button type="button" class="icon-btn settings-gear" id="bus-settings-btn" aria-label="巴士路線設定">設定</button>
      </div>
      <div id="route-options" class="route-options" ${w?"":"hidden"}></div>
      <div id="eta-body"><p class="muted">載入 ETA…</p></div>
      <p class="device-local-hint">路線設定只存呢部機 · 唔會同步其他裝置</p>
    `;const $=t.querySelector(".route-tiles");$.innerHTML=c.length?c.map(C=>`
        <button type="button" class="route-tile" role="tab" data-route="${C}"
          aria-selected="${C===s}">${C}</button>`).join(""):'<span class="muted">未選路線</span>',$.addEventListener("click",C=>{const y=C.target.closest("[data-route]");if(!y)return;s=y.dataset.route,r=(T.get(s)||[])[0]?.key||null,$.querySelectorAll(".route-tile").forEach(K=>{K.setAttribute("aria-selected",String(K.dataset.route===s))}),b(),g()}),t.querySelector("#bus-settings-btn").addEventListener("click",()=>{i?.()}),b()},b=()=>{const c=t.querySelector("#route-options");if(!c)return;const k=T.get(s)||[];if(k.length<=1){c.hidden=!0,c.innerHTML="";return}c.hidden=!1,c.innerHTML=`
      <p class="route-options-label">${s} · 揀站／方向</p>
      <div class="route-option-list" role="listbox" aria-label="${s} 站同方向">
        ${k.map(w=>`
          <button type="button" class="route-option" role="option"
            data-opt="${w.key}" aria-selected="${w.key===r}">
            ${w.label}
          </button>`).join("")}
      </div>
    `,c.querySelector(".route-option-list").addEventListener("click",w=>{const $=w.target.closest("[data-opt]");$&&(r=$.dataset.opt,c.querySelectorAll(".route-option").forEach(C=>{C.setAttribute("aria-selected",String(C.dataset.opt===r))}),g())})},A=c=>{const k=t.querySelector("#eta-body");k&&(k.innerHTML=d?`${d}<p class="error">刷新失敗：${c}</p>`:`<p class="error">巴士暫無資料：${c}</p>`)},g=async()=>{const c=t.querySelector("#eta-body");if(!c||!a)return;const k=T.get(s)||[],w=k.find(y=>y.key===r)||k[0];if(!w){c.innerHTML='<p class="muted">未選擇車站 · 撳「設定」加入</p>';return}const{stop:$,dir:C}=w;try{const y=C.serviceType||$.serviceType||"1",q=await kt(C.stopId,$.route,y),K=Date.now(),N=q.map(I=>({dest:I.dest_tc,eta:I.eta,mins:Kt(I.eta,K),rmk:I.rmk_tc})).filter(I=>I.eta).slice(0,3);if(!N.length)d=`<div class="eta-dir">${$.route} · ${w.label}</div><p class="muted">暫無班次</p>`;else{const I=N.map(M=>{const O=M.mins===0?"即將到達":M.mins==null?"—":`${M.mins} 分鐘`;return`<li class="eta-item">
              <span class="eta-dest">${M.dest}${M.rmk?` · ${M.rmk}`:""}</span>
              <span class="eta-mins">${O}</span>
            </li>`}).join("");d=`<div class="eta-dir">${$.route} · ${w.label}</div><ul class="eta-list">${I}</ul>`}c.innerHTML=d,n?.("巴士已更新")}catch(y){A(y.message||"網絡錯誤"),n?.("巴士更新失敗")}},f=c=>{a=c,E(),g()},h=c=>{f(c),u&&clearInterval(u),u=setInterval(g,45*1e3),document.addEventListener("visibilitychange",o)},o=()=>{document.visibilityState==="visible"&&g()};return{start:h,setSelection:f,refresh:g,destroy:()=>{u&&clearInterval(u),document.removeEventListener("visibilitychange",o)},_base:_}}const Pt="https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php",xt={ADM:"金鐘",EXC:"會展",HUH:"紅磡",MKK:"旺角東",KOT:"九龍塘",TAW:"大圍",SHT:"沙田",FOT:"火炭",RAC:"馬場",UNI:"大學",TAP:"大埔墟",TWO:"太和",FAN:"粉嶺",SHS:"上水",LOW:"羅湖",LMC:"落馬洲",CEN:"中環",TST:"尖沙咀",JOR:"佐敦",YMT:"油麻地",MOK:"旺角",PRE:"太子",SSP:"深水埗",CSW:"長沙灣",LCK:"荔枝角",MEF:"美孚",LAK:"荔景",TSW:"荃灣",SKW:"筲箕灣",TAK:"太古",QUB:"鰂魚涌",NOP:"北角",FOH:"炮台山",TIH:"天后",CAB:"銅鑼灣",WAC:"灣仔",DIH:"鑽石山",CHH:"彩虹",KOB:"九龍灣",NTK:"牛頭角",KWT:"觀塘",LAT:"藍田",YAT:"油塘",TIK:"調景嶺",OLY:"奧運",NAC:"南昌",TSY:"青衣",SUN:"欣澳",TUC:"東涌",TUM:"屯門",YUL:"元朗",TIS:"天水圍",AWE:"博覽館",AIR:"機場",TSY2:"青衣"};function Nt(t){return xt[t]||t||"—"}async function Ut(t,e){const n=`${Pt}?line=${encodeURIComponent(t)}&sta=${encodeURIComponent(e)}`,i=await fetch(n,{cache:"no-store"});if(!i.ok)throw new Error(`HTTP ${i.status}`);const a=await i.json(),s=`${t}-${e}`,r=a?.data?.[s];if(!r){const d=a?.message||a?.status||"無班次資料";throw new Error(String(d))}return{up:Array.isArray(r.UP)?r.UP:[],down:Array.isArray(r.DOWN)?r.DOWN:[],currTime:r.curr_time||a.curr_time}}function it(t,e=3){const n=(t||[]).filter(i=>i&&i.valid!=="N").slice(0,e);return n.length?`<ul class="eta-list">${n.map(i=>{const a=i.ttnt==="0"||i.ttnt===0?"即將到達":`${i.ttnt} 分鐘`,s=Nt(i.dest),r=i.plat?` · 月台 ${i.plat}`:"";return`<li class="eta-item">
        <span class="eta-dest">往${s}${r}</span>
        <span class="eta-mins">${a}</span>
      </li>`}).join("")}</ul>`:'<p class="muted">暫無班次</p>'}function _t(t,e,{onStatus:n,onOpenSettings:i}={}){let a=null,s=null,r="",d=null;const u=()=>{const f=a?.stations||[];(!s||!f.some(o=>o.id===s))&&(s=f[0]?.id||null),e&&(e.textContent="港鐵"),t.innerHTML=`
      <div class="bus-toolbar">
        <div class="stop-tabs mtr-tabs" role="tablist" aria-label="港鐵站"></div>
        <button type="button" class="icon-btn settings-gear" id="mtr-settings-btn" aria-label="港鐵站設定">設定</button>
      </div>
      <div id="mtr-body"><p class="muted">載入班次…</p></div>
      <p class="device-local-hint">港鐵站只存呢部機 · 公開 Next Train API</p>
    `;const h=t.querySelector(".mtr-tabs");f.length?h.innerHTML=f.map(o=>`
        <button type="button" class="tab" role="tab" data-mtr="${o.id}"
          aria-selected="${o.id===s}">${o.nameTc}</button>`).join(""):h.innerHTML='<span class="muted">未選站</span>',h.addEventListener("click",o=>{const S=o.target.closest("[data-mtr]");S&&(s=S.dataset.mtr,h.querySelectorAll(".tab").forEach(c=>{c.setAttribute("aria-selected",String(c.dataset.mtr===s))}),T())}),t.querySelector("#mtr-settings-btn").addEventListener("click",()=>{i?.()})},T=async()=>{const f=t.querySelector("#mtr-body");if(!f||!a)return;const h=a.stations.find(o=>o.id===s);if(!h){f.innerHTML='<p class="muted">未選擇車站 · 撳「設定」加入</p>';return}try{const{up:o,down:S}=await Ut(h.line,h.sta);r=`
        <div class="eta-dir">${h.lineTc||h.line} · ${h.nameTc} · 上行</div>
        ${it(o)}
        <div style="height:0.55rem"></div>
        <div class="eta-dir">${h.lineTc||h.line} · ${h.nameTc} · 下行</div>
        ${it(S)}
      `,f.innerHTML=r,n?.("港鐵已更新")}catch(o){f.innerHTML=r?`${r}<p class="error">刷新失敗：${o.message||o}</p>`:`<p class="error">港鐵暫無資料：${o.message||o}</p>
           <p class="muted">若瀏覽器封鎖跨域，請稍後再試或改用其他網絡。</p>`,n?.("港鐵更新失敗")}},E=f=>{a=f,u(),T()},b=()=>{document.visibilityState==="visible"&&T()};return{start:f=>{E(f),d&&clearInterval(d),d=setInterval(T,30*1e3),document.addEventListener("visibilitychange",b)},setSelection:E,refresh:T,destroy:()=>{d&&clearInterval(d),document.removeEventListener("visibilitychange",b)}}}const jt="modulepreload",Dt=function(t){return"/my-helper-dashboard/"+t},rt={},Rt=function(e,n,i){let a=Promise.resolve();if(n&&n.length>0){let r=function(T){return Promise.all(T.map(E=>Promise.resolve(E).then(b=>({status:"fulfilled",value:b}),b=>({status:"rejected",reason:b}))))};document.getElementsByTagName("link");const d=document.querySelector("meta[property=csp-nonce]"),u=d?.nonce||d?.getAttribute("nonce");a=r(n.map(T=>{if(T=Dt(T),T in rt)return;rt[T]=!0;const E=T.endsWith(".css"),b=E?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${T}"]${b}`))return;const A=document.createElement("link");if(A.rel=E?"stylesheet":jt,E||(A.as="script"),A.crossOrigin="",A.href=T,u&&A.setAttribute("nonce",u),document.head.appendChild(A),E)return new Promise((g,f)=>{A.addEventListener("load",g),A.addEventListener("error",()=>f(new Error(`Unable to preload CSS for ${T}`)))})}))}function s(r){const d=new Event("vite:preloadError",{cancelable:!0});if(d.payload=r,window.dispatchEvent(d),!d.defaultPrevented)throw r}return a.then(r=>{for(const d of r||[])d.status==="rejected"&&s(d.reason);return e().catch(s)})};function Bt(t,e){const n=e.stations;let i=n[0]?.id,a=!1,s=null;t.innerHTML=`
    <div class="radio-row" role="group" aria-label="電台頻道"></div>
    <button type="button" class="play-btn" data-playing="false" aria-pressed="false">播放</button>
    <p class="radio-status muted" aria-live="polite">撳播放先連線（唔會自動播）</p>
    <audio id="radio-audio" preload="none" playsinline></audio>
  `;const r=t.querySelector(".radio-row"),d=t.querySelector(".play-btn"),u=t.querySelector(".radio-status"),T=t.querySelector("#radio-audio");r.innerHTML=n.map(o=>`
      <button type="button" class="station-btn" data-station="${o.id}"
        aria-pressed="${o.id===i}">${o.name}</button>`).join("");const E=()=>{s&&(s.destroy(),s=null)},b=async o=>{if(E(),T.removeAttribute("src"),T.canPlayType("application/vnd.apple.mpegurl"))return T.src=o,"native";const{default:S}=await Rt(async()=>{const{default:c}=await import("./hls-ToztMTY2.js");return{default:c}},[]);return S.isSupported()?(s=new S({enableWorker:!0,lowLatencyMode:!1}),s.loadSource(o),s.attachMedia(T),s.on(S.Events.ERROR,(c,k)=>{k.fatal&&(u.textContent="串流錯誤，稍後再試或換台",u.classList.add("error"),A(!1))}),"hls.js"):(u.textContent="呢個瀏覽器暫唔支援 HLS 電台串流",u.classList.add("error"),null)},A=o=>{a=o,d.dataset.playing=String(a),d.setAttribute("aria-pressed",String(a)),d.textContent=a?"暫停":"播放"},g=()=>n.find(o=>o.id===i),f=async()=>{const o=g();if(!o)return;u.classList.remove("error"),u.textContent=`連線 ${o.name}…`;let S;try{S=await b(o.url)}catch{u.textContent="載入播放器失敗",u.classList.add("error");return}if(S)try{await T.play(),A(!0),u.textContent=`播放中 · ${o.name}`}catch{A(!1),u.textContent="播放失敗（要用戶手勢／檢查網絡）",u.classList.add("error")}},h=()=>{T.pause(),A(!1),u.textContent="已暫停"};return r.addEventListener("click",async o=>{const S=o.target.closest("[data-station]");S&&(i=S.dataset.station,r.querySelectorAll(".station-btn").forEach(c=>{c.setAttribute("aria-pressed",String(c.dataset.station===i))}),a?await f():u.textContent=`已選 ${g()?.name} · 撳播放`)}),d.addEventListener("click",async()=>{a?h():await f()}),T.addEventListener("error",()=>{a&&(u.textContent="音訊中斷，可再撳播放重試",u.classList.add("error"),A(!1))}),()=>{h(),E()}}const pt="my-helper.weather.place.v1",F=["大埔","大美督","沙田","元朗公園","屯門","荃灣可觀","荃灣城門谷","青衣","石崗","流浮山","打鼓嶺","西貢","將軍澳","觀塘","黃大仙","九龍城","深水埗","啟德跑道公園","京士柏","香港天文台","香港公園","跑馬地","筲箕灣","黃竹坑","赤柱","長洲","赤鱲角"];function Ft(){try{const t=localStorage.getItem(pt);if(!t)return null;const e=JSON.parse(t);return typeof e=="string"&&F.includes(e)?e:null}catch{return null}}function mt(t){if(!F.includes(t))throw new Error("invalid weather place");return localStorage.setItem(pt,JSON.stringify(t)),t}const G="my-helper.mtr.v1",Tt=[{id:"EAL-TAP",line:"EAL",sta:"TAP",nameTc:"大埔墟",lineTc:"東鐵綫"},{id:"EAL-TWO",line:"EAL",sta:"TWO",nameTc:"太和",lineTc:"東鐵綫"},{id:"EAL-UNI",line:"EAL",sta:"UNI",nameTc:"大學",lineTc:"東鐵綫"},{id:"EAL-FOT",line:"EAL",sta:"FOT",nameTc:"火炭",lineTc:"東鐵綫"},{id:"EAL-SHT",line:"EAL",sta:"SHT",nameTc:"沙田",lineTc:"東鐵綫"},{id:"EAL-TAW",line:"EAL",sta:"TAW",nameTc:"大圍",lineTc:"東鐵綫"},{id:"EAL-KOT",line:"EAL",sta:"KOT",nameTc:"九龍塘",lineTc:"東鐵綫"},{id:"EAL-MKK",line:"EAL",sta:"MKK",nameTc:"旺角東",lineTc:"東鐵綫"},{id:"EAL-HUH",line:"EAL",sta:"HUH",nameTc:"紅磡",lineTc:"東鐵綫"},{id:"EAL-EXC",line:"EAL",sta:"EXC",nameTc:"會展",lineTc:"東鐵綫"},{id:"EAL-ADM",line:"EAL",sta:"ADM",nameTc:"金鐘",lineTc:"東鐵綫"},{id:"EAL-FAN",line:"EAL",sta:"FAN",nameTc:"粉嶺",lineTc:"東鐵綫"},{id:"EAL-SHS",line:"EAL",sta:"SHS",nameTc:"上水",lineTc:"東鐵綫"},{id:"EAL-LOW",line:"EAL",sta:"LOW",nameTc:"羅湖",lineTc:"東鐵綫"},{id:"EAL-LMC",line:"EAL",sta:"LMC",nameTc:"落馬洲",lineTc:"東鐵綫"},{id:"TML-TUM",line:"TML",sta:"TUM",nameTc:"屯門",lineTc:"屯馬綫"},{id:"TML-YUL",line:"TML",sta:"YUL",nameTc:"元朗",lineTc:"屯馬綫"},{id:"TML-TIS",line:"TML",sta:"TIS",nameTc:"天水圍",lineTc:"屯馬綫"},{id:"TML-TAW",line:"TML",sta:"TAW",nameTc:"大圍",lineTc:"屯馬綫"},{id:"TML-HUH",line:"TML",sta:"HUH",nameTc:"紅磡",lineTc:"屯馬綫"},{id:"TWL-TSW",line:"TWL",sta:"TSW",nameTc:"荃灣",lineTc:"荃灣綫"},{id:"TWL-LAK",line:"TWL",sta:"LAK",nameTc:"荔景",lineTc:"荃灣綫"},{id:"TWL-MEF",line:"TWL",sta:"MEF",nameTc:"美孚",lineTc:"荃灣綫"},{id:"TWL-LCK",line:"TWL",sta:"LCK",nameTc:"荔枝角",lineTc:"荃灣綫"},{id:"TWL-CSW",line:"TWL",sta:"CSW",nameTc:"長沙灣",lineTc:"荃灣綫"},{id:"TWL-SSP",line:"TWL",sta:"SSP",nameTc:"深水埗",lineTc:"荃灣綫"},{id:"TWL-PRE",line:"TWL",sta:"PRE",nameTc:"太子",lineTc:"荃灣綫"},{id:"TWL-MOK",line:"TWL",sta:"MOK",nameTc:"旺角",lineTc:"荃灣綫"},{id:"TWL-YMT",line:"TWL",sta:"YMT",nameTc:"油麻地",lineTc:"荃灣綫"},{id:"TWL-JOR",line:"TWL",sta:"JOR",nameTc:"佐敦",lineTc:"荃灣綫"},{id:"TWL-TST",line:"TWL",sta:"TST",nameTc:"尖沙咀",lineTc:"荃灣綫"},{id:"TWL-ADM",line:"TWL",sta:"ADM",nameTc:"金鐘",lineTc:"荃灣綫"},{id:"TWL-CEN",line:"TWL",sta:"CEN",nameTc:"中環",lineTc:"荃灣綫"},{id:"ISL-SKW",line:"ISL",sta:"SKW",nameTc:"筲箕灣",lineTc:"港島綫"},{id:"ISL-TAK",line:"ISL",sta:"TAK",nameTc:"太古",lineTc:"港島綫"},{id:"ISL-QUB",line:"ISL",sta:"QUB",nameTc:"鰂魚涌",lineTc:"港島綫"},{id:"ISL-NOP",line:"ISL",sta:"NOP",nameTc:"北角",lineTc:"港島綫"},{id:"ISL-FOH",line:"ISL",sta:"FOH",nameTc:"炮台山",lineTc:"港島綫"},{id:"ISL-TIH",line:"ISL",sta:"TIH",nameTc:"天后",lineTc:"港島綫"},{id:"ISL-CAB",line:"ISL",sta:"CAB",nameTc:"銅鑼灣",lineTc:"港島綫"},{id:"ISL-WAC",line:"ISL",sta:"WAC",nameTc:"灣仔",lineTc:"港島綫"},{id:"ISL-ADM",line:"ISL",sta:"ADM",nameTc:"金鐘",lineTc:"港島綫"},{id:"ISL-CEN",line:"ISL",sta:"CEN",nameTc:"中環",lineTc:"港島綫"},{id:"KTL-DIH",line:"KTL",sta:"DIH",nameTc:"鑽石山",lineTc:"觀塘綫"},{id:"KTL-CHH",line:"KTL",sta:"CHH",nameTc:"彩虹",lineTc:"觀塘綫"},{id:"KTL-KOB",line:"KTL",sta:"KOB",nameTc:"九龍灣",lineTc:"觀塘綫"},{id:"KTL-NTK",line:"KTL",sta:"NTK",nameTc:"牛頭角",lineTc:"觀塘綫"},{id:"KTL-KWT",line:"KTL",sta:"KWT",nameTc:"觀塘",lineTc:"觀塘綫"},{id:"KTL-LAT",line:"KTL",sta:"LAT",nameTc:"藍田",lineTc:"觀塘綫"},{id:"KTL-YAT",line:"KTL",sta:"YAT",nameTc:"油塘",lineTc:"觀塘綫"},{id:"KTL-TIK",line:"KTL",sta:"TIK",nameTc:"調景嶺",lineTc:"觀塘綫"},{id:"TCL-OLY",line:"TCL",sta:"OLY",nameTc:"奧運",lineTc:"東涌綫"},{id:"TCL-NAC",line:"TCL",sta:"NAC",nameTc:"南昌",lineTc:"東涌綫"},{id:"TCL-LAK",line:"TCL",sta:"LAK",nameTc:"荔景",lineTc:"東涌綫"},{id:"TCL-TSY",line:"TCL",sta:"TSY",nameTc:"青衣",lineTc:"東涌綫"},{id:"TCL-SUN",line:"TCL",sta:"SUN",nameTc:"欣澳",lineTc:"東涌綫"},{id:"TCL-TUC",line:"TCL",sta:"TUC",nameTc:"東涌",lineTc:"東涌綫"}];function Yt(t){return Tt.find(e=>e.id===t)||null}function D(){return{version:1,stations:[{id:"EAL-TAP",line:"EAL",sta:"TAP",nameTc:"大埔墟",lineTc:"東鐵綫"},{id:"EAL-TWO",line:"EAL",sta:"TWO",nameTc:"太和",lineTc:"東鐵綫"}]}}function bt(t){return t&&t.version===1&&Array.isArray(t.stations)&&t.stations.every(e=>e&&typeof e.id=="string"&&typeof e.line=="string"&&typeof e.sta=="string"&&typeof e.nameTc=="string")}function Jt(){try{const t=localStorage.getItem(G);if(!t)return D();const e=JSON.parse(t);return bt(e)?e:D()}catch{return D()}}function ot(t){if(!bt(t))throw new Error("invalid mtr selection");return localStorage.setItem(G,JSON.stringify(t)),t}function Vt(){return localStorage.removeItem(G),D()}function zt({overlayRoot:t,getBusSelection:e,setBusSelection:n,onBusChange:i,getWeatherPlace:a,onWeatherPlaceChange:s,getMtrSelection:r,setMtrSelection:d,onMtrChange:u}){return{open:(E="bus")=>{t.hidden=!1,t.innerHTML=`
      <div class="settings-backdrop" data-close></div>
      <div class="settings-sheet" role="dialog" aria-modal="true" aria-labelledby="app-settings-title">
        <header class="settings-head">
          <h2 id="app-settings-title">設定</h2>
          <button type="button" class="icon-btn" data-close aria-label="關閉">✕</button>
        </header>
        <p class="settings-note">
          所有設定只保存在<strong>呢部手機／瀏覽器</strong>（localStorage）。
          唔會上雲、唔會同步去第二部機。
        </p>

        <nav class="settings-tabs" role="tablist" aria-label="設定分類">
          <button type="button" class="settings-tab" data-panel="weather" aria-selected="${E==="weather"}">天氣</button>
          <button type="button" class="settings-tab" data-panel="bus" aria-selected="${E==="bus"}">巴士</button>
          <button type="button" class="settings-tab" data-panel="mtr" aria-selected="${E==="mtr"}">港鐵</button>
        </nav>

        <div class="settings-panel" data-panel-body="weather" ${E==="weather"?"":"hidden"}>
          <h3 class="settings-sub">天氣地區</h3>
          <p class="muted">揀天文台公開溫度站；只影響呢部機。</p>
          <div class="place-grid" id="settings-weather-places"></div>
          <p class="muted" id="weather-settings-status"></p>
        </div>

        <div class="settings-panel" data-panel-body="bus" ${E==="bus"?"":"hidden"}>
          <h3 class="settings-sub">而家顯示</h3>
          <ul class="settings-list" id="settings-current"></ul>
          <div class="settings-actions-row">
            <button type="button" class="ghost-btn" id="settings-reset">恢復預設巴士站</button>
          </div>
          <h3 class="settings-sub">新增站（九巴公開資料）</h3>
          <div class="add-form">
            <label class="field">
              <span>路線</span>
              <input id="add-route" type="text" inputmode="text" autocomplete="off" placeholder="例如 64K" maxlength="8" />
            </label>
            <button type="button" class="tab" id="add-load">載入方向</button>
          </div>
          <div id="add-variants" class="add-variants"></div>
          <div id="add-stops" class="add-stops"></div>
          <p class="muted" id="add-status"></p>
        </div>

        <div class="settings-panel" data-panel-body="mtr" ${E==="mtr"?"":"hidden"}>
          <h3 class="settings-sub">已選港鐵站</h3>
          <ul class="settings-list" id="mtr-current"></ul>
          <div class="settings-actions-row">
            <button type="button" class="ghost-btn" id="mtr-reset">恢復預設（大埔墟／太和）</button>
          </div>
          <h3 class="settings-sub">加入車站</h3>
          <label class="field">
            <span>搜尋</span>
            <input id="mtr-search" type="search" placeholder="例如 大埔／沙田／觀塘" autocomplete="off" />
          </label>
          <div class="place-grid mtr-add-grid" id="mtr-catalog"></div>
          <p class="muted" id="mtr-status"></p>
        </div>
      </div>
    `;const b=t.querySelector(".settings-sheet");b.querySelector(".settings-tabs").addEventListener("click",m=>{const p=m.target.closest("[data-panel]");if(!p)return;const L=p.dataset.panel;b.querySelectorAll(".settings-tab").forEach(l=>{l.setAttribute("aria-selected",String(l.dataset.panel===L))}),b.querySelectorAll("[data-panel-body]").forEach(l=>{l.hidden=l.getAttribute("data-panel-body")!==L})}),t.addEventListener("click",m=>{m.target.closest("[data-close]")&&(t.hidden=!0,t.innerHTML="")});const A=b.querySelector("#settings-weather-places"),g=b.querySelector("#weather-settings-status"),f=a();A.innerHTML=F.map(m=>`
      <button type="button" class="place-chip" data-place="${m}"
        aria-pressed="${m===f}">${m}</button>`).join(""),A.addEventListener("click",m=>{const p=m.target.closest("[data-place]");if(!p)return;const L=p.dataset.place;mt(L),s(L),A.querySelectorAll(".place-chip").forEach(l=>{l.setAttribute("aria-pressed",String(l.dataset.place===L))}),g.textContent=`已儲存：${L}（只呢部機）`});const h=b.querySelector("#settings-current"),o=b.querySelector("#add-status"),S=b.querySelector("#add-variants"),c=b.querySelector("#add-stops"),k=b.querySelector("#add-route"),w=()=>{const m=e();if(!m.stops.length){h.innerHTML='<li class="muted">未選站（會用預設）</li>';return}h.innerHTML=m.stops.map(p=>`
        <li class="settings-item">
          <div>
            <strong>${p.route}</strong> · ${p.nameTc}
            <div class="muted">${p.directions.map(L=>L.label).join(" · ")}</div>
          </div>
          <button type="button" class="ghost-btn danger" data-remove="${p.id}">移除</button>
        </li>`).join("")};w(),b.querySelector("#settings-reset").addEventListener("click",()=>{const m=st();n(m),i(m),w(),o.textContent="已恢復預設巴士站（只影響呢部機）"}),h.addEventListener("click",m=>{const p=m.target.closest("[data-remove]");if(!p)return;const L=p.getAttribute("data-remove"),l=e(),v={...l,stops:l.stops.filter(H=>H.id!==L)};if(v.stops.length)at(v),n(v),i(v);else{o.textContent="至少留一個站；已恢復預設";const H=st();n(H),i(H)}w()});let $=[],C=[],y=null;b.querySelector("#add-load").addEventListener("click",async()=>{const m=k.value.trim().toUpperCase();if(!m){o.textContent="請輸入路線編號";return}o.textContent="載入路線…",S.innerHTML="",c.innerHTML="";try{if($=await wt(m),!$.length){o.textContent=`搵唔到 ${m}`;return}const p=$.filter(l=>l.serviceType==="1"),L=p.length?p:$;S.innerHTML=L.map((l,v)=>`
          <button type="button" class="station-btn" data-variant="${v}"
            aria-pressed="false">${l.route} · ${l.label}</button>`).join(""),o.textContent="揀一個方向，再剔站名",$=L}catch(p){o.textContent=`載入失敗：${p.message||p}`}}),S.addEventListener("click",async m=>{const p=m.target.closest("[data-variant]");if(!p)return;const L=Number(p.dataset.variant);y=$[L],S.querySelectorAll("[data-variant]").forEach(l=>{l.setAttribute("aria-pressed",String(l===p))}),o.textContent="載入車站…",c.innerHTML="";try{const l=await ct(y.route,y.bound,y.serviceType);C=await dt(l),c.innerHTML=`
          <label class="check-row both-ways">
            <input type="checkbox" id="add-both" checked />
            <span>盡量加埋反向（同站名）</span>
          </label>
          <div class="stop-check-list">
            ${C.map(v=>`
              <label class="check-row">
                <input type="checkbox" data-stop="${v.stopId}" />
                <span>${v.nameTc}</span>
              </label>`).join("")}
          </div>
          <button type="button" class="play-btn" id="add-save">加入已剔車站</button>
        `,o.textContent=`已載入 ${C.length} 個站`}catch(l){o.textContent=`載入車站失敗：${l.message||l}`}}),c.addEventListener("click",async m=>{if(m.target.id!=="add-save"&&!m.target.closest("#add-save")||!y)return;const p=[...c.querySelectorAll("input[data-stop]:checked")];if(!p.length){o.textContent="請最少剔一個站";return}const L=c.querySelector("#add-both")?.checked;o.textContent="儲存中…";try{const l=structuredClone(e()),v=$.find(H=>H.route===y.route&&H.serviceType===y.serviceType&&H.bound!==y.bound);for(const H of p){const Y=H.getAttribute("data-stop"),j=C.find(P=>P.stopId===Y);if(!j)continue;const X=Wt(y.route,Y),tt=[{label:`往${y.destTc}`,stopId:Y,bound:y.bound,serviceType:y.serviceType}];if(L){const P=await It(y.route,y.serviceType,y.bound,j.nameTc,v?.destTc);P&&tt.push(P)}const et=l.stops.findIndex(P=>P.id===X),nt={id:X,route:y.route,serviceType:y.serviceType,nameTc:j.nameTc,nameEn:j.nameEn,directions:tt};et>=0?l.stops[et]=nt:l.stops.push(nt)}at(l),n(l),i(l),w(),o.textContent="已儲存到呢部機（其他裝置唔會見到）"}catch(l){o.textContent=`儲存失敗：${l.message||l}`}});const q=b.querySelector("#mtr-current"),K=b.querySelector("#mtr-catalog"),N=b.querySelector("#mtr-status"),I=b.querySelector("#mtr-search"),M=()=>{const m=r();if(!m.stations.length){q.innerHTML='<li class="muted">未選站</li>';return}q.innerHTML=m.stations.map(p=>`
        <li class="settings-item">
          <div>
            <strong>${p.nameTc}</strong>
            <div class="muted">${p.lineTc||p.line}</div>
          </div>
          <button type="button" class="ghost-btn danger" data-mtr-remove="${p.id}">移除</button>
        </li>`).join("")},O=(m="")=>{const p=m.trim().toLowerCase(),L=new Set(r().stations.map(v=>v.id)),l=Tt.filter(v=>p?v.nameTc.includes(m.trim())||v.lineTc.includes(m.trim())||v.sta.toLowerCase().includes(p)||v.line.toLowerCase().includes(p):!0).slice(0,40);K.innerHTML=l.map(v=>`
        <button type="button" class="place-chip" data-mtr-add="${v.id}"
          ${L.has(v.id)?"disabled":""}>
          ${v.nameTc}<small>${v.lineTc}</small>
        </button>`).join("")};M(),O(),I.addEventListener("input",()=>O(I.value)),b.querySelector("#mtr-reset").addEventListener("click",()=>{const m=Vt();d(m),u(m),M(),O(I.value),N.textContent="已恢復預設港鐵站（只影響呢部機）"}),q.addEventListener("click",m=>{const p=m.target.closest("[data-mtr-remove]");if(!p)return;const L=p.getAttribute("data-mtr-remove"),l=r(),v={...l,stations:l.stations.filter(H=>H.id!==L)};ot(v),d(v),u(v),M(),O(I.value)}),K.addEventListener("click",m=>{const p=m.target.closest("[data-mtr-add]");if(!p||p.disabled)return;const L=Yt(p.dataset.mtrAdd);if(!L)return;const l=structuredClone(r());l.stations.some(v=>v.id===L.id)||(l.stations.push({...L}),ot(l),d(l),u(l),M(),O(I.value),N.textContent=`已加入 ${L.nameTc}`)})}}}function Gt(t,{currentPlace:e,onPick:n}){t.hidden=!1,t.innerHTML=`
    <div class="settings-backdrop"></div>
    <div class="settings-sheet place-picker-sheet" role="dialog" aria-modal="true" aria-labelledby="place-picker-title">
      <header class="settings-head">
        <h2 id="place-picker-title">揀天氣地區</h2>
      </header>
      <p class="settings-note">
        第一次使用請揀你想睇嘅香港地區天氣。選擇只存在呢部機，之後可喺設定更改。
      </p>
      <div class="place-grid" id="first-place-grid">
        ${F.map(i=>`
          <button type="button" class="place-chip" data-place="${i}"
            aria-pressed="${i===e}">${i}</button>`).join("")}
      </div>
    </div>
  `,t.querySelector("#first-place-grid").addEventListener("click",i=>{const a=i.target.closest("[data-place]");if(!a)return;const s=a.dataset.place;mt(s),t.hidden=!0,t.innerHTML="",n(s)})}const Zt=document.querySelector("#app");Zt.innerHTML=`
  <header class="brand-bar">
    <div class="brand">
      my helper
      <small>個人儀表板</small>
    </div>
    <div class="status-pill" id="net-status" aria-live="polite">連線中</div>
  </header>

  <section class="hero-clock" aria-label="時鐘">
    <div class="clock-time" id="clock-time">--:--</div>
    <div class="clock-date" id="clock-date">—</div>
  </section>

  <div class="grid">
    <section class="panel" aria-labelledby="weather-title">
      <h2 id="weather-title">天氣</h2>
      <div id="weather-root"></div>
    </section>

    <section class="panel" aria-labelledby="bus-title">
      <h2 id="bus-title">巴士</h2>
      <div id="bus-root"></div>
    </section>

    <section class="panel" aria-labelledby="mtr-title">
      <h2 id="mtr-title">港鐵</h2>
      <div id="mtr-root"></div>
    </section>

    <section class="panel span-2" aria-labelledby="radio-title">
      <h2 id="radio-title">電台</h2>
      <div id="radio-root"></div>
    </section>
  </div>

  <p class="footer-note">公開資料：天文台 · 九巴 ETA · 港鐵 Next Train · RTHK（手動播放）· 設定只存本機</p>
  <div id="settings-overlay" class="settings-overlay" hidden></div>
`;Lt({timeEl:document.querySelector("#clock-time"),dateEl:document.querySelector("#clock-date"),locale:R.locale,timeZone:R.timeZone});const Qt=document.querySelector("#net-status"),W=t=>{Qt.textContent=t},ht=document.querySelector("#settings-overlay");let x=Ft(),J=Ht(),V=Jt();const Xt=document.querySelector("#weather-title"),Z=t=>{Xt.textContent=t?`天氣 · ${t}`:"天氣"},ft=$t(document.querySelector("#weather-root"),R.weather,{onStatus:W,onChangePlace:()=>Q.open("weather")}),vt=qt(document.querySelector("#bus-root"),document.querySelector("#bus-title"),{onStatus:W,onOpenSettings:()=>Q.open("bus")}),yt=_t(document.querySelector("#mtr-root"),document.querySelector("#mtr-title"),{onStatus:W,onOpenSettings:()=>Q.open("mtr")}),Q=zt({overlayRoot:ht,getBusSelection:()=>J,setBusSelection:t=>{J=t},onBusChange:t=>{vt.setSelection(t),W("巴士設定已更新（本機）")},getWeatherPlace:()=>x,onWeatherPlaceChange:t=>{x=t,Z(t),ft.setPlace(t),W("天氣地區已更新（本機）")},getMtrSelection:()=>V,setMtrSelection:t=>{V=t},onMtrChange:t=>{yt.setSelection(t),W("港鐵設定已更新（本機）")}}),lt=()=>{Z(x),ft.start(x),vt.start(J),yt.start(V),Bt(document.querySelector("#radio-root"),R.radio)};x?lt():Gt(ht,{currentPlace:null,onPick:t=>{x=t,Z(t),W(`天氣地區：${t}`),lt()}});"serviceWorker"in navigator&&window.addEventListener("load",()=>{navigator.serviceWorker.register("./sw.js").catch(()=>{})});window.addEventListener("online",()=>W("已連線"));window.addEventListener("offline",()=>W("離線（顯示上次資料）"));
//# sourceMappingURL=index-DVFdOocj.js.map
