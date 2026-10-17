// Holyrics-Style Ultra-Fast Scripture Search Engine with Multi-Version & Import Support
import { Slide, PlaylistItem } from "../engine/state";

export interface BibleVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
  version: string;
}

export interface BibleBookData {
  abbrev: string;
  name: string;
  chapters: string[][];
}

export interface BibleVersionInfo {
  id: string;
  name: string;
  isCustom?: boolean;
}

// Fallback initial verses before full JSON finishes loading
const INITIAL_VERSES: BibleVerse[] = [
  { book: "João", chapter: 3, verse: 16, version: "ACF", text: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna." },
  { book: "Salmos", chapter: 23, verse: 1, version: "ACF", text: "O Senhor é o meu pastor, nada me faltará." },
  { book: "Salmos", chapter: 23, verse: 2, version: "ACF", text: "Deitar-me faz em verdes pastos, guia-me mansamente a águas tranqüilas." },
  { book: "Salmos", chapter: 91, verse: 1, version: "ACF", text: "Aquele que habita no esconderijo do Altíssimo, à sombra do Onipotente descansará." },
  { book: "Salmos", chapter: 91, verse: 2, version: "ACF", text: "Direi do Senhor: Ele é o meu Deus, o meu refúgio, a minha fortaleza, e nele confiarei." },
  { book: "Gênesis", chapter: 1, verse: 1, version: "ACF", text: "No princípio criou Deus os céus e a terra." },
  { book: "Filipenses", chapter: 4, verse: 13, version: "ACF", text: "Posso todas as coisas em Cristo que me fortalece." },
  { book: "Romanos", chapter: 8, verse: 28, version: "ACF", text: "E sabemos que todas as coisas conspiram para o bem daqueles que amam a Deus, daqueles que são chamados segundo o seu propósito." },
  { book: "Isaías", chapter: 53, verse: 5, version: "ACF", text: "Mas ele foi ferido por causa das nossas transgressões, e moído por causa das nossas iniqüidades; o castigo que nos traz a paz estava sobre ele, e pelas suas pisaduras fomos sarados." },
  { book: "Apocalipse", chapter: 22, verse: 20, version: "ACF", text: "Aquele que testifica estas coisas diz: Certamente cedo venho. Amém. Ora vem, Senhor Jesus." }
];

// Standard Brazilian abbreviations map
const BOOK_MAP: Record<string, string> = {
  "gn": "Gênesis", "genesis": "Gênesis",
  "ex": "Êxodo", "exodo": "Êxodo",
  "lv": "Levítico", "levitico": "Levítico",
  "nm": "Números", "numeros": "Números",
  "dt": "Deuteronômio", "deuteronomio": "Deuteronômio",
  "js": "Josué", "josue": "Josué",
  "jz": "Juízes", "juizes": "Juízes",
  "rt": "Rute", "rute": "Rute",
  "1sm": "1 Samuel", "1samuel": "1 Samuel", "1s": "1 Samuel",
  "2sm": "2 Samuel", "2samuel": "2 Samuel", "2s": "2 Samuel",
  "1rs": "1 Reis", "1reis": "1 Reis", "1r": "1 Reis",
  "2rs": "2 Reis", "2reis": "2 Reis", "2r": "2 Reis",
  "1cr": "1 Crônicas", "1cronicas": "1 Crônicas",
  "2cr": "2 Crônicas", "2cronicas": "2 Crônicas",
  "ed": "Esdras", "esdras": "Esdras",
  "ne": "Neemias", "neemias": "Neemias",
  "et": "Ester", "ester": "Ester",
  "jo": "Jó", "jó": "Jó",
  "sl": "Salmos", "salmo": "Salmos", "salmos": "Salmos", "ps": "Salmos",
  "pv": "Provérbios", "proverbios": "Provérbios", "pr": "Provérbios",
  "ec": "Eclesiastes", "eclesiastes": "Eclesiastes",
  "ct": "Cânticos", "canticos": "Cânticos", "cantares": "Cânticos",
  "is": "Isaías", "isaias": "Isaías",
  "jr": "Jeremias", "jeremias": "Jeremias",
  "lm": "Lamentações de Jeremias", "lamentacoes": "Lamentações de Jeremias",
  "ez": "Ezequiel", "ezequiel": "Ezequiel",
  "dn": "Daniel", "daniel": "Daniel",
  "os": "Oséias", "oseias": "Oséias",
  "jl": "Joel", "joel": "Joel",
  "am": "Amós", "amos": "Amós",
  "ob": "Obadias", "obadias": "Obadias",
  "jonas": "Jonas",
  "mq": "Miquéias", "miqueias": "Miquéias",
  "na": "Naum", "naum": "Naum",
  "hc": "Habacuque", "habacuque": "Habacuque",
  "sf": "Sofonias", "sofonias": "Sofonias",
  "ag": "Ageu", "ageu": "Ageu",
  "zc": "Zacarias", "zacarias": "Zacarias",
  "ml": "Malaquias", "malaquias": "Malaquias",
  "mt": "Mateus", "mateus": "Mateus",
  "mc": "Marcos", "marcos": "Marcos",
  "lc": "Lucas", "lucas": "Lucas",
  "joao": "João", "joão": "João", "jh": "João",
  "atos": "Atos", "at": "Atos",
  "rm": "Romanos", "romanos": "Romanos", "ro": "Romanos",
  "1co": "1 Coríntios", "1corintios": "1 Coríntios",
  "2co": "2 Coríntios", "2corintios": "2 Coríntios",
  "gl": "Gálatas", "galatas": "Gálatas",
  "ef": "Efésios", "efesios": "Efésios",
  "fp": "Filipenses", "filipenses": "Filipenses",
  "cl": "Colossenses", "colossenses": "Colossenses",
  "1ts": "1 Tessalonicenses", "1tessalonicenses": "1 Tessalonicenses",
  "2ts": "2 Tessalonicenses", "2tessalonicenses": "2 Tessalonicenses",
  "1tm": "1 Timóteo", "1timoteo": "1 Timóteo",
  "2tm": "2 Timóteo", "2timoteo": "2 Timóteo",
  "tt": "Tito", "tito": "Tito",
  "fm": "Filemom", "filemom": "Filemom",
  "hb": "Hebreus", "hebreus": "Hebreus",
  "tg": "Tiago", "tiago": "Tiago",
  "1pe": "1 Pedro", "1pedro": "1 Pedro", "1p": "1 Pedro",
  "2pe": "2 Pedro", "2pedro": "2 Pedro", "2p": "2 Pedro",
  "1jo": "1 João", "1joao": "1 João",
  "2jo": "2 João", "2joao": "2 João",
  "3jo": "3 João", "3joao": "3 João",
  "jd": "Judas", "judas": "Judas",
  "ap": "Apocalipse", "apocalipse": "Apocalipse", "apoc": "Apocalipse"
};

export class BibleEngine {
  private static activeVersionId = "acf";
  private static versionDataCache: Map<string, BibleBookData[]> = new Map();
  private static books: BibleBookData[] = [];
  private static booksByName: Map<string, BibleBookData> = new Map();
  private static isLoaded = false;

  private static availableVersions: BibleVersionInfo[] = [
    { id: "acf", name: "Almeida Corrigida Fiel (ACF)" },
    { id: "arc", name: "Almeida Revista e Corrigida (ARC)" },
    { id: "tb", name: "Tradução Brasileira (TB)" }
  ];

  static async init(): Promise<void> {
    if (this.isLoaded) return;
    this.loadCustomVersionsList();

    const savedVersion = localStorage.getItem("open_presenter_active_bible_version") || "acf";
    await this.setVersion(savedVersion);
    this.isLoaded = true;
  }

  static getAvailableVersions(): BibleVersionInfo[] {
    return this.availableVersions;
  }

  static getActiveVersion(): string {
    return this.activeVersionId;
  }

  private static loadCustomVersionsList() {
    try {
      const saved = localStorage.getItem("open_presenter_custom_bibles_meta");
      if (saved) {
        const list: BibleVersionInfo[] = JSON.parse(saved);
        list.forEach((v) => {
          if (!this.availableVersions.some((ex) => ex.id === v.id)) {
            this.availableVersions.push(v);
          }
        });
      }
    } catch (e) {
      console.warn("Erro ao ler custom bibles meta:", e);
    }
  }

  static async setVersion(versionId: string): Promise<boolean> {
    this.activeVersionId = versionId;
    localStorage.setItem("open_presenter_active_bible_version", versionId);

    // Check cache first
    if (this.versionDataCache.has(versionId)) {
      this.applyBooks(this.versionDataCache.get(versionId)!);
      return true;
    }

    // Check local storage for custom imported bibles
    const customData = localStorage.getItem(`open_presenter_bible_${versionId}`);
    if (customData) {
      try {
        const books: BibleBookData[] = JSON.parse(customData);
        this.versionDataCache.set(versionId, books);
        this.applyBooks(books);
        return true;
      } catch (e) {
        console.warn("Erro ao carregar bíblia customizada:", e);
      }
    }

    // Load built-in static JSON files
    const fileMap: Record<string, string> = {
      acf: "/data/bibles/biblia_acf.json",
      arc: "/data/bibles/biblia_arc.json",
      tb: "/data/bibles/biblia_tb.json"
    };

    const targetUrl = fileMap[versionId] || fileMap.acf;
    try {
      const res = await fetch(targetUrl);
      if (res.ok) {
        const data: BibleBookData[] = await res.json();
        this.versionDataCache.set(versionId, data);
        this.applyBooks(data);
        console.log(`[BibleEngine] Bíblia ${versionId.toUpperCase()} carregada com ${data.length} livros`);
        return true;
      }
    } catch (e) {
      console.warn(`[BibleEngine] Falha ao carregar bíblia ${versionId}:`, e);
    }

    return false;
  }

  private static applyBooks(data: BibleBookData[]) {
    this.books = data;
    this.booksByName.clear();
    for (const b of data) {
      this.booksByName.set(b.name.toLowerCase(), b);
      this.booksByName.set(b.abbrev.toLowerCase(), b);
    }
  }

  static getOldTestamentBooks(): { name: string; abbrev: string; chapterCount: number }[] {
    return this.getBooks().slice(0, 39);
  }

  static getNewTestamentBooks(): { name: string; abbrev: string; chapterCount: number }[] {
    return this.getBooks().slice(39);
  }

  static getChapterVerses(bookName: string, chapter: number): BibleVerse[] {
    return this.findVerses(`${bookName} ${chapter}`);
  }

  static getBooks(): { name: string; abbrev: string; chapterCount: number }[] {
    return this.books.map((b) => ({
      name: b.name,
      abbrev: b.abbrev,
      chapterCount: b.chapters.length
    }));
  }

  static parseQuery(input: string): { book: string; chapter: number; verseStart?: number; verseEnd?: number } | null {
    const cleaned = input.trim().toLowerCase().replace(/[.:]/g, " ");
    const match = cleaned.match(/^([0-9]?[a-zá-ú]+)\s+([0-9]+)(?:\s+([0-9]+)(?:\s*-\s*([0-9]+))?)?$/i);
    if (!match) return null;

    const rawBook = match[1];
    const chapter = parseInt(match[2], 10);
    const verseStart = match[3] ? parseInt(match[3], 10) : undefined;
    const verseEnd = match[4] ? parseInt(match[4], 10) : verseStart;

    const matchedBook = BOOK_MAP[rawBook] || rawBook;
    return { book: matchedBook, chapter, verseStart, verseEnd };
  }

  static findVerses(input: string): BibleVerse[] {
    const parsed = this.parseQuery(input);
    const currentVersionLabel = this.activeVersionId.toUpperCase();

    if (parsed) {
      if (this.books.length > 0) {
        const bookData =
          this.booksByName.get(parsed.book.toLowerCase()) ||
          this.books.find((b) => b.name.toLowerCase().startsWith(parsed.book.toLowerCase()));

        if (bookData) {
          const chapIdx = parsed.chapter - 1;
          if (chapIdx >= 0 && chapIdx < bookData.chapters.length) {
            const chap = bookData.chapters[chapIdx];
            const results: BibleVerse[] = [];

            if (parsed.verseStart !== undefined) {
              const start = Math.max(1, parsed.verseStart);
              const end = Math.min(chap.length, parsed.verseEnd || start);
              for (let v = start; v <= end; v++) {
                if (chap[v - 1]) {
                  results.push({
                    book: bookData.name,
                    chapter: parsed.chapter,
                    verse: v,
                    version: currentVersionLabel,
                    text: chap[v - 1]
                  });
                }
              }
            } else {
              // Return all verses of the chapter
              chap.forEach((t, i) => {
                results.push({
                  book: bookData.name,
                  chapter: parsed.chapter,
                  verse: i + 1,
                  version: currentVersionLabel,
                  text: t
                });
              });
            }
            return results;
          }
        }
      }

      // Fallback
      return INITIAL_VERSES.filter((v) => {
        const bMatch = v.book.toLowerCase().startsWith(parsed.book.toLowerCase());
        const cMatch = v.chapter === parsed.chapter;
        const vMatch = parsed.verseStart ? v.verse === parsed.verseStart : true;
        return bMatch && cMatch && vMatch;
      });
    }

    // Text search
    const query = input.trim().toLowerCase();
    if (query.length < 3) return [];

    if (this.books.length > 0) {
      const results: BibleVerse[] = [];
      for (const b of this.books) {
        for (let c = 0; c < b.chapters.length; c++) {
          const chap = b.chapters[c];
          for (let v = 0; v < chap.length; v++) {
            if (chap[v].toLowerCase().includes(query)) {
              results.push({
                book: b.name,
                chapter: c + 1,
                verse: v + 1,
                version: currentVersionLabel,
                text: chap[v]
              });
              if (results.length >= 25) return results;
            }
          }
        }
      }
      return results;
    }

    return INITIAL_VERSES.filter((v) => v.text.toLowerCase().includes(query));
  }

  // XML / Zefania / OpenSong Importers
  static importBibleXml(name: string, xmlString: string): BibleVersionInfo {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "text/xml");
    const books: BibleBookData[] = [];

    // Check Zefania format (<XMLBIBLE><BIBLEBOOK bname="...">...)
    const zefaniaBooks = doc.querySelectorAll("BIBLEBOOK");
    if (zefaniaBooks.length > 0) {
      zefaniaBooks.forEach((bNode) => {
        const bName = bNode.getAttribute("bname") || bNode.getAttribute("bnumber") || "Livro";
        const abbrev = bName.slice(0, 3).toLowerCase();
        const chapters: string[][] = [];
        bNode.querySelectorAll("CHAPTER").forEach((cNode) => {
          const verses: string[] = [];
          cNode.querySelectorAll("VERS").forEach((vNode) => {
            verses.push(vNode.textContent?.trim() || "");
          });
          chapters.push(verses);
        });
        books.push({ name: bName, abbrev, chapters });
      });
    } else {
      // Check OpenSong format (<bible><b n="...">...)
      const openSongBooks = doc.querySelectorAll("b");
      if (openSongBooks.length > 0) {
        openSongBooks.forEach((bNode) => {
          const bName = bNode.getAttribute("n") || "Livro";
          const abbrev = bName.slice(0, 3).toLowerCase();
          const chapters: string[][] = [];
          bNode.querySelectorAll("c").forEach((cNode) => {
            const verses: string[] = [];
            cNode.querySelectorAll("v").forEach((vNode) => {
              verses.push(vNode.textContent?.trim() || "");
            });
            chapters.push(verses);
          });
          books.push({ name: bName, abbrev, chapters });
        });
      }
    }

    if (books.length === 0) {
      throw new Error("Não foi possível reconhecer o formato XML da Bíblia (compatível com Zefania ou OpenSong).");
    }

    const id = `custom-${Date.now()}`;
    const versionInfo: BibleVersionInfo = { id, name: name.trim() || "Bíblia Importada", isCustom: true };

    localStorage.setItem(`open_presenter_bible_${id}`, JSON.stringify(books));
    this.registerCustomVersion(versionInfo);
    this.versionDataCache.set(id, books);
    this.setVersion(id);

    return versionInfo;
  }

  static importBibleJson(name: string, jsonString: string): BibleVersionInfo {
    const raw = JSON.parse(jsonString);
    if (!Array.isArray(raw) || raw.length === 0 || !raw[0].chapters) {
      throw new Error("Formato JSON inválido. Esperado array de 66 livros com atributo 'chapters'.");
    }

    const books: BibleBookData[] = raw.map((b: any) => ({
      name: b.name || "Livro",
      abbrev: b.abbrev || (b.name ? b.name.slice(0, 3) : "lv").toLowerCase(),
      chapters: b.chapters
    }));

    const id = `custom-${Date.now()}`;
    const versionInfo: BibleVersionInfo = { id, name: name.trim() || "Bíblia Personalizada", isCustom: true };

    localStorage.setItem(`open_presenter_bible_${id}`, JSON.stringify(books));
    this.registerCustomVersion(versionInfo);
    this.versionDataCache.set(id, books);
    this.setVersion(id);

    return versionInfo;
  }

  private static registerCustomVersion(v: BibleVersionInfo) {
    this.availableVersions.push(v);
    const customList = this.availableVersions.filter((ver) => ver.isCustom);
    localStorage.setItem("open_presenter_custom_bibles_meta", JSON.stringify(customList));
  }

  static verseToSlide(v: BibleVerse): Slide {
    return {
      id: `bible-${v.book}-${v.chapter}-${v.verse}`,
      title: `${v.book} ${v.chapter}:${v.verse}`,
      header: `${v.book} ${v.chapter}:${v.verse} (${v.version})`,
      text: v.text,
      category: "bible",
      background: {
        type: "shader",
        value: "nebula"
      }
    };
  }

  static versesToPlaylistItem(verses: BibleVerse[]): PlaylistItem {
    if (verses.length === 0) throw new Error("Sem versículos");
    const first = verses[0];
    const last = verses[verses.length - 1];
    const title =
      verses.length === 1
        ? `${first.book} ${first.chapter}:${first.verse}`
        : `${first.book} ${first.chapter}:${first.verse}-${last.verse}`;

    return {
      id: `bible-${Date.now()}`,
      title: `${title} (${first.version})`,
      type: "bible",
      slides: verses.map((v) => this.verseToSlide(v))
    };
  }
}
