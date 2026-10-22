// Altaris PPTX Native Presentation Viewer & Layout Engine
// Extrai apresentações instantaneamente (< 0.5s), mantendo textos dinâmicos e editáveis,
// com suporte a Auto-Fit do Altaris, visualização vetorial proporcional e Otimização opcional via IA Local (Ollama).
import type { Slide, SlideLayout, SlideElement, SlideElementParagraph } from "../engine/state";

interface ExtractedMedia {
  [rId: string]: string; // Data URL (base64)
}

function getLocalName(el: Element): string {
  return (el.localName || el.tagName.split(":").pop() || "").toLowerCase();
}

function findFirstDescendant(parent: Element, name: string): Element | null {
  const target = name.toLowerCase();
  const all = parent.getElementsByTagName("*");
  for (let i = 0; i < all.length; i++) {
    if (getLocalName(all[i]) === target) return all[i];
  }
  return null;
}

function findAllDescendants(parent: Element, name: string): Element[] {
  const target = name.toLowerCase();
  const all = parent.getElementsByTagName("*");
  const res: Element[] = [];
  for (let i = 0; i < all.length; i++) {
    if (getLocalName(all[i]) === target) res.push(all[i]);
  }
  return res;
}

function parseColor(node: Element | null): string | undefined {
  if (!node) return undefined;
  const srgb = findFirstDescendant(node, "srgbClr");
  if (srgb) {
    const val = srgb.getAttribute("val");
    if (val) return `#${val}`;
  }
  return undefined;
}

function isFooterNoise(t: string): boolean {
  const low = t.toLowerCase().trim();
  return (
    low.includes("www.") ||
    low.includes(".com") ||
    low.includes("nome do professor") ||
    low.includes("clique para adicionar") ||
    low.includes("todos os direitos reservados")
  );
}

function cleanText(t: string): string {
  return t.replace(/[\t\r]+/g, " ").replace(/ +/g, " ").trim();
}

/**
 * Lê um arquivo .pptx e reconstrói apresentações com layout vetorial proporcional e textos editáveis
 * em menos de 1 segundo, sem depender de conversões externas.
 */
export async function parsePptxNative(
  file: File,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<Slide[]> {
  const mod: any = await import("jszip");
  const JSZip = mod.default || mod;
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const baseTitle = file.name.replace(/\.[^/.]+$/, "");
  const slides: Slide[] = [];
  const parser = new DOMParser();

  // 1. Dimensões da apresentação em EMU (padrão 16:9 -> 12192000 x 6858000)
  let slideWidthEmu = 12192000;
  let slideHeightEmu = 6858000;

  try {
    const presXml = await zip.file("ppt/presentation.xml")?.async("text");
    if (presXml) {
      const presDoc = parser.parseFromString(presXml, "application/xml");
      const sldSz = findFirstDescendant(presDoc.documentElement, "sldsz");
      if (sldSz) {
        const cx = parseInt(sldSz.getAttribute("cx") || "0", 10);
        const cy = parseInt(sldSz.getAttribute("cy") || "0", 10);
        if (cx > 0 && cy > 0) {
          slideWidthEmu = cx;
          slideHeightEmu = cy;
        }
      }
    }
  } catch (e) {
    console.warn("Aviso ao ler dimensões de ppt/presentation.xml:", e);
  }

  // 2. Encontra todos os slides ordenados numericamente
  const slideEntries: { index: number; path: string; relsPath: string }[] = [];
  zip.forEach((relPath: string) => {
    const match = relPath.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
    if (match) {
      const idx = parseInt(match[1], 10);
      slideEntries.push({
        index: idx,
        path: relPath,
        relsPath: `ppt/slides/_rels/slide${idx}.xml.rels`
      });
    }
  });

  slideEntries.sort((a, b) => a.index - b.index);
  const total = slideEntries.length;
  if (total === 0) return [];

  // 3. Itera por cada slide
  for (let sIdx = 0; sIdx < total; sIdx++) {
    const entry = slideEntries[sIdx];
    if (onProgress) {
      onProgress(sIdx + 1, total, `Processando slide ${sIdx + 1} de ${total}...`);
    }

    // A. Mapeia mídias/imagens do slide
    const mediaMap: ExtractedMedia = {};
    const relsFile = zip.file(entry.relsPath);
    if (relsFile) {
      try {
        const relsXml = await relsFile.async("text");
        const relsDoc = parser.parseFromString(relsXml, "application/xml");
        const relationships = relsDoc.getElementsByTagName("Relationship");

        for (let r = 0; r < relationships.length; r++) {
          const rel = relationships[r];
          const rId = rel.getAttribute("Id") || "";
          const target = rel.getAttribute("Target") || "";
          const type = rel.getAttribute("Type") || "";

          if (type.includes("image") || /\.(png|jpe?g|gif|webp|svg)$/i.test(target)) {
            const normalized = target.replace(/^\.\.\//, "ppt/");
            const mediaFile = zip.file(normalized);
            if (mediaFile) {
              const base64 = await mediaFile.async("base64");
              const ext = target.split(".").pop()?.toLowerCase() || "png";
              const mime =
                ext === "jpg" || ext === "jpeg"
                  ? "image/jpeg"
                  : ext === "svg"
                  ? "image/svg+xml"
                  : ext === "webp"
                  ? "image/webp"
                  : "image/png";
              mediaMap[rId] = `data:${mime};base64,${base64}`;
            }
          }
        }
      } catch (e) {
        console.warn(`Erro ao ler relacionamentos de slide ${entry.index}:`, e);
      }
    }

    // B. Analisa o XML do slide
    const slideXml = await zip.file(entry.path)?.async("text");
    if (!slideXml) continue;

    const doc = parser.parseFromString(slideXml, "application/xml");

    // Identifica fundo do slide (<p:bg>)
    let slideBgImage: string | undefined = undefined;
    let slideBgColor: string | undefined = undefined;

    const bgNode = findFirstDescendant(doc.documentElement, "bg");
    if (bgNode) {
      const blip = findFirstDescendant(bgNode, "blip");
      if (blip) {
        const embedId = blip.getAttribute("r:embed") || blip.getAttribute("embed") || "";
        if (embedId && mediaMap[embedId]) {
          slideBgImage = mediaMap[embedId];
        }
      }
      if (!slideBgImage) {
        slideBgColor = parseColor(bgNode);
      }
    }

    // C. Percorre a Árvore de Formas (<p:spTree>) preservando ordem Z
    const elements: SlideElement[] = [];
    const extractedShapesForTitle: { isTitlePlaceholder: boolean; text: string }[] = [];
    let primaryImageUrl: string | undefined = slideBgImage;

    const spTree = findFirstDescendant(doc.documentElement, "sptree");
    const shapeNodes = spTree ? Array.from(spTree.children) : [];

    for (let c = 0; c < shapeNodes.length; c++) {
      const child = shapeNodes[c];
      const tag = getLocalName(child);

      // 1. FORMAS E TEXTOS (<p:sp>)
      if (tag === "sp") {
        const xfrm = findFirstDescendant(child, "xfrm");
        const off = xfrm ? findFirstDescendant(xfrm, "off") : null;
        const ext = xfrm ? findFirstDescendant(xfrm, "ext") : null;

        let x = 0, y = 0, w = 0, h = 0;
        if (off && ext) {
          const offX = parseInt(off.getAttribute("x") || "0", 10);
          const offY = parseInt(off.getAttribute("y") || "0", 10);
          const extW = parseInt(ext.getAttribute("cx") || "0", 10);
          const extH = parseInt(ext.getAttribute("cy") || "0", 10);
          x = Math.max(0, Math.min(100, (offX / slideWidthEmu) * 100));
          y = Math.max(0, Math.min(100, (offY / slideHeightEmu) * 100));
          w = Math.max(0, Math.min(100, (extW / slideWidthEmu) * 100));
          h = Math.max(0, Math.min(100, (extH / slideHeightEmu) * 100));
        }

        // Estilos da forma
        const spPr = findFirstDescendant(child, "sppr");
        let bgColor: string | undefined = undefined;
        let borderColor: string | undefined = undefined;
        let borderRadius: number | undefined = undefined;

        if (spPr) {
          bgColor = parseColor(findFirstDescendant(spPr, "solidfill"));
          const ln = findFirstDescendant(spPr, "ln");
          if (ln) borderColor = parseColor(ln);
          const geom = findFirstDescendant(spPr, "prstgeom");
          if (geom && geom.getAttribute("prst") === "roundRect") {
            borderRadius = 14;
          }
        }

        // Extrai parágrafos de texto
        const txBody = findFirstDescendant(child, "txbody");
        const paragraphs: SlideElementParagraph[] = [];
        const shapeLines: string[] = [];
        let shapeColor: string | undefined = undefined;
        let shapeAlign: "left" | "center" | "right" = "left";
        let shapeFontSize: number | undefined = undefined;
        let shapeBold = false;
        let shapeItalic = false;

        if (txBody) {
          const pNodes = findAllDescendants(txBody, "p");
          for (const pElem of pNodes) {
            const pPr = findFirstDescendant(pElem, "ppr");
            const algnAttr = pPr?.getAttribute("algn") || "l";
            const align: "left" | "center" | "right" =
              algnAttr === "ctr" ? "center" : algnAttr === "r" ? "right" : "left";
            shapeAlign = align;

            const rNodes = findAllDescendants(pElem, "r");
            let lineText = "";
            let pFontSize: number | undefined = undefined;
            let pBold = false;
            let pItalic = false;
            let pColor: string | undefined = undefined;

            if (rNodes.length > 0) {
              for (const rElem of rNodes) {
                const rPr = findFirstDescendant(rElem, "rpr");
                if (rPr) {
                  const sz = parseInt(rPr.getAttribute("sz") || "0", 10);
                  if (sz > 0 && !pFontSize) pFontSize = sz;
                  if (rPr.getAttribute("b") === "1") pBold = true;
                  if (rPr.getAttribute("i") === "1") pItalic = true;
                  const c = parseColor(rPr);
                  if (c && !pColor) pColor = c;
                }
                const tElem = findFirstDescendant(rElem, "t");
                if (tElem && tElem.textContent) {
                  lineText += tElem.textContent;
                }
              }
            } else {
              // Alguns slides têm <a:t> direto no parágrafo
              const tElem = findFirstDescendant(pElem, "t");
              if (tElem && tElem.textContent) lineText = tElem.textContent;
            }

            lineText = cleanText(lineText);
            if (lineText) {
              shapeLines.push(lineText);
              paragraphs.push({
                text: lineText,
                align,
                fontSize: pFontSize,
                bold: pBold,
                italic: pItalic,
                color: pColor
              });
              if (!shapeFontSize && pFontSize) shapeFontSize = pFontSize;
              if (pBold) shapeBold = true;
              if (pItalic) shapeItalic = true;
              if (pColor && !shapeColor) shapeColor = pColor;
            }
          }
        }

        const fullShapeText = shapeLines.join("\n").trim();

        // Identifica se é placeholder de título
        const ph = findFirstDescendant(child, "ph");
        const phType = ph ? ph.getAttribute("type") : null;
        const isTitlePlaceholder = phType === "title" || phType === "ctrTitle";

        if (fullShapeText && !isFooterNoise(fullShapeText)) {
          extractedShapesForTitle.push({ isTitlePlaceholder, text: fullShapeText });
        }

        // Se tem área visual ou texto, adiciona aos elementos
        if (w > 0 && h > 0 && (fullShapeText || bgColor || borderColor)) {
          elements.push({
            id: `elem-${sIdx}-${c}`,
            type: fullShapeText ? "text" : "shape",
            x,
            y,
            w,
            h,
            text: fullShapeText,
            paragraphs: paragraphs.length > 0 ? paragraphs : undefined,
            fontSize: shapeFontSize,
            align: shapeAlign,
            color: shapeColor,
            bold: shapeBold,
            italic: shapeItalic,
            bgColor,
            borderColor,
            borderRadius
          });
        }
      }

      // 2. IMAGENS (<p:pic>)
      else if (tag === "pic") {
        const xfrm = findFirstDescendant(child, "xfrm");
        const off = xfrm ? findFirstDescendant(xfrm, "off") : null;
        const ext = xfrm ? findFirstDescendant(xfrm, "ext") : null;

        let x = 0, y = 0, w = 0, h = 0;
        if (off && ext) {
          const offX = parseInt(off.getAttribute("x") || "0", 10);
          const offY = parseInt(off.getAttribute("y") || "0", 10);
          const extW = parseInt(ext.getAttribute("cx") || "0", 10);
          const extH = parseInt(ext.getAttribute("cy") || "0", 10);
          x = Math.max(0, Math.min(100, (offX / slideWidthEmu) * 100));
          y = Math.max(0, Math.min(100, (offY / slideHeightEmu) * 100));
          w = Math.max(0, Math.min(100, (extW / slideWidthEmu) * 100));
          h = Math.max(0, Math.min(100, (extH / slideHeightEmu) * 100));
        }

        const blip = findFirstDescendant(child, "blip");
        const embedId = blip?.getAttribute("r:embed") || blip?.getAttribute("embed") || "";
        const imageUrl = embedId ? mediaMap[embedId] : undefined;

        if (imageUrl && w > 0 && h > 0) {
          if (!primaryImageUrl) primaryImageUrl = imageUrl;
          elements.push({
            id: `pic-${sIdx}-${c}`,
            type: "image",
            x,
            y,
            w,
            h,
            imageUrl
          });
        }
      }
    }

    // D. Inteligência de Título e Conteúdo para Altaris Search & AI
    let slideTitle = "";
    const bodyParagraphs: string[] = [];

    // 1. Títulos canônicos conhecidos de EBD
    const canonicalPattern =
      /^(TEXTO\s+ÁUREO|VERDADE\s+PRÁTICA|OBJETIVOS(\s+DA\s+LIÇÃO)?|LEITURA\s+BÍBLICA(\s+EM\s+CLASSE)?|INTRODUÇÃO|CONCLUSÃO|LIÇÃO\s+\d+|[IVXLCDM]+\s*[-–—]\s*[^.]+)$/i;

    for (const sh of extractedShapesForTitle) {
      const st = sh.text.trim();
      if (canonicalPattern.test(st)) {
        if (!slideTitle || st.length < slideTitle.length) {
          slideTitle = st;
        }
      }
    }

    // 2. Se não achou canônico, verifica placeholder de título
    if (!slideTitle) {
      for (const sh of extractedShapesForTitle) {
        if (sh.isTitlePlaceholder && sh.text.trim().length <= 60) {
          slideTitle = sh.text.trim();
          break;
        }
      }
    }

    // 3. Separa formas de texto que não são o título
    for (const sh of extractedShapesForTitle) {
      if (sh.text.trim() === slideTitle) continue;
      bodyParagraphs.push(sh.text.trim());
    }

    // 4. Se ainda sem título e temos formas curtas (< 45 chars)
    if (!slideTitle && bodyParagraphs.length > 0) {
      const shortIdx = bodyParagraphs.findIndex(
        (b) => b.length <= 45 && !b.includes("\n") && !b.endsWith(".")
      );
      if (shortIdx !== -1) {
        slideTitle = bodyParagraphs[shortIdx];
        bodyParagraphs.splice(shortIdx, 1);
      }
    }

    if (!slideTitle) {
      slideTitle = `Slide ${entry.index}`;
    }

    const fullBodyText = bodyParagraphs.join("\n\n").trim();

    // Detecção bíblica
    const combined = `${slideTitle} ${fullBodyText}`;
    const isBibleRef =
      /\b([1-3]?\s?[A-Za-zçãéíóú]{2,12})\s+\d+[:.]\d+/i.test(combined) ||
      /\b(Jr|Sl|Mt|Mc|Lc|Jo|Rm|Ef|Fp|Cl|Hb|Ap|Deuteronômio|Salmos?|Mateus|João)\b/i.test(combined);

    const layout: SlideLayout = {
      bgImage: slideBgImage,
      bgColor: slideBgColor,
      elements
    };

    slides.push({
      id: `pptx-native-${Date.now()}-${entry.index}`,
      title: slideTitle,
      header: isBibleRef ? slideTitle : baseTitle,
      text: fullBodyText || slideTitle,
      category: isBibleRef ? "bible" : elements.some((e) => e.type === "image") && !fullBodyText ? "media" : "verse",
      mediaUrl: primaryImageUrl,
      mediaType: primaryImageUrl ? "image" : undefined,
      layout,
      background: primaryImageUrl
        ? { type: "image", value: primaryImageUrl }
        : { type: "gradient", value: "nebula" }
    });
  }

  return slides;
}

/**
 * Verifica se o servidor local do Ollama está rodando e lista modelos disponíveis.
 */
export async function checkOllamaStatus(
  ollamaEndpoint: string = "http://localhost:11434"
): Promise<{ available: boolean; models: string[]; recommendedModel?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1600);
    const res = await fetch(`${ollamaEndpoint}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { available: false, models: [] };
    const data = await res.json();
    const models: string[] = (data.models || []).map((m: any) => m.name || m.model || "");
    const recommended =
      models.find(
        (m) =>
          m.includes("llama3.2") ||
          m.includes("llama3") ||
          m.includes("phi3") ||
          m.includes("gemma2")
      ) || models[0];

    return {
      available: true,
      models,
      recommendedModel: recommended
    };
  } catch {
    return { available: false, models: [] };
  }
}

/**
 * Conector com IA Local (Ollama) para resumir e diagramar lições extensas de EBD
 * em tópicos limpos de 3-4 linhas perfeitamente encaixados para o telão 16:9.
 */
export async function optimizeSlideWithLocalAI(
  title: string,
  rawText: string,
  modelName: string = "llama3.2",
  ollamaEndpoint: string = "http://localhost:11434"
): Promise<{ title: string; text: string } | null> {
  const prompt = `Você é um especialista em projeção de igreja e professor de EBD.
Resuma e formate o conteúdo a seguir para exibição em telão 16:9 de forma clara, bonita e sem textos longos.
Regras:
1. Máximo de 3 a 4 tópicos curtos iniciados com bullet (•).
2. Se houver versículo bíblico, destaque-o no final com emoji de livro (📖).
3. Seja fiel à mensagem teológica sem alterar o sentido.
4. Responda APENAS com o texto formatado final, sem introduções ou explicações.

Título: ${title}
Conteúdo:
${rawText}
`;

  try {
    const res = await fetch(`${ollamaEndpoint}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        prompt,
        stream: false
      })
    });

    if (!res.ok) return null;
    const data = await res.json();
    const responseText = (data.response || "").trim();
    if (!responseText) return null;

    return {
      title,
      text: responseText
    };
  } catch (err) {
    console.warn("IA Local (Ollama) falhou:", err);
    return null;
  }
}
