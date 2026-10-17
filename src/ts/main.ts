// OpenPresenter Master Controller (Operator Center)
// macOS / iOS Design Philosophy • Two-Click Staging Workflow • Visual Bible Navigator • Web Lyrics Search
import { store, PlaylistItem } from "./engine/state";
import { SlideCompositor } from "./engine/compositor";
import { SongEngine, songToPlaylistItem, Song, OnlineSearchResult } from "./modules/songs";
import { BibleEngine, BibleVerse } from "./modules/bibles";
import { getServerInfo, inTauri, tauriInvoke } from "./engine/server";

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
const btnShowQrWifi = document.getElementById("btn-show-qr-wifi")!;
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

const tabPaneBible = document.getElementById("tab-pane-bible")!;
const tabPaneHarpa = document.getElementById("tab-pane-harpa")!;
const tabPaneOnline = document.getElementById("tab-pane-online")!;
const tabPaneCustom = document.getElementById("tab-pane-custom")!;
const tabPaneImport = document.getElementById("tab-pane-import")!;

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

// Initialize Default Playlist
async function initPlaylist() {
  const p1: PlaylistItem = {
    id: "welcome-item",
    title: "Boas-Vindas & Abertura",
    type: "alert",
    slides: [
      {
        id: "s-welc-1",
        title: "Boas-Vindas",
        header: "OpenPresenter",
        text: "Sejam bem-vindos ao culto!\nOnde estiverem dois ou três reunidos em meu nome, ali estou eu.",
        category: "intro",
        background: { type: "shader", value: "nebula" }
      }
    ]
  };

  const allSongs = SongEngine.getAllSongs();
  const p2 = songToPlaylistItem(allSongs[0], keyOffset);
  const p3 = songToPlaylistItem(allSongs[1], keyOffset);

  const verses = BibleEngine.findVerses("jo 3 16");
  const p4: PlaylistItem = {
    id: "bible-reading",
    title: `Leitura Bíblica: João 3:16 (${BibleEngine.getActiveVersion().toUpperCase()})`,
    type: "bible",
    slides: verses.map((v) => BibleEngine.verseToSlide(v))
  };

  playlist = [p1, p2, p3, p4];
  renderPlaylist();
  selectPlaylistItem(1, true); // initial auto-live
}

// Render Playlist in Left Panel
function renderPlaylist() {
  playlistContainer.innerHTML = "";
  playlist.forEach((item, idx) => {
    const el = document.createElement("div");
    el.className = `glass-panel ${idx === activeItemIndex ? "btn-primary" : ""}`;
    el.style.padding = "10px 12px";
    el.style.cursor = "pointer";
    el.style.display = "flex";
    el.style.justifyContent = "space-between";
    el.style.alignItems = "center";
    el.style.transition = "var(--transition)";

    const typeBadge = item.type === "song" ? "🎵 HINO" : item.type === "bible" ? "📖 BÍBLIA" : "📢 AVISO";
    el.innerHTML = `
      <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 170px;">
        <div style="font-weight: 600; font-size: 0.88rem; overflow: hidden; text-overflow: ellipsis;">${item.title}</div>
        <div style="font-size: 0.72rem; opacity: 0.8; margin-top: 2px;">${item.author || typeBadge} ${item.key ? "• Tom: " + item.key : ""}</div>
      </div>
      <span style="font-size: 0.7rem; font-weight: 700; opacity: 0.75; white-space: nowrap;">${item.slides.length} slides</span>
    `;

    el.addEventListener("click", () => {
      // 1-Click selects in operator view (stages it)
      // If 2-click mode is off, activates immediately
      const autoFire = !toggleTwoClick.checked;
      selectPlaylistItem(idx, autoFire);
    });

    el.addEventListener("dblclick", () => {
      // Double click always fires immediately
      selectPlaylistItem(idx, true);
    });

    playlistContainer.appendChild(el);
  });
}

function selectPlaylistItem(index: number, fireImmediately: boolean = false) {
  if (index < 0 || index >= playlist.length) return;
  activeItemIndex = index;
  stagedSlideIndex = 0;
  renderPlaylist();

  const item = playlist[index];
  if (!item) return;

  activeItemTitle.textContent = item.title;
  activeItemBadge.style.display = "inline-block";
  activeItemBadge.textContent = item.type.toUpperCase();

  renderSlideMatrix(item);

  if (fireImmediately) {
    fireSlide(0);
  } else {
    stageSlide(0);
  }
}

function renderSlideMatrix(item: PlaylistItem) {
  gridContainer.innerHTML = "";

  item.slides.forEach((slide, idx) => {
    const card = document.createElement("div");
    const isLive = idx === liveSlideIndex && store.getState().currentSlide?.id === slide.id;
    const isThisStaged = isStaged && idx === stagedSlideIndex;

    card.className = `slide-card ${isLive ? "is-live" : ""} ${isThisStaged ? "is-staged" : ""}`;

    const badgeClass =
      slide.category === "verse"
        ? "slide-badge-verse"
        : slide.category === "chorus"
        ? "slide-badge-chorus"
        : slide.category === "bridge"
        ? "slide-badge-bridge"
        : slide.category === "bible"
        ? "slide-badge-bible"
        : "slide-badge-pill";

    card.innerHTML = `
      <div class="slide-card-header">
        <span class="slide-badge-pill ${badgeClass}">${slide.title}</span>
        <div class="slide-status-tag-area">
          ${isLive ? '<span class="status-tag-live">🔴 NO AR</span>' : isThisStaged ? '<span class="status-tag-staged">🟡 PRÉVIA</span>' : ''}
        </div>
      </div>
      <div class="slide-text-preview">${slide.text.replace(/\n/g, "<br>")}</div>
      ${slide.chords ? `<div class="slide-chords-preview">${slide.chords.split("\n")[0] || ""}</div>` : ""}
    `;

    // 1-Click: Stage (Preview) or Direct Fire depending on mode
    card.addEventListener("click", () => {
      if (toggleTwoClick.checked) {
        if (isStaged && stagedSlideIndex === idx) {
          // Second click on the staged slide fires it!
          fireSlide(idx);
        } else {
          stageSlide(idx);
        }
      } else {
        fireSlide(idx);
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
    nextSlide: next
  });

  updateSlideCardClasses();
}

function updateSlideCardClasses() {
  const cards = gridContainer.querySelectorAll(".slide-card");
  const currentLive = store.getState().currentSlide;
  const item = playlist[activeItemIndex];

  cards.forEach((c, idx) => {
    const isLive = item?.slides[idx]?.id === currentLive?.id;
    const isThisStaged = isStaged && idx === stagedSlideIndex;

    if (isLive) c.classList.add("is-live");
    else c.classList.remove("is-live");

    if (isThisStaged && !isLive) c.classList.add("is-staged");
    else c.classList.remove("is-staged");

    const tagArea = c.querySelector(".slide-status-tag-area");
    if (tagArea) {
      if (isLive) tagArea.innerHTML = '<span class="status-tag-live">🔴 NO AR</span>';
      else if (isThisStaged && !isLive) tagArea.innerHTML = '<span class="status-tag-staged">🟡 PRÉVIA</span>';
      else tagArea.innerHTML = '';
    }
  });

  const stagingBanner = document.getElementById("staging-banner");
  const stagedSlideName = document.getElementById("staged-slide-name");
  if (stagingBanner && stagedSlideName) {
    if (isStaged && item && item.slides[stagedSlideIndex]) {
      stagingBanner.style.display = "flex";
      stagedSlideName.textContent = item.slides[stagedSlideIndex].title;
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
  const targetIdx = isStaged ? stagedSlideIndex + 1 : liveSlideIndex + 1;
  if (targetIdx < item.slides.length) {
    if (toggleTwoClick.checked) stageSlide(targetIdx);
    else fireSlide(targetIdx);
  } else if (activeItemIndex + 1 < playlist.length) {
    selectPlaylistItem(activeItemIndex + 1, !toggleTwoClick.checked);
  }
}

function prevSlide() {
  const targetIdx = isStaged ? stagedSlideIndex - 1 : liveSlideIndex - 1;
  if (targetIdx >= 0) {
    if (toggleTwoClick.checked) stageSlide(targetIdx);
    else fireSlide(targetIdx);
  } else if (activeItemIndex > 0) {
    selectPlaylistItem(activeItemIndex - 1, !toggleTwoClick.checked);
    const item = playlist[activeItemIndex];
    if (item) {
      if (toggleTwoClick.checked) stageSlide(item.slides.length - 1);
      else fireSlide(item.slides.length - 1);
    }
  }
}

// Global Quick Search (Holyrics style)
quickSearchInput.addEventListener("input", () => {
  const query = quickSearchInput.value.trim();
  if (query.length < 2) {
    searchResultsList.style.display = "none";
    return;
  }

  const verses = BibleEngine.findVerses(query);
  const songs = SongEngine.findSongs(query);

  searchResultsList.innerHTML = "";
  if (verses.length === 0 && songs.length === 0) {
    searchResultsList.innerHTML = `<div style="padding: 8px; font-size: 0.75rem; color: #94a3b8;">Nenhum resultado local. Use o botão <b>🌐 Web</b> acima para buscar online.</div>`;
    searchResultsList.style.display = "block";
    return;
  }

  // Display found verses
  verses.slice(0, 15).forEach((v) => {
    const item = document.createElement("div");
    item.style.padding = "6px 10px";
    item.style.borderBottom = "1px solid var(--border-subtle)";
    item.style.cursor = "pointer";
    item.style.fontSize = "0.8rem";
    item.innerHTML = `<span style="color: #10b981; font-weight: 700;">📖 ${v.book} ${v.chapter}:${v.verse} (${v.version})</span>: <span style="opacity: 0.8;">${v.text.slice(0, 50)}...</span>`;
    item.addEventListener("click", () => {
      const slide = BibleEngine.verseToSlide(v);
      const playlistItem: PlaylistItem = {
        id: `quick-bible-${Date.now()}`,
        title: `${v.book} ${v.chapter}:${v.verse} (${v.version})`,
        type: "bible",
        slides: [slide]
      };
      playlist.splice(activeItemIndex + 1, 0, playlistItem);
      renderPlaylist();
      selectPlaylistItem(activeItemIndex + 1, !toggleTwoClick.checked);
      quickSearchInput.value = "";
      searchResultsList.style.display = "none";
    });
    searchResultsList.appendChild(item);
  });

  // Display found songs
  songs.slice(0, 15).forEach((s) => {
    const item = document.createElement("div");
    item.style.padding = "6px 10px";
    item.style.borderBottom = "1px solid var(--border-subtle)";
    item.style.cursor = "pointer";
    item.style.fontSize = "0.8rem";
    item.innerHTML = `<span style="color: #6366f1; font-weight: 700;">🎵 ${s.title}</span> - <span style="opacity: 0.8;">${s.artist}</span>`;
    item.addEventListener("click", () => {
      const playlistItem = songToPlaylistItem(s, keyOffset);
      playlist.splice(activeItemIndex + 1, 0, playlistItem);
      renderPlaylist();
      selectPlaylistItem(activeItemIndex + 1, !toggleTwoClick.checked);
      quickSearchInput.value = "";
      searchResultsList.style.display = "none";
    });
    searchResultsList.appendChild(item);
  });

  searchResultsList.style.display = "block";
});

// macOS Bible Pill & Popover Logic
btnBiblePill.addEventListener("click", (e) => {
  e.stopPropagation();
  const isHidden = popoverBibleVersions.style.display === "none";
  popoverBibleVersions.style.display = isHidden ? "block" : "none";
  if (isHidden) renderBiblePopoverList();
});

document.addEventListener("click", (e) => {
  if (!popoverBibleVersions.contains(e.target as Node) && e.target !== btnBiblePill) {
    popoverBibleVersions.style.display = "none";
  }
});

function renderBiblePopoverList() {
  const versions = BibleEngine.getAvailableVersions();
  const active = BibleEngine.getActiveVersion();

  popoverBibleList.innerHTML = "";
  versions.forEach((v) => {
    const row = document.createElement("div");
    const isActive = v.id === active;
    row.className = `popover-item ${isActive ? "active" : ""}`;
    row.innerHTML = `
      <span>${v.name}</span>
      ${isActive ? `<span style="color: #6366f1; font-weight: 800;">✓</span>` : ""}
    `;
    row.addEventListener("click", async () => {
      await BibleEngine.setVersion(v.id);
      labelActiveBible.textContent = v.id.toUpperCase();
      navActiveVersionBadge.textContent = v.id.toUpperCase();
      popoverBibleVersions.style.display = "none";
      renderBiblePopoverList();
      populateBibleBooks(true);
      updateBiblePreviewFromDropdowns();
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
  const item = BibleEngine.versesToPlaylistItem(navSelectedVerses);
  playlist.splice(activeItemIndex + 1, 0, item);
  renderPlaylist();
  selectPlaylistItem(activeItemIndex + 1, false); // Stage
  modalBibleNavigator.style.display = "none";
});

btnNavProjectNow.addEventListener("click", () => {
  if (navSelectedVerses.length === 0) {
    alert("Selecione pelo menos um versículo para projetar.");
    return;
  }
  const item = BibleEngine.versesToPlaylistItem(navSelectedVerses);
  playlist.splice(activeItemIndex + 1, 0, item);
  renderPlaylist();
  selectPlaylistItem(activeItemIndex + 1, true); // Fire now
  modalBibleNavigator.style.display = "none";
});

// Web Lyrics Search Logic
btnOpenWebSearch.addEventListener("click", () => {
  modalAddItem.style.display = "flex";
  switchTab(tabBtnOnline, tabPaneOnline);
});

btnDoOnlineSearch.addEventListener("click", executeOnlineSearch);
inputOnlineSearch.addEventListener("keydown", (e) => {
  if (e.key === "Enter") executeOnlineSearch();
});

async function executeOnlineSearch() {
  const q = inputOnlineSearch.value.trim();
  if (!q) return;

  onlineResultsList.innerHTML = `<div style="padding: 16px; text-align: center; color: #818cf8;">🔍 Buscando na web...</div>`;
  const results = await SongEngine.searchOnlineLyrics(q);

  if (results.length === 0) {
    onlineResultsList.innerHTML = `<div style="padding: 16px; text-align: center; color: #ef4444;">Nenhuma letra encontrada online para "${q}". Tente outro termo ou adicione manualmente na aba "Nova Letra".</div>`;
    return;
  }

  onlineResultsList.innerHTML = "";
  results.forEach((r) => {
    const row = document.createElement("div");
    row.style.padding = "8px 10px";
    row.style.borderBottom = "1px solid var(--border-subtle)";
    row.style.cursor = "pointer";
    row.style.fontSize = "0.8rem";
    row.innerHTML = `<div style="font-weight: 700; color: #f8fafc;">${r.title}</div><div style="font-size: 0.72rem; color: #94a3b8;">${r.artist}</div>`;

    row.addEventListener("click", () => {
      selectedOnlineResult = r;
      Array.from(onlineResultsList.children).forEach((c) => ((c as HTMLElement).style.background = ""));
      row.style.background = "rgba(99, 102, 241, 0.25)";

      const formatted = SongEngine.parseLyricsToSong(r.title, r.artist, "C", r.plainLyrics);
      onlineLyricsPreview.innerHTML = `
        <div style="font-weight: 700; color: #818cf8; margin-bottom: 6px;">${r.title} - ${r.artist}</div>
        ${formatted.slides.map((s) => `<div style="margin-bottom: 6px;"><b>${s.label}:</b><br>${s.lyrics.replace(/\n/g, "<br>")}</div>`).join("")}
      `;
    });

    onlineResultsList.appendChild(row);
  });
}

btnAddOnlineToPlaylist.addEventListener("click", () => {
  if (!selectedOnlineResult) {
    alert("Selecione uma música da lista para adicionar.");
    return;
  }
  const song = SongEngine.parseLyricsToSong(
    selectedOnlineResult.title,
    selectedOnlineResult.artist,
    "C",
    selectedOnlineResult.plainLyrics
  );
  SongEngine.saveCustomSong(song);

  const item = songToPlaylistItem(song, keyOffset);
  playlist.splice(activeItemIndex + 1, 0, item);
  renderPlaylist();
  selectPlaylistItem(activeItemIndex + 1, !toggleTwoClick.checked);
  modalAddItem.style.display = "none";
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
  store.setState({ obsTheme: target.value as any });
});

inputChurchLogo?.addEventListener("change", () => {
  if (inputChurchLogo.files && inputChurchLogo.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      store.setState({ churchLogo: base64 });
    };
    reader.readAsDataURL(inputChurchLogo.files[0]);
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
    qrImage.innerHTML = info.qr_svg;
    qrUrlText.innerHTML = `${info.ip}:${info.port}<br>PIN: <b>${info.pin}</b>`;
  }
  modalQr.style.display = "flex";
}

btnShowQrWifi?.addEventListener("click", showQrModal);
btnCloseQr?.addEventListener("click", () => {
  modalQr.style.display = "none";
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
  if (!info) {
    window.open("/stream.html", "StreamWindow", "width=1280,height=720,menubar=no,toolbar=no");
    return;
  }
  await navigator.clipboard.writeText(info.obs_url);
  const original = btnStream.innerHTML;
  btnStream.textContent = "Link copiado! Cole no OBS";
  setTimeout(() => (btnStream.innerHTML = original), 2500);
});

document.getElementById("btn-open-remote")?.addEventListener("click", () => void showQrModal());

// Modal Adicionar Item (+ Item)
function switchTab(activeBtn: HTMLElement, activePane: HTMLElement) {
  [tabBtnBible, tabBtnHarpa, tabBtnOnline, tabBtnCustom, tabBtnImport].forEach((b) => b?.classList.remove("active-tab-btn"));
  [tabPaneBible, tabPaneHarpa, tabPaneOnline, tabPaneCustom, tabPaneImport].forEach((p) => {
    if (p) p.style.display = "none";
  });
  activeBtn.classList.add("active-tab-btn");
  activePane.style.display = "block";
}

tabBtnBible.addEventListener("click", () => switchTab(tabBtnBible, tabPaneBible));
tabBtnHarpa.addEventListener("click", () => {
  switchTab(tabBtnHarpa, tabPaneHarpa);
  renderHarpaList(inputHarpaSearch.value);
});
tabBtnOnline.addEventListener("click", () => switchTab(tabBtnOnline, tabPaneOnline));
tabBtnCustom.addEventListener("click", () => switchTab(tabBtnCustom, tabPaneCustom));
tabBtnImport.addEventListener("click", () => switchTab(tabBtnImport, tabPaneImport));

btnAddItem.addEventListener("click", () => {
  modalAddItem.style.display = "flex";
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
    const item = BibleEngine.versesToPlaylistItem(currentBibleVersesPreview);
    playlist.splice(activeItemIndex + 1, 0, item);
    renderPlaylist();
    selectPlaylistItem(activeItemIndex + 1, !toggleTwoClick.checked);
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
  selectPlaylistItem(activeItemIndex + 1, !toggleTwoClick.checked);
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
  selectPlaylistItem(activeItemIndex + 1, !toggleTwoClick.checked);

  inputCustomTitle.value = "";
  inputCustomArtist.value = "";
  textareaCustomLyrics.value = "";
  modalAddItem.style.display = "none";
});

// Tab 4: Universal File Import Logic (ProPresenter, OpenLP, Holyrics, ChordPro, XML Bibles)
inputFileImport?.addEventListener("change", async () => {
  if (!inputFileImport.files || inputFileImport.files.length === 0) return;
  const file = inputFileImport.files[0];
  const name = file.name;
  importStatusBox.style.display = "block";
  importStatusBox.innerHTML = `Analisando e importando: <b>${name}</b>...`;

  try {
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
      setTimeout(() => {
        modalAddItem.style.display = "none";
        importStatusBox.style.display = "none";
      }, 2200);
      return;
    }

    // Otherwise, parse as Song / Presentation (ProPresenter, OpenLP, ChordPro, TXT)
    const song = SongEngine.importFile(name, text);
    SongEngine.saveCustomSong(song);

    const item = songToPlaylistItem(song, keyOffset);
    playlist.splice(activeItemIndex + 1, 0, item);
    renderPlaylist();
    selectPlaylistItem(activeItemIndex + 1, !toggleTwoClick.checked);

    importStatusBox.innerHTML = `<span style="color: #10b981; font-weight: 700;">✓ Importado com Sucesso!</span> "${song.title}" (${song.artist}) com <b>${song.slides.length} slides</b> adicionada ao culto.`;
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

  if (e.code === "Space" || e.code === "ArrowRight") {
    e.preventDefault();
    nextSlide();
  } else if (e.code === "Backspace" || e.code === "ArrowLeft") {
    e.preventDefault();
    prevSlide();
  } else if (e.code === "Enter") {
    e.preventDefault();
    if (isStaged) fireSlide(stagedSlideIndex);
  } else if (e.code === "F1") {
    e.preventDefault();
    btnBlackout.click();
  } else if (e.code === "F2") {
    e.preventDefault();
    btnClearText.click();
  }
});

store.onCommand((cmd) => {
  if (cmd === "next") nextSlide();
  else if (cmd === "prev") prevSlide();
});

store.subscribe((state) => {
  audiencePreview.setSlide(state.currentSlide);
  audiencePreview.setOptions({
    isBlackout: state.isBlackout || !state.isLive,
    isClearText: state.isClearText,
    alertText: state.alertMessage
  });

  streamPreview.setSlide(state.currentSlide);
  streamPreview.setOptions({
    isBlackout: state.isBlackout || !state.isLive,
    isClearText: state.isClearText,
    alertText: state.alertMessage
  });
});

// Start Engines & App
async function bootstrap() {
  await Promise.all([BibleEngine.init(), SongEngine.init()]);
  labelActiveBible.textContent = BibleEngine.getActiveVersion().toUpperCase();
  initPlaylist();
  console.log("OpenPresenter Control Center initialized with macOS Pill, Staging & Online Search!");
}

bootstrap();


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
