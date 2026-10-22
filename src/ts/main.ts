
async function launchActivePresentationInLibreOffice() {
  const item = playlist[activeItemIndex];
  if (!item?.presentationPath) {
    showOfflineToast("LibreOffice Impress", "Selecione uma apresentação importada para abrir com animações.");
    return;
  }
  try {
    const res: any = await tauriInvoke("launch_libreoffice_presentation", {
      filePath: item.presentationPath,
      slideIndex: stagedSlideIndex >= 0 ? stagedSlideIndex + 1 : 1
    });
    if (res && res.success === false) {
      showOfflineToast("LibreOffice Não Encontrado", res.error);
    } else {
      showOfflineToast("▶ Abrindo no LibreOffice", `Iniciando apresentação com animações e efeitos no telão (Slide ${stagedSlideIndex + 1})...`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    showOfflineToast("Aviso LibreOffice", msg);
  }
}

// Altaris Presenter Master Controller (Operator Center)
// macOS / iOS Design Philosophy • Two-Click Staging Workflow • Visual Bible Navigator • Web Lyrics Search
import { store, PlaylistItem, buildObsCss, Slide } from "./engine/state";
import { SlideCompositor } from "./engine/compositor";
import { SongEngine, songToPlaylistItem, Song, OnlineSearchResult } from "./modules/songs";
import { BibleEngine, BibleVerse, BibleVersionInfo, PUBLIC_DOMAIN_CATALOG, COMMUNITY_EXTERNAL_CATALOG, CatalogBibleEntry } from "./modules/bibles";
import { getServerInfo, inTauri, tauriInvoke } from "./engine/server";
import { processImportFiles, convertPresentationToPdf, convertPdfToSlides } from "./engine/mediaImporter";
import { sanitizePptxWithAutoFit, auditPptxPresentation } from "./modules/slideAuditor";
import { checkOllamaStatus, optimizeSlideWithLocalAI } from "./modules/pptxNativeParser";
import { showLoadingHUD, updateLoadingHUD, hideLoadingHUD } from "./engine/loadingHud";


// Toast Notification System for Offline Operations
export function showOfflineToast(title: string, message: string, duration: number = 3800) {
  const host = document.getElementById("offline-toast-container");
  if (!host) return;
  const card = document.createElement("div");
  card.className = "offline-toast-card";
  card.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;">
      <span style="font-weight: 700; color: #6ee7b7; font-size: 0.82rem;">${title}</span>
      <span style="font-size: 0.7rem; opacity: 0.8; color: #a7f3d0;">✓ 100% Offline</span>
    </div>
    <div style="font-size: 0.75rem; color: #cbd5e1; line-height: 1.35;">${message}</div>
  `;
  host.appendChild(card);
  setTimeout(() => {
    card.style.transition = "opacity 0.3s, transform 0.3s";
    card.style.opacity = "0";
    card.style.transform = "translateY(-8px)";
    setTimeout(() => card.remove(), 320);
  }, duration);
}

// Ouvinte global para mensagens toast do sistema
window.addEventListener("altaris:toast", (e: any) => {
  if (e.detail) {
    showOfflineToast(e.detail.title, e.detail.message, e.detail.duration || 6000);
  }
});

// DOM Elements
const gridContainer = (document.getElementById("slide-matrix-grid") || document.getElementById("slide-matrix"))!;
const playlistContainer = document.getElementById("playlist-container")!;
const activeItemTitle = document.getElementById("active-item-title")!;
const activeItemBadge = document.getElementById("active-item-badge")!;
const btnFireStaged = document.getElementById("btn-fire-staged")!;
const quickSearchInput = document.getElementById("quick-search-input") as HTMLInputElement;
const searchResultsList = document.getElementById("search-results-list")!;
const statusClock = document.getElementById("status-clock")!;
const toggleTwoClick = document.getElementById("toggle-two-click") as HTMLInputElement;

const btnBlackout = document.getElementById("btn-blackout")!;
const btnClearText = document.getElementById("btn-clear-text")!;
const btnToggleLive = document.getElementById("btn-toggle-live")!;
const btnPrevSlide = document.getElementById("btn-prev-slide")!;
const btnNextSlide = document.getElementById("btn-next-slide")!;

const btnKeyDown = document.getElementById("btn-key-down")!;
const btnKeyUp = document.getElementById("btn-key-up")!;
const btnKeyReset = document.getElementById("btn-key-reset")!;
const labelCurrentKey = document.getElementById("label-current-key")!;

const alertInput = document.getElementById("alert-input") as HTMLInputElement;
const btnSendAlert = document.getElementById("btn-send-alert")!;
const btnClearAlert = document.getElementById("btn-clear-alert")!;
const btnCountdown5m = document.getElementById("btn-countdown-5m");
const btnCountdown3m = document.getElementById("btn-countdown-3m");

// macOS Bible Pill & Popover Elements
const btnBiblePill = document.getElementById("btn-bible-pill")!;
const labelActiveBible = document.getElementById("label-active-bible")!;
const popoverBibleVersions = document.getElementById("popover-bible-versions")!;
const popoverBibleList = document.getElementById("popover-bible-list")!;
const inputBiblePopoverFile = document.getElementById("input-bible-popover-file") as HTMLInputElement;

// OBS Controls & QR Modal Elements
const selectObsTheme = document.getElementById("select-obs-theme") as HTMLSelectElement;
const inputChurchLogo = document.getElementById("input-church-logo") as HTMLInputElement;
const toggleLowSpec = document.getElementById("toggle-low-spec") as HTMLInputElement;
const btnShowQrWifi = document.getElementById("btn-show-qr-wifi");
const modalQr = document.getElementById("modal-qr")!;
const btnCloseQr = document.getElementById("btn-close-qr")!;
const qrImage = document.getElementById("qr-image") as HTMLElement;
const qrUrlText = document.getElementById("qr-url-text")!;

// Add Item Modal Elements
const btnAddItem = document.getElementById("btn-add-item")!;
const btnOpenWebSearch = document.getElementById("btn-open-web-search")!;
const modalAddItem = document.getElementById("modal-add-item")!;
const btnCloseAddModal = document.getElementById("btn-close-add-modal")!;

// Tab buttons & Panes
const tabBtnBible = document.getElementById("tab-btn-bible")!;
const tabBtnHarpa = document.getElementById("tab-btn-harpa")!;
const tabBtnOnline = document.getElementById("tab-btn-online")!;
const tabBtnCustom = document.getElementById("tab-btn-custom")!;
const tabBtnImport = document.getElementById("tab-btn-import")!;
const tabBtnLibrary = document.getElementById("tab-btn-library") as HTMLElement | null;

const tabPaneBible = document.getElementById("tab-pane-bible")!;
const tabPaneHarpa = document.getElementById("tab-pane-harpa")!;
const tabPaneOnline = document.getElementById("tab-pane-online")!;
const tabPaneCustom = document.getElementById("tab-pane-custom")!;
const tabPaneImport = document.getElementById("tab-pane-import")!;
const tabPaneLibrary = document.getElementById("tab-pane-library") as HTMLElement | null;

// Tab 1 (Bíblia Rápida) Elements
// Modal quick bible tab elements
const selectModalBibleVersion = document.getElementById("select-modal-bible-version") as HTMLSelectElement | null;
const inputBibleFileImport = document.getElementById("input-bible-file-import") as HTMLInputElement | null;
const bibleImportStatus = document.getElementById("bible-import-status");
if (selectModalBibleVersion) {
  selectModalBibleVersion.addEventListener("change", async () => {
    await BibleEngine.setVersion(selectModalBibleVersion.value);
    labelActiveBible.textContent = selectModalBibleVersion.value.toUpperCase();
    navActiveVersionBadge.textContent = selectModalBibleVersion.value.toUpperCase();
  });
}
if (inputBibleFileImport) {
  inputBibleFileImport.addEventListener("change", async () => {
    if (!inputBibleFileImport.files || inputBibleFileImport.files.length === 0) return;
    const f = inputBibleFileImport.files[0];
    const text = await f.text();
    const ver = f.name.endsWith(".json") ? BibleEngine.importBibleJson(f.name.replace(/\.[^/.]+$/, ""), text) : BibleEngine.importBibleXml(f.name.replace(/\.[^/.]+$/, ""), text);
    labelActiveBible.textContent = ver.id.toUpperCase();
    if (bibleImportStatus) {
      bibleImportStatus.style.display = "block";
      bibleImportStatus.innerHTML = `✓ Bíblia "${ver.name}" importada e ativada!`;
      setTimeout(() => { bibleImportStatus.style.display = "none"; }, 3000);
    }
  });
}
const inputBibleQuick = document.getElementById("input-bible-quick") as HTMLInputElement;
const btnBibleSearch = document.getElementById("btn-bible-search")!;
const selectBibleBook = document.getElementById("select-bible-book") as HTMLSelectElement;
const inputBibleChapter = document.getElementById("input-bible-chapter") as HTMLInputElement;
const inputBibleStart = document.getElementById("input-bible-start") as HTMLInputElement;
const inputBibleEnd = document.getElementById("input-bible-end") as HTMLInputElement;
const biblePreviewBox = document.getElementById("bible-preview-box")!;
const btnAddBibleToPlaylist = document.getElementById("btn-add-bible-to-playlist")!;

// Visual Bible Navigator Modal Elements
const btnOpenBibleNav = document.getElementById("btn-open-bible-nav")!;
const modalBibleNavigator = document.getElementById("modal-bible-navigator")!;
const btnCloseBibleNav = document.getElementById("btn-close-bible-nav")!;
const navActiveVersionBadge = document.getElementById("nav-active-version-badge")!;
const navBooksAt = document.getElementById("nav-books-at")!;
const navBooksNt = document.getElementById("nav-books-nt")!;
const navSelectedBookTitle = document.getElementById("nav-selected-book-title")!;
const navChaptersGrid = document.getElementById("nav-chapters-grid")!;
const navVersesHeader = document.getElementById("nav-verses-header")!;
const navVersesList = document.getElementById("nav-verses-list")!;
const btnNavSelectAll = document.getElementById("btn-nav-select-all")!;
const navSelectedSummary = document.getElementById("nav-selected-summary")!;
const btnNavStage = document.getElementById("btn-nav-stage")!;
const btnNavProjectNow = document.getElementById("btn-nav-project-now")!;

// Tab 2 (Harpa) Elements
const inputHarpaSearch = document.getElementById("input-harpa-search") as HTMLInputElement;
const harpaResultsList = document.getElementById("harpa-results-list")!;
const harpaLyricsPreview = document.getElementById("harpa-lyrics-preview")!;
const btnAddHarpaToPlaylist = document.getElementById("btn-add-harpa-to-playlist")!;

// Tab Online Lyrics Elements
const inputOnlineSearch = document.getElementById("input-online-search") as HTMLInputElement;
const btnDoOnlineSearch = document.getElementById("btn-do-online-search")!;
const onlineResultsList = document.getElementById("online-results-list")!;
const onlineLyricsPreview = document.getElementById("online-lyrics-preview")!;
const btnAddOnlineToPlaylist = document.getElementById("btn-add-online-to-playlist")!;

// Tab 3 (Custom Song) Elements
const inputCustomTitle = document.getElementById("input-custom-title") as HTMLInputElement;
const inputCustomArtist = document.getElementById("input-custom-artist") as HTMLInputElement;
const selectCustomKey = document.getElementById("select-custom-key") as HTMLSelectElement;
const textareaCustomLyrics = document.getElementById("textarea-custom-lyrics") as HTMLTextAreaElement;
const btnSaveCustomSong = document.getElementById("btn-save-custom-song")!;

// Tab 4 (Import) Elements
const inputFileImport = document.getElementById("input-file-import") as HTMLInputElement;
const importStatusBox = document.getElementById("import-status-box")!;

// Local State
let playlist: PlaylistItem[] = [];
let activeItemIndex: number = 0;
let liveSlideIndex: number = 0;
let stagedSlideIndex: number = 0;
let isStaged: boolean = false;
let keyOffset: number = 0;

let currentBibleVersesPreview: BibleVerse[] = [];
let selectedHarpaSong: Song | null = null;
let selectedOnlineResult: OnlineSearchResult | null = null;

// Navigator State
let navSelectedBook = "Gênesis";
let navSelectedChapter = 1;
let navSelectedVerses: BibleVerse[] = [];

// Initialize Compositors for Live Previews
const audienceCanvas = document.getElementById("canvas-audience-preview") as HTMLCanvasElement;
const audiencePreview = new SlideCompositor(audienceCanvas, {
  layout: "full",
  showBackground: true,
  alphaChannel: false
});

const streamCanvas = document.getElementById("canvas-stream-preview") as HTMLCanvasElement;
const streamPreview = new SlideCompositor(streamCanvas, {
  layout: "lowerThird",
  showBackground: false,
  alphaChannel: true
});

// Setup Clock
setInterval(() => {
  const d = new Date();
  statusClock.textContent = d.toTimeString().split(" ")[0];
}, 1000);

function renderEmptyWorshipState(
  title = "Culto Pronto",
  message = 'Nenhum item na ordem do culto.<br>Clique em <b style="color: #94a3b8;">"+ Adicionar ao Culto"</b> ou use os atalhos para inserir hinos, passagens bíblicas ou apresentações.'
) {
  gridContainer.innerHTML = `
    <div class="slide-grid-empty">
      <div class="empty-icon">⛪</div>
      <div class="empty-title">${title}</div>
      <div class="empty-desc">${message}</div>
    </div>
  `;
  activeItemTitle.textContent = "Culto Vazio";
  activeItemBadge.style.display = "none";
}

// Initialize Default Playlist (Inicia vazio por padrão)
async function initPlaylist() {
  playlist = [];
  renderPlaylist();
  renderEmptyWorshipState();
}

function updatePlaylistActiveHighlight() {
  Array.from(playlistContainer.children).forEach((child, idx) => {
    if (idx === activeItemIndex) child.classList.add("btn-primary");
    else child.classList.remove("btn-primary");
  });
}

// Reorder Playlist Items
function movePlaylistItem(fromIndex: number, toIndex: number) {
  if (toIndex < 0 || toIndex >= playlist.length || fromIndex === toIndex) return;
  const item = playlist.splice(fromIndex, 1)[0];
  playlist.splice(toIndex, 0, item);

  if (activeItemIndex === fromIndex) {
    activeItemIndex = toIndex;
  } else if (fromIndex < activeItemIndex && toIndex >= activeItemIndex) {
    activeItemIndex--;
  } else if (fromIndex > activeItemIndex && toIndex <= activeItemIndex) {
    activeItemIndex++;
  }

  renderPlaylist();
  syncRemoteState();
  showOfflineToast("Ordem do Culto Alterada", `Item "${item.title}" movido para a posição ${toIndex + 1}.`);
}

// Render Playlist in Left Panel
function renderPlaylist() {
  playlistContainer.innerHTML = "";
  
  const countBadge = document.getElementById("playlist-count-badge");
  if (countBadge) {
    countBadge.textContent = `(${playlist.length} itens)`;
  }

  if (playlist.length === 0) {
    playlistContainer.innerHTML = `
      <div style="padding: 24px 14px; text-align: center; color: #64748b; font-size: 0.8rem; border: 1px dashed rgba(255,255,255,0.12); border-radius: 12px; margin-top: 8px;">
        <div style="font-size: 1.6rem; margin-bottom: 8px;">📋</div>
        <div style="font-weight: 600; color: #94a3b8; margin-bottom: 4px;">Culto Vazio</div>
        <div>Clique nos botões acima (<b>Bíblia</b>, <b>Web</b> ou <b>Harpa</b>) para adicionar itens ao culto.</div>
      </div>
    `;
    return;
  }

  playlist.forEach((item, idx) => {
    const el = document.createElement("div");
    el.className = `glass-panel playlist-item-row ${idx === activeItemIndex ? "btn-primary" : ""}`;
    el.setAttribute("draggable", "true");
    el.setAttribute("data-index", String(idx));
    el.style.padding = "8px 10px";
    el.style.cursor = "pointer";
    el.style.display = "flex";
    el.style.justifyContent = "space-between";
    el.style.alignItems = "center";
    el.style.transition = "var(--transition)";

    const typeBadge = item.type === "song" ? "🎵 HINO" : item.type === "bible" ? "📖 BÍBLIA" : item.type === "media" ? "🖼️ MÍDIA" : "📢 AVISO";
    el.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; flex: 1;">
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <button class="playlist-order-btn btn-order-up" title="Mover para cima" ${idx === 0 ? "disabled" : ""}>▲</button>
          <button class="playlist-order-btn btn-order-down" title="Mover para baixo" ${idx === playlist.length - 1 ? "disabled" : ""}>▼</button>
        </div>
        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-left: 2px; flex: 1;">
          <div style="font-weight: 600; font-size: 0.86rem; overflow: hidden; text-overflow: ellipsis;">${item.title}</div>
          <div style="font-size: 0.72rem; opacity: 0.8; margin-top: 1px;">${item.author || typeBadge} ${item.key ? "• Tom: " + item.key : ""}</div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
        <span style="font-size: 0.7rem; font-weight: 700; opacity: 0.75; white-space: nowrap;">${item.slides.length} slides</span>
        <button class="btn-remove-playlist-item" title="Remover do Culto" style="background: rgba(255,255,255,0.08); border: none; color: #cbd5e1; border-radius: 6px; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; line-height: 1; cursor: pointer; padding: 0;">&times;</button>
      </div>
    `;

    const upBtn = el.querySelector(".btn-order-up") as HTMLButtonElement | null;
    upBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      movePlaylistItem(idx, idx - 1);
    });

    const downBtn = el.querySelector(".btn-order-down") as HTMLButtonElement | null;
    downBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      movePlaylistItem(idx, idx + 1);
    });

    // Drag-and-drop reordering
    el.addEventListener("dragstart", (e) => {
      e.dataTransfer?.setData("text/plain", String(idx));
      el.style.opacity = "0.5";
    });
    el.addEventListener("dragend", () => {
      el.style.opacity = "1";
    });
    el.addEventListener("dragover", (e) => {
      e.preventDefault();
      el.style.borderTop = "2px solid #6366f1";
    });
    el.addEventListener("dragleave", () => {
      el.style.borderTop = "";
    });
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      el.style.borderTop = "";
      const fromIdxStr = e.dataTransfer?.getData("text/plain");
      if (fromIdxStr !== undefined) {
        const fromIdx = parseInt(fromIdxStr, 10);
        if (!isNaN(fromIdx) && fromIdx !== idx) {
          movePlaylistItem(fromIdx, idx);
        }
      }
    });

    const removeBtn = el.querySelector(".btn-remove-playlist-item");
    removeBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      playlist.splice(idx, 1);
      if (playlist.length === 0) {
        activeItemIndex = 0;
        renderPlaylist();
        renderEmptyWorshipState();
      } else {
        if (activeItemIndex >= playlist.length) activeItemIndex = playlist.length - 1;
        renderPlaylist();
        selectPlaylistItem(activeItemIndex, false, 0);
      }
    });

    el.addEventListener("click", () => {
      const autoFire = !toggleTwoClick.checked || item.type === "media";
      selectPlaylistItem(idx, autoFire);
    });

    el.addEventListener("dblclick", () => {
      selectPlaylistItem(idx, true);
    });

    playlistContainer.appendChild(el);
  });

  syncRemoteState();
}

function syncRemoteState() {
  const item = playlist[activeItemIndex];
  const playlistSummary = playlist.map((it, idx) => ({
    index: idx,
    id: it.id,
    title: it.title,
    type: it.type,
    slideCount: it.slides.length
  }));
  const activeItemSlides = (item?.slides || []).map((sl, idx) => ({
    index: idx,
    header: sl.header || sl.title,
    text: sl.text,
    category: sl.category
  }));
  store.setState({
    activeItemIndex,
    liveSlideIndex,
    playlistSummary,
    activeItemSlides,
    activeBibleVersion: BibleEngine.getActiveVersion()
  });
}

function selectPlaylistItem(index: number, fireImmediately: boolean = false, startSlideIndex: number = 0) {
  if (index < 0 || index >= playlist.length) return;
  activeItemIndex = index;
  const initialSlide = Math.min(Math.max(0, startSlideIndex), (playlist[index]?.slides.length || 1) - 1);
  stagedSlideIndex = initialSlide;

  // Atualiza destaque sem destruir o DOM para preservar duplo-clique
  if (playlistContainer.children.length === playlist.length) {
    updatePlaylistActiveHighlight();
  } else {
    renderPlaylist();
  }

  const item = playlist[index];
  if (!item) return;

  activeItemTitle.textContent = item.title;
  activeItemBadge.style.display = "inline-block";
  activeItemBadge.textContent = item.type.toUpperCase();

  const btnImpress = document.getElementById("btn-launch-impress");
  if (btnImpress) {
    btnImpress.style.display = item.presentationPath ? "inline-flex" : "none";
  }
  const btnAi = document.getElementById("btn-ai-optimize");
  if (btnAi) {
    btnAi.style.display = (item.type === "media" && item.slides.length > 0) ? "inline-flex" : "none";
  }

  const btnAudit = document.getElementById("btn-audit-report");
  const btnAuditText = document.getElementById("btn-audit-report-text");
  if (btnAudit && btnAuditText) {
    if (item.auditReport) {
      btnAudit.style.display = "inline-flex";
      btnAudit.classList.remove("audit-ok", "audit-warn");
      if (item.auditReport.overflowSlides === 0) {
        btnAudit.classList.add("audit-ok");
        btnAuditText.textContent = "🛡️ Layout OK";
      } else {
        btnAudit.classList.add("audit-warn");
        btnAuditText.textContent = `⚠️ Layout (${item.auditReport.overflowSlides})`;
      }
    } else {
      btnAudit.style.display = "none";
    }
  }

  renderSlideMatrix(item);

  if (fireImmediately) {
    fireSlide(initialSlide);
  } else {
    stageSlide(initialSlide);
    syncRemoteState();
  }
}

function renderSlideMatrix(item: PlaylistItem) {
  gridContainer.innerHTML = "";

  item.slides.forEach((slide, idx) => {
    const card = document.createElement("div");
    const isLive = idx === liveSlideIndex && store.getState().currentSlide?.id === slide.id;
    const isThisStaged = isStaged && idx === stagedSlideIndex && !isLive;

    card.className = `slide-card ${isLive ? "is-live" : ""} ${isThisStaged ? "is-staged" : ""}`;
    if (slide.mediaUrl && slide.mediaType !== "video") {
      card.style.backgroundImage = `linear-gradient(rgba(10, 12, 18, 0.55), rgba(10, 12, 18, 0.75)), url(${slide.mediaUrl})`;
      card.style.backgroundSize = "cover";
      card.style.backgroundPosition = "center";
    }

    const badgeClass =
      slide.category === "verse"
        ? "slide-badge-verse"
        : slide.category === "chorus"
        ? "slide-badge-chorus"
        : slide.category === "bridge"
        ? "slide-badge-bridge"
        : slide.category === "bible"
        ? "slide-badge-bible"
        : slide.category === "media"
        ? "slide-badge-media"
        : "slide-badge-pill";

    let previewBody = `<div class="slide-text-preview">${slide.text.replace(/\n/g, "<br>")}</div>`;
    if (slide.mediaUrl && !slide.text) {
      if (slide.mediaType === "video") {
        previewBody = `
          <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
            <video src="${slide.mediaUrl}" muted loop autoplay playsinline style="width: 100%; height: 92px; object-fit: cover; border-radius: 6px; background: #000; border: 1px solid rgba(255,255,255,0.12);"></video>
            <div style="display: flex; gap: 6px; align-items: center; justify-content: space-between;">
              <span style="font-size: 0.74rem; color: #38bdf8; font-weight: 700;">🎬 Vídeo em Loop</span>
              <div style="display: flex; gap: 4px;">
                <button class="btn btn-video-playpause" style="padding: 2px 8px; font-size: 0.7rem;">⏯ Play/Pausa</button>
                <button class="btn btn-video-restart" style="padding: 2px 8px; font-size: 0.7rem;">🔄 Início</button>
              </div>
            </div>
          </div>
        `;
      } else {
        previewBody = `<div class="slide-visual-preview" style="min-height: 84px;"></div>`;
      }
    }

    card.innerHTML = `
      <div class="slide-card-header">
        <span class="slide-badge-pill ${badgeClass}">${slide.title}</span>
        <div class="slide-status-tag-area">
          ${(slide.auditStatus === "overflow" || slide.auditStatus === "warning") && slide.category !== "media" ? `<span class="slide-badge-pill" style="background: rgba(245, 158, 11, 0.22); border: 1px solid rgba(245, 158, 11, 0.5); color: #fbbf24; font-size: 0.62rem; margin-right: 4px;" title="${slide.auditIssue || "Aviso de transbordo"}">⚠️ Transbordo</span>` : ""}
          ${isLive ? '<span class="status-tag-live">🔴 NO AR</span>' : isThisStaged ? '<span class="status-tag-staged">🟡 PRÉVIA</span>' : ''}
        </div>
      </div>
      ${previewBody}
      ${slide.chords ? `<div class="slide-chords-preview">${slide.chords.split("\n")[0] || ""}</div>` : ""}
    `;

    const btnPlayPause = card.querySelector(".btn-video-playpause");
    btnPlayPause?.addEventListener("click", (e) => {
      e.stopPropagation();
      fireSlide(idx);
      const playing = audiencePreview.toggleSlideVideoPlay();
      const thumbVid = card.querySelector("video");
      if (thumbVid) {
        if (playing) thumbVid.play().catch(() => {});
        else thumbVid.pause();
      }
    });

    const btnRestart = card.querySelector(".btn-video-restart");
    btnRestart?.addEventListener("click", (e) => {
      e.stopPropagation();
      fireSlide(idx);
      audiencePreview.restartSlideVideo();
      const thumbVid = card.querySelector("video");
      if (thumbVid) {
        thumbVid.currentTime = 0;
        thumbVid.play().catch(() => {});
      }
    });

    // 1-Click: Direct Fire by default, or Stage if 2-Click mode is enabled (never re-stage an already live slide!)
    card.addEventListener("click", () => {
      const alreadyLive = store.getState().currentSlide?.id === slide.id;
      if (!toggleTwoClick.checked || alreadyLive) {
        fireSlide(idx);
      } else {
        if (isStaged && stagedSlideIndex === idx) {
          fireSlide(idx);
        } else {
          stageSlide(idx);
        }
      }
    });

    // Double-click always fires to screen
    card.addEventListener("dblclick", () => {
      fireSlide(idx);
    });

    gridContainer.appendChild(card);
  });
}

// Stage a slide for preview without affecting the audience projector
function stageSlide(index: number) {
  const item = playlist[activeItemIndex];
  if (!item || !item.slides[index]) return;

  stagedSlideIndex = index;
  isStaged = true;

  updateSlideCardClasses();
}

// Fire slide to live projection & OBS
function fireSlide(index: number) {
  const item = playlist[activeItemIndex];
  if (!item || !item.slides[index]) return;

  liveSlideIndex = index;
  stagedSlideIndex = index;
  isStaged = false;

  const current = item.slides[index];
  const next = item.slides[index + 1] || (playlist[activeItemIndex + 1]?.slides[0] ?? null);

  store.setState({
    currentSlide: current,
    nextSlide: next,
    activeItemIndex,
    liveSlideIndex
  });

  syncRemoteState();
  updateSlideCardClasses();
}

function updateSlideCardClasses() {
  const cards = gridContainer.querySelectorAll(".slide-card");
  const currentLive = store.getState().currentSlide;
  const item = playlist[activeItemIndex];

  cards.forEach((c, idx) => {
    const isLive = item?.slides[idx]?.id === currentLive?.id;
    const isThisStaged = isStaged && idx === stagedSlideIndex && !isLive;

    if (isLive) {
      c.classList.add("is-live");
      c.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      c.classList.remove("is-live");
    }

    if (isThisStaged) c.classList.add("is-staged");
    else c.classList.remove("is-staged");

    const tagArea = c.querySelector(".slide-status-tag-area");
    if (tagArea) {
      if (isLive) tagArea.innerHTML = '<span class="status-tag-live">🔴 NO AR</span>';
      else if (isThisStaged) tagArea.innerHTML = '<span class="status-tag-staged">🟡 PRÉVIA</span>';
      else tagArea.innerHTML = '';
    }
  });

  const stagingBanner = document.getElementById("staging-banner");
  const stagedSlideName = document.getElementById("staged-slide-name");
  if (stagingBanner && stagedSlideName) {
    const targetSlide = item?.slides[stagedSlideIndex];
    const isAlreadyLive = targetSlide && targetSlide.id === currentLive?.id;
    if (isStaged && targetSlide && !isAlreadyLive) {
      stagingBanner.style.display = "flex";
      stagedSlideName.textContent = targetSlide.title;
    } else {
      stagingBanner.style.display = "none";
    }
  }
}

btnFireStaged.addEventListener("click", () => {
  if (isStaged) fireSlide(stagedSlideIndex);
});

function nextSlide() {
  const item = playlist[activeItemIndex];
  if (!item) return;

  // Se houver um slide engatilhado na prévia amarela diferente do ao vivo, projeta ele imediatamente!
  if (isStaged && stagedSlideIndex !== liveSlideIndex) {
    fireSlide(stagedSlideIndex);
    return;
  }

  const targetIdx = liveSlideIndex + 1;

  if (targetIdx < item.slides.length) {
    fireSlide(targetIdx);
  } else if (item.type === "bible") {
    // Leitura Bíblica Contínua: se o pastor continuar pregando, carrega o próximo capítulo automaticamente!
    try {
      const lastSlide = item.slides[item.slides.length - 1];
      const match = lastSlide.header?.match(/^([0-9]?[a-zá-ú\s]+)\s+([0-9]+):([0-9]+)/i);
      if (match) {
        const book = match[1].trim();
        const nextChap = parseInt(match[2], 10) + 1;
        const nextVerses = BibleEngine.getChapterVerses(book, nextChap);
        if (nextVerses.length > 0) {
          const nextSlides = nextVerses.map(v => BibleEngine.verseToSlide(v));
          item.slides.push(...nextSlides);
          item.title = `${book} ${match[2]}-${nextChap} (${BibleEngine.getActiveVersion().toUpperCase()})`;
          activeItemTitle.textContent = item.title;
          renderSlideMatrix(item);
          fireSlide(targetIdx);
          return;
        }
      }
    } catch (e) {
      console.warn("Continuar capítulo bíblico:", e);
    }
    // Trava de segurança no item atual
    if (store.getState().lockToCurrentItem) {
      showOfflineToast("Fim da Leitura Bíblica", "Último versículo deste capítulo. Trava ativa para não invadir outro item sem querer.");
      return;
    }
    if (activeItemIndex + 1 < playlist.length) {
      selectPlaylistItem(activeItemIndex + 1, true, 0);
    }
  } else {
    // Fim da música ou outro item
    if (store.getState().lockToCurrentItem) {
      showOfflineToast("Fim do Hino / Item", "Último slide atingido. Trava de segurança ativa para não trocar de louvor sem querer.");
      return;
    }
    if (activeItemIndex + 1 < playlist.length) {
      selectPlaylistItem(activeItemIndex + 1, true, 0);
    }
  }
}

function prevSlide() {
  const targetIdx = liveSlideIndex - 1;
  if (targetIdx >= 0) {
    fireSlide(targetIdx);
  } else {
    if (store.getState().lockToCurrentItem) {
      showOfflineToast("Início do Item", "Você já está no primeiro slide deste item.");
      return;
    }
    if (activeItemIndex > 0) {
      selectPlaylistItem(activeItemIndex - 1, true, 0);
      const item = playlist[activeItemIndex];
      if (item && item.slides.length > 0) {
        fireSlide(item.slides.length - 1);
      }
    }
  }
}


// macOS Bible Pill & Popover Logic
btnBiblePill.addEventListener("click", (e) => {
  e.stopPropagation();
  const isHidden = popoverBibleVersions.style.display === "none";
  popoverBibleVersions.style.display = isHidden ? "block" : "none";
  if (isHidden) renderBiblePopoverList();
});

btnBiblePill.addEventListener("dblclick", (e) => {
  e.stopPropagation();
  popoverBibleVersions.style.display = "none";
  modalBibleNavigator.style.display = "flex";
  renderBibleNavigator();
});

document.addEventListener("click", (e) => {
  if (!popoverBibleVersions.contains(e.target as Node) && e.target !== btnBiblePill) {
    popoverBibleVersions.style.display = "none";
  }
});

function renderBiblePopoverList() {
  const versions = BibleEngine.getAvailableVersions();
  const active = BibleEngine.getActiveVersion();

  const btnOpenNav = document.getElementById("btn-popover-open-visual-bible");
  if (btnOpenNav) {
    btnOpenNav.onclick = () => {
      popoverBibleVersions.style.display = "none";
      modalBibleNavigator.style.display = "flex";
      renderBibleNavigator();
    };
  }

  popoverBibleList.innerHTML = "";
  versions.forEach((v) => {
    const row = document.createElement("div");
    const isActive = v.id === active;
    row.className = `popover-item ${isActive ? "active" : ""}`;
    row.style.whiteSpace = "nowrap";
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.justifyContent = "space-between";
    row.style.gap = "12px";
    row.style.padding = "8px 12px";
    row.innerHTML = `
      <span style="font-weight: ${isActive ? "700" : "500"}; color: ${isActive ? "#fff" : "#cbd5e1"};">${v.name}</span>
      ${isActive ? `<span style="color: #6366f1; font-weight: 800;">✓</span>` : `<span style="color: transparent;">✓</span>`}
    `;
    row.addEventListener("click", async () => {
      await BibleEngine.setVersion(v.id);
      labelActiveBible.textContent = v.id.toUpperCase();
      navActiveVersionBadge.textContent = v.id.toUpperCase();
      popoverBibleVersions.style.display = "none";
      renderBiblePopoverList();
      populateBibleBooks(true);
      updateBiblePreviewFromDropdowns();

      // Open the visual Bible Navigator immediately!
      modalBibleNavigator.style.display = "flex";
      renderBibleNavigator();
    });
    popoverBibleList.appendChild(row);
  });
}

inputBiblePopoverFile.addEventListener("change", async () => {
  if (!inputBiblePopoverFile.files || inputBiblePopoverFile.files.length === 0) return;
  const file = inputBiblePopoverFile.files[0];
  try {
    const text = await file.text();
    let versionInfo;
    if (file.name.endsWith(".json")) {
      versionInfo = BibleEngine.importBibleJson(file.name.replace(/\.[^/.]+$/, ""), text);
    } else {
      versionInfo = BibleEngine.importBibleXml(file.name.replace(/\.[^/.]+$/, ""), text);
    }
    labelActiveBible.textContent = versionInfo.id.toUpperCase();
    navActiveVersionBadge.textContent = versionInfo.id.toUpperCase();
    renderBiblePopoverList();
    populateBibleBooks(true);
    alert(`Bíblia "${versionInfo.name}" importada com sucesso e definida como ativa!`);
  } catch (err: any) {
    alert("Erro ao importar Bíblia: " + err.message);
  }
});

// Visual Bible Navigator (macOS / iPadOS style)
btnOpenBibleNav.addEventListener("click", () => {
  modalBibleNavigator.style.display = "flex";
  navActiveVersionBadge.textContent = BibleEngine.getActiveVersion().toUpperCase();
  renderBibleNavigator();
});

btnCloseBibleNav.addEventListener("click", () => {
  modalBibleNavigator.style.display = "none";
});

modalBibleNavigator.addEventListener("click", (e) => {
  if (e.target === modalBibleNavigator) modalBibleNavigator.style.display = "none";
});

function renderBibleNavigator() {
  const atBooks = BibleEngine.getOldTestamentBooks();
  const ntBooks = BibleEngine.getNewTestamentBooks();

  navBooksAt.innerHTML = "";
  atBooks.forEach((b) => {
    const btn = document.createElement("button");
    btn.className = `bible-book-btn ${b.name === navSelectedBook ? "active" : ""}`;
    btn.innerHTML = `<span>${b.name}</span><span style="opacity: 0.6; font-size: 0.7rem;">${b.chapterCount}c</span>`;
    btn.addEventListener("click", () => selectNavigatorBook(b.name, b.chapterCount));
    navBooksAt.appendChild(btn);
  });

  navBooksNt.innerHTML = "";
  ntBooks.forEach((b) => {
    const btn = document.createElement("button");
    btn.className = `bible-book-btn ${b.name === navSelectedBook ? "active" : ""}`;
    btn.innerHTML = `<span>${b.name}</span><span style="opacity: 0.6; font-size: 0.7rem;">${b.chapterCount}c</span>`;
    btn.addEventListener("click", () => selectNavigatorBook(b.name, b.chapterCount));
    navBooksNt.appendChild(btn);
  });

  const cur = BibleEngine.getBooks().find((b) => b.name === navSelectedBook) || atBooks[0];
  if (cur) selectNavigatorBook(cur.name, cur.chapterCount);
}

function selectNavigatorBook(bookName: string, chapterCount: number) {
  navSelectedBook = bookName;
  navSelectedChapter = 1;
  navSelectedVerses = [];

  // Update book buttons active state
  document.querySelectorAll(".bible-book-btn").forEach((btn) => {
    if (btn.textContent?.includes(bookName)) btn.classList.add("active");
    else btn.classList.remove("active");
  });

  navSelectedBookTitle.textContent = `${bookName} (${chapterCount} Capítulos)`;

  navChaptersGrid.innerHTML = "";
  for (let c = 1; c <= chapterCount; c++) {
    const cBtn = document.createElement("button");
    cBtn.className = `chapter-btn ${c === 1 ? "active" : ""}`;
    cBtn.textContent = String(c);
    cBtn.addEventListener("click", () => selectNavigatorChapter(c));
    navChaptersGrid.appendChild(cBtn);
  }

  selectNavigatorChapter(1);
}

function selectNavigatorChapter(chapter: number) {
  navSelectedChapter = chapter;
  navSelectedVerses = [];

  Array.from(navChaptersGrid.children).forEach((c, idx) => {
    if (idx + 1 === chapter) c.classList.add("active");
    else c.classList.remove("active");
  });

  navVersesHeader.textContent = `${navSelectedBook} - Capítulo ${chapter}`;
  const verses = BibleEngine.getChapterVerses(navSelectedBook, chapter);

  navVersesList.innerHTML = "";
  verses.forEach((v) => {
    const row = document.createElement("div");
    row.className = "verse-item-row";
    row.innerHTML = `<b style="color: #10b981;">${v.verse}.</b> ${v.text}`;

    row.addEventListener("click", () => {
      const idx = navSelectedVerses.findIndex((sv) => sv.verse === v.verse);
      if (idx >= 0) {
        navSelectedVerses.splice(idx, 1);
        row.classList.remove("selected");
      } else {
        navSelectedVerses.push(v);
        navSelectedVerses.sort((a, b) => a.verse - b.verse);
        row.classList.add("selected");
      }
      updateNavigatorSummary();
    });

    navVersesList.appendChild(row);
  });

  updateNavigatorSummary();
}

btnNavSelectAll.addEventListener("click", () => {
  const verses = BibleEngine.getChapterVerses(navSelectedBook, navSelectedChapter);
  navSelectedVerses = [...verses];
  Array.from(navVersesList.children).forEach((el) => el.classList.add("selected"));
  updateNavigatorSummary();
});

function updateNavigatorSummary() {
  if (navSelectedVerses.length === 0) {
    navSelectedSummary.textContent = "Nenhum versículo selecionado (clique para escolher)";
    return;
  }
  const first = navSelectedVerses[0].verse;
  const last = navSelectedVerses[navSelectedVerses.length - 1].verse;
  const range = first === last ? `${first}` : `${first}-${last}`;
  navSelectedSummary.innerHTML = `Selecionado: <b style="color: #fff;">${navSelectedBook} ${navSelectedChapter}:${range}</b> (${navSelectedVerses.length} slides)`;
}

btnNavStage.addEventListener("click", () => {
  if (navSelectedVerses.length === 0) {
    alert("Selecione pelo menos um versículo para engatilhar.");
    return;
  }
  const res = BibleEngine.versesToPlaylistItem(navSelectedVerses, true);
  playlist.splice(activeItemIndex + 1, 0, res.item);
  renderPlaylist();
  selectPlaylistItem(activeItemIndex + 1, false, res.startSlideIndex); // Stage at selected verse
  modalBibleNavigator.style.display = "none";
});

btnNavProjectNow.addEventListener("click", () => {
  if (navSelectedVerses.length === 0) {
    alert("Selecione pelo menos um versículo para projetar.");
    return;
  }
  const res = BibleEngine.versesToPlaylistItem(navSelectedVerses, true);
  playlist.splice(activeItemIndex + 1, 0, res.item);
  renderPlaylist();
  selectPlaylistItem(activeItemIndex + 1, true, res.startSlideIndex); // Fire at selected verse
  modalBibleNavigator.style.display = "none";
});

// Web Lyrics Search Logic
btnOpenWebSearch.addEventListener("click", () => {
  modalAddItem.style.display = "flex";
  switchTab(tabBtnOnline, tabPaneOnline);
});

let currentOnlineResults: OnlineSearchResult[] = [];
let currentOnlineSelectedIdx = 0;

function addOnlineResultNow(r: OnlineSearchResult) {
  const song = SongEngine.parseLyricsToSong(r.title, r.artist, "C", r.plainLyrics);
  SongEngine.saveCustomSong(song);
  const item = songToPlaylistItem(song, keyOffset);
  playlist.splice(activeItemIndex + 1, 0, item);
  renderPlaylist();
  selectPlaylistItem(activeItemIndex + 1, !toggleTwoClick.checked, 0);
  modalAddItem.style.display = "none";
  showOfflineToast("Louvor Salvo 100% Offline", `"${r.title}" baixado e armazenado na sua Biblioteca local.`);
}

function selectOnlineResultByIndex(idx: number) {
  if (idx < 0 || idx >= currentOnlineResults.length) return;
  currentOnlineSelectedIdx = idx;
  const r = currentOnlineResults[idx];
  selectedOnlineResult = r;

  Array.from(onlineResultsList.children).forEach((c, i) => {
    const el = c as HTMLElement;
    el.style.background = i === idx ? "rgba(99, 102, 241, 0.25)" : "";
    if (i === idx) el.scrollIntoView({ block: "nearest" });
  });

  const formatted = SongEngine.parseLyricsToSong(r.title, r.artist, "C", r.plainLyrics);
  onlineLyricsPreview.innerHTML = `
    <div style="font-weight: 700; color: #818cf8; margin-bottom: 6px;">${r.title} - ${r.artist}</div>
    ${formatted.slides.map((s) => `<div style="margin-bottom: 6px;"><b>${s.label}:</b><br>${s.lyrics.replace(/\n/g, "<br>")}</div>`).join("")}
  `;
}

btnDoOnlineSearch.addEventListener("click", executeOnlineSearch);
inputOnlineSearch.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (currentOnlineResults.length > 0) {
      selectOnlineResultByIndex(Math.min(currentOnlineSelectedIdx + 1, currentOnlineResults.length - 1));
    }
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (currentOnlineResults.length > 0) {
      selectOnlineResultByIndex(Math.max(currentOnlineSelectedIdx - 1, 0));
    }
  } else if (e.key === "Enter") {
    e.preventDefault();
    executeOnlineSearch();
  }
});

async function executeOnlineSearch() {
  const q = inputOnlineSearch.value.trim();
  if (!q) return;

  onlineResultsList.innerHTML = `<div style="padding: 16px; text-align: center; color: #818cf8;">🔍 Buscando na web e no banco local...</div>`;
  const results = await SongEngine.searchOnlineLyrics(q);
  currentOnlineResults = results;

  if (results.length === 0) {
    onlineResultsList.innerHTML = `<div style="padding: 16px; text-align: center; color: #ef4444;">Nenhuma letra encontrada para "${q}". Tente outro termo ou adicione manualmente na aba "Nova Letra".</div>`;
    return;
  }

  onlineResultsList.innerHTML = "";
  results.forEach((r, idx) => {
    const row = document.createElement("div");
    row.style.padding = "8px 10px";
    row.style.borderBottom = "1px solid var(--border-subtle)";
    row.style.cursor = "pointer";
    row.style.fontSize = "0.8rem";
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.alignItems = "center";
    row.style.gap = "8px";
    row.innerHTML = `
      <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        <div style="font-weight: 700; color: #f8fafc; overflow: hidden; text-overflow: ellipsis;">${r.title}</div>
        <div style="font-size: 0.72rem; color: #94a3b8; overflow: hidden; text-overflow: ellipsis;">${r.artist}</div>
      </div>
      <button class="btn btn-primary btn-quick-add-online" style="padding: 3px 8px; font-size: 0.7rem; white-space: nowrap; flex-shrink: 0;">+ Projetar</button>
    `;

    row.querySelector(".btn-quick-add-online")?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      addOnlineResultNow(r);
    });

    row.addEventListener("click", () => {
      selectOnlineResultByIndex(idx);
    });

    row.addEventListener("dblclick", () => {
      addOnlineResultNow(r);
    });

    onlineResultsList.appendChild(row);
  });

  // Auto-seleciona o 1º resultado imediatamente!
  selectOnlineResultByIndex(0);
}

btnAddOnlineToPlaylist.addEventListener("click", () => {
  if (!selectedOnlineResult) {
    alert("Selecione uma música da lista para adicionar.");
    return;
  }
  addOnlineResultNow(selectedOnlineResult);
});

// Countdown Timer logic
let countdownInterval: any = null;
function startCountdown(minutes: number) {
  let secondsLeft = minutes * 60;
  if (countdownInterval) clearInterval(countdownInterval);

  countdownInterval = setInterval(() => {
    if (secondsLeft <= 0) {
      clearInterval(countdownInterval);
      store.setState({ alertMessage: "O Culto vai começar! Sejam todos bem-vindos!" });
      setTimeout(() => store.setState({ alertMessage: "" }), 6000);
      return;
    }
    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    const timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    store.setState({ alertMessage: `⏱ O culto iniciará em: ${timeStr}` });
    secondsLeft--;
  }, 1000);
}

btnCountdown5m?.addEventListener("click", () => startCountdown(5));
btnCountdown3m?.addEventListener("click", () => startCountdown(3));

// Chords Transposition Controls
function updateKeyTransposition(delta: number, reset: boolean = false) {
  if (reset) keyOffset = 0;
  else keyOffset += delta;

  labelCurrentKey.textContent =
    keyOffset === 0 ? "Original (0)" : keyOffset > 0 ? `+${keyOffset} Semitons` : `${keyOffset} Semitons`;

  const currentItem = playlist[activeItemIndex];
  if (currentItem && currentItem.type === "song") {
    const originalSong = SongEngine.getAllSongs().find((s) => s.id === currentItem.id);
    if (originalSong) {
      playlist[activeItemIndex] = songToPlaylistItem(originalSong, keyOffset);
      renderSlideMatrix(playlist[activeItemIndex]);
      if (!isStaged) fireSlide(liveSlideIndex);
      else stageSlide(stagedSlideIndex);
    }
  }
}

btnKeyUp.addEventListener("click", () => updateKeyTransposition(1));
btnKeyDown.addEventListener("click", () => updateKeyTransposition(-1));
btnKeyReset.addEventListener("click", () => updateKeyTransposition(0, true));

btnBlackout.addEventListener("click", () => {
  const s = store.getState();
  store.setState({ isBlackout: !s.isBlackout });
  btnBlackout.style.background = !s.isBlackout ? "var(--live-color)" : "";
});

btnClearText.addEventListener("click", () => {
  const s = store.getState();
  store.setState({ isClearText: !s.isClearText });
  btnClearText.style.background = !s.isClearText ? "var(--accent-primary)" : "";
});

btnToggleLive.addEventListener("click", () => {
  const s = store.getState();
  const nextState = !s.isLive;
  store.setState({ isLive: nextState });
  if (nextState) {
    btnToggleLive.classList.add("active");
    btnToggleLive.textContent = "AO VIVO";
  } else {
    btnToggleLive.classList.remove("active");
    btnToggleLive.textContent = "OFFLINE";
  }
});

btnNextSlide.addEventListener("click", nextSlide);
btnPrevSlide.addEventListener("click", prevSlide);

btnSendAlert.addEventListener("click", () => {
  const msg = alertInput.value.trim();
  store.setState({ alertMessage: msg });
});

btnClearAlert.addEventListener("click", () => {
  alertInput.value = "";
  if (countdownInterval) clearInterval(countdownInterval);
  store.setState({ alertMessage: "" });
});

// OBS Lower Third & Logos
selectObsTheme?.addEventListener("change", (e) => {
  const target = e.target as HTMLSelectElement;
  const theme = target.value as any;
  let shape: "pill" | "card" | "full-width" | "minimal" = "pill";
  let accent = store.getState().obsAccentColor || "#6366f1";

  if (theme === "clean-minimal") {
    shape = "minimal";
  } else if (theme === "full-width") {
    shape = "full-width";
  } else if (theme === "bible-box") {
    shape = "card";
    accent = "#10b981";
  } else if (theme === "glass-pill") {
    shape = "pill";
    accent = "#6366f1";
  }

  const st = store.getState();
  const updated = { ...st, obsTheme: theme, obsShape: shape, obsAccentColor: accent };
  const newCss = buildObsCss(updated);

  store.setState({
    obsTheme: theme,
    obsShape: shape,
    obsAccentColor: accent,
    obsCustomCss: newCss
  });

  syncSegmentedGroup("seg-obs-shape", shape);
  updateObsLivePreview();
});

inputChurchLogo?.addEventListener("change", () => {
  if (inputChurchLogo.files && inputChurchLogo.files[0]) {
    const file = inputChurchLogo.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      store.setState({ churchLogo: base64, churchLogoName: file.name });
      updateSelectedMediaBadges();
      showOfflineToast("Logotipo Atualizado", `"${file.name}" carregado para a transmissão OBS.`);
    };
    reader.readAsDataURL(file);
  }
});

toggleLowSpec?.addEventListener("change", (e) => {
  const target = e.target as HTMLInputElement;
  store.setState({ lowSpecMode: target.checked });
});

async function showQrModal() {
  const info = await getServerInfo();
  if (!info) {
    qrImage.textContent = "";
    qrUrlText.textContent = "O QR Code só funciona no aplicativo nativo (não no navegador de desenvolvimento).";
  } else {
    const remoteUrl = `http://${info.ip}:${info.port}/remote.html`;
    qrImage.innerHTML = info.qr_svg;
    const svg = qrImage.querySelector("svg");
    if (svg) {
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.style.maxWidth = "200px";
      svg.style.maxHeight = "200px";
      svg.style.display = "block";
      svg.style.margin = "0 auto";
    }
    qrImage.style.cursor = "pointer";
    qrImage.title = "Clique para copiar e abrir o Controle Remoto no navegador";
    qrUrlText.style.cursor = "pointer";
    qrUrlText.innerHTML = `<span style="text-decoration: underline;">${info.ip}:${info.port}/remote.html</span><br>PIN: <b>${info.pin}</b> <span style="font-size: 0.72rem; color: #38bdf8; display: block; margin-top: 4px;">📋 Clique para copiar link / testar</span>`;
    const copyAndOpenRemote = async () => {
      try { await navigator.clipboard.writeText(remoteUrl); } catch {}
      window.open(remoteUrl, "_blank");
    };
    qrImage.onclick = copyAndOpenRemote;
    qrUrlText.onclick = copyAndOpenRemote;
  }
  modalQr.style.display = "flex";
}

btnShowQrWifi?.addEventListener("click", showQrModal);
document.getElementById("pref-btn-show-qr")?.addEventListener("click", showQrModal);
btnCloseQr?.addEventListener("click", () => {
  modalQr.style.display = "none";
});
modalQr?.addEventListener("click", (e) => {
  if (e.target === modalQr) modalQr.style.display = "none";
});

// Double-click on Monitor do Telão opens/toggles Projetor do Público (F5)
audienceCanvas?.addEventListener("dblclick", () => {
  document.getElementById("btn-open-audience")?.click();
});

async function pickMonitor(): Promise<number | null> {
  try {
    const d = await tauriInvoke<unknown[]>("get_displays");
    return d.length > 1 ? d.length - 1 : null;
  } catch {
    return null;
  }
}

document.getElementById("btn-open-audience")?.addEventListener("click", async () => {
  if (inTauri()) await tauriInvoke("toggle_audience_window", { monitorIndex: await pickMonitor() });
  else window.open("/audience.html", "AudienceWindow", "width=1280,height=720,menubar=no,toolbar=no");
});

document.getElementById("btn-open-stage")?.addEventListener("click", async () => {
  if (inTauri()) await tauriInvoke("toggle_stage_window", { monitorIndex: await pickMonitor() });
  else window.open("/stage.html", "StageWindow", "width=1024,height=600,menubar=no,toolbar=no");
});

const btnStream = document.getElementById("btn-open-stream")!;
btnStream.addEventListener("click", async () => {
  const info = await getServerInfo();
  const targetUrl = info ? info.obs_url : "http://localhost:7878/stream.html";
  window.open(targetUrl, "StreamWindow", "width=1280,height=720,menubar=no,toolbar=no");
  try { await navigator.clipboard.writeText(targetUrl); } catch (e) {}
});

document.getElementById("btn-open-remote")?.addEventListener("click", () => void showQrModal());
document.getElementById("btn-open-obs-settings")?.addEventListener("click", () => {
  if (popoverScreens) popoverScreens.style.display = "none";
  openPreferences("obs");
});

// Modal Adicionar Item (+ Item)
function switchTab(activeBtn: HTMLElement, activePane: HTMLElement) {
  const allBtns = [tabBtnBible, tabBtnHarpa, tabBtnOnline, tabBtnCustom, tabBtnImport, tabBtnLibrary].filter(Boolean) as HTMLElement[];
  const allPanes = [tabPaneBible, tabPaneHarpa, tabPaneOnline, tabPaneCustom, tabPaneImport, tabPaneLibrary].filter(Boolean) as HTMLElement[];
  allBtns.forEach((b) => b?.classList.remove("active-tab-btn"));
  allPanes.forEach((p) => {
    if (p) p.style.display = "none";
  });
  activeBtn.classList.add("active-tab-btn");
  activePane.style.display = "block";
}

tabBtnBible?.addEventListener("click", () => switchTab(tabBtnBible, tabPaneBible));
tabBtnHarpa?.addEventListener("click", () => {
  switchTab(tabBtnHarpa, tabPaneHarpa);
  renderHarpaList(inputHarpaSearch.value);
});
tabBtnOnline?.addEventListener("click", () => switchTab(tabBtnOnline, tabPaneOnline));
tabBtnCustom?.addEventListener("click", () => switchTab(tabBtnCustom, tabPaneCustom));
tabBtnImport?.addEventListener("click", () => switchTab(tabBtnImport, tabPaneImport));

if (tabBtnLibrary && tabPaneLibrary) {
  tabBtnLibrary.addEventListener("click", () => {
    switchTab(tabBtnLibrary, tabPaneLibrary);
    renderOfflineLibrary();
  });
}

document.getElementById("pill-quick-library")?.addEventListener("click", () => {
  modalAddItem.style.display = "flex";
  if (tabBtnLibrary && tabPaneLibrary) {
    switchTab(tabBtnLibrary, tabPaneLibrary);
    renderOfflineLibrary();
  }
});

document.getElementById("mi-offline-library")?.addEventListener("click", () => {
  closeAllMenus();
  modalAddItem.style.display = "flex";
  if (tabBtnLibrary && tabPaneLibrary) {
    switchTab(tabBtnLibrary, tabPaneLibrary);
    renderOfflineLibrary();
  }
});

// Offline Library Controller Logic
let selectedLibrarySong: Song | null = null;

function renderOfflineLibrary() {
  const query = (document.getElementById("input-library-search") as HTMLInputElement)?.value || "";
  const cat = ((document.getElementById("select-library-category") as HTMLSelectElement)?.value || "all") as "all" | "custom" | "pack" | "harpa";
  const listEl = document.getElementById("library-results-list");
  const statsEl = document.getElementById("library-offline-stats-text");
  if (!listEl) return;

  const stats = SongEngine.getOfflineLibraryStats();
  if (statsEl) {
    statsEl.textContent = `Biblioteca 100% Offline • ${stats.totalCount} itens salvos (${stats.customCount} louvores web/importados + ${stats.harpaCount} da Harpa Cristã)`;
  }

  const items = SongEngine.getOfflineLibrarySongs(query, cat);
  listEl.innerHTML = "";

  if (items.length === 0) {
    listEl.innerHTML = `<div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 0.78rem;">Nenhum item encontrado na Biblioteca Offline com este filtro.</div>`;
    return;
  }

  items.slice(0, 100).forEach((entry) => {
    const s = entry.song;
    const row = document.createElement("div");
    const isSelected = selectedLibrarySong?.id === s.id;
    row.style.padding = "7px 10px";
    row.style.borderBottom = "1px solid var(--border-subtle)";
    row.style.cursor = "pointer";
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.alignItems = "center";
    row.style.fontSize = "0.78rem";
    if (isSelected) row.style.background = "rgba(16, 185, 129, 0.2)";

    const catBadge = entry.sourceLabel.includes("Harpa") ? "🎵 Harpa" : entry.sourceLabel.includes("Pacote") ? "📦 Pack" : "💾 Offline";
    row.innerHTML = `
      <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
        <span style="font-weight: 700; color: #f8fafc;">${s.title}</span>
        <span style="font-size: 0.7rem; color: #94a3b8; margin-left: 6px;">${s.artist || ""}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 0.68rem; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.06); color: #cbd5e1;">${catBadge}</span>
        ${entry.isCustom ? `<button class="btn-delete-lib-song" title="Remover da Biblioteca" style="background: none; border: none; color: #f87171; cursor: pointer; padding: 0 4px; font-size: 0.85rem;">🗑️</button>` : ""}
      </div>
    `;

    row.querySelector(".btn-delete-lib-song")?.addEventListener("click", (e) => {
      e.stopPropagation();
      SongEngine.deleteCustomSong(s.id);
      renderOfflineLibrary();
      showOfflineToast("Item Removido", `"${s.title}" removido da biblioteca.`);
    });

    row.addEventListener("click", () => {
      selectedLibrarySong = s;
      renderOfflineLibrary();
      updateOfflineLibraryPreview(s);
    });

    row.addEventListener("dblclick", () => {
      selectedLibrarySong = s;
      addSelectedLibrarySongToPlaylist();
    });

    listEl.appendChild(row);
  });

  if (!selectedLibrarySong && items.length > 0) {
    selectedLibrarySong = items[0].song;
    updateOfflineLibraryPreview(items[0].song);
  }
}

function updateOfflineLibraryPreview(song: Song) {
  const preview = document.getElementById("library-lyrics-preview");
  if (!preview) return;
  preview.innerHTML = `
    <div style="font-weight: 700; color: #34d399; margin-bottom: 6px;">${song.title} - ${song.artist || "Louvor"}</div>
    ${song.slides.map((s) => `<div style="margin-bottom: 6px;"><b>${s.label}:</b><br>${s.lyrics.replace(/\n/g, "<br>")}</div>`).join("")}
  `;
}

function addSelectedLibrarySongToPlaylist() {
  if (!selectedLibrarySong) return;
  const item = songToPlaylistItem(selectedLibrarySong, keyOffset);
  playlist.splice(activeItemIndex + 1, 0, item);
  renderPlaylist();
  selectPlaylistItem(activeItemIndex + 1, !toggleTwoClick.checked, 0);
  modalAddItem.style.display = "none";
  showOfflineToast("Adicionado ao Culto", `"${selectedLibrarySong.title}" adicionado da Biblioteca Offline.`);
}

document.getElementById("input-library-search")?.addEventListener("input", () => renderOfflineLibrary());
document.getElementById("select-library-category")?.addEventListener("change", () => renderOfflineLibrary());
document.getElementById("btn-add-library-to-playlist")?.addEventListener("click", addSelectedLibrarySongToPlaylist);

btnAddItem.addEventListener("click", () => {
  modalAddItem.style.display = "flex";
  switchTab(tabBtnBible, tabPaneBible);
  populateBibleBooks();
});

btnCloseAddModal.addEventListener("click", () => {
  modalAddItem.style.display = "none";
});

modalAddItem.addEventListener("click", (e) => {
  if (e.target === modalAddItem) modalAddItem.style.display = "none";
});

// Tab 1: Bible Logic
function populateBibleBooks(force: boolean = false) {
  if (!selectBibleBook) return;
  if (!force && selectBibleBook.options.length > 0) return;
  const books = BibleEngine.getBooks();
  selectBibleBook.innerHTML = "";
  books.forEach((b) => {
    const opt = document.createElement("option");
    opt.value = b.name;
    opt.textContent = `${b.name} (${b.chapterCount} cap)`;
    selectBibleBook.appendChild(opt);
  });
}

function updateBiblePreviewFromDropdowns() {
  if (!selectBibleBook) return;
  const book = selectBibleBook.value;
  const chapter = parseInt(inputBibleChapter.value, 10) || 1;
  const start = parseInt(inputBibleStart.value, 10) || 1;
  const end = parseInt(inputBibleEnd.value, 10) || start;

  const verses = BibleEngine.findVerses(`${book} ${chapter} ${start}-${end}`);
  currentBibleVersesPreview = verses;

  if (verses.length === 0) {
    biblePreviewBox.innerHTML = `<span style="color: #ef4444;">Nenhum versículo encontrado para ${book} ${chapter}:${start}.</span>`;
    return;
  }

  biblePreviewBox.innerHTML = verses
    .map(
      (v) => `
    <div style="margin-bottom: 6px;">
      <b style="color: #10b981;">${v.verse}.</b> ${v.text}
    </div>
  `
    )
    .join("");
}

btnBibleSearch?.addEventListener("click", () => {
  const q = inputBibleQuick.value.trim();
  if (!q) return;
  const verses = BibleEngine.findVerses(q);
  currentBibleVersesPreview = verses;
  if (verses.length === 0) {
    biblePreviewBox.innerHTML = `<span style="color: #ef4444;">Referência não encontrada. Tente "jo 3 16" ou "sl 23 1-6".</span>`;
  } else {
    biblePreviewBox.innerHTML = verses
      .map(
        (v) => `
      <div style="margin-bottom: 6px;">
        <b style="color: #10b981;">${v.book} ${v.chapter}:${v.verse} (${v.version})</b> ${v.text}
      </div>
    `
      )
      .join("");
  }
});

inputBibleQuick?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnBibleSearch.click();
});

selectBibleBook?.addEventListener("change", updateBiblePreviewFromDropdowns);
inputBibleChapter?.addEventListener("input", updateBiblePreviewFromDropdowns);
inputBibleStart?.addEventListener("input", updateBiblePreviewFromDropdowns);
inputBibleEnd?.addEventListener("input", updateBiblePreviewFromDropdowns);

btnAddBibleToPlaylist?.addEventListener("click", () => {
  if (currentBibleVersesPreview.length === 0) {
    updateBiblePreviewFromDropdowns();
  }
  if (currentBibleVersesPreview.length > 0) {
    const res = BibleEngine.versesToPlaylistItem(currentBibleVersesPreview, true);
    playlist.splice(activeItemIndex + 1, 0, res.item);
    renderPlaylist();
    selectPlaylistItem(activeItemIndex + 1, !toggleTwoClick.checked, res.startSlideIndex);
    modalAddItem.style.display = "none";
  }
});

// Tab 2: Harpa Cristã Logic
function renderHarpaList(filter: string = "") {
  const songs = SongEngine.findSongs(filter || "1");
  harpaResultsList.innerHTML = "";
  songs.slice(0, 40).forEach((s) => {
    const row = document.createElement("div");
    row.style.padding = "6px 10px";
    row.style.borderBottom = "1px solid var(--border-subtle)";
    row.style.cursor = "pointer";
    row.style.fontSize = "0.78rem";
    row.textContent = s.title;
    row.addEventListener("click", () => {
      selectedHarpaSong = s;
      Array.from(harpaResultsList.children).forEach((c) => ((c as HTMLElement).style.background = ""));
      row.style.background = "rgba(99, 102, 241, 0.25)";

      harpaLyricsPreview.innerHTML = `
        <div style="font-weight: 700; color: #818cf8; margin-bottom: 6px;">${s.title}</div>
        ${s.slides
          .map((sl) => `<div style="margin-bottom: 6px;"><b>${sl.label}:</b><br>${sl.lyrics.replace(/\n/g, "<br>")}</div>`)
          .join("")}
      `;
    });
    harpaResultsList.appendChild(row);
  });
}

inputHarpaSearch?.addEventListener("input", () => {
  renderHarpaList(inputHarpaSearch.value);
});

btnAddHarpaToPlaylist?.addEventListener("click", () => {
  if (!selectedHarpaSong) return;
  const item = songToPlaylistItem(selectedHarpaSong, keyOffset);
  playlist.splice(activeItemIndex + 1, 0, item);
  renderPlaylist();
  selectPlaylistItem(activeItemIndex + 1, !toggleTwoClick.checked, 0);
  modalAddItem.style.display = "none";
});

// Tab 3: Custom Song Logic
btnSaveCustomSong?.addEventListener("click", () => {
  const title = inputCustomTitle.value.trim();
  const artist = inputCustomArtist.value.trim();
  const key = selectCustomKey.value;
  const lyrics = textareaCustomLyrics.value.trim();

  if (!title || !lyrics) {
    alert("Por favor preencha pelo menos o título e a letra da música.");
    return;
  }

  const song = SongEngine.parseLyricsToSong(title, artist, key, lyrics);
  SongEngine.saveCustomSong(song);

  const item = songToPlaylistItem(song, keyOffset);
  playlist.splice(activeItemIndex + 1, 0, item);
  renderPlaylist();
  selectPlaylistItem(activeItemIndex + 1, !toggleTwoClick.checked, 0);

  inputCustomTitle.value = "";
  inputCustomArtist.value = "";
  textareaCustomLyrics.value = "";
  modalAddItem.style.display = "none";
  showOfflineToast("Letra Salva 100% Offline", `"${song.title}" gravada na sua Biblioteca local.`);
});

// Tab 4: Universal File Import Logic (Formatos de Slides, Acervos de Músicas, ChordPro, Bíblias XML)
inputFileImport?.addEventListener("change", async () => {
  if (!inputFileImport.files || inputFileImport.files.length === 0) return;
  const file = inputFileImport.files[0];
  const name = file.name;
  importStatusBox.style.display = "block";
  importStatusBox.innerHTML = `Analisando e importando: <b>${name}</b>...`;

  try {
    // Check if it is a binary song collection pack (.mufl)
    if (name.toLowerCase().endsWith(".mufl")) {
      const buf = await file.arrayBuffer();
      const songs = SongEngine.parseMuflBinaryBuffer(buf);
      if (songs.length === 0) {
        throw new Error("Nenhuma música encontrada no pacote .mufl.");
      }
      songs.forEach((s) => SongEngine.saveCustomSong(s));

      // Remove any previously corrupted 2310-slide pack item from playlist if present
      playlist = playlist.filter((it) => it.slides.length < 150);

      // Add the first song to the playlist and make all others searchable in Spotlight/Harpa
      const firstItem = songToPlaylistItem(songs[0], keyOffset);
      playlist.splice(activeItemIndex + 1, 0, firstItem);
      renderPlaylist();
      selectPlaylistItem(activeItemIndex + 1, !toggleTwoClick.checked, 0);

      importStatusBox.innerHTML = `<span style="color: #10b981; font-weight: 700;">✓ Pacote de Músicas Importado!</span> <b>${songs.length} músicas</b> salvas na biblioteca local (busque por nome no topo ⌘K) e "${songs[0].title}" adicionada ao culto.`;
      showOfflineToast("Pacote de Músicas Salvo 100% Offline", `${songs.length} louvores importados e armazenados no computador.`);
      setTimeout(() => {
        modalAddItem.style.display = "none";
        importStatusBox.style.display = "none";
      }, 2800);
      return;
    }

    const text = await file.text();

    // Check if it is a Bible file
    if (
      text.includes("<XMLBIBLE") ||
      text.includes("<BIBLEBOOK") ||
      text.includes("<bible><b") ||
      (file.name.endsWith(".json") && text.includes("\"chapters\""))
    ) {
      let versionInfo;
      if (file.name.endsWith(".json")) {
        versionInfo = BibleEngine.importBibleJson(file.name.replace(/\.[^/.]+$/, ""), text);
      } else {
        versionInfo = BibleEngine.importBibleXml(file.name.replace(/\.[^/.]+$/, ""), text);
      }
      labelActiveBible.textContent = versionInfo.id.toUpperCase();
      navActiveVersionBadge.textContent = versionInfo.id.toUpperCase();
      populateBibleBooks(true);
      importStatusBox.innerHTML = `<span style="color: #10b981; font-weight: 700;">✓ Bíblia Importada com Sucesso!</span> Versão "<b>${versionInfo.name}</b>" ativada e pronta para busca.`;
      showOfflineToast("Bíblia Salva 100% Offline", `Tradução "${versionInfo.name}" ativada e pronta para o culto.`);
      setTimeout(() => {
        modalAddItem.style.display = "none";
        importStatusBox.style.display = "none";
      }, 2200);
      return;
    }

    // Otherwise, parse as Song / Presentation (XML, JSON, ChordPro, TXT)
    const song = SongEngine.importFile(name, text);
    SongEngine.saveCustomSong(song);

    const item = songToPlaylistItem(song, keyOffset);
    playlist.splice(activeItemIndex + 1, 0, item);
    renderPlaylist();
    selectPlaylistItem(activeItemIndex + 1, !toggleTwoClick.checked, 0);

    importStatusBox.innerHTML = `<span style="color: #10b981; font-weight: 700;">✓ Importado com Sucesso!</span> "${song.title}" (${song.artist}) com <b>${song.slides.length} slides</b> adicionada ao culto.`;
    showOfflineToast("Louvor Salvo 100% Offline", `"${song.title}" importada e armazenada na Biblioteca.`);
    setTimeout(() => {
      modalAddItem.style.display = "none";
      importStatusBox.style.display = "none";
    }, 2000);
  } catch (err: any) {
    importStatusBox.innerHTML = `<span style="color: #ef4444;">Erro ao importar arquivo:</span> ${err.message}`;
  }
});

// Keyboard Navigation & Shortcuts
window.addEventListener("keydown", (e) => {
  // Global Shortcuts that work everywhere (even when focused in inputs)
  if (e.key === "Escape") {
    e.preventDefault();
    if (document.activeElement && (document.activeElement as HTMLElement).blur) {
      (document.activeElement as HTMLElement).blur();
    }
    modalAddItem.style.display = "none";
    modalBibleNavigator.style.display = "none";
    if (modalPreferences) modalPreferences.style.display = "none";
    if (modalQr) modalQr.style.display = "none";
    searchResultsList.style.display = "none";
    closeAllMenus();
    if (popoverScreens) popoverScreens.style.display = "none";
    const popBible = document.getElementById("popover-bible-versions");
    if (popBible) popBible.style.display = "none";
    return;
  }

  // Ctrl+K / Cmd+K (Spotlight Search)
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    quickSearchInput.focus();
    quickSearchInput.select();
    return;
  }

  // Ctrl+L / Cmd+L (Web Lyrics Search)
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "l") {
    e.preventDefault();
    modalAddItem.style.display = "flex";
    switchTab(tabBtnOnline, tabPaneOnline);
    setTimeout(() => inputOnlineSearch.focus(), 100);
    return;
  }

  // Ctrl+, / Cmd+, (Preferences)
  if ((e.metaKey || e.ctrlKey) && e.key === ",") {
    e.preventDefault();
    openPreferences("general");
    return;
  }

  // Ctrl+N / Cmd+N (New Worship)
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
    e.preventDefault();
    document.getElementById("mi-new-worship")?.click();
    return;
  }

  // F-Keys
  if (e.key === "F1") {
    e.preventDefault();
    btnClearText.click();
    return;
  }
  if (e.key === "F2") {
    e.preventDefault();
    btnBlackout.click();
    return;
  }
  if (e.key === "F3") {
    e.preventDefault();
    modalBibleNavigator.style.display = "flex";
    renderBibleNavigator();
    return;
  }
  if (e.key === "F5") {
    e.preventDefault();
    if (e.shiftKey && playlist[activeItemIndex]?.presentationPath) {
      launchActivePresentationInLibreOffice();
    } else {
      document.getElementById("btn-open-audience")?.click();
    }
    return;
  }
  if (e.key === "F6") {
    e.preventDefault();
    document.getElementById("btn-open-stage")?.click();
    return;
  }

  // Ignore presentation keys if typing in a text field
  if (
    document.activeElement === quickSearchInput ||
    document.activeElement === alertInput ||
    document.activeElement === inputBibleQuick ||
    document.activeElement === inputOnlineSearch ||
    document.activeElement === textareaCustomLyrics ||
    document.activeElement?.tagName === "INPUT" ||
    document.activeElement?.tagName === "TEXTAREA"
  ) {
    return;
  }

  if (e.code === "Space" || e.code === "ArrowRight" || e.code === "ArrowDown" || e.code === "PageDown") {
    e.preventDefault();
    nextSlide();
  } else if (e.code === "Backspace" || e.code === "ArrowLeft" || e.code === "ArrowUp" || e.code === "PageUp") {
    e.preventDefault();
    prevSlide();
  } else if (e.code === "KeyB" || e.key.toLowerCase() === "b") {
    e.preventDefault();
    btnBlackout.click();
  } else if (e.code === "KeyC" || e.key.toLowerCase() === "c") {
    e.preventDefault();
    btnClearText.click();
  } else if (e.code === "Enter") {
    e.preventDefault();
    if (isStaged) fireSlide(stagedSlideIndex);
  }
});


// Additional UI Event Handlers (Screens Menu, Drawer Tabs, Quick Navigation)
const btnScreensMenu = document.getElementById("btn-screens-menu");
const popoverScreens = document.getElementById("popover-screens");
btnScreensMenu?.addEventListener("click", (e) => {
  e.stopPropagation();
  if (popoverScreens) {
    popoverScreens.style.display = popoverScreens.style.display === "none" ? "flex" : "none";
  }
});

document.addEventListener("click", (e) => {
  if (popoverScreens && !btnScreensMenu?.contains(e.target as Node) && !popoverScreens.contains(e.target as Node)) {
    popoverScreens.style.display = "none";
  }
});

// Click Mode Switcher (2 Cliques vs 1 Clique)
const btnToggleClickMode = document.getElementById("btn-toggle-click-mode");
btnToggleClickMode?.addEventListener("click", () => {
  toggleTwoClick.checked = !toggleTwoClick.checked;
  if (toggleTwoClick.checked) {
    btnToggleClickMode.classList.add("active");
    btnToggleClickMode.textContent = "🔒 2 Cliques (Engatilhar)";
    btnToggleClickMode.title = "Modo seguro: 1º clique engatilha na prévia, 2º projeta";
  } else {
    btnToggleClickMode.classList.remove("active");
    btnToggleClickMode.textContent = "⚡ 1 Clique (Direto)";
    btnToggleClickMode.title = "Modo direto: 1 clique já projeta imediatamente";
  }
});

// Big Navigation Buttons on Right Monitor
const btnQuickPrev = document.getElementById("btn-quick-prev");
const btnQuickNext = document.getElementById("btn-quick-next");
btnQuickPrev?.addEventListener("click", prevSlide);
btnQuickNext?.addEventListener("click", nextSlide);

// Drawer Tabs
const tabDrawerObs = document.getElementById("tab-drawer-obs");
const tabDrawerAlert = document.getElementById("tab-drawer-alert");
const tabDrawerChords = document.getElementById("tab-drawer-chords");

const paneDrawerObs = document.getElementById("pane-drawer-obs");
const paneDrawerAlert = document.getElementById("pane-drawer-alert");
const paneDrawerChords = document.getElementById("pane-drawer-chords");

function switchDrawerTab(tab: "obs" | "alert" | "chords") {
  [tabDrawerObs, tabDrawerAlert, tabDrawerChords].forEach((b) => b?.classList.remove("active"));
  if (paneDrawerObs) paneDrawerObs.style.display = "none";
  if (paneDrawerAlert) paneDrawerAlert.style.display = "none";
  if (paneDrawerChords) paneDrawerChords.style.display = "none";

  if (tab === "obs") {
    tabDrawerObs?.classList.add("active");
    if (paneDrawerObs) paneDrawerObs.style.display = "flex";
  } else if (tab === "alert") {
    tabDrawerAlert?.classList.add("active");
    if (paneDrawerAlert) paneDrawerAlert.style.display = "flex";
  } else if (tab === "chords") {
    tabDrawerChords?.classList.add("active");
    if (paneDrawerChords) paneDrawerChords.style.display = "flex";
  }
}

tabDrawerObs?.addEventListener("click", () => switchDrawerTab("obs"));
tabDrawerAlert?.addEventListener("click", () => switchDrawerTab("alert"));
tabDrawerChords?.addEventListener("click", () => switchDrawerTab("chords"));

// Launch Visual Bible Nav from Quick Bible Tab
document.getElementById("btn-launch-visual-nav")?.addEventListener("click", () => {
  modalAddItem.style.display = "none";
  modalBibleNavigator.style.display = "flex";
  renderBibleNavigator();
});


// Direct Top Bar Bible Navigator Launcher
document.getElementById("btn-top-bible-nav")?.addEventListener("click", () => {
  modalBibleNavigator.style.display = "flex";
  renderBibleNavigator();
});

// Close screens popover on item click
[
  document.getElementById("btn-open-audience"),
  document.getElementById("btn-open-stage"),
  document.getElementById("btn-open-stream"),
  document.getElementById("btn-open-remote"),
].forEach((btn) => {
  btn?.addEventListener("click", () => {
    if (popoverScreens) popoverScreens.style.display = "none";
  });
});


// ==========================================
// Apple macOS Menu Bar & Menus Interactivity
// ==========================================
const menuRoots = document.querySelectorAll(".menu-root");
let isMenuOpen = false;

function closeAllMenus() {
  document.querySelectorAll(".macos-dropdown").forEach(d => (d as HTMLElement).style.display = "none");
  const popScreens = document.getElementById("popover-screens");
  if (popScreens) popScreens.style.display = "none";
  const popBibles = document.getElementById("popover-more-bibles");
  if (popBibles) popBibles.style.display = "none";
  menuRoots.forEach(r => r.classList.remove("active"));
  isMenuOpen = false;
}

menuRoots.forEach(root => {
  const title = root.querySelector(".menu-title");
  const dropdown = root.querySelector(".macos-dropdown") as HTMLElement;

  title?.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasOpen = dropdown.style.display === "flex";
    closeAllMenus();
    if (!wasOpen) {
      dropdown.style.display = "flex";
      root.classList.add("active");
      isMenuOpen = true;
    }
  });

  root.addEventListener("mouseenter", () => {
    if (isMenuOpen) {
      closeAllMenus();
      dropdown.style.display = "flex";
      root.classList.add("active");
      isMenuOpen = true;
    }
  });
});

document.addEventListener("click", (e) => {
  if (!(e.target as HTMLElement).closest(".menu-root")) {
    closeAllMenus();
  }
});

// Menu Actions
document.getElementById("mi-about")?.addEventListener("click", () => {
  closeAllMenus();
  openPreferences("about");
});

document.getElementById("mi-settings")?.addEventListener("click", () => {
  closeAllMenus();
  openPreferences("general");
});

document.getElementById("mi-quit")?.addEventListener("click", () => {
  window.close();
});

document.getElementById("mi-new-worship")?.addEventListener("click", () => {
  closeAllMenus();
  if (confirm("Deseja iniciar um novo culto? A ordem atual será limpa.")) {
    playlist = [];
    renderPlaylist();
    renderEmptyWorshipState("Culto Novo Iniciado", 'Clique em <b style="color: #94a3b8;">"+ Adicionar ao Culto"</b> ou use os atalhos para inserir hinos, versículos ou apresentações.');
  }
});

document.getElementById("mi-add-item")?.addEventListener("click", () => {
  closeAllMenus();
  modalAddItem.style.display = "flex";
});

document.getElementById("mi-import-file")?.addEventListener("click", () => {
  closeAllMenus();
  modalAddItem.style.display = "flex";
  switchTab(tabBtnImport, tabPaneImport);
});

document.getElementById("mi-import-media")?.addEventListener("click", () => {
  closeAllMenus();
  inputQuickMediaFiles?.click();
});

document.getElementById("mi-bible-nav")?.addEventListener("click", () => {
  closeAllMenus();
  modalBibleNavigator.style.display = "flex";
  renderBibleNavigator();
});

async function switchBibleVersionInstant(ver: string) {
  await BibleEngine.setVersion(ver);
  const upper = ver.toUpperCase();
  labelActiveBible.textContent = upper;
  navActiveVersionBadge.textContent = upper;

  document.querySelectorAll(".bible-seg-btn").forEach(btn => {
    if (btn.getAttribute("data-fast-bible") === ver) btn.classList.add("active");
    else btn.classList.remove("active");
  });

  document.querySelectorAll(".bible-ver-item").forEach(el => {
    const icon = el.querySelector(".item-icon");
    if (icon) icon.textContent = el.getAttribute("data-ver") === ver ? "✓" : " ";
  });

  const prefDefBible = document.getElementById("pref-default-bible") as HTMLSelectElement | null;
  if (prefDefBible && prefDefBible.value !== ver) prefDefBible.value = ver;

  populateBibleBooks(true);
  updateBiblePreviewFromDropdowns();

  // Se o item ativo no culto for uma passagem bíblica, atualiza os versículos na tela para a nova tradução na hora!
  const currentItem = playlist[activeItemIndex];
  if (currentItem && currentItem.type === "bible" && currentItem.slides.length > 0) {
    const firstHeader = currentItem.slides[0].header || "";
    const match = firstHeader.match(/^([0-9]?[a-zá-ú\s]+)\s+([0-9]+):([0-9]+)/i);
    if (match) {
      const book = match[1].trim();
      const chap = parseInt(match[2], 10);
      const newVerses = BibleEngine.getChapterVerses(book, chap);
      if (newVerses.length > 0) {
        currentItem.slides = newVerses.map(v => BibleEngine.verseToSlide(v));
        currentItem.title = `${book} ${chap} (${upper})`;
        activeItemTitle.textContent = currentItem.title;
        renderPlaylist();
        renderSlideMatrix(currentItem);
        if (!isStaged) {
          fireSlide(Math.min(liveSlideIndex, currentItem.slides.length - 1));
        } else {
          stageSlide(Math.min(stagedSlideIndex, currentItem.slides.length - 1));
        }
      }
    }
  }

  store.setState({ activeBibleVersion: ver });
  renderTopBarBibleButtons();
}

// Top 3 Favorite/Most Used Brazilian Church Bible Versions Priority
const PREFERRED_TOP_VERSIONS = ["acf", "nvi", "arc", "naa", "ara", "nvt", "tb", "kja", "nbv", "a21"];

function getTop3DisplayVersions(): BibleVersionInfo[] {
  const allInstalled = BibleEngine.getAvailableVersions();
  const activeId = BibleEngine.getActiveVersion().toLowerCase();

  // 1. Seleciona até 3 versões prioritárias instaladas
  const installedPreferred: BibleVersionInfo[] = [];
  for (const pid of PREFERRED_TOP_VERSIONS) {
    const match = allInstalled.find((v) => v.id.toLowerCase() === pid);
    if (match && !installedPreferred.some((x) => x.id.toLowerCase() === match.id.toLowerCase())) {
      installedPreferred.push(match);
    }
    if (installedPreferred.length >= 3) break;
  }

  // Se menos de 3 forem encontradas, completa com outras versões instaladas
  for (const v of allInstalled) {
    if (installedPreferred.length >= 3) break;
    if (!installedPreferred.some((x) => x.id.toLowerCase() === v.id.toLowerCase())) {
      installedPreferred.push(v);
    }
  }

  // 2. Se a tradução ativa já estiver no Top 3, exibe as 3 normalmente
  const activeInTop3 = installedPreferred.some((v) => v.id.toLowerCase() === activeId);
  if (activeInTop3) {
    return installedPreferred.slice(0, 3);
  }

  // 3. Se o usuário ativou outra versão (pelo menu +), mantém as 2 primeiras e coloca a ativa no 3º slot!
  const activeObj = allInstalled.find((v) => v.id.toLowerCase() === activeId) || {
    id: activeId,
    name: activeId.toUpperCase()
  };

  const result = installedPreferred.slice(0, 2);
  result.push(activeObj);
  return result;
}

// Renderiza exatamente até 3 versões no visor superior fixo
function renderTopBarBibleButtons() {
  const container = document.getElementById("top-bible-buttons-list");
  if (!container) return;
  const versions = getTop3DisplayVersions();
  const active = BibleEngine.getActiveVersion().toLowerCase();
  container.innerHTML = "";

  versions.forEach(v => {
    const btn = document.createElement("button");
    const isAct = v.id.toLowerCase() === active;
    btn.className = `bible-seg-btn ${isAct ? "active" : ""}`;
    btn.setAttribute("data-fast-bible", v.id);
    btn.title = `${v.name} (${v.id.toUpperCase()})`;
    btn.textContent = v.id.toUpperCase();
    btn.addEventListener("click", () => {
      void switchBibleVersionInstant(v.id);
    });
    container.appendChild(btn);
  });
}

// Popula o menu suspenso do botão '+' com todas as versões instaladas
function renderMoreBiblesPopoverList() {
  const listContainer = document.getElementById("popover-more-bibles-list");
  if (!listContainer) return;
  const versions = BibleEngine.getAvailableVersions();
  const active = BibleEngine.getActiveVersion().toLowerCase();
  listContainer.innerHTML = "";

  versions.forEach(v => {
    const item = document.createElement("button");
    item.className = "popover-item";
    item.style.display = "flex";
    item.style.alignItems = "center";
    item.style.justifyContent = "space-between";
    item.style.padding = "7px 10px";
    item.style.borderRadius = "6px";
    item.style.border = "none";
    const isCurrent = v.id.toLowerCase() === active;
    item.style.background = isCurrent ? "rgba(99, 102, 241, 0.22)" : "transparent";
    item.style.cursor = "pointer";
    item.style.textAlign = "left";
    item.style.width = "100%";
    item.style.boxSizing = "border-box";

    item.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
        <span style="font-weight: 800; font-size: 0.76rem; color: ${isCurrent ? '#818cf8' : '#e2e8f0'}; min-width: 34px;">${v.id.toUpperCase()}</span>
        <span style="font-size: 0.76rem; color: ${isCurrent ? '#ffffff' : '#94a3b8'}; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${v.name}</span>
      </div>
      <span style="font-size: 0.82rem; font-weight: 700; color: #818cf8; margin-left: 6px;">${isCurrent ? "✓" : ""}</span>
    `;

    item.addEventListener("mouseenter", () => {
      if (!isCurrent) item.style.background = "rgba(255, 255, 255, 0.06)";
    });
    item.addEventListener("mouseleave", () => {
      if (!isCurrent) item.style.background = "transparent";
    });

    item.addEventListener("click", () => {
      const popover = document.getElementById("popover-more-bibles");
      if (popover) popover.style.display = "none";
      void switchBibleVersionInstant(v.id);
    });

    listContainer.appendChild(item);
  });
}

function renderBibleCatalog() {
  const pdGrid = document.getElementById("bible-public-domain-grid");
  const commGrid = document.getElementById("bible-community-grid");
  const availableIds = new Set(BibleEngine.getAvailableVersions().map(v => v.id.toLowerCase()));

  if (pdGrid) {
    pdGrid.innerHTML = "";
    PUBLIC_DOMAIN_CATALOG.forEach(entry => {
      pdGrid.appendChild(createBibleCatalogCard(entry, availableIds.has(entry.id.toLowerCase())));
    });
  }

  if (commGrid) {
    commGrid.innerHTML = "";
    COMMUNITY_EXTERNAL_CATALOG.forEach(entry => {
      commGrid.appendChild(createBibleCatalogCard(entry, availableIds.has(entry.id.toLowerCase())));
    });
  }
}

function createBibleCatalogCard(entry: CatalogBibleEntry, isInstalled: boolean): HTMLElement {
  const card = document.createElement("div");
  card.className = "bible-catalog-card";
  card.style.background = "rgba(255,255,255,0.03)";
  card.style.border = "1px solid var(--border-subtle)";
  card.style.borderRadius = "8px";
  card.style.padding = "8px 10px";
  card.style.display = "flex";
  card.style.flexDirection = "column";
  card.style.justifyContent = "space-between";
  card.style.gap = "6px";

  const btnHtml = isInstalled
    ? `<button class="btn btn-ghost btn-download-bible" disabled style="padding: 3px 8px; font-size: 0.72rem; color: #10b981; border: 1px solid rgba(16,185,129,0.3); background: rgba(16,185,129,0.08); cursor: default;">✓ Instalada</button>`
    : `<button class="btn btn-primary btn-download-bible" style="padding: 3px 8px; font-size: 0.72rem;">⬇️ Baixar</button>`;

  const descText = entry.description || `${entry.lang} • Bíblia Completa (66 Livros)`;
  const sizeText = entry.size || "~4.2 MB";
  const licenseBadge = entry.license === "public-domain" ? "✓ Domínio Público" : "🌐 Espelho Comunitário";

  card.innerHTML = `
    <div>
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
        <span style="font-weight: 700; font-size: 0.8rem; color: #f8fafc;">${entry.name}</span>
        <span style="font-size: 0.65rem; color: #94a3b8; font-family: monospace;">${sizeText}</span>
      </div>
      <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 2px;">${descText}</div>
    </div>
    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
      <span style="font-size: 0.65rem; color: ${entry.license === "public-domain" ? "#10b981" : "#38bdf8"}; font-weight: 500;">${licenseBadge}</span>
      ${btnHtml}
    </div>
  `;

  const btn = card.querySelector(".btn-download-bible") as HTMLButtonElement | null;
  if (btn && !isInstalled) {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "⏳ Baixando...";
      const statusBox = document.getElementById("bible-download-status");
      if (statusBox) {
        statusBox.style.display = "block";
        statusBox.textContent = `Baixando "${entry.name}" para uso offline permanente...`;
      }
      try {
        const ver = await BibleEngine.downloadCatalogVersion(entry);
        showOfflineToast("Bíblia Instalada 100% Offline", `Tradução "${ver.name}" salva no computador com sucesso.`);
        renderBibleCatalog();
        renderTopBarBibleButtons();
        renderBiblePopoverList();
        populateBibleDefaultSelect();
        if (statusBox) {
          statusBox.textContent = `✓ "${ver.name}" instalada com sucesso!`;
          setTimeout(() => { statusBox.style.display = "none"; }, 3500);
        }
      } catch (err: any) {
        btn.disabled = false;
        btn.textContent = "⬇️ Tentar Novamente";
        if (statusBox) {
          statusBox.style.color = "#f87171";
          statusBox.textContent = `Erro ao baixar: ${err.message}`;
        }
      }
    });
  }

  return card;
}

function populateBibleDefaultSelect() {
  const sel = document.getElementById("pref-default-bible") as HTMLSelectElement | null;
  if (!sel) return;
  const versions = BibleEngine.getAvailableVersions();
  const active = BibleEngine.getActiveVersion();
  sel.innerHTML = "";
  versions.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v.id;
    opt.textContent = `${v.name} (${v.id.toUpperCase()})`;
    if (v.id === active) opt.selected = true;
    sel.appendChild(opt);
  });
}

const btnTopMoreBibles = document.getElementById("btn-top-more-bibles");
const popoverMoreBibles = document.getElementById("popover-more-bibles");

btnTopMoreBibles?.addEventListener("click", (e) => {
  e.stopPropagation();
  const popScreens = document.getElementById("popover-screens");
  if (popScreens) popScreens.style.display = "none";
  if (popoverMoreBibles) {
    const willOpen = popoverMoreBibles.style.display === "none";
    if (willOpen) {
      renderMoreBiblesPopoverList();
      popoverMoreBibles.style.display = "flex";
    } else {
      popoverMoreBibles.style.display = "none";
    }
  }
});

document.getElementById("btn-popover-open-bible-settings")?.addEventListener("click", () => {
  if (popoverMoreBibles) popoverMoreBibles.style.display = "none";
  openPreferences("bibles");
});

document.addEventListener("click", (e) => {
  if (popoverMoreBibles && !btnTopMoreBibles?.contains(e.target as Node) && !popoverMoreBibles.contains(e.target as Node)) {
    popoverMoreBibles.style.display = "none";
  }
});

document.getElementById("btn-nav-more-versions")?.addEventListener("click", () => {
  modalBibleNavigator.style.display = "none";
  openPreferences("bibles");
});

document.getElementById("btn-toggle-community-bibles")?.addEventListener("click", () => {
  const box = document.getElementById("bible-community-external-box");
  if (box) {
    box.style.display = box.style.display === "none" ? "block" : "none";
  }
});

document.querySelectorAll(".bible-ver-item").forEach(item => {
  item.addEventListener("click", () => {
    const ver = item.getAttribute("data-ver") || "acf";
    closeAllMenus();
    void switchBibleVersionInstant(ver);
  });
});

document.getElementById("mi-web-lyrics")?.addEventListener("click", () => {
  closeAllMenus();
  modalAddItem.style.display = "flex";
  switchTab(tabBtnOnline, tabPaneOnline);
  setTimeout(() => inputOnlineSearch.focus(), 100);
});

document.getElementById("mi-harpa-lyrics")?.addEventListener("click", () => {
  closeAllMenus();
  modalAddItem.style.display = "flex";
  switchTab(tabBtnHarpa, tabPaneHarpa);
});

document.getElementById("mi-new-lyrics")?.addEventListener("click", () => {
  closeAllMenus();
  modalAddItem.style.display = "flex";
  switchTab(tabBtnCustom, tabPaneCustom);
});

document.getElementById("mi-screen-audience")?.addEventListener("click", async () => {
  closeAllMenus();
  document.getElementById("btn-open-audience")?.click();
});

document.getElementById("mi-screen-stage")?.addEventListener("click", async () => {
  closeAllMenus();
  document.getElementById("btn-open-stage")?.click();
});

document.getElementById("mi-screen-obs")?.addEventListener("click", async () => {
  closeAllMenus();
  document.getElementById("btn-open-stream")?.click();
});

document.getElementById("mi-obs-advanced")?.addEventListener("click", () => {
  closeAllMenus();
  openPreferences("obs");
});

document.getElementById("btn-open-obs-settings")?.addEventListener("click", () => {
  if (popoverScreens) popoverScreens.style.display = "none";
  openPreferences("obs");
});

document.getElementById("mi-screen-remote")?.addEventListener("click", () => {
  closeAllMenus();
  showQrModal();
});

document.getElementById("btn-open-remote")?.addEventListener("click", () => {
  if (popoverScreens) popoverScreens.style.display = "none";
  showQrModal();
});

// Clock on Projection Screen Options
document.querySelectorAll(".menu-clock-opt").forEach((btn) => {
  btn.addEventListener("click", () => {
    const clockPos = btn.getAttribute("data-clock") as "none" | "topRight" | "bottomRight" | "bottomLeft";
    closeAllMenus();
    store.setState({ clockPosition: clockPos });
    document.querySelectorAll(".clock-check").forEach((span) => {
      const forPos = span.getAttribute("data-for");
      span.textContent = forPos === clockPos ? "✓" : " ";
    });
  });
});

// Background Theme Options
document.querySelectorAll(".menu-bg-opt").forEach((btn) => {
  btn.addEventListener("click", () => {
    const bgTheme = btn.getAttribute("data-bg") as any;
    closeAllMenus();
    store.setState({ backgroundTheme: bgTheme });
    document.querySelectorAll(".bg-check").forEach((span) => {
      const forBg = span.getAttribute("data-for");
      span.textContent = forBg === bgTheme ? "✓" : " ";
    });
  });
});

// Uppercase Lyrics Toggle
document.getElementById("mi-toggle-uppercase")?.addEventListener("click", () => {
  closeAllMenus();
  const nextVal = !store.getState().uppercaseLyrics;
  store.setState({ uppercaseLyrics: nextVal });
  const icon = document.getElementById("icon-uppercase-check");
  if (icon) icon.textContent = nextVal ? "✓" : " ";
});

// Full System Backup & Worship Service Export/Import (.altaris-backup.json / .opw.json)
function exportFullSystemBackup() {
  const st = store.getState();
  const customSongs = SongEngine.getCustomSongs();
  const favorites = BibleEngine.getFavorites();
  const activeBibleVersion = localStorage.getItem("open_presenter_active_bible_version") || "acf";

  // Capture user preferences (avoiding circular/transient state)
  const settingsToBackup = {
    backgroundTheme: st.backgroundTheme,
    customBackgroundImage: st.customBackgroundImage,
    customBackgroundImageName: st.customBackgroundImageName,
    customBackgroundVideo: st.customBackgroundVideo,
    customBackgroundVideoName: st.customBackgroundVideoName,
    backgroundDimmer: st.backgroundDimmer,
    fontFamily: st.fontFamily,
    textColor: st.textColor,
    uppercaseLyrics: st.uppercaseLyrics,
    lowSpecMode: st.lowSpecMode,
    fontSizeScale: st.fontSizeScale,
    fontStyle: st.fontStyle,
    textShadowStyle: st.textShadowStyle,
    showSongTitle: st.showSongTitle,
    bibleReferenceFormat: st.bibleReferenceFormat,
    obsTheme: st.obsTheme,
    obsShape: st.obsShape,
    obsPosition: st.obsPosition,
    obsTextAlign: st.obsTextAlign,
    obsBgColor: st.obsBgColor,
    obsTextColor: st.obsTextColor,
    obsAccentColor: st.obsAccentColor,
    obsFontSize: st.obsFontSize,
    obsBold: st.obsBold,
    obsShowHeader: st.obsShowHeader,
    obsCustomCss: st.obsCustomCss,
    obsCustomHtml: st.obsCustomHtml,
    churchLogo: st.churchLogo,
    churchLogoName: st.churchLogoName,
    clockPosition: st.clockPosition,
    raffleMode: st.raffleMode,
    raffleMinNumber: st.raffleMinNumber,
    raffleMaxNumber: st.raffleMaxNumber,
    raffleNoRepeat: st.raffleNoRepeat,
    raffleNames: st.raffleNames,
    screenLooks: st.screenLooks
  };

  const backupPayload = {
    backupType: "altaris-full-system-backup",
    version: "2.0",
    appName: "Altaris Presenter",
    createdAt: new Date().toISOString(),
    data: {
      customSongs,
      settings: settingsToBackup,
      bible: {
        activeVersion: activeBibleVersion,
        favorites
      },
      playlist
    }
  };

  const dataStr = JSON.stringify(backupPayload, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `altaris-backup-${dateStr}.altaris-backup.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function saveCurrentWorshipService() {
  const data = JSON.stringify({ version: "1.0", date: new Date().toISOString(), playlist }, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `culto-${new Date().toISOString().slice(0, 10)}.opw.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function handleBackupOrWorshipImport(file: File) {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    const isFullBackup =
      parsed.backupType === "altaris-full-system-backup" ||
      parsed.type === "altaris-full-backup" ||
      (parsed.data && (parsed.data.customSongs || parsed.data.settings)) ||
      parsed.customSongs;

    if (isFullBackup) {
      const backupData = parsed.data || parsed;

      // 1. Restaurar Músicas Offline Customizadas
      if (Array.isArray(backupData.customSongs)) {
        SongEngine.setCustomSongs(backupData.customSongs);
        renderOfflineLibrary();
      }

      // 2. Restaurar Configurações Visuais, OBS, Logo, etc.
      if (backupData.settings && typeof backupData.settings === "object") {
        store.setState(backupData.settings);
        if (modalPreferences && modalPreferences.style.display !== "none") {
          openPreferences();
        }
      }

      // 3. Restaurar Bíblia e Favoritos
      if (backupData.bible) {
        if (backupData.bible.activeVersion) {
          localStorage.setItem("open_presenter_active_bible_version", backupData.bible.activeVersion);
          void BibleEngine.setVersion(backupData.bible.activeVersion);
        }
        if (Array.isArray(backupData.bible.favorites)) {
          BibleEngine.setFavorites(backupData.bible.favorites);
        }
      }

      // 4. Restaurar Culto Atual
      if (Array.isArray(backupData.playlist)) {
        playlist = backupData.playlist;
        renderPlaylist();
        if (playlist.length > 0) selectPlaylistItem(0, false);
      }

      alert(`✅ Backup Completo Restaurado com Sucesso!\n\n• ${backupData.customSongs?.length || 0} louvores restaurados na biblioteca offline\n• Temas visuais, planos de fundo e logo aplicados\n• Configurações visuais e HTML/CSS do OBS sincronizadas\n• Ordem de culto e favoritos da Bíblia recuperados.`);
      return;
    }

    // Se for apenas o arquivo de culto (.opw.json)
    const items = Array.isArray(parsed) ? parsed : parsed.playlist;
    if (Array.isArray(items) && items.length > 0) {
      playlist = items;
      renderPlaylist();
      selectPlaylistItem(0, false);
      alert(`📋 Roteiro do Culto carregado com sucesso (${items.length} itens).`);
    } else {
      alert("Nenhum item válido de culto foi encontrado no arquivo.");
    }
  } catch (err: any) {
    alert("Erro ao restaurar arquivo de backup/culto: " + err.message);
  }
}

document.getElementById("mi-save-worship")?.addEventListener("click", () => {
  closeAllMenus();
  saveCurrentWorshipService();
});

document.getElementById("mi-full-backup-export")?.addEventListener("click", () => {
  closeAllMenus();
  exportFullSystemBackup();
});

const inputLoadWorshipFile = document.getElementById("input-load-worship-file") as HTMLInputElement | null;
document.getElementById("mi-load-worship")?.addEventListener("click", () => {
  closeAllMenus();
  inputLoadWorshipFile?.click();
});

const inputFullBackupFile = document.getElementById("input-full-backup-file") as HTMLInputElement | null;
document.getElementById("mi-full-backup-import")?.addEventListener("click", () => {
  closeAllMenus();
  inputFullBackupFile?.click();
});

inputLoadWorshipFile?.addEventListener("change", async () => {
  if (!inputLoadWorshipFile.files || inputLoadWorshipFile.files.length === 0) return;
  await handleBackupOrWorshipImport(inputLoadWorshipFile.files[0]);
  inputLoadWorshipFile.value = "";
});

inputFullBackupFile?.addEventListener("change", async () => {
  if (!inputFullBackupFile.files || inputFullBackupFile.files.length === 0) return;
  await handleBackupOrWorshipImport(inputFullBackupFile.files[0]);
  inputFullBackupFile.value = "";
});

document.getElementById("btn-full-backup-export")?.addEventListener("click", exportFullSystemBackup);
document.getElementById("btn-full-backup-import")?.addEventListener("click", () => inputFullBackupFile?.click());

// Quick Alert Presets & Random Draw
document.querySelectorAll(".quick-alert-preset").forEach((btn) => {
  btn.addEventListener("click", () => {
    const msg = btn.getAttribute("data-msg") || "";
    alertInput.value = msg;
    store.setState({ alertMessage: msg });
  });
});

document.getElementById("btn-drawer-raffle-settings")?.addEventListener("click", () => {
  openPreferences("raffle");
});

document.getElementById("btn-random-draw")?.addEventListener("click", () => {
  void executeRaffleDraw(true);
});

// Stage Communication Panel (Comunicação com o Palco)
const inputStageCpMsg = document.getElementById("input-stage-cp-msg") as HTMLInputElement | null;
document.getElementById("btn-send-stage-cp")?.addEventListener("click", () => {
  const msg = inputStageCpMsg?.value.trim() || "";
  store.setState({ stageMessage: msg });
});

document.getElementById("btn-flash-stage-cp")?.addEventListener("click", () => {
  store.setState({ stageFlash: true });
  setTimeout(() => store.setState({ stageFlash: false }), 2500);
});

document.getElementById("btn-clear-stage-cp")?.addEventListener("click", () => {
  if (inputStageCpMsg) inputStageCpMsg.value = "";
  store.setState({ stageMessage: "", stageFlash: false });
});

document.getElementById("mi-toggle-chords")?.addEventListener("click", () => {
  closeAllMenus();
  switchDrawerTab("chords");
});

document.getElementById("mi-toggle-alerts")?.addEventListener("click", () => {
  closeAllMenus();
  switchDrawerTab("alert");
});

// Advanced OBS Settings in Preferences
const btnCopyObsUrl = document.getElementById("btn-copy-obs-url");
btnCopyObsUrl?.addEventListener("click", () => {
  const input = document.getElementById("obs-browser-url-input") as HTMLInputElement;
  if (input) {
    navigator.clipboard.writeText(input.value);
    const orig = btnCopyObsUrl.textContent;
    btnCopyObsUrl.textContent = "✓ Copiado!";
    setTimeout(() => {
      btnCopyObsUrl.textContent = orig;
    }, 2000);
  }
});

document.getElementById("btn-test-obs-url")?.addEventListener("click", () => {
  window.open("http://localhost:7878/stream.html", "_blank");
});

const prefSelectObsTheme = document.getElementById("pref-select-obs-theme") as HTMLSelectElement;
prefSelectObsTheme?.addEventListener("change", () => {
  store.setState({ obsTheme: prefSelectObsTheme.value as any });
});

const inputObsLogoUpload = document.getElementById("input-obs-logo-upload") as HTMLInputElement;
inputObsLogoUpload?.addEventListener("change", () => {
  if (inputObsLogoUpload.files && inputObsLogoUpload.files[0]) {
    const file = inputObsLogoUpload.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      store.setState({ churchLogo: base64, churchLogoName: file.name });
      updateSelectedMediaBadges();
      showOfflineToast("Logotipo Atualizado", `"${file.name}" carregado.`);
    };
    reader.readAsDataURL(file);
  }
});

const removeLogoHandler = () => {
  store.setState({ churchLogo: null, churchLogoName: undefined });
  updateSelectedMediaBadges();
  showOfflineToast("Logotipo Removido", "Logo removido do stream OBS.");
};

document.getElementById("btn-obs-remove-logo")?.addEventListener("click", removeLogoHandler);
document.getElementById("btn-clear-church-logo")?.addEventListener("click", removeLogoHandler);

// ==========================================
// Media Files Helper (Images, Videos, Slides/PDF)
// ==========================================
async function uploadVideoFileToServer(file: File): Promise<string> {
  try {
    const ext = file.name.split(".").pop() || "mp4";
    const buf = await file.arrayBuffer();
    const res = await fetch(`/__upload_media?ext=${encodeURIComponent(ext)}`, {
      method: "POST",
      body: buf
    });
    if (res.ok) {
      const data = await res.json();
      if (data.url) return data.url;
    }
  } catch {}
  return URL.createObjectURL(file);
}

async function addMediaFilesToPlaylist(files: FileList | File[] | null) {
  if (!files || files.length === 0) return;
  try {
    const items = await processImportFiles(files, uploadVideoFileToServer);
    if (items.length > 0) {
      playlist.splice(activeItemIndex + 1, 0, ...items);
      renderPlaylist();
      selectPlaylistItem(activeItemIndex + 1);
      const totalSlides = items.reduce((acc, it) => acc + it.slides.length, 0);
      showOfflineToast("📁 Apresentação / Mídia Carregada", `${items.length} item(ns) adicionado(s) com ${totalSlides} slide(s) pronto(s) para o telão.`);
    }
  } catch (err) {
    console.error("Erro ao importar arquivos de mídia e apresentações:", err);
    const message = err instanceof Error ? err.message : String(err);
    showOfflineToast("Falha na importação", message);
  }
}

// ==========================================
// Direct Visible Top Bar & Sidebar Action Buttons
// ==========================================
document.getElementById("btn-top-settings")?.addEventListener("click", () => {
  openPreferences("general");
});

document.getElementById("btn-top-donate")?.addEventListener("click", () => {
  openPreferences("about");
});

// Donation / Support Logic (Pix & Mercado Pago)
const DONATION_URL = "https://link.mercadopago.com.br/johntechdicas";

async function openExternalBrowser(url: string) {
  if (inTauri()) {
    try {
      await tauriInvoke("open_browser_url", { url });
      return;
    } catch (e) {
      console.warn("open_browser_url error:", e);
    }
  }
  window.open(url, "_blank");
}

document.getElementById("btn-donate-open-link")?.addEventListener("click", () => {
  void openExternalBrowser(DONATION_URL);
});

document.getElementById("btn-donate-copy-link")?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(DONATION_URL);
    const feedbackEl = document.getElementById("donate-copy-feedback");
    if (feedbackEl) {
      feedbackEl.style.display = "inline";
      setTimeout(() => { feedbackEl.style.display = "none"; }, 3000);
    }
    showOfflineToast("Chave / Link Pix Copiado", "Link de doação copiado para a área de transferência!");
  } catch {
    showOfflineToast("Link de Apoio", DONATION_URL);
  }
});

document.getElementById("btn-top-web-search")?.addEventListener("click", () => {
  modalAddItem.style.display = "flex";
  switchTab(tabBtnOnline, tabPaneOnline);
  setTimeout(() => inputOnlineSearch.focus(), 100);
});

document.getElementById("btn-top-remote-qr")?.addEventListener("click", () => {
  showQrModal();
});

document.getElementById("pill-quick-bible")?.addEventListener("click", () => {
  modalBibleNavigator.style.display = "flex";
  renderBibleNavigator();
});

document.getElementById("pill-quick-web")?.addEventListener("click", () => {
  modalAddItem.style.display = "flex";
  switchTab(tabBtnOnline, tabPaneOnline);
  setTimeout(() => inputOnlineSearch.focus(), 100);
});

document.getElementById("pill-quick-harpa")?.addEventListener("click", () => {
  modalAddItem.style.display = "flex";
  switchTab(tabBtnHarpa, tabPaneHarpa);
});

document.getElementById("pill-quick-new")?.addEventListener("click", () => {
  modalAddItem.style.display = "flex";
  switchTab(tabBtnCustom, tabPaneCustom);
});

const inputQuickMediaFiles = document.getElementById("input-quick-media-files") as HTMLInputElement | null;
document.getElementById("pill-quick-media")?.addEventListener("click", () => {
  inputQuickMediaFiles?.click();
});
inputQuickMediaFiles?.addEventListener("change", () => {
  void addMediaFilesToPlaylist(inputQuickMediaFiles.files);
  inputQuickMediaFiles.value = "";
});

// ==========================================
// Spotlight Autocomplete with Instant Web Action
// ==========================================
quickSearchInput.addEventListener("input", () => {
  const query = quickSearchInput.value.trim();
  if (query.length < 2) {
    searchResultsList.style.display = "none";
    return;
  }

  const verses = BibleEngine.findVerses(query);
  const songs = SongEngine.findSongs(query);

  searchResultsList.innerHTML = "";
  searchResultsList.style.display = "block";

  verses.slice(0, 5).forEach((v) => {
    const el = document.createElement("div");
    el.className = "menu-item";
    el.innerHTML = `<span class="item-icon">📖</span> <span><b>${v.book} ${v.chapter}:${v.verse} (${v.version})</b>: ${v.text.slice(0, 52)}...</span>`;
    el.addEventListener("click", () => {
      const res = BibleEngine.versesToPlaylistItem([v], true);
      playlist.splice(activeItemIndex + 1, 0, res.item);
      renderPlaylist();
      selectPlaylistItem(activeItemIndex + 1, !toggleTwoClick.checked, res.startSlideIndex);
      searchResultsList.style.display = "none";
      quickSearchInput.value = "";
    });
    searchResultsList.appendChild(el);
  });

  songs.slice(0, 8).forEach((s) => {
    const el = document.createElement("div");
    el.className = "menu-item";
    el.innerHTML = `<span class="item-icon">🎵</span> <span><b>${s.title}</b> <span style="opacity:0.75;font-size:0.76rem;">(${s.artist} • ${s.slides.length} slides)</span></span>`;
    el.addEventListener("click", () => {
      const item = songToPlaylistItem(s, keyOffset);
      playlist.splice(activeItemIndex + 1, 0, item);
      renderPlaylist();
      selectPlaylistItem(activeItemIndex + 1, !toggleTwoClick.checked);
      searchResultsList.style.display = "none";
      quickSearchInput.value = "";
    });
    searchResultsList.appendChild(el);
  });

  // Always append: Instant Search on Web
  const webEl = document.createElement("div");
  webEl.className = "menu-item";
  webEl.style.background = "rgba(56, 189, 248, 0.15)";
  webEl.style.color = "#38bdf8";
  webEl.style.fontWeight = "600";
  webEl.innerHTML = `<span class="item-icon">🌐</span> <span>Buscar "<b>${query}</b>" na Web (Milhares de Músicas)...</span>`;
  webEl.addEventListener("click", () => {
    searchResultsList.style.display = "none";
    quickSearchInput.value = "";
    modalAddItem.style.display = "flex";
    switchTab(tabBtnOnline, tabPaneOnline);
    inputOnlineSearch.value = query;
    btnDoOnlineSearch.click();
  });
  searchResultsList.appendChild(webEl);
});

quickSearchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const firstItem = searchResultsList.querySelector(".menu-item") as HTMLElement | null;
    if (firstItem && searchResultsList.style.display !== "none") {
      firstItem.click();
      quickSearchInput.blur();
    }
  }
});

// Close search dropdown on click outside
document.addEventListener("click", (e) => {
  if (!quickSearchInput.contains(e.target as Node) && !searchResultsList.contains(e.target as Node)) {
    searchResultsList.style.display = "none";
  }
});

// ==========================================
// macOS Safari Preferences / Ajustes Window
// ==========================================
const modalPreferences = document.getElementById("modal-preferences");
const btnClosePrefs = document.getElementById("btn-close-prefs");
const prefsTabBtns = document.querySelectorAll(".prefs-tab-btn");
const prefsWindowTitle = document.getElementById("prefs-window-title");

const prefSelectBgTheme = document.getElementById("pref-select-bg-theme") as HTMLSelectElement | null;
const inputPrefBgImage = document.getElementById("input-pref-bg-image") as HTMLInputElement | null;
const inputPrefBgVideo = document.getElementById("input-pref-bg-video") as HTMLInputElement | null;
const prefBgDimmer = document.getElementById("pref-bg-dimmer") as HTMLInputElement | null;
const labelBgDimmer = document.getElementById("label-bg-dimmer");
const prefSelectFont = document.getElementById("pref-select-font") as HTMLSelectElement | null;
const prefInputTextColor = document.getElementById("pref-input-text-color") as HTMLInputElement | null;
const prefObsCustomHtml = document.getElementById("pref-obs-custom-html") as HTMLTextAreaElement | null;
const prefObsCustomCss = document.getElementById("pref-obs-custom-css") as HTMLTextAreaElement | null;
const prefSelectClock = document.getElementById("pref-select-clock") as HTMLSelectElement | null;
const prefUppercaseLyrics = document.getElementById("pref-uppercase-lyrics") as HTMLInputElement | null;
const prefLowSpecCheck = document.getElementById("pref-low-spec-check") as HTMLInputElement | null;
const prefTwoClick = document.getElementById("pref-two-click") as HTMLInputElement | null;
const prefDefaultBible = document.getElementById("pref-default-bible") as HTMLSelectElement | null;

// Visual Media Indicators & Badges Helper

function syncBgThemeUploadRows(theme: string) {
  const rowImg = document.getElementById("row-custom-image");
  const rowVid = document.getElementById("row-custom-video");
  if (rowImg) rowImg.style.display = theme === "custom-image" ? "flex" : "none";
  if (rowVid) rowVid.style.display = theme === "custom-video" ? "flex" : "none";
}

function updateSelectedMediaBadges() {
  const st = store.getState();

  // Background Image status
  const imgStatus = document.getElementById("bg-image-selected-status");
  if (imgStatus) {
    if (st.customBackgroundImage) {
      const name = st.customBackgroundImageName || "Imagem customizada ativa";
      imgStatus.innerHTML = `
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></span>
        <span style="color: #6ee7b7; font-weight: 600;">Ativa:</span>
        <span style="color: #f1f5f9; overflow: hidden; text-overflow: ellipsis; max-width: 280px; white-space: nowrap;">${name}</span>
      `;
    } else {
      imgStatus.innerHTML = `<span>⚪ Nenhuma imagem customizada selecionada</span>`;
    }
  }

  // Background Video status & preset button highlight
  const vidStatus = document.getElementById("bg-video-selected-status");
  if (vidStatus) {
    if (st.customBackgroundVideo) {
      const vidName = st.customBackgroundVideoName || st.customBackgroundVideo.split("/").pop() || "Vídeo ativo";
      vidStatus.innerHTML = `
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #38bdf8;"></span>
        <span style="color: #38bdf8; font-weight: 600;">Em Loop:</span>
        <span style="color: #f1f5f9; overflow: hidden; text-overflow: ellipsis; max-width: 240px; white-space: nowrap;">${vidName}</span>
      `;
    } else {
      vidStatus.innerHTML = `<span>⚪ Nenhum vídeo em loop selecionado</span>`;
    }
  }

  document.querySelectorAll(".btn-preset-bg-video").forEach((btn) => {
    const vUrl = btn.getAttribute("data-video");
    if (st.customBackgroundVideo && vUrl && st.customBackgroundVideo === vUrl) {
      btn.classList.add("active-preset");
    } else {
      btn.classList.remove("active-preset");
    }
  });

  // OBS church logo badge
  const logoStatus = document.getElementById("obs-logo-selected-status");
  if (logoStatus) {
    if (st.churchLogo) {
      const logoName = st.churchLogoName || "Logotipo / Brasão carregado";
      logoStatus.innerHTML = `
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></span>
        <span style="color: #6ee7b7; font-weight: 600;">Logo Ativo:</span>
        <span style="color: #f1f5f9;">${logoName}</span>
      `;
    } else {
      logoStatus.innerHTML = `<span>⚪ Nenhum logotipo carregado</span>`;
    }
  }
}

function syncSegmentedGroup(groupId: string, activeVal: string) {
  const grp = document.getElementById(groupId);
  if (!grp) return;
  grp.querySelectorAll<HTMLButtonElement>(".apple-segmented-btn").forEach(btn => {
    if (btn.getAttribute("data-val") === activeVal) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

function updateObsLivePreview() {
  const previewBox = document.getElementById("obs-modal-preview-box");
  const previewEl = document.getElementById("obs-modal-preview-element");
  const previewHdr = document.getElementById("obs-preview-header");
  const previewTxt = document.getElementById("obs-preview-text");
  if (!previewBox || !previewEl) return;

  const st = store.getState();
  const shape = st.obsShape || "pill";
  const pos = st.obsPosition || "bottom";
  const align = st.obsTextAlign || "center";
  const bg = st.obsBgColor || "rgba(10, 14, 24, 0.88)";
  const txtColor = st.obsTextColor || "#ffffff";
  const accent = st.obsAccentColor || "#6366f1";
  const fSize = st.obsFontSize || "normal";
  const isBold = st.obsBold !== false;
  const showHdr = st.obsShowHeader !== false;

  previewBox.style.alignItems = pos === "top" ? "flex-start" : "flex-end";
  previewEl.style.textAlign = align;
  previewEl.style.color = txtColor;

  if (previewHdr) {
    previewHdr.style.display = showHdr ? "block" : "none";
    previewHdr.style.color = accent;
  }

  if (previewTxt) {
    previewTxt.style.fontWeight = isBold ? "700" : "500";
    if (fSize === "normal") previewTxt.style.fontSize = "13px";
    else if (fSize === "large") previewTxt.style.fontSize = "15px";
    else previewTxt.style.fontSize = "17px";
  }

  if (shape === "pill") {
    previewEl.style.background = bg;
    previewEl.style.border = `1px solid ${accent}66`;
    previewEl.style.borderLeft = `5px solid ${accent}`;
    previewEl.style.borderRadius = "20px";
    previewEl.style.padding = "10px 18px";
    previewEl.style.width = "90%";
    previewEl.style.boxShadow = "0 8px 24px rgba(0,0,0,0.6)";
  } else if (shape === "card") {
    previewEl.style.background = bg;
    previewEl.style.border = `1px solid ${accent}66`;
    previewEl.style.borderLeft = `4px solid ${accent}`;
    previewEl.style.borderRadius = "10px";
    previewEl.style.padding = "10px 18px";
    previewEl.style.width = "92%";
    previewEl.style.boxShadow = "0 8px 24px rgba(0,0,0,0.6)";
  } else if (shape === "full-width") {
    previewEl.style.background = bg;
    previewEl.style.border = "none";
    previewEl.style.borderTop = `3px solid ${accent}`;
    previewEl.style.borderRadius = "0";
    previewEl.style.padding = "10px 16px";
    previewEl.style.width = "100%";
    previewEl.style.boxShadow = "0 -4px 16px rgba(0,0,0,0.5)";
  } else { // minimal
    previewEl.style.background = "transparent";
    previewEl.style.border = "none";
    previewEl.style.borderRadius = "0";
    previewEl.style.padding = "6px 12px";
    previewEl.style.width = "95%";
    previewEl.style.boxShadow = "none";
    previewEl.style.textShadow = "0 2px 6px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.8)";
  }
}

function openPreferences(tabName: string = "general") {
  if (modalPreferences) {
    const st = store.getState();
    if (prefObsCustomHtml) prefObsCustomHtml.value = st.obsCustomHtml || "";
    if (prefObsCustomCss) prefObsCustomCss.value = st.obsCustomCss || "";
    if (prefSelectBgTheme) {
      prefSelectBgTheme.value = st.backgroundTheme || "nebula";
      syncBgThemeUploadRows(st.backgroundTheme || "nebula");
    }
    if (prefBgDimmer) {
      const pct = Math.round((st.backgroundDimmer ?? 0.45) * 100);
      prefBgDimmer.value = String(pct);
      if (labelBgDimmer) labelBgDimmer.textContent = `${pct}%`;
    }
    if (prefSelectFont && st.fontFamily) prefSelectFont.value = st.fontFamily;
    if (prefInputTextColor && st.textColor) prefInputTextColor.value = st.textColor;
    if (prefSelectClock) prefSelectClock.value = st.clockPosition || "none";
    if (prefUppercaseLyrics) prefUppercaseLyrics.checked = !!st.uppercaseLyrics;
    if (prefLowSpecCheck) prefLowSpecCheck.checked = !!st.lowSpecMode;
    if (prefTwoClick) prefTwoClick.checked = toggleTwoClick.checked;

    const prefLockCurrentItem = document.getElementById("pref-lock-current-item") as HTMLInputElement | null;
    if (prefLockCurrentItem) prefLockCurrentItem.checked = st.lockToCurrentItem ?? true;

    // Telão Typography & Display Segmented Controls
    syncSegmentedGroup("seg-font-size-scale", st.fontSizeScale || "normal");
    syncSegmentedGroup("seg-font-style", st.fontStyle || "bold");
    syncSegmentedGroup("seg-text-shadow", st.textShadowStyle || "soft");
    syncSegmentedGroup("seg-show-song-title", String(st.showSongTitle ?? true));
    syncSegmentedGroup("seg-bible-ref-format", st.bibleReferenceFormat || "header");

    // OBS Visual Controls
    syncSegmentedGroup("seg-obs-shape", st.obsShape || "pill");
    syncSegmentedGroup("seg-obs-position", st.obsPosition || "bottom");
    syncSegmentedGroup("seg-obs-text-align", st.obsTextAlign || "center");
    syncSegmentedGroup("seg-obs-font-size", st.obsFontSize || "normal");
    syncSegmentedGroup("seg-obs-bold", st.obsBold !== false ? "bold" : "normal");
    syncSegmentedGroup("seg-obs-show-header", String(st.obsShowHeader ?? true));

    const obsBgColorPicker = document.getElementById("pref-obs-bg-color-picker") as HTMLInputElement | null;
    if (obsBgColorPicker && st.obsBgColor) {
      obsBgColorPicker.value = st.obsBgColor.startsWith("#") ? st.obsBgColor : "#0a0e18";
    }
    const obsTextColorPicker = document.getElementById("pref-obs-text-color-picker") as HTMLInputElement | null;
    if (obsTextColorPicker && st.obsTextColor) {
      obsTextColorPicker.value = st.obsTextColor.startsWith("#") ? st.obsTextColor : "#ffffff";
    }
    const obsAccentColorPicker = document.getElementById("pref-obs-accent-color-picker") as HTMLInputElement | null;
    if (obsAccentColorPicker && st.obsAccentColor) {
      obsAccentColorPicker.value = st.obsAccentColor.startsWith("#") ? st.obsAccentColor : "#6366f1";
    }

    updateObsLivePreview();
    updateSelectedMediaBadges();

    modalPreferences.style.display = "flex";
    switchPrefsTab(tabName);
  }
}

function switchPrefsTab(tabName: string) {
  prefsTabBtns.forEach(btn => {
    if (btn.getAttribute("data-tab") === tabName) {
      btn.classList.add("active");
      const title = btn.getAttribute("data-title") || "Ajustes";
      if (prefsWindowTitle) prefsWindowTitle.textContent = title;
    } else {
      btn.classList.remove("active");
    }
  });

  document.querySelectorAll(".prefs-section").forEach(sec => {
    (sec as HTMLElement).style.display = "none";
  });

  const targetPane = document.getElementById(`prefs-pane-${tabName}`);
  if (targetPane) targetPane.style.display = "flex";

  if (tabName === "bibles") {
    renderBibleCatalog();
    populateBibleDefaultSelect();
  } else if (tabName === "backgrounds" || tabName === "obs") {
    updateSelectedMediaBadges();
  } else if (tabName === "raffle") {
    renderRaffleUI();
  }
}

prefsTabBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.getAttribute("data-tab") || "general";
    switchPrefsTab(tab);
  });
});

btnClosePrefs?.addEventListener("click", () => {
  if (modalPreferences) modalPreferences.style.display = "none";
});

modalPreferences?.addEventListener("click", (e) => {
  if (e.target === modalPreferences) modalPreferences.style.display = "none";
});

// Wire up macOS Preferences Controls
document.getElementById("pref-lock-current-item")?.addEventListener("change", (e) => {
  const target = e.target as HTMLInputElement;
  store.setState({ lockToCurrentItem: target.checked });
});

prefTwoClick?.addEventListener("change", () => {
  if (prefTwoClick.checked !== toggleTwoClick.checked) {
    btnToggleClickMode?.click();
  }
});

prefSelectClock?.addEventListener("change", () => {
  store.setState({ clockPosition: prefSelectClock.value as any });
});

prefUppercaseLyrics?.addEventListener("change", () => {
  store.setState({ uppercaseLyrics: prefUppercaseLyrics.checked });
});

prefLowSpecCheck?.addEventListener("change", () => {
  store.setState({ lowSpecMode: prefLowSpecCheck.checked });
  if (toggleLowSpec) toggleLowSpec.checked = prefLowSpecCheck.checked;
});

prefDefaultBible?.addEventListener("change", () => {
  void switchBibleVersionInstant(prefDefaultBible.value);
});

prefSelectBgTheme?.addEventListener("change", () => {
  const val = prefSelectBgTheme.value as any;
  store.setState({ backgroundTheme: val });
  syncBgThemeUploadRows(val);
  if (val === "motion-loop-1") {
    showOfflineToast("🎬 Motion Background", "Loop 1: Partículas HD ativado no telão.");
  } else if (val === "motion-loop-2") {
    showOfflineToast("🎬 Motion Background", "Loop 2: Violão & Adoração ativado no telão.");
  } else if (val === "motion-loop-3") {
    showOfflineToast("🎬 Motion Background", "Loop 3: Bíblia & Louvor Dourado ativado no telão.");
  } else if (val === "custom-image") {
    showOfflineToast("🖼️ Imagem Customizada", "Escolha a imagem desejada no campo abaixo.");
  } else if (val === "custom-video") {
    showOfflineToast("🎬 Vídeo Customizado", "Escolha o vídeo desejado no campo abaixo.");
  }
});

inputPrefBgImage?.addEventListener("change", () => {
  if (inputPrefBgImage.files && inputPrefBgImage.files[0]) {
    const file = inputPrefBgImage.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      store.setState({
        customBackgroundImage: dataUrl,
        customBackgroundImageName: file.name,
        backgroundTheme: "custom-image"
      });
      if (prefSelectBgTheme) prefSelectBgTheme.value = "custom-image";
      updateSelectedMediaBadges();
      showOfflineToast("Fundo de Imagem Ativado", `"${file.name}" definida como plano de fundo do telão.`);
    };
    reader.readAsDataURL(file);
  }
});

document.getElementById("btn-pref-clear-bg-image")?.addEventListener("click", () => {
  store.setState({ customBackgroundImage: null, customBackgroundImageName: undefined, backgroundTheme: "nebula" });
  if (prefSelectBgTheme) prefSelectBgTheme.value = "nebula";
  updateSelectedMediaBadges();
  showOfflineToast("Fundo Restaurado", "Imagem removida, fundo padrão restaurado.");
});

inputPrefBgVideo?.addEventListener("change", async () => {
  if (inputPrefBgVideo.files && inputPrefBgVideo.files[0]) {
    const file = inputPrefBgVideo.files[0];
    const vidUrl = await uploadVideoFileToServer(file);
    store.setState({
      customBackgroundVideo: vidUrl,
      customBackgroundVideoName: file.name,
      backgroundTheme: "custom-video"
    });
    if (prefSelectBgTheme) prefSelectBgTheme.value = "custom-video";
    updateSelectedMediaBadges();
    showOfflineToast("Vídeo de Fundo Ativado", `"${file.name}" em reprodução contínua.`);
  }
});

document.querySelectorAll(".btn-preset-bg-video").forEach((btn) => {
  btn.addEventListener("click", () => {
    const vidUrl = btn.getAttribute("data-video") || "./data/videos/bg1.mp4";
    const label = btn.getAttribute("data-label") || "Vídeo Loop HD";
    store.setState({
      customBackgroundVideo: vidUrl,
      customBackgroundVideoName: label,
      backgroundTheme: "custom-video"
    });
    if (prefSelectBgTheme) prefSelectBgTheme.value = "custom-video";
    updateSelectedMediaBadges();
    showOfflineToast("Vídeo Loop Ativado", `${label} em reprodução contínua atrás das letras.`);
  });
});

document.getElementById("btn-pref-clear-bg-video")?.addEventListener("click", () => {
  store.setState({ customBackgroundVideo: null, customBackgroundVideoName: undefined, backgroundTheme: "nebula" });
  if (prefSelectBgTheme) prefSelectBgTheme.value = "nebula";
  updateSelectedMediaBadges();
  showOfflineToast("Fundo Restaurado", "Vídeo de loop removido.");
});

prefBgDimmer?.addEventListener("input", () => {
  const val = parseInt(prefBgDimmer.value, 10) || 0;
  if (labelBgDimmer) labelBgDimmer.textContent = `${val}%`;
  store.setState({ backgroundDimmer: val / 100 });
});

prefSelectFont?.addEventListener("change", () => {
  store.setState({ fontFamily: prefSelectFont.value });
});

prefInputTextColor?.addEventListener("input", () => {
  store.setState({ textColor: prefInputTextColor.value });
});

document.querySelectorAll(".text-color-preset").forEach(btn => {
  btn.addEventListener("click", () => {
    const c = btn.getAttribute("data-color") || "#ffffff";
    if (prefInputTextColor) prefInputTextColor.value = c;
    store.setState({ textColor: c });
  });
});

// Media Tab in Preferences
const inputMediaImages = document.getElementById("input-media-images") as HTMLInputElement | null;
const inputMediaVideo = document.getElementById("input-media-video") as HTMLInputElement | null;
const inputMediaPdf = document.getElementById("input-media-pdf") as HTMLInputElement | null;

[inputMediaImages, inputMediaVideo, inputMediaPdf].forEach(inp => {
  inp?.addEventListener("change", () => {
    void addMediaFilesToPlaylist(inp.files);
    if (modalPreferences) modalPreferences.style.display = "none";
    inp.value = "";
  });
});

// Custom OBS HTML/CSS Editor Actions
document.getElementById("btn-apply-obs-custom")?.addEventListener("click", () => {
  store.setState({
    obsCustomHtml: prefObsCustomHtml?.value || "",
    obsCustomCss: prefObsCustomCss?.value || "",
    obsTheme: "custom-html"
  });
  if (prefSelectObsTheme) prefSelectObsTheme.value = "custom-html";
  if (selectObsTheme) selectObsTheme.value = "custom-html";
});

document.getElementById("btn-reset-obs-custom")?.addEventListener("click", () => {
  const defHtml = `<div class="op-obs-card">\n  <div class="op-obs-header">{{header}}</div>\n  <div class="op-obs-text">{{text}}</div>\n</div>`;
  const defCss = `.op-obs-card {\n  position: fixed;\n  bottom: 48px;\n  left: 50%;\n  transform: translateX(-50%);\n  width: 82vw;\n  max-width: 1480px;\n  background: rgba(10, 14, 24, 0.86);\n  backdrop-filter: blur(16px);\n  border: 1px solid rgba(99, 102, 241, 0.45);\n  border-left: 6px solid #6366f1;\n  border-radius: 18px;\n  padding: 22px 36px;\n  color: #ffffff;\n  font-family: Inter, system-ui, sans-serif;\n  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.75);\n  text-align: center;\n}\n.op-obs-header {\n  font-size: 20px;\n  font-weight: 700;\n  color: #a5b4fc;\n  text-transform: uppercase;\n  letter-spacing: 0.08em;\n  margin-bottom: 6px;\n}\n.op-obs-text {\n  font-size: 38px;\n  font-weight: 700;\n  line-height: 1.3;\n  white-space: pre-line;\n  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);\n}`;
  if (prefObsCustomHtml) prefObsCustomHtml.value = defHtml;
  if (prefObsCustomCss) prefObsCustomCss.value = defCss;
  store.setState({ obsCustomHtml: defHtml, obsCustomCss: defCss });
});

document.getElementById("btn-pref-save-worship")?.addEventListener("click", saveCurrentWorshipService);
document.getElementById("btn-pref-load-worship")?.addEventListener("click", () => inputLoadWorshipFile?.click());

document.getElementById("btn-drawer-obs-advanced")?.addEventListener("click", () => {
  openPreferences("obs");
});

document.getElementById("mi-import-bible")?.addEventListener("click", () => {
  closeAllMenus();
  openPreferences("bible");
  (document.getElementById("input-pref-bible-file") as HTMLInputElement | null)?.click();
});

document.getElementById("mi-shortcuts-help")?.addEventListener("click", () => {
  closeAllMenus();
  openPreferences("shortcuts");
});

document.getElementById("mi-about-help")?.addEventListener("click", () => {
  closeAllMenus();
  openPreferences("about");
});

// ==========================================
// Reactive Store Subscriptions & Bootstrap
// ==========================================
store.onCommand(async (cmd) => {
  if (cmd === "next") nextSlide();
  else if (cmd === "prev") prevSlide();
  else if (cmd === "toggle-clear") btnClearText.click();
  else if (cmd === "toggle-blackout") btnBlackout.click();
  else if (cmd.startsWith("goto-slide:")) {
    const idx = parseInt(cmd.slice(11), 10);
    if (!isNaN(idx)) fireSlide(idx);
  } else if (cmd.startsWith("select-item:")) {
    const idx = parseInt(cmd.slice(12), 10);
    if (!isNaN(idx)) selectPlaylistItem(idx, true, 0);
  } else if (cmd.startsWith("bible-ver:")) {
    const ver = cmd.slice(10).trim();
    if (ver) await switchBibleVersionInstant(ver);
  } else if (cmd.startsWith("bible:")) {
    const query = cmd.slice(6).trim();
    const verses = BibleEngine.findVerses(query);
    if (verses.length > 0) {
      const res = BibleEngine.versesToPlaylistItem(verses, true);
      playlist.splice(activeItemIndex + 1, 0, res.item);
      renderPlaylist();
      selectPlaylistItem(activeItemIndex + 1, true, res.startSlideIndex);
    }
  } else if (cmd.startsWith("song:")) {
    const query = cmd.slice(5).trim();
    if (!query) return;
    const localSongs = SongEngine.findSongs(query);
    if (localSongs.length > 0) {
      const item = songToPlaylistItem(localSongs[0], keyOffset);
      playlist.splice(activeItemIndex + 1, 0, item);
      renderPlaylist();
      selectPlaylistItem(activeItemIndex + 1, true, 0);
    } else {
      const online = await SongEngine.searchOnlineLyrics(query);
      if (online.length > 0) {
        const song = SongEngine.parseLyricsToSong(online[0].title, online[0].artist, "C", online[0].plainLyrics);
        SongEngine.saveCustomSong(song);
        const item = songToPlaylistItem(song, keyOffset);
        playlist.splice(activeItemIndex + 1, 0, item);
        renderPlaylist();
        selectPlaylistItem(activeItemIndex + 1, true, 0);
      }
    }
  }
});

// ==========================================
// Advanced Raffle System (Sorteios por Números)
// ==========================================
function renderRaffleUI() {
  const st = store.getState();
  const modeLabel = document.getElementById("raffle-current-mode-label");
  const minInp = document.getElementById("pref-raffle-min") as HTMLInputElement | null;
  const maxInp = document.getElementById("pref-raffle-max") as HTMLInputElement | null;
  const noRepCheck = document.getElementById("pref-raffle-no-repeat") as HTMLInputElement | null;

  if (modeLabel) {
    modeLabel.textContent = `SORTEIO ATIVO: NÚMEROS (${st.raffleMinNumber || 1} A ${st.raffleMaxNumber || 200})`;
  }

  if (minInp) minInp.value = String(st.raffleMinNumber || 1);
  if (maxInp) maxInp.value = String(st.raffleMaxNumber || 200);
  if (noRepCheck) noRepCheck.checked = st.raffleNoRepeat ?? true;

  // Render Winners History List
  const winnersList = document.getElementById("raffle-winners-history-list");
  const winnersCount = document.getElementById("raffle-winners-count");
  if (winnersList) {
    const wins = st.raffleDrawnNumbers || [];
    if (wins.length === 0) {
      winnersList.innerHTML = `<span style="font-size: 0.72rem; color: #64748b; font-style: italic;">Nenhum sorteio realizado ainda nesta sessão.</span>`;
      if (winnersCount) winnersCount.textContent = "0 sorteios realizados";
    } else {
      if (winnersCount) winnersCount.textContent = `${wins.length} sorteio(s) realizado(s)`;
      winnersList.innerHTML = wins.map((num: number, i: number) => `
        <span class="raffle-badge-won" style="font-size: 0.74rem; padding: 3px 8px;">
          ${i + 1}º: Nº ${num}
        </span>
      `).join("");
    }
  }
}

async function executeRaffleDraw(isFromQuickDrawer: boolean = false) {
  const st = store.getState();
  const displayEl = document.getElementById("raffle-result-display");
  const suspenseCheck = document.getElementById("pref-raffle-suspense") as HTMLInputElement | null;
  const wantSuspense = !isFromQuickDrawer && (suspenseCheck ? suspenseCheck.checked : true);

  const min = st.raffleMinNumber || 1;
  const max = Math.max(min, st.raffleMaxNumber || 200);
  const drawnNums = st.raffleDrawnNumbers || [];

  const pool: number[] = [];
  for (let i = min; i <= max; i++) {
    if (!st.raffleNoRepeat || !drawnNums.includes(i)) {
      pool.push(i);
    }
  }

  if (pool.length === 0) {
    showOfflineToast("Intervalo Esgotado!", `Todos os números de ${min} a ${max} já foram sorteados. Zere o histórico para continuar!`);
    return;
  }

  if (wantSuspense && displayEl) {
    displayEl.classList.add("shuffling");
    for (let i = 0; i < 16; i++) {
      const randTemp = pool[Math.floor(Math.random() * pool.length)];
      displayEl.textContent = `🎲 NÚMERO: ${randTemp}...`;
      await new Promise(r => setTimeout(r, 60 + i * 8));
    }
    displayEl.classList.remove("shuffling");
  }

  const winner = pool[Math.floor(Math.random() * pool.length)];
  const drawn = [...drawnNums, winner];
  store.setState({
    raffleDrawnNumbers: drawn,
    raffleLastWinner: `Número ${winner}`
  });

  const winnerText = `Nº ${winner}`;

  // Update display
  if (displayEl) {
    displayEl.innerHTML = `
      <div style="font-size: 0.85rem; color: #a5b4fc; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 4px;">🎉 NÚMERO SORTEADO</div>
      <div style="font-size: 2.6rem; font-weight: 800; color: #fbbf24; text-shadow: 0 4px 20px rgba(245, 158, 11, 0.4);">${winnerText}</div>
    `;
  }



  renderRaffleUI();
  showOfflineToast("Sorteio Realizado!", `${winnerText} foi o sorteado!`);
}

function initRaffleControls() {
  const minInp = document.getElementById("pref-raffle-min") as HTMLInputElement | null;
  const maxInp = document.getElementById("pref-raffle-max") as HTMLInputElement | null;
  const noRepCheck = document.getElementById("pref-raffle-no-repeat") as HTMLInputElement | null;

  minInp?.addEventListener("change", () => {
    const val = parseInt(minInp.value, 10) || 1;
    store.setState({ raffleMinNumber: val });
    renderRaffleUI();
  });

  maxInp?.addEventListener("change", () => {
    const val = parseInt(maxInp.value, 10) || 200;
    store.setState({ raffleMaxNumber: val });
    renderRaffleUI();
  });

  noRepCheck?.addEventListener("change", () => {
    store.setState({ raffleNoRepeat: noRepCheck.checked });
  });

  // Range Presets (1 a 50, 1 a 100, 1 a 200, 1 a 500, 1 a 1000)
  document.querySelectorAll(".btn-raffle-range-preset").forEach(btn => {
    btn.addEventListener("click", () => {
      const min = parseInt(btn.getAttribute("data-min") || "1", 10);
      const max = parseInt(btn.getAttribute("data-max") || "200", 10);
      store.setState({ raffleMinNumber: min, raffleMaxNumber: max });
      document.querySelectorAll(".btn-raffle-range-preset").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderRaffleUI();
    });
  });

  // Trigger Sorteio
  document.getElementById("btn-raffle-trigger-now")?.addEventListener("click", () => {
    executeRaffleDraw(false);
  });

  // Projetar no Telão (Cria Slide Especial Ao Vivo)
  document.getElementById("btn-raffle-project-screen")?.addEventListener("click", () => {
    const st = store.getState();
    if (!st.raffleLastWinner) {
      showOfflineToast("Nenhum Ganhador", "Realize um sorteio antes de projetar!");
      return;
    }
    const msg = `🎉 GANHADOR DO SORTEIO: ${st.raffleLastWinner.toUpperCase()}! 🏆`;
    const raffleSlide: Slide = {
      id: `raffle-win-${Date.now()}`,
      title: "Resultado do Sorteio",
      header: "SORTEIO AO VIVO",
      text: msg,
      category: "alert",
      background: { type: "shader", value: "worship-gold" }
    };
    store.setState({ currentSlide: raffleSlide, isLive: true, isBlackout: false, isClearText: false });
    showOfflineToast("Projetado no Telão", "Resultado do sorteio transmitido ao vivo!");
  });

  // Enviar para Banner de Avisos
  document.getElementById("btn-raffle-copy-alert")?.addEventListener("click", () => {
    const st = store.getState();
    if (!st.raffleLastWinner) {
      showOfflineToast("Nenhum Ganhador", "Realize um sorteio antes de enviar aos avisos!");
      return;
    }
    const msg = `🎉 GANHADOR DO SORTEIO: ${st.raffleLastWinner}!`;
    const alertInp = document.getElementById("input-quick-alert") as HTMLInputElement | null;
    if (alertInp) {
      alertInp.value = msg;
      showOfflineToast("Copiado para Avisos", "Texto carregado na barra de alertas rápidos.");
    }
  });

  // Reset History
  document.getElementById("btn-raffle-reset-history")?.addEventListener("click", () => {
    store.setState({ raffleDrawnNumbers: [], raffleLastWinner: null });
    const displayEl = document.getElementById("raffle-result-display");
    if (displayEl) displayEl.innerHTML = "<span>Pronto para sortear</span>";
    renderRaffleUI();
    showOfflineToast("Histórico Zerado", "A urna foi renovada para novos sorteios.");
  });
}

function initAppleSegmentedControls() {
  const wireGroup = (groupId: string, callback: (val: string) => void) => {
    const grp = document.getElementById(groupId);
    if (!grp) return;
    grp.querySelectorAll<HTMLButtonElement>(".apple-segmented-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const val = btn.getAttribute("data-val");
        if (!val) return;
        grp.querySelectorAll(".apple-segmented-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        callback(val);
      });
    });
  };



  // Telão Settings
  wireGroup("seg-font-size-scale", (val) => store.setState({ fontSizeScale: val as any }));
  wireGroup("seg-font-style", (val) => store.setState({ fontStyle: val as any }));
  wireGroup("seg-text-shadow", (val) => store.setState({ textShadowStyle: val as any }));
  wireGroup("seg-show-song-title", (val) => store.setState({ showSongTitle: val === "true" }));
  wireGroup("seg-bible-ref-format", (val) => store.setState({ bibleReferenceFormat: val as any }));

  // OBS Settings
  wireGroup("seg-obs-shape", (val) => {
    let theme: any = "glass-pill";
    if (val === "minimal") theme = "clean-minimal";
    else if (val === "full-width") theme = "full-width";
    else if (val === "card") theme = "bible-box";
    else theme = "glass-pill";

    const st = store.getState();
    const updated = { ...st, obsShape: val as any, obsTheme: theme };
    const newCss = buildObsCss(updated);
    store.setState({ obsShape: val as any, obsTheme: theme, obsCustomCss: newCss });
    if (prefObsCustomCss) prefObsCustomCss.value = newCss;
    if (selectObsTheme) selectObsTheme.value = theme;
    updateObsLivePreview();
  });
  wireGroup("seg-obs-position", (val) => {
    const st = store.getState();
    const updated = { ...st, obsPosition: val as any };
    const newCss = buildObsCss(updated);
    store.setState({ obsPosition: val as any, obsCustomCss: newCss });
    if (prefObsCustomCss) prefObsCustomCss.value = newCss;
    updateObsLivePreview();
  });
  wireGroup("seg-obs-text-align", (val) => {
    const st = store.getState();
    const updated = { ...st, obsTextAlign: val as any };
    const newCss = buildObsCss(updated);
    store.setState({ obsTextAlign: val as any, obsCustomCss: newCss });
    if (prefObsCustomCss) prefObsCustomCss.value = newCss;
    updateObsLivePreview();
  });
  wireGroup("seg-obs-font-size", (val) => {
    const st = store.getState();
    const updated = { ...st, obsFontSize: val as any };
    const newCss = buildObsCss(updated);
    store.setState({ obsFontSize: val as any, obsCustomCss: newCss });
    if (prefObsCustomCss) prefObsCustomCss.value = newCss;
    updateObsLivePreview();
  });
  wireGroup("seg-obs-bold", (val) => {
    const isBold = val === "bold";
    const st = store.getState();
    const updated = { ...st, obsBold: isBold };
    const newCss = buildObsCss(updated);
    store.setState({ obsBold: isBold, obsCustomCss: newCss });
    if (prefObsCustomCss) prefObsCustomCss.value = newCss;
    updateObsLivePreview();
  });
  wireGroup("seg-obs-show-header", (val) => {
    const show = val === "true";
    const st = store.getState();
    const updated = { ...st, obsShowHeader: show };
    const newCss = buildObsCss(updated);
    store.setState({ obsShowHeader: show, obsCustomCss: newCss });
    if (prefObsCustomCss) prefObsCustomCss.value = newCss;
    updateObsLivePreview();
  });

  const obsBgColorPicker = document.getElementById("pref-obs-bg-color-picker") as HTMLInputElement | null;
  const obsTextColorPicker = document.getElementById("pref-obs-text-color-picker") as HTMLInputElement | null;
  const obsAccentColorPicker = document.getElementById("pref-obs-accent-color-picker") as HTMLInputElement | null;

  obsBgColorPicker?.addEventListener("input", () => {
    const st = store.getState();
    const updated = { ...st, obsBgColor: obsBgColorPicker.value };
    const newCss = buildObsCss(updated);
    store.setState({ obsBgColor: obsBgColorPicker.value, obsCustomCss: newCss });
    if (prefObsCustomCss) prefObsCustomCss.value = newCss;
    updateObsLivePreview();
  });

  obsTextColorPicker?.addEventListener("input", () => {
    const st = store.getState();
    const updated = { ...st, obsTextColor: obsTextColorPicker.value };
    const newCss = buildObsCss(updated);
    store.setState({ obsTextColor: obsTextColorPicker.value, obsCustomCss: newCss });
    if (prefObsCustomCss) prefObsCustomCss.value = newCss;
    updateObsLivePreview();
  });

  obsAccentColorPicker?.addEventListener("input", () => {
    const st = store.getState();
    const updated = { ...st, obsAccentColor: obsAccentColorPicker.value };
    const newCss = buildObsCss(updated);
    store.setState({ obsAccentColor: obsAccentColorPicker.value, obsCustomCss: newCss });
    if (prefObsCustomCss) prefObsCustomCss.value = newCss;
    updateObsLivePreview();
  });

  document.querySelectorAll(".obs-bg-preset").forEach(btn => {
    btn.addEventListener("click", () => {
      const bg = btn.getAttribute("data-bg") || "rgba(10, 14, 24, 0.88)";
      const st = store.getState();
      const updated = { ...st, obsBgColor: bg };
      const newCss = buildObsCss(updated);
      store.setState({ obsBgColor: bg, obsCustomCss: newCss });
      if (prefObsCustomCss) prefObsCustomCss.value = newCss;
      updateObsLivePreview();
    });
  });

  document.querySelectorAll(".obs-accent-preset").forEach(btn => {
    btn.addEventListener("click", () => {
      const acc = btn.getAttribute("data-accent") || "#6366f1";
      if (obsAccentColorPicker) obsAccentColorPicker.value = acc;
      const st = store.getState();
      const updated = { ...st, obsAccentColor: acc };
      const newCss = buildObsCss(updated);
      store.setState({ obsAccentColor: acc, obsCustomCss: newCss });
      if (prefObsCustomCss) prefObsCustomCss.value = newCss;
      updateObsLivePreview();
    });
  });
}

store.subscribe((state) => {
  audiencePreview.setSlide(state.currentSlide);
  audiencePreview.setOptions({
    isBlackout: state.isBlackout || !state.isLive,
    isClearText: state.isClearText,
    alertText: state.alertMessage,
    clockPosition: state.clockPosition,
    backgroundTheme: state.backgroundTheme,
    customBackgroundImage: state.customBackgroundImage,
    customBackgroundVideo: state.customBackgroundVideo,
    backgroundDimmer: state.backgroundDimmer,
    fontFamily: state.fontFamily,
    textColor: state.textColor,
    uppercaseLyrics: state.uppercaseLyrics,
    lowSpecMode: state.lowSpecMode,
    fontSizeScale: state.fontSizeScale,
    fontStyle: state.fontStyle,
    textShadowStyle: state.textShadowStyle,
    showSongTitle: state.showSongTitle,
    bibleReferenceFormat: state.bibleReferenceFormat
  });

  streamPreview.setSlide(state.currentSlide);
  streamPreview.setOptions({
    isBlackout: state.isBlackout || !state.isLive,
    isClearText: state.isClearText,
    alertText: state.alertMessage,
    obsTheme: state.obsTheme,
    churchLogo: state.churchLogo,
    fontFamily: state.fontFamily,
    textColor: state.textColor,
    lowSpecMode: state.lowSpecMode,
    uppercaseLyrics: state.uppercaseLyrics,
    obsShape: state.obsShape,
    obsPosition: state.obsPosition,
    obsTextAlign: state.obsTextAlign,
    obsBgColor: state.obsBgColor,
    obsTextColor: state.obsTextColor,
    obsAccentColor: state.obsAccentColor,
    obsFontSize: state.obsFontSize,
    obsBold: state.obsBold,
    obsShowHeader: state.obsShowHeader
  });

  // Update Drawer OBS Preview for Custom HTML
  const customDrawerContainer = document.getElementById("drawer-obs-custom-html-container") as HTMLDivElement | null;
  const canvasStream = document.getElementById("canvas-stream-preview") as HTMLCanvasElement | null;
  if (customDrawerContainer && canvasStream) {
    if (state.obsTheme === "custom-html") {
      canvasStream.style.display = "none";
      customDrawerContainer.style.display = "block";
      const sl = state.currentSlide;
      if (sl && !state.isClearText && !state.isBlackout && state.isLive) {
        const textVal = state.uppercaseLyrics ? sl.text.toUpperCase() : sl.text;
        const tpl = state.obsCustomHtml || `<div class="op-obs-card"><div class="op-obs-header">{{header}}</div><div class="op-obs-text">{{text}}</div></div>`;
        customDrawerContainer.innerHTML = `<style>
          .op-obs-card {
            transform: scale(0.35) !important;
            transform-origin: bottom center !important;
            bottom: 8px !important;
            width: 90% !important;
          }
          ${state.obsCustomCss || ""}
        </style>` + tpl
          .replace(/\{\{title\}\}/g, sl.title || "")
          .replace(/\{\{header\}\}/g, sl.header || sl.title || "")
          .replace(/\{\{text\}\}/g, textVal)
          .replace(/\{\{chords\}\}/g, sl.chords || "");
      } else {
        customDrawerContainer.innerHTML = "";
      }
    } else {
      canvasStream.style.display = "block";
      customDrawerContainer.style.display = "none";
    }
  }

  // Keep OBS Theme Selectors in sync
  if (selectObsTheme && selectObsTheme.value !== state.obsTheme) {
    selectObsTheme.value = state.obsTheme;
  }
  if (prefSelectObsTheme && prefSelectObsTheme.value !== state.obsTheme) {
    prefSelectObsTheme.value = state.obsTheme;
  }
});

// Start Engines & App
async function bootstrap() {
  initPlaylist();
  initAppleSegmentedControls();
  initRaffleControls();

  // Resolve real IP for OBS Browser Source & Remote URL
  getServerInfo().then(info => {
    if (info) {
      (window as any).__OP_PORT__ = info.port;
      const input = document.getElementById("obs-browser-url-input") as HTMLInputElement;
      if (input) input.value = `http://${info.ip}:${info.port}/stream.html`;
      const remUrl = document.getElementById("pref-remote-url");
      if (remUrl) remUrl.textContent = `http://${info.ip}:${info.port}/remote.html`;
    }
  }).catch(() => {});

  Promise.all([BibleEngine.init(), SongEngine.init()]).then(() => {
    const ver = BibleEngine.getActiveVersion();
    labelActiveBible.textContent = ver.toUpperCase();
    renderTopBarBibleButtons();
    populateBibleDefaultSelect();

    // Atualiza o item bíblico inicial com o capítulo inteiro de João 3 carregado!
    const joVerses = BibleEngine.findVerses("jo 3 16");
    if (joVerses.length > 0) {
      const fullJo = BibleEngine.versesToPlaylistItem(joVerses, true);
      const bIdx = playlist.findIndex((it) => it.id === "bible-reading" || it.type === "bible");
      if (bIdx >= 0) {
        playlist[bIdx] = fullJo.item;
        renderPlaylist();
        if (activeItemIndex === bIdx) {
          renderSlideMatrix(playlist[bIdx]);
        }
      }
    }

    syncRemoteState();
    console.log("Altaris Presenter Control Center initialized with full Bible & Harpa database in 0ms!");

    const urlParams = new URLSearchParams(window.location.search);
    const modalParam = urlParams.get("modal");
    if (modalParam === "bible") {
      setTimeout(() => {
        modalBibleNavigator.style.display = "flex";
        renderBibleNavigator();
      }, 400);
    } else if (modalParam === "prefs" || modalParam === "backup" || modalParam === "about" || modalParam === "obs") {
      setTimeout(() => {
        openPreferences((modalParam === "backup" || modalParam === "about") ? "about" : (modalParam === "obs" ? "obs" : "general"));
      }, 400);
    }
  }).catch(e => console.warn("Error loading databases:", e));
}

bootstrap();




async function handleLocalAiOptimization() {
  const item = playlist[activeItemIndex];
  if (!item || item.slides.length === 0) return;

  const targetIdx = stagedSlideIndex >= 0 ? stagedSlideIndex : (liveSlideIndex >= 0 ? liveSlideIndex : 0);
  const slide = item.slides[targetIdx];
  if (!slide || !slide.text?.trim()) {
    showOfflineToast("✨ IA Local", "Selecione um slide com texto para otimizar.");
    return;
  }

  showLoadingHUD("Verificando IA Local...", "Conectando ao Ollama (localhost:11434)...");
  const status = await checkOllamaStatus();
  hideLoadingHUD();

  if (!status.available) {
    showOfflineToast(
      "✨ IA Local (Ollama)",
      "Ollama não foi detectado em execução no seu computador. Para usar IA local gratuita: 1) Instale de ollama.com  2) Execute 'ollama run llama3.2'. O Altaris usará o Auto-Fit matemático inteligente!",
      7000
    );
    return;
  }

  const model = status.recommendedModel || "llama3.2";
  showLoadingHUD("✨ Otimizando Slide com IA Local...", `Processando texto com ${model} (100% offline)...`);

  try {
    const res = await optimizeSlideWithLocalAI(slide.title, slide.text, model);
    hideLoadingHUD();
    if (res && res.text) {
      slide.text = res.text;
      renderSlideMatrix(item);
      stageSlide(targetIdx);
      showOfflineToast("✨ Slide Otimizado!", `Texto diagramado e resumido com sucesso via ${model}.`);
    } else {
      showOfflineToast("Aviso IA Local", "O modelo não retornou novo texto para este slide.");
    }
  } catch (err: any) {
    hideLoadingHUD();
    showOfflineToast("Erro na IA Local", err.message || String(err));
  }
}

document.getElementById("btn-ai-optimize")?.addEventListener("click", () => {
  handleLocalAiOptimization();
});

document.getElementById("btn-launch-impress")?.addEventListener("click", () => {
  launchActivePresentationInLibreOffice();
});

document.getElementById("mi-launch-impress")?.addEventListener("click", () => {
  closeAllMenus();
  launchActivePresentationInLibreOffice();
});

// Layout Audit & Auto-Fit Controller
async function runAutoFitOnItem(item: PlaylistItem, targetSlideNum?: number) {
  if (!item.auditReport) return;
  let sourceFile = item.originalFile;

  // Se o arquivo original não estiver em memória, tenta recarregar do cache nativo Tauri
  if (!sourceFile && inTauri() && item.presentationPath) {
    try {
      const bytes = await tauriInvoke<number[]>("get_presentation_bytes", { filePath: item.presentationPath });
      if (bytes && bytes.length > 0) {
        sourceFile = new File([new Uint8Array(bytes)], "apresentacao.pptx", {
          type: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        });
      }
    } catch (e) {
      console.warn("Falha ao carregar bytes da apresentação:", e);
    }
  }

  if (!sourceFile) {
    showOfflineToast("Auto-Fit", "Arquivo original da apresentação não encontrado para reajuste.");
    return;
  }

  const modal = document.getElementById("modal-layout-audit");
  if (modal) modal.style.display = "none";

  const label = targetSlideNum !== undefined ? `Slide ${targetSlideNum}` : "Todos os slides";
  showLoadingHUD("Auto-Ajustando Slides...", `Recalculando geometria e enquadramento de fontes (${label})...`);
  updateLoadingHUD(20, "Aplicando Auto-Fit...", "Ajustando limites normativos e caixas de texto...");

  try {
    // 1. Sanitiza PPTX em memória
    const sanitizedFile = await sanitizePptxWithAutoFit(sourceFile, item.auditReport, targetSlideNum);
    updateLoadingHUD(50, "Renderizando Apresentação...", "Gerando novos slides com alta fidelidade visual...");

    // 2. Converte PPTX para PDF
    const pdfFile = await convertPresentationToPdf(sanitizedFile, (pct, count, sub) => {
      updateLoadingHUD(50 + Math.round(pct * 0.3), count, sub);
    });

    if (!pdfFile) throw new Error("Falha ao renderizar nova apresentação após auto-ajuste.");

    // 3. Converte PDF para slides em alta resolução (1080p / 4K)
    const newSlides = await convertPdfToSlides(pdfFile, (curr, tot, msg) => {
      const pct = 80 + Math.round((curr / tot) * 18);
      updateLoadingHUD(pct, `${curr} / ${tot}`, msg);
    });

    // 4. Salva a versão sanitizada no cache do Tauri para que o LibreOffice use o arquivo perfeito
    let newPath = item.presentationPath;
    if (inTauri()) {
      try {
        const u8 = new Uint8Array(await sanitizedFile.arrayBuffer());
        newPath = await tauriInvoke<string>("cache_presentation_file", {
          filename: sanitizedFile.name,
          data: Array.from(u8)
        });
      } catch (e) {
        console.warn("Falha ao atualizar cache Tauri:", e);
      }
    }

    // 5. Re-audita
    const newAudit = await auditPptxPresentation(sanitizedFile);

    // 6. Atualiza o item na playlist
    item.slides = newSlides;
    item.presentationPath = newPath;
    item.originalFile = sanitizedFile;
    item.auditReport = newAudit;

    newAudit.items.forEach((it, idx) => {
      if (item.slides[idx]) {
        item.slides[idx].auditStatus = it.status;
        item.slides[idx].auditIssue = it.issue;
      }
    });

    hideLoadingHUD();
    renderSlideMatrix(item);

    // Atualiza botão do cabeçalho
    const btnAudit = document.getElementById("btn-audit-report");
    const btnAuditText = document.getElementById("btn-audit-report-text");
    if (btnAudit && btnAuditText) {
      btnAudit.classList.remove("audit-ok", "audit-warn");
      if (newAudit.overflowSlides === 0) {
        btnAudit.classList.add("audit-ok");
        btnAuditText.textContent = "🛡️ Layout OK";
      } else {
        btnAudit.classList.add("audit-warn");
        btnAuditText.textContent = `⚠️ Layout (${newAudit.overflowSlides})`;
      }
    }

    showOfflineToast("✨ Auto-Fit Aplicado!", "Slides recalculados com sucesso! Os textos agora cabem com folga dentro das formas.");
    openLayoutAuditModal(item);
  } catch (err: any) {
    hideLoadingHUD();
    showOfflineToast("Erro no Auto-Fit", err.message || String(err));
  }
}

function openLayoutAuditModal(item: PlaylistItem) {
  const modal = document.getElementById("modal-layout-audit");
  if (!modal || !item.auditReport) return;
  const rep = item.auditReport;

  const subtitle = document.getElementById("audit-subtitle");
  if (subtitle) {
    subtitle.textContent = `${item.title} — ${rep.totalSlides} slides analisados com verificação métrica de caixas de texto.`;
  }

  const banner = document.getElementById("audit-status-banner");
  if (banner) {
    if (rep.overflowSlides === 0) {
      banner.style.background = "rgba(16, 185, 129, 0.12)";
      banner.style.border = "1px solid rgba(16, 185, 129, 0.3)";
      banner.innerHTML = `
        <span style="font-size: 1.4rem;">🎉</span>
        <div>
          <div style="font-weight: 700; color: #34d399; font-size: 0.88rem; margin-bottom: 2px;">Layout 100% Compatível</div>
          <div style="font-size: 0.78rem; color: #94a3b8; line-height: 1.4;">Todas as caixas de texto possuem margens seguras. Nenhum texto ultrapassará as formas delimitadoras.</div>
        </div>
      `;
    } else {
      banner.style.background = "rgba(245, 158, 11, 0.12)";
      banner.style.border = "1px solid rgba(245, 158, 11, 0.35)";
      banner.innerHTML = `
        <span style="font-size: 1.4rem;">⚠️</span>
        <div>
          <div style="font-weight: 700; color: #fbbf24; font-size: 0.88rem; margin-bottom: 2px;">${rep.overflowSlides} Slide(s) com Risco de Transbordo</div>
          <div style="font-size: 0.78rem; color: #94a3b8; line-height: 1.4;">Caixas de texto foram criadas muito rentes à borda no arquivo de apresentação. Clique em <strong>Auto-Ajustar</strong> para que o Altaris recalcule os limites garantindo que o texto nunca ultrapasse as formas.</div>
        </div>
      `;
    }
  }

  const fontsList = document.getElementById("audit-fonts-list");
  if (fontsList) {
    fontsList.innerHTML = "";
    if (rep.fontsDetected.length === 0) {
      fontsList.innerHTML = `<span style="font-size: 0.76rem; color: #64748b;">Nenhuma fonte personalizada detectada.</span>`;
    } else {
      rep.fontsDetected.forEach((f: any) => {
        const isOk = f.available;
        const pill = document.createElement("span");
        pill.className = "slide-badge-pill";
        pill.style.cssText = `padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; background: ${isOk ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)"}; border: 1px solid ${isOk ? "rgba(16,185,129,0.35)" : "rgba(245,158,11,0.35)"}; color: ${isOk ? "#34d399" : "#fbbf24"};`;
        pill.innerHTML = `<strong>${f.name}</strong>: ${isOk ? "🟢 Instalada" : "🟡 Substituta"}`;
        fontsList.appendChild(pill);
      });
    }
  }

  const slidesList = document.getElementById("audit-slides-list");
  if (slidesList) {
    slidesList.innerHTML = "";
    const problemItems = rep.items.filter((it: any) => it.status !== "ok");
    if (problemItems.length === 0) {
      slidesList.innerHTML = `<div style="padding: 12px; text-align: center; color: #34d399; font-size: 0.82rem; font-weight: 600;">✅ Nenhum transbordo de texto detectado! Todos os slides estão perfeitamente contidos.</div>`;
    } else {
      problemItems.forEach((it: any) => {
        const row = document.createElement("div");
        row.style.cssText = "background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px;";
        row.innerHTML = `
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;">
              <span class="slide-badge-pill" style="background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171; font-size: 0.7rem;">Slide ${it.slideNumber}</span>
              <span style="font-size: 0.78rem; font-weight: 600; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${it.shapeText || "Texto da forma"}</span>
            </div>
            <div style="font-size: 0.72rem; color: #94a3b8; line-height: 1.3;">${it.issue || "Risco de transbordo de margem"}</div>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <button class="btn btn-autofit-slide" style="padding: 4px 10px; font-size: 0.72rem; font-weight: 600; background: rgba(99,102,241,0.2); border: 1px solid rgba(99,102,241,0.45); color: #a5b4fc; border-radius: 6px; cursor: pointer; white-space: nowrap;">✨ Ajustar</button>
            <button class="btn btn-view-slide" style="padding: 4px 8px; font-size: 0.72rem; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; border-radius: 6px; cursor: pointer; white-space: nowrap;">Ver</button>
          </div>
        `;
        row.querySelector(".btn-autofit-slide")?.addEventListener("click", () => {
          runAutoFitOnItem(item, it.slideNumber);
        });
        row.querySelector(".btn-view-slide")?.addEventListener("click", () => {
          modal.style.display = "none";
          const targetSlide = item.slides[it.slideIndex];
          if (targetSlide) {
            stageSlide(it.slideIndex);
            syncRemoteState();
          }
        });
        slidesList.appendChild(row);
      });
    }
  }

  modal.style.display = "flex";
}

document.getElementById("btn-autofit-all")?.addEventListener("click", () => {
  const item = playlist[activeItemIndex];
  if (item) runAutoFitOnItem(item);
});

document.getElementById("btn-audit-report")?.addEventListener("click", () => {
  const item = playlist[activeItemIndex];
  if (item) openLayoutAuditModal(item);
});

document.getElementById("btn-close-audit")?.addEventListener("click", () => {
  const modal = document.getElementById("modal-layout-audit");
  if (modal) modal.style.display = "none";
});

document.getElementById("btn-dismiss-audit")?.addEventListener("click", () => {
  const modal = document.getElementById("modal-layout-audit");
  if (modal) modal.style.display = "none";
});

document.getElementById("btn-sync-fonts-modal")?.addEventListener("click", async () => {
  try {
    if (inTauri()) {
      const res = await tauriInvoke<string>("ensure_system_fonts");
      showOfflineToast("🔤 Fontes Sincronizadas", res || "Fontes essenciais garantidas no sistema.");
    } else {
      showOfflineToast("🔤 Fontes", "Fontes do sistema já operacionais no navegador.");
    }
  } catch (e: any) {
    showOfflineToast("Fontes", e.message || String(e));
  }
});

// Sincroniza fontes automaticamente no boot do Altaris
if (inTauri()) {
  tauriInvoke("ensure_system_fonts").catch(() => {});
}
