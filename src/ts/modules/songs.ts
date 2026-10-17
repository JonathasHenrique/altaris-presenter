// OpenPresenter Song & Chord Transposition Engine with ProPresenter, OpenLP & Holyrics Importers
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
  }
];

export class SongEngine {
  private static harpaSongs: Song[] = [];
  private static customSongs: Song[] = [];
  private static isLoaded = false;

  static async init(): Promise<void> {
    if (this.isLoaded) return;
    this.loadCustomSongs();

    try {
      const res = await fetch("/data/songs/harpa_crista_640.json");
      if (res.ok) {
        const rawMap: Record<string, HarpaHymnRaw> = await res.json();
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
  }

  static loadCustomSongs(): void {
    try {
      const saved = localStorage.getItem("open_presenter_custom_songs");
      if (saved) {
        this.customSongs = JSON.parse(saved);
      }
    } catch (e) {
      console.warn("[SongEngine] Erro ao carregar customSongs de localStorage:", e);
    }
  }

  static saveCustomSong(song: Song): void {
    const idx = this.customSongs.findIndex((s) => s.id === song.id);
    if (idx >= 0) {
      this.customSongs[idx] = song;
    } else {
      this.customSongs.unshift(song);
    }
    localStorage.setItem("open_presenter_custom_songs", JSON.stringify(this.customSongs));
  }

  static getAllSongs(): Song[] {
    return [...INITIAL_SONGS, ...this.customSongs, ...this.harpaSongs];
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

    // 1. Tentar comando nativo do Tauri
    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
      try {
        const results = await (window as any).__TAURI_INTERNALS__.invoke("search_online_lyrics", { query: q });
        if (Array.isArray(results) && results.length > 0) {
          return results.map((item: any) => ({
            id: item.id || Math.random(),
            title: item.title || item.trackName || q,
            artist: item.artist || item.artistName || "Desconhecido",
            plainLyrics: item.plainLyrics || item.plain_lyrics || ""
          }));
        }
      } catch (e) {
        console.warn("Tauri search_online_lyrics:", e);
      }
    }

    // 2. Tentar proxy HTTP local (Axum embutido na porta 7878)
    try {
      const port = (window as any).__OP_PORT__ || 7878;
      const res = await fetch(`http://localhost:${port}/api/search_lyrics?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map((item: any) => ({
            id: item.id || Math.random(),
            title: item.title || item.trackName || q,
            artist: item.artist || item.artistName || "Desconhecido",
            plainLyrics: item.plainLyrics || item.plain_lyrics || ""
          }));
        }
      }
    } catch (e) {
      console.warn("Proxy local de letras:", e);
    }

    return [];
  }

  // ProPresenter 4 / 5 / 6 XML Parser
  static parseProPresenterXml(xmlText: string, fallbackTitle: string): Song {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");
    const root = doc.documentElement;

    const title =
      root.getAttribute("CCLISongTitle") ||
      root.getAttribute("title") ||
      fallbackTitle.replace(/\.[^/.]+$/, "");
    const artist =
      root.getAttribute("CCLIAuthor") ||
      root.getAttribute("artist") ||
      root.getAttribute("CCLIArtistCredits") ||
      "ProPresenter";

    const slides: SongSlide[] = [];
    const displaySlides = doc.querySelectorAll("RVDisplaySlide");

    displaySlides.forEach((s, idx) => {
      const label = s.getAttribute("label") || `Slide ${idx + 1}`;
      const textEl = s.querySelector("RVTextElement");
      let lyrics = "";

      const rtfB64 = textEl?.getAttribute("RTFData");
      if (rtfB64) {
        try {
          const decoded = atob(rtfB64);
          lyrics = this.stripRtf(decoded);
        } catch {
          lyrics = textEl?.textContent || "";
        }
      } else if (textEl) {
        lyrics = textEl.textContent || "";
      }

      if (lyrics.trim()) {
        const lower = label.toLowerCase();
        const category: SongSlide["category"] =
          lower.includes("coro") || lower.includes("chorus")
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
      throw new Error("Nenhum slide de texto encontrado no arquivo ProPresenter.");
    }

    return {
      id: `pro-${Date.now()}`,
      title: title.trim(),
      artist: artist.trim(),
      key: "C",
      slides
    };
  }

  // OpenLyrics / OpenLP XML Parser
  static parseOpenLyricsXml(xmlText: string, fallbackTitle: string): Song {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");

    const titleEl = doc.querySelector("title");
    const title = titleEl?.textContent || fallbackTitle.replace(/\.[^/.]+$/, "");
    const authorEl = doc.querySelector("author");
    const artist = authorEl?.textContent || "OpenLP";

    const slides: SongSlide[] = [];
    const verses = doc.querySelectorAll("verse");

    verses.forEach((vNode, idx) => {
      const name = vNode.getAttribute("name") || `v${idx + 1}`;
      const lines = Array.from(vNode.querySelectorAll("lines"))
        .map((l) => l.textContent?.trim() || "")
        .join("\n");

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

    if (slides.length === 0) {
      throw new Error("Nenhuma estrofe encontrada no arquivo OpenLyrics.");
    }

    return {
      id: `openlp-${Date.now()}`,
      title: title.trim(),
      artist: artist.trim(),
      key: "C",
      slides
    };
  }

  static parseLyricsToSong(title: string, artist: string, key: string, rawText: string): Song {
    const id = `song-${Date.now()}`;
    const blocks = rawText
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter(Boolean);
    const slides: SongSlide[] = [];

    blocks.forEach((block, idx) => {
      let label = `Verso ${idx + 1}`;
      let category: SongSlide["category"] = "verse";

      const lower = block.toLowerCase();
      if (lower.startsWith("coro:") || lower.startsWith("refrão:") || lower.startsWith("refrao:")) {
        label = "Coro";
        category = "chorus";
        block = block.replace(/^(coro|refrão|refrao):\s*/i, "");
      } else if (lower.startsWith("ponte:")) {
        label = "Ponte";
        category = "bridge";
        block = block.replace(/^ponte:\s*/i, "");
      }

      slides.push({
        label,
        category,
        lyrics: block
      });
    });

    return { id, title: title.trim() || "Sem Título", artist: artist.trim() || "Igreja", key: key || "C", slides };
  }

  // Universal File Importer
  static importFile(fileName: string, content: string): Song {
    const lowerName = fileName.toLowerCase();

    // 1. ProPresenter XML
    if (content.includes("<RVPresentationDocument") || content.includes("<RVDisplaySlide") || lowerName.endsWith(".pro") || lowerName.endsWith(".pro6") || lowerName.endsWith(".pro5")) {
      return this.parseProPresenterXml(content, fileName);
    }

    // 2. OpenLyrics XML / OpenLP XML
    if (content.includes("<song xmlns=") || content.includes("<lyrics>") || lowerName.endsWith(".xml")) {
      try {
        return this.parseOpenLyricsXml(content, fileName);
      } catch {
        /* fallback to plain text */
      }
    }

    // 3. ChordPro format
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
