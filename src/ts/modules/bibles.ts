// Ultra-Fast Scripture Search Engine with Multi-Version & Import Support
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
  "jó": "Jó", "job": "Jó",
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
  "jonas": "Jonas", "jn": "Jonas",
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
  "jo": "João", "joao": "João", "joão": "João", "jh": "João",
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

export const CANONICAL_66_BOOKS: { abbrev: string; name: string }[] = [
  { abbrev: "gn", name: "Gênesis" }, { abbrev: "ex", name: "Êxodo" }, { abbrev: "lv", name: "Levítico" },
  { abbrev: "nm", name: "Números" }, { abbrev: "dt", name: "Deuteronômio" }, { abbrev: "js", name: "Josué" },
  { abbrev: "jz", name: "Juízes" }, { abbrev: "rt", name: "Rute" }, { abbrev: "1sm", name: "1 Samuel" },
  { abbrev: "2sm", name: "2 Samuel" }, { abbrev: "1rs", name: "1 Reis" }, { abbrev: "2rs", name: "2 Reis" },
  { abbrev: "1cr", name: "1 Crônicas" }, { abbrev: "2cr", name: "2 Crônicas" }, { abbrev: "ed", name: "Esdras" },
  { abbrev: "ne", name: "Neemias" }, { abbrev: "et", name: "Ester" }, { abbrev: "jó", name: "Jó" },
  { abbrev: "sl", name: "Salmos" }, { abbrev: "pv", name: "Provérbios" }, { abbrev: "ec", name: "Eclesiastes" },
  { abbrev: "ct", name: "Cânticos" }, { abbrev: "is", name: "Isaías" }, { abbrev: "jr", name: "Jeremias" },
  { abbrev: "lm", name: "Lamentações de Jeremias" }, { abbrev: "ez", name: "Ezequiel" }, { abbrev: "dn", name: "Daniel" },
  { abbrev: "os", name: "Oséias" }, { abbrev: "jl", name: "Joel" }, { abbrev: "am", name: "Amós" },
  { abbrev: "ob", name: "Obadias" }, { abbrev: "jn", name: "Jonas" }, { abbrev: "mq", name: "Miquéias" },
  { abbrev: "na", name: "Naum" }, { abbrev: "hc", name: "Habacuque" }, { abbrev: "sf", name: "Sofonias" },
  { abbrev: "ag", name: "Ageu" }, { abbrev: "zc", name: "Zacarias" }, { abbrev: "ml", name: "Malaquias" },
  { abbrev: "mt", name: "Mateus" }, { abbrev: "mc", name: "Marcos" }, { abbrev: "lc", name: "Lucas" },
  { abbrev: "jo", name: "João" }, { abbrev: "at", name: "Atos" }, { abbrev: "rm", name: "Romanos" },
  { abbrev: "1co", name: "1 Coríntios" }, { abbrev: "2co", name: "2 Coríntios" }, { abbrev: "gl", name: "Gálatas" },
  { abbrev: "ef", name: "Efésios" }, { abbrev: "fp", name: "Filipenses" }, { abbrev: "cl", name: "Colossenses" },
  { abbrev: "1ts", name: "1 Tessalonicenses" }, { abbrev: "2ts", name: "2 Tessalonicenses" }, { abbrev: "1tm", name: "1 Timóteo" },
  { abbrev: "2tm", name: "2 Timóteo" }, { abbrev: "tt", name: "Tito" }, { abbrev: "fm", name: "Filemom" },
  { abbrev: "hb", name: "Hebreus" }, { abbrev: "tg", name: "Tiago" }, { abbrev: "1pe", name: "1 Pedro" },
  { abbrev: "2pe", name: "2 Pedro" }, { abbrev: "1jo", name: "1 João" }, { abbrev: "2jo", name: "2 João" },
  { abbrev: "3jo", name: "3 João" }, { abbrev: "jd", name: "Judas" }, { abbrev: "ap", name: "Apocalipse" }
];

export interface BibleCatalogEntry {
  id: string;
  name: string;
  lang: string;
  license: "public-domain" | "community-external";
  url: string;
  description?: string;
  size?: string;
}

export type CatalogBibleEntry = BibleCatalogEntry;

export const PUBLIC_DOMAIN_CATALOG: BibleCatalogEntry[] = [
  { id: "acf", name: "Almeida Corrigida Fiel (ACF)", lang: "Português", license: "public-domain", url: "/data/bibles/biblia_acf.json", description: "Tradução clássica fidedigna ao Texto Recebido.", size: "4.1 MB" },
  { id: "arc", name: "Almeida Revista e Corrigida (ARC)", lang: "Português", license: "public-domain", url: "/data/bibles/biblia_arc.json", description: "Histórica e amplamente usada nas igrejas brasileiras.", size: "4.3 MB" },
  { id: "tb", name: "Tradução Brasileira 1917 (TB)", lang: "Português", license: "public-domain", url: "/data/bibles/biblia_tb.json", description: "Primeira tradução bíblica direta para o português do Brasil.", size: "3.9 MB" },
  { id: "aa", name: "Almeida Revisada Imprensa Bíblica (AA)", lang: "Português", license: "public-domain", url: "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/pt_aa.json", description: "Texto revisado de fácil compreensão.", size: "4.2 MB" },
  { id: "matos", name: "Bíblia Padre Matos Soares 1956 (MSO)", lang: "Português", license: "public-domain", url: "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/pt_matos.json", description: "Tradução histórica da Vulgata Latina.", size: "4.0 MB" },
  { id: "kjv", name: "King James Version (KJV)", lang: "Inglês", license: "public-domain", url: "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json", description: "A mais influente tradução bíblica em língua inglesa (1611).", size: "4.4 MB" },
  { id: "web", name: "World English Bible (WEB)", lang: "Inglês", license: "public-domain", url: "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_web.json", description: "Tradução moderna em inglês 100% de domínio público.", size: "4.2 MB" },
  { id: "rvr", name: "Reina-Valera 1909 (RVR)", lang: "Espanhol", license: "public-domain", url: "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/es_rvr1960.json", description: "A versão mais respeitada em todo o mundo hispano.", size: "4.3 MB" }
];

export const COMMUNITY_EXTERNAL_CATALOG: BibleCatalogEntry[] = [
  { id: "nvi", name: "Nova Versão Internacional (NVI)", lang: "Português", license: "community-external", url: "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/pt_nvi.json", description: "Linguagem contemporânea e de leitura fluida.", size: "4.0 MB" },
  { id: "naa", name: "Nova Almeida Atualizada (NAA)", lang: "Português", license: "community-external", url: "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/pt_naa.json", description: "Equilíbrio entre fidelidade formal e clareza moderna.", size: "4.1 MB" },
  { id: "nvt", name: "Nova Versão Transformadora (NVT)", lang: "Português", license: "community-external", url: "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/pt_nvt.json", description: "Excelente clareza para leitura e compreensão.", size: "4.2 MB" },
  { id: "ntlh", name: "Nova Tradução na Linguagem de Hoje (NTLH)", lang: "Português", license: "community-external", url: "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/pt_ntlh.json", description: "Vocabulário simples e direto para todas as idades.", size: "3.8 MB" },
  { id: "ara", name: "Almeida Revista e Atualizada (ARA)", lang: "Português", license: "community-external", url: "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/pt_ara.json", description: "Tradução clássica da Sociedade Bíblica do Brasil.", size: "4.2 MB" },
  { id: "kja", name: "King James Atualizada (KJA)", lang: "Português", license: "community-external", url: "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/pt_kja.json", description: "Tradição King James vertida para o português moderno.", size: "4.3 MB" },
  { id: "nbv", name: "Nova Bíblia Viva (NBV)", lang: "Português", license: "community-external", url: "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/pt_nbv.json", description: "Paráfrase expressiva e dinâmica.", size: "3.9 MB" },
  { id: "a21", name: "Almeida Século 21 (A21)", lang: "Português", license: "community-external", url: "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/pt_a21.json", description: "Estilo elegante mantendo a solenidade tradicional.", size: "4.1 MB" }
];

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

  static isVersionInstalled(id: string): boolean {
    return this.availableVersions.some((v) => v.id.toLowerCase() === id.toLowerCase());
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

    // Load built-in or disk-saved static JSON files (/data/bibles/biblia_<id>.json)
    const targetUrl = `/data/bibles/biblia_${versionId.toLowerCase()}.json`;
    try {
      const res = await fetch(targetUrl);
      if (res.ok) {
        const rawText = (await res.text()).replace(/^\uFEFF/, "");
        const data: BibleBookData[] = JSON.parse(rawText);
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
    this.books = data.map((b, idx) => {
      const canon = CANONICAL_66_BOOKS[idx];
      const name = b.name || canon?.name || `Livro ${idx + 1}`;
      const abbrev = b.abbrev || canon?.abbrev || name.slice(0, 3).toLowerCase();
      return { name, abbrev, chapters: b.chapters };
    });
    this.booksByName.clear();
    for (const b of this.books) {
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
      } else {
        // Check OSIS XML format (<div type="book" osisID="Gen"><chapter osisID="Gen.1"><verse osisID="Gen.1.1">...)
        const osisBooks = doc.querySelectorAll("div[type='book']");
        if (osisBooks.length > 0) {
          osisBooks.forEach((bNode) => {
            const osisId = bNode.getAttribute("osisID") || "Livro";
            const bName = BOOK_MAP[osisId.toLowerCase()] || osisId;
            const abbrev = osisId.slice(0, 3).toLowerCase();
            const chapters: string[][] = [];
            bNode.querySelectorAll("chapter").forEach((cNode) => {
              const verses: string[] = [];
              cNode.querySelectorAll("verse").forEach((vNode) => {
                const txt = vNode.textContent?.trim();
                if (txt) verses.push(txt);
              });
              if (verses.length > 0) chapters.push(verses);
            });
            if (chapters.length > 0) books.push({ name: bName, abbrev, chapters });
          });
        }
      }
    }

    if (books.length === 0) {
      throw new Error("Não foi possível reconhecer o formato XML da Bíblia (compatível com Zefania, OpenSong ou OSIS).");
    }

    const cleanId = name.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || `xml-${Date.now()}`;
    const id = this.isVersionInstalled(cleanId) ? `${cleanId}-${Date.now().toString().slice(-3)}` : cleanId;
    const versionInfo: BibleVersionInfo = { id, name: name.trim() || "Bíblia Importada", isCustom: true };

    void this.persistBibleBooks(id, books);
    this.registerCustomVersion(versionInfo);
    this.versionDataCache.set(id, books);
    void this.setVersion(id);

    return versionInfo;
  }

  static importBibleJson(name: string, jsonString: string, forcedId?: string): BibleVersionInfo {
    const cleanJson = jsonString.replace(/^\uFEFF/, "");
    const raw = JSON.parse(cleanJson);
    if (!Array.isArray(raw) || raw.length === 0 || !raw[0].chapters) {
      throw new Error("Formato JSON inválido. Esperado array de 66 livros com atributo 'chapters'.");
    }

    const books: BibleBookData[] = raw.map((b: any, idx: number) => {
      const canon = CANONICAL_66_BOOKS[idx];
      return {
        name: b.name || canon?.name || `Livro ${idx + 1}`,
        abbrev: b.abbrev || canon?.abbrev || (b.name ? b.name.slice(0, 3) : "lv").toLowerCase(),
        chapters: b.chapters
      };
    });

    const cleanId = forcedId || name.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || `json-${Date.now()}`;
    const id = forcedId ? forcedId.toLowerCase() : (this.isVersionInstalled(cleanId) ? `${cleanId}-${Date.now().toString().slice(-3)}` : cleanId);
    const versionInfo: BibleVersionInfo = { id, name: name.trim() || "Bíblia Personalizada", isCustom: true };

    void this.persistBibleBooks(id, books);
    this.registerCustomVersion(versionInfo);
    this.versionDataCache.set(id, books);
    void this.setVersion(id);

    return versionInfo;
  }

  static async downloadCatalogVersion(entryOrId: string | BibleCatalogEntry, name?: string, remoteUrl?: string): Promise<BibleVersionInfo> {
    const id = typeof entryOrId === "object" ? entryOrId.id : entryOrId;
    const vName = typeof entryOrId === "object" ? entryOrId.name : (name || id);
    const url = typeof entryOrId === "object" ? entryOrId.url : (remoteUrl || "");
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Falha ao baixar a versão ${vName} (HTTP ${res.status})`);
    }
    const text = await res.text();
    if (text.trim().startsWith("<")) {
      return this.importBibleXml(vName, text);
    }
    return this.importBibleJson(vName, text, id.toLowerCase());
  }

  static removeCustomVersion(id: string): void {
    if (["acf", "arc", "tb"].includes(id.toLowerCase())) return;
    this.availableVersions = this.availableVersions.filter((v) => v.id !== id);
    this.versionDataCache.delete(id);
    try {
      localStorage.removeItem(`open_presenter_bible_${id}`);
      const customList = this.availableVersions.filter((ver) => ver.isCustom);
      localStorage.setItem("open_presenter_custom_bibles_meta", JSON.stringify(customList));
    } catch {}
    if (this.activeVersionId === id) {
      void this.setVersion("acf");
    }
  }

  private static async persistBibleBooks(id: string, books: BibleBookData[]): Promise<void> {
    const serialized = JSON.stringify(books);
    try {
      await fetch(`/__save_bible?id=${encodeURIComponent(id)}`, {
        method: "POST",
        body: serialized
      });
    } catch {}
    try {
      localStorage.setItem(`open_presenter_bible_${id}`, serialized);
    } catch {
      // Se exceder a cota de 5MB do localStorage, o arquivo já está salvo em /data/bibles/biblia_<id>.json!
    }
  }

  private static registerCustomVersion(v: BibleVersionInfo) {
    const existingIdx = this.availableVersions.findIndex((ex) => ex.id === v.id);
    if (existingIdx >= 0) {
      this.availableVersions[existingIdx] = v;
    } else {
      this.availableVersions.push(v);
    }
    const customList = this.availableVersions.filter((ver) => ver.isCustom);
    try {
      localStorage.setItem("open_presenter_custom_bibles_meta", JSON.stringify(customList));
    } catch {}
  }

  // Bible Favorites & History Support
  static getFavorites(): BibleVerse[] {
    try {
      const raw = localStorage.getItem("open_presenter_bible_favorites");
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
    return [];
  }

  static toggleFavorite(verse: BibleVerse): boolean {
    const favs = this.getFavorites();
    const idx = favs.findIndex(
      (f) => f.book === verse.book && f.chapter === verse.chapter && f.verse === verse.verse
    );
    let added = false;
    if (idx >= 0) {
      favs.splice(idx, 1);
    } else {
      favs.unshift(verse);
      added = true;
    }
    localStorage.setItem("open_presenter_bible_favorites", JSON.stringify(favs.slice(0, 100)));
    return added;
  }

  static setFavorites(favs: BibleVerse[]): void {
    if (Array.isArray(favs)) {
      localStorage.setItem("open_presenter_bible_favorites", JSON.stringify(favs.slice(0, 100)));
    }
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

  static versesToPlaylistItem(verses: BibleVerse[], loadFullChapter: boolean = true): { item: PlaylistItem; startSlideIndex: number } {
    if (verses.length === 0) throw new Error("Sem versículos");
    const first = verses[0];
    const last = verses[verses.length - 1];

    let allSlides: Slide[] = [];
    let startSlideIndex = 0;

    if (loadFullChapter) {
      // Carrega o capítulo inteiro para que a leitura continue sem interrupção!
      const chapterVerses = this.getChapterVerses(first.book, first.chapter);
      if (chapterVerses.length > 0) {
        allSlides = chapterVerses.map((v) => this.verseToSlide(v));
        startSlideIndex = Math.max(0, first.verse - 1);
        if (startSlideIndex >= allSlides.length) startSlideIndex = 0;
      } else {
        allSlides = verses.map((v) => this.verseToSlide(v));
      }
    } else {
      allSlides = verses.map((v) => this.verseToSlide(v));
    }

    const title =
      verses.length === 1
        ? `${first.book} ${first.chapter}:${first.verse} (${first.version})`
        : `${first.book} ${first.chapter}:${first.verse}-${last.verse} (${first.version})`;

    return {
      item: {
        id: `bible-${Date.now()}`,
        title,
        type: "bible",
        slides: allSlides
      },
      startSlideIndex
    };
  }
}
