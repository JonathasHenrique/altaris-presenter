import { loadAppJson } from "../engine/assetLoader";
// Altaris Song & Chord Transposition Engine with Multi-Format Importers
import { Slide, PlaylistItem } from "../engine/state";


export interface OnlineSearchResult {
  id: number | string;
  title: string;
  artist: string;
  plainLyrics: string;
}

export interface SongSlide {
  label: string;
  category: "intro" | "verse" | "chorus" | "bridge" | "ending";
  lyrics: string;
  chords?: string;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  key: string;
  slides: SongSlide[];
}

interface HarpaHymnRaw {
  hino: string;
  coro?: string;
  verses: Record<string, string>;
}

const SCALE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_SCALE = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

export class ChordsTransposer {
  static transposeChord(chord: string, semitones: number): string {
    return chord.replace(/([A-G][#b]?)/g, (match) => {
      let idx = SCALE.indexOf(match);
      if (idx === -1) idx = FLAT_SCALE.indexOf(match);
      if (idx === -1) return match;
      let newIdx = (idx + semitones) % 12;
      if (newIdx < 0) newIdx += 12;
      return SCALE[newIdx];
    });
  }

  static transposeLine(chordLine: string, semitones: number): string {
    if (semitones === 0) return chordLine;
    return chordLine.replace(
      /\b([A-G][#b]?(?:m|maj|min|dim|aug|sus[24]?|[0-9]+)*)(?:\/([A-G][#b]?))?\b/g,
      (_, root, bass) => {
        const transRoot = this.transposeChord(root, semitones);
        const transBass = bass ? "/" + this.transposeChord(bass, semitones) : "";
        return transRoot + transBass;
      }
    );
  }
}

export const INITIAL_SONGS: Song[] = [
  {
    id: "porque-ele-vive",
    title: "Porque Ele Vive",
    artist: "Harpa Cristã",
    key: "G",
    slides: [
      {
        label: "Verso 1",
        category: "verse",
        lyrics: "Deus enviou seu Filho amado\nPara morrer no meu lugar\nNa cruz pagou por meus pecados\nMas o sepulcro vazio está\nPorque Ele vive!",
        chords: "G             C\nDeus enviou seu Filho amado\nG             D\nPara morrer no meu lugar"
      },
      {
        label: "Coro",
        category: "chorus",
        lyrics: "Porque Ele vive, posso crer no amanhã\nPorque Ele vive, temor não há\nMas eu bem sei, eu sei que a minha vida\nEstá nas mãos do meu Jesus, que vivo está!",
        chords: "G             C\nPorque Ele vive, posso crer no amanhã\nG                 D\nPorque Ele vive, temor não há"
      },
      {
        label: "Verso 2",
        category: "verse",
        lyrics: "E quando enfim chegar a hora\nEm que a morte enfrentarei\nSem medo então, terei vitória\nIrei à glória, ao meu Jesus que vivo está!",
        chords: "G             C\nE quando enfim chegar a hora\nG             D\nEm que a morte enfrentarei"
      }
    ]
  },
  {
    id: "vitorioso-es",
    title: "Vitorioso És",
    artist: "Gabriel Guedes",
    key: "D",
    slides: [
      {
        label: "Verso 1",
        category: "verse",
        lyrics: "O Teu amor me resgatou\nTua graça me alcançou\nMesmo sem merecer\nEntregou Sua vida por mim",
        chords: "D             G\nO Teu amor me resgatou\nBm            A\nTua graça me alcançou"
      },
      {
        label: "Coro",
        category: "chorus",
        lyrics: "Vitorioso és! O Rei dos reis!\nVenceu a morte, ressuscitou!\nTu és exaltado, assentado no trono\nPara sempre reinarás!",
        chords: "D        A           Bm\nVitorioso és! O Rei dos reis!\nG\nVenceu a morte, ressuscitou!"
      },
      {
        label: "Ponte",
        category: "bridge",
        lyrics: "A Ele a glória, a Ele o domínio\nA Ele o louvor para sempre, amém!\nA Ele a glória, a Ele o domínio\nA Ele o louvor para sempre, amém!",
        chords: "G       A       Bm      F#m\nA Ele a glória, a Ele o domínio"
      }
    ]
  },
  {
    id: "bondade-de-deus",
    title: "Bondade de Deus",
    artist: "Isaías Saad",
    key: "G",
    slides: [
      {
        label: "Verso 1",
        category: "verse",
        lyrics: "Te amo, Deus, Tua graça nunca falha\nTodos os dias eu estou em Tuas mãos\nDesde quando me levanto até eu me deitar\nEu cantarei da bondade de Deus",
        chords: "G                  C\nTe amo, Deus, Tua graça nunca falha"
      },
      {
        label: "Coro",
        category: "chorus",
        lyrics: "És fiel em todo tempo\nEm todo tempo Tu és tão, tão bom\nCom todo fôlego que tenho\nEu cantarei da bondade de Deus",
        chords: "C                   G\nÉs fiel em todo tempo\nC                   G     D\nEm todo tempo Tu és tão, tão bom"
      },
      {
        label: "Verso 2",
        category: "verse",
        lyrics: "Tua doce voz que me guia em meio ao fogo\nNa escuridão Tua presença me conforta\nSei que és meu Pai e que sou Teu amigo\nEu vivo na bondade de Deus",
        chords: "G                        C\nTua doce voz que me guia em meio ao fogo"
      },
      {
        label: "Ponte",
        category: "bridge",
        lyrics: "Tua bondade me seguirá\nMe seguirá, Senhor\nEu me rendo a Ti, Te dou tudo o que sou\nTua bondade me seguirá!",
        chords: "C      D          G\nTua bondade me seguirá"
      }
    ]
  },
  {
    id: "se-isso-nao-for-amor",
    title: "Se Isso Não For Amor",
    artist: "Luiz de Carvalho",
    key: "C",
    slides: [
      {
        label: "Verso 1",
        category: "verse",
        lyrics: "Deixou o esplendor de Sua glória\nSabendo o destino aqui\nEstava só e ferido no Gólgota\nPara dar Sua vida por mim",
        chords: "C                    F\nDeixou o esplendor de Sua glória"
      },
      {
        label: "Coro",
        category: "chorus",
        lyrics: "Se isso não for amor, o oceano secou\nNão há estrelas no céu, as andorinhas não voam mais\nSe isso não for amor, o céu não é real\nTudo perde o valor, se isso não for amor!",
        chords: "C                     F\nSe isso não for amor, o oceano secou\nG                     C\nNão há estrelas no céu"
      },
      {
        label: "Verso 2",
        category: "verse",
        lyrics: "Mesmo na morte lembrou-se\nDe um ladrão que a seu lado estava\nCom amor e ternura falou-lhe:\nHoje mesmo comigo estarás no paraíso!",
        chords: "C                    F\nMesmo na morte lembrou-se"
      }
    ]
  },
  {
    id: "a-casa-e-sua",
    title: "A Casa É Sua",
    artist: "Casa Worship",
    key: "C",
    slides: [
      {
        label: "Verso 1",
        category: "verse",
        lyrics: "Você é bem-vindo aqui\nA casa é Sua, pode entrar\nMe esvazio de mim\nMe esvazio de mim",
        chords: "Am       F          C\nVocê é bem-vindo aqui"
      },
      {
        label: "Coro",
        category: "chorus",
        lyrics: "Essa casa é Sua casa\nNós deixamos ela pra Você, Jesus\nEssa casa é Sua casa\nNós deixamos ela pra Você, Jesus!",
        chords: "Am       F          C        G\nEssa casa é Sua casa"
      },
      {
        label: "Ponte",
        category: "bridge",
        lyrics: "Apareça, que o Teu nome cresça\nEnche este lugar, enche este lugar\nApareça, que o Teu nome cresça\nVem me incendiar, vem me incendiar!",
        chords: "F                  C\nApareça, que o Teu nome cresça"
      }
    ]
  },
  {
    id: "me-atraiu",
    title: "Me Atraiu",
    artist: "Gabriela Rocha",
    key: "G",
    slides: [
      {
        label: "Verso 1",
        category: "verse",
        lyrics: "Eu poderia estar em qualquer outro lugar\nMas Tua glória me atraiu\nTua presença me atraiu",
        chords: "C                     G\nEu poderia estar em qualquer outro lugar"
      },
      {
        label: "Coro",
        category: "chorus",
        lyrics: "É que a sarça pegou fogo e não se consumiu\nE a voz que saiu dela um dia me atraiu\nE o meu coração queimou até que descobriu\nQue um dia com Tua glória vale mais que mil!",
        chords: "C                     D\nÉ que a sarça pegou fogo e não se consumiu\nEm                    Bm\nE a voz que saiu dela um dia me atraiu"
      }
    ]
  }
];

export class SongEngine {
  private static harpaSongs: Song[] = [];
  private static packSongs: Song[] = [];
  private static customSongs: Song[] = [];
  private static isLoaded = false;

  static async init(): Promise<void> {
    if (this.isLoaded) return;
    this.loadCustomSongs();

    try {
      const rawMap = await loadAppJson<Record<string, HarpaHymnRaw>>("data/songs/harpa_crista_640.json");
      if (rawMap && typeof rawMap === "object") {
        const songs: Song[] = [];

        for (const [key, raw] of Object.entries(rawMap)) {
          const num = parseInt(key, 10);
          const slides: SongSlide[] = [];
          const cleanText = (t: string) => t.replace(/<br\s*\/?>/gi, "\n").trim();

          const coroText = raw.coro ? cleanText(raw.coro) : "";
          const verseKeys = Object.keys(raw.verses || {}).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

          verseKeys.forEach((vKey) => {
            slides.push({
              label: `Verso ${vKey}`,
              category: "verse",
              lyrics: cleanText(raw.verses[vKey])
            });
            if (coroText) {
              slides.push({
                label: "Coro",
                category: "chorus",
                lyrics: coroText
              });
            }
          });

          songs.push({
            id: `harpa-${num}`,
            title: raw.hino,
            artist: "Harpa Cristã",
            key: "G",
            slides
          });
        }

        this.harpaSongs = songs;
        this.isLoaded = true;
        console.log(`[SongEngine] 640 Hinos da Harpa Cristã carregados`);
      }
    } catch (e) {
      console.warn("[SongEngine] Erro ao carregar harpa_crista_640.json:", e);
    }

    try {
      const rawPack = await loadAppJson<{ title: string; artist: string; lyrics: string }[]>("data/songs/coletanea_gospel.json");
      if (rawPack && Array.isArray(rawPack)) {
        this.packSongs = rawPack.map((p, idx) => {
          const s = this.parseLyricsToSong(p.title, p.artist || "Louvor", "C", p.lyrics);
          s.id = `hpack-${idx}`;
          return s;
        });
        console.log(`[SongEngine] ${this.packSongs.length} Louvores do Pacote Offline carregados`);
      }
    } catch (e) {
      console.warn("[SongEngine] Erro ao carregar coletanea_gospel.json:", e);
    }
  }

  static loadCustomSongs(): void {
    try {
      const saved = localStorage.getItem("open_presenter_custom_songs");
      if (saved) {
        const parsed: Song[] = JSON.parse(saved);
        // Filtra músicas corrompidas ou packs gigantes (>80 slides) e re-divide músicas de 1 slide gigante
        this.customSongs = parsed
          .filter((s) => s && Array.isArray(s.slides) && s.slides.length <= 80 && !s.title.toLowerCase().includes("pack músicas"))
          .map((s) => {
            if (s.slides.length === 1 && s.slides[0].lyrics.split("\n").length > 4) {
              const reparsed = this.parseLyricsToSong(s.title, s.artist, s.key || "C", s.slides[0].lyrics);
              reparsed.id = s.id;
              return reparsed;
            }
            return s;
          });
        localStorage.setItem("open_presenter_custom_songs", JSON.stringify(this.customSongs));
      }
    } catch (e) {
      console.warn("[SongEngine] Erro ao carregar customSongs de localStorage:", e);
    }
  }

  static saveCustomSong(song: Song): void {
    const idx = this.customSongs.findIndex(
      (s) => s.id === song.id || (s.title.toLowerCase() === song.title.toLowerCase() && s.artist.toLowerCase() === song.artist.toLowerCase())
    );
    if (idx >= 0) {
      this.customSongs[idx] = song;
    } else {
      this.customSongs.unshift(song);
    }
    localStorage.setItem("open_presenter_custom_songs", JSON.stringify(this.customSongs));
  }

  static deleteCustomSong(id: string): void {
    this.customSongs = this.customSongs.filter((s) => s.id !== id);
    localStorage.setItem("open_presenter_custom_songs", JSON.stringify(this.customSongs));
  }

  static getCustomSongs(): Song[] {
    return [...this.customSongs];
  }

  static setCustomSongs(songs: Song[]): void {
    if (!Array.isArray(songs)) return;
    this.customSongs = songs.filter((s) => s && s.title && Array.isArray(s.slides));
    localStorage.setItem("open_presenter_custom_songs", JSON.stringify(this.customSongs));
  }

  static getOfflineLibraryStats(): { customCount: number; packCount: number; harpaCount: number; totalCount: number } {
    const customCount = this.customSongs.length + INITIAL_SONGS.length;
    const packCount = this.packSongs.length;
    const harpaCount = this.harpaSongs.length;
    return {
      customCount,
      packCount,
      harpaCount,
      totalCount: customCount + packCount + harpaCount
    };
  }

  static getOfflineLibrarySongs(filter: string = "", category: "all" | "custom" | "pack" | "harpa" = "all"): { song: Song; isCustom: boolean; sourceLabel: string }[] {
    const list: { song: Song; isCustom: boolean; sourceLabel: string }[] = [];
    if (category === "all" || category === "custom") {
      this.customSongs.forEach((s) => list.push({ song: s, isCustom: true, sourceLabel: "Baixado / Importado Offline" }));
      INITIAL_SONGS.forEach((s) => list.push({ song: s, isCustom: false, sourceLabel: "Acervo Padrão Offline" }));
    }
    if (category === "all" || category === "pack") {
      this.packSongs.forEach((s) => list.push({ song: s, isCustom: false, sourceLabel: "Pacote de Louvores Offline" }));
    }
    if (category === "harpa") {
      this.harpaSongs.forEach((s) => list.push({ song: s, isCustom: false, sourceLabel: "Harpa Cristã Offline" }));
    }
    const q = filter.trim().toLowerCase();
    if (!q) return list.slice(0, 120);
    return list
      .filter((item) => item.song.title.toLowerCase().includes(q) || item.song.artist.toLowerCase().includes(q))
      .slice(0, 120);
  }

  static getAllSongs(): Song[] {
    return [...INITIAL_SONGS, ...this.customSongs, ...this.packSongs, ...this.harpaSongs];
  }

  static findSongs(query: string): Song[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const all = this.getAllSongs();

    const numMatch = q.match(/^(?:hino\s+)?([0-9]{1,3})$/i);
    if (numMatch) {
      const num = parseInt(numMatch[1], 10);
      return all.filter((s) => s.id === `harpa-${num}` || s.title.startsWith(`${num} -`));
    }

    return all
      .filter((s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q))
      .slice(0, 30);
  }

  static stripRtf(rtf: string): string {
    let clean = rtf.replace(/\{\\(?:fonttbl|colortbl|stylesheet|info|\*)[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/gi, "");
    clean = clean.replace(/\\par[d]?\s*/gi, "\n").replace(/\\line\s*/gi, "\n");
    clean = clean.replace(/\\[a-zA-Z]+-?[0-9]*\s?/g, "");
    clean = clean.replace(/[{}]/g, "");
    return clean.trim();
  }

  static async searchOnlineLyrics(query: string): Promise<OnlineSearchResult[]> {
    const q = query.trim();
    if (!q) return [];

    const combined: OnlineSearchResult[] = [];

    // 0. Resultados instantâneos do banco local + Harpa Cristã (640 hinos)
    const localMatches = this.findSongs(q).slice(0, 6);
    for (const s of localMatches) {
      combined.push({
        id: Math.floor(Math.random() * 1000000),
        title: s.title,
        artist: `${s.artist} (Offline)`,
        plainLyrics: s.slides.map((sl) => sl.lyrics).join("\n\n")
      });
    }

    // 1. Busca direta na API LRCLIB (HTTPS CORS aberto, sem depender da porta local)
    try {
      const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          for (const item of data) {
            const lyrics = (item.plainLyrics || item.plain_lyrics || "").trim();
            if (!lyrics) continue;
            combined.push({
              id: item.id || Math.random(),
              title: item.trackName || item.title || q,
              artist: item.artistName || item.artist || "Ministério de Louvor",
              plainLyrics: lyrics
            });
          }
          if (combined.length > 0) return combined;
        }
      }
    } catch (e) {
      console.warn("LRCLIB direct search:", e);
    }

    // 2. Fallback para proxy HTTP local (testa portas 7878 e 7879)
    for (const port of [(window as any).__OP_PORT__ || 7878, 7879]) {
      try {
        const res = await fetch(`http://localhost:${port}/api/search_lyrics?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            for (const item of data) {
              const lyrics = (item.plainLyrics || item.plain_lyrics || "").trim();
              if (!lyrics) continue;
              combined.push({
                id: item.id || Math.random(),
                title: item.title || item.trackName || q,
                artist: item.artist || item.artistName || "Desconhecido",
                plainLyrics: lyrics
              });
            }
            if (combined.length > 0) return combined;
          }
        }
      } catch {}
    }

    return combined;
  }

  // XML Slide Presentation Parser
  static parseXmlSlidePresentation(xmlText: string, fallbackTitle: string): Song {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");
    const root = doc.documentElement;

    const title =
      root.getAttribute("CCLISongTitle") ||
      root.getAttribute("title") ||
      fallbackTitle.replace(/\.[^/.]+$/, "");
    const artist =
      root.getAttribute("author") ||
      root.getAttribute("CCLIAuthor") ||
      root.getAttribute("artist") ||
      root.getAttribute("CCLIArtistCredits") ||
      "Ministério de Louvor";

    const slides: SongSlide[] = [];
    const displaySlides = doc.querySelectorAll("RVDisplaySlide");

    displaySlides.forEach((s, idx) => {
      const parentGroup = s.closest("RVSlideGrouping");
      const groupLabel = parentGroup?.getAttribute("name") || "";
      const label = s.getAttribute("label") || groupLabel || `Slide ${idx + 1}`;
      const textEls = s.querySelectorAll("RVTextElement");
      let lyrics = "";

      textEls.forEach((textEl) => {
        if (lyrics.trim()) return;
        const rtfB64 = textEl.getAttribute("RTFData");
        if (rtfB64) {
          try {
            const decoded = atob(rtfB64);
            lyrics = this.stripRtf(decoded);
          } catch {
            lyrics = textEl.textContent || "";
          }
        } else {
          // XML string property check
          const nsStrings = textEl.querySelectorAll("NSString");
          nsStrings.forEach((ns) => {
            const ivar = ns.getAttribute("rvXMLIvarName");
            if (ivar === "RTFData" && ns.textContent) {
              try {
                lyrics = this.stripRtf(atob(ns.textContent.trim()));
              } catch {
                /* ignore */
              }
            } else if (ivar === "PlainText" && ns.textContent && !lyrics) {
              try {
                lyrics = atob(ns.textContent.trim());
              } catch {
                lyrics = ns.textContent;
              }
            }
          });
          if (!lyrics) lyrics = textEl.textContent || "";
        }
      });

      if (lyrics.trim()) {
        const lower = label.toLowerCase();
        const category: SongSlide["category"] =
          lower.includes("coro") || lower.includes("chorus") || lower.includes("refr")
            ? "chorus"
            : lower.includes("ponte") || lower.includes("bridge")
            ? "bridge"
            : "verse";

        slides.push({
          label,
          category,
          lyrics: lyrics.trim()
        });
      }
    });

    if (slides.length === 0) {
      throw new Error("Nenhum slide de texto encontrado no arquivo importado.");
    }

    return {
      id: `pro-${Date.now()}`,
      title: title.trim(),
      artist: artist.trim(),
      key: "C",
      slides
    };
  }

  // OpenLyrics & OpenSong XML Parser
  static parseOpenLyricsXml(xmlText: string, fallbackTitle: string): Song {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");

    const titleEl = doc.querySelector("title");
    const title = titleEl?.textContent || fallbackTitle.replace(/\.[^/.]+$/, "");
    const authorEl = doc.querySelector("author");
    const artist = authorEl?.textContent || "Ministério de Louvor";

    const slides: SongSlide[] = [];
    const verses = doc.querySelectorAll("verse");

    if (verses.length > 0) {
      verses.forEach((vNode, idx) => {
        const name = vNode.getAttribute("name") || `v${idx + 1}`;
        const lines = Array.from(vNode.querySelectorAll("lines"))
          .map((l) => l.textContent?.trim() || "")
          .join("\n") || vNode.textContent?.trim() || "";

        let category: SongSlide["category"] = "verse";
        let label = `Verso ${idx + 1}`;

        if (name.toLowerCase().startsWith("c")) {
          category = "chorus";
          label = "Coro";
        } else if (name.toLowerCase().startsWith("b")) {
          category = "bridge";
          label = "Ponte";
        }

        if (lines.trim()) {
          slides.push({
            label,
            category,
            lyrics: lines.trim()
          });
        }
      });
    } else {
      // OpenSong XML (<song><lyrics>[V1]...</lyrics></song>)
      const lyricsEl = doc.querySelector("lyrics");
      if (lyricsEl && lyricsEl.textContent) {
        return this.parseLyricsToSong(title, artist, "C", lyricsEl.textContent);
      }
    }

    if (slides.length === 0) {
      throw new Error("Nenhuma estrofe encontrada no arquivo XML.");
    }

    return {
      id: `xml-song-${Date.now()}`,
      title: title.trim(),
      artist: artist.trim(),
      key: "C",
      slides
    };
  }

  static parseLyricsToSong(title: string, artist: string, key: string, rawText: string): Song {
    const id = `song-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const normalized = rawText.replace(/\r\n/g, "\n");
    const blocks = normalized
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter(Boolean);
    const slides: SongSlide[] = [];

    blocks.forEach((block) => {
      let label = `Verso ${slides.length + 1}`;
      let category: SongSlide["category"] = "verse";

      // Comment line support: lines starting with // are stage/operator notes or section labels
      const rawLines = block.split("\n");
      const cleanLines: string[] = [];
      let commentNote = "";

      for (const ln of rawLines) {
        if (ln.trim().startsWith("//")) {
          const note = ln.trim().slice(2).trim();
          if (note) commentNote = commentNote ? `${commentNote} | ${note}` : note;
        } else if (ln.trim().length > 0) {
          cleanLines.push(ln.trim());
        }
      }

      if (cleanLines.length === 0) return;

      if (commentNote) {
        label = commentNote;
      }

      let fullBlock = cleanLines.join("\n").trim();
      const lower = fullBlock.toLowerCase();
      const lowerLabel = label.toLowerCase();
      if (
        lower.startsWith("coro:") ||
        lower.startsWith("refrão:") ||
        lower.startsWith("refrao:") ||
        lower.startsWith("[coro]") ||
        lowerLabel.includes("coro") ||
        lowerLabel.includes("refr")
      ) {
        if (!commentNote) label = "Coro";
        category = "chorus";
        fullBlock = fullBlock.replace(/^(\[?coro\]?|refrão|refrao):?\s*/i, "");
      } else if (
        lower.startsWith("ponte:") ||
        lower.startsWith("[ponte]") ||
        lowerLabel.includes("ponte") ||
        lowerLabel.includes("bridge")
      ) {
        if (!commentNote) label = "Ponte";
        category = "bridge";
        fullBlock = fullBlock.replace(/^(\[?ponte\]?):?\s*/i, "");
      }

      // Se a estrofe tiver mais de 4 linhas (ex: letra do LRCLIB sem linha em branco), divide em slides de 4 linhas!
      const finalLines = fullBlock.split("\n").filter((l) => l.trim().length > 0);
      if (finalLines.length > 4) {
        for (let i = 0; i < finalLines.length; i += 4) {
          const chunk = finalLines.slice(i, i + 4).join("\n");
          const slideLabel = commentNote ? `${commentNote} (${Math.floor(i / 4) + 1})` : `${category === "chorus" ? "Coro" : "Verso"} ${slides.length + 1}`;
          slides.push({
            label: slideLabel,
            category,
            lyrics: chunk
          });
        }
      } else {
        slides.push({
          label,
          category,
          lyrics: fullBlock
        });
      }
    });

    return { id, title: title.trim() || "Sem Título", artist: artist.trim() || "Igreja", key: key || "C", slides };
  }

  static parseMuflBinaryBuffer(buf: ArrayBuffer): Song[] {
    const bytes = new Uint8Array(buf);
    const decoder = new TextDecoder("utf-8");
    // Locate first "titleToSearch" followed by "xp"
    const headerStr = decoder.decode(bytes.subarray(0, Math.min(bytes.length, 1024)));
    const xpIdx = headerStr.indexOf("titleToSearch");
    if (xpIdx === -1) return [];

    // Find the first "xp" (0x78 0x70) after "titleToSearch"
    let start = xpIdx;
    while (start < bytes.length - 1 && !(bytes[start] === 0x78 && bytes[start + 1] === 0x70)) {
      start++;
    }
    start += 2;

    // Split records by 0x73 0x71 0x00 0x7e 0x00 0x02
    const recordStarts: number[] = [start];
    for (let i = start; i < bytes.length - 6; i++) {
      if (
        bytes[i] === 0x73 &&
        bytes[i + 1] === 0x71 &&
        bytes[i + 2] === 0x00 &&
        bytes[i + 3] === 0x7e &&
        bytes[i + 4] === 0x00 &&
        bytes[i + 5] === 0x02
      ) {
        recordStarts.push(i + 6);
      }
    }

    const songs: Song[] = [];
    for (let r = 0; r < recordStarts.length; r++) {
      const recStart = recordStarts[r];
      const recEnd = r + 1 < recordStarts.length ? recordStarts[r + 1] - 6 : bytes.length;
      let p = recStart + 32; // Skip 4 Java longs (32 bytes)
      const strs: string[] = [];
      while (p < recEnd) {
        const t = bytes[p];
        if (t === 0x74 && p + 3 <= recEnd) {
          const len = (bytes[p + 1] << 8) | bytes[p + 2];
          if (p + 3 + len <= recEnd) {
            strs.push(decoder.decode(bytes.subarray(p + 3, p + 3 + len)));
            p += 3 + len;
            continue;
          }
        } else if (t === 0x71 && p + 5 <= recEnd) {
          strs.push(strs[strs.length - 1] || "");
          p += 5;
          continue;
        } else if (t === 0x70) {
          strs.push("");
          p += 1;
          continue;
        }
        p++;
      }
      if (strs.length >= 9) {
        const artist = (strs[0] || "Louvor").trim();
        const lyrics = (strs[4] || "").trim();
        const title = (strs[strs.length - 2] || "").trim();
        if (title && lyrics) {
          const s = this.parseLyricsToSong(title, artist, "C", lyrics);
          songs.push(s);
          this.saveCustomSong(s);
        }
      }
    }
    return songs;
  }

  // Universal File Importer (JSON, XML, ChordPro, TXT, Slides)
  static importFile(fileName: string, content: string): Song {
    const lowerName = fileName.toLowerCase();

    // 1. JSON music export format (.json / .hly)
    if (content.trim().startsWith("{") || lowerName.endsWith(".json")) {
      try {
        const obj = JSON.parse(content);
        if (obj.title || obj.lyrics || obj.music) {
          const m = obj.music || obj;
          const t = m.title || m.name || fileName.replace(/\.[^/.]+$/, "");
          const a = m.artist || m.author || "Louvor";
          const k = m.key || m.tom || "C";
          if (Array.isArray(m.paragraphs) || Array.isArray(m.slides)) {
            const arr = m.paragraphs || m.slides;
            const textBlocks = arr.map((p: any) => p.text || p.lyrics || String(p)).join("\n\n");
            return this.parseLyricsToSong(t, a, k, textBlocks);
          }
          const rawLyrics = m.lyrics || m.text || "";
          return this.parseLyricsToSong(t, a, k, rawLyrics);
        }
      } catch {
        /* continue to other formats */
      }
    }

    // 2. XML slide presentation format (.pro, .xml)
    if (content.includes("<RVPresentationDocument") || content.includes("<RVDisplaySlide") || lowerName.endsWith(".pro") || lowerName.endsWith(".pro6") || lowerName.endsWith(".pro5") || lowerName.endsWith(".pro4")) {
      return this.parseXmlSlidePresentation(content, fileName);
    }

    // 3. OpenLyrics XML / OpenSong XML
    if (content.includes("<song") || content.includes("<lyrics>") || lowerName.endsWith(".xml")) {
      try {
        return this.parseOpenLyricsXml(content, fileName);
      } catch {
        /* fallback to plain text */
      }
    }

    // 4. ChordPro / CCLI / Plain Text format
    let title = fileName.replace(/\.[^/.]+$/, "");
    let artist = "Importado";
    let key = "C";

    const titleMatch = content.match(/\{title:\s*([^}]+)\}/i) || content.match(/\{t:\s*([^}]+)\}/i);
    if (titleMatch) title = titleMatch[1].trim();

    const artistMatch = content.match(/\{artist:\s*([^}]+)\}/i) || content.match(/\{a:\s*([^}]+)\}/i);
    if (artistMatch) artist = artistMatch[1].trim();

    const keyMatch = content.match(/\{key:\s*([^}]+)\}/i) || content.match(/\{k:\s*([^}]+)\}/i);
    if (keyMatch) key = keyMatch[1].trim();

    const cleanLyrics = content
      .replace(/\{[^}]+\}\n?/gi, "")
      .replace(/\[[A-G][#b]?[^\]]*\]/g, "");

    return this.parseLyricsToSong(title, artist, key, cleanLyrics);
  }
}

export function songToPlaylistItem(song: Song, offset: number = 0): PlaylistItem {
  const slides: Slide[] = song.slides.map((s, idx) => ({
    id: `${song.id}-slide-${idx}`,
    title: s.label,
    header: `${song.title} (${s.label})`,
    text: s.lyrics,
    chords: s.chords ? ChordsTransposer.transposeLine(s.chords, offset) : undefined,
    category: s.category,
    background: {
      type: "shader",
      value: "nebula"
    }
  }));

  return {
    id: song.id,
    title: song.title,
    author: song.artist,
    key: song.key,
    type: "song",
    slides
  };
}
