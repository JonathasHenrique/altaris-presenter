// Altaris PPTX Native Presentation Extractor & Slide Rebuilder
// Extrai imagens originais (ppt/media/), textos estruturados e formas sem depender de LibreOffice.
import type { Slide } from "../engine/state";

interface ExtractedMedia {
  [rId: string]: string; // Data URL (base64)
}

/**
 * Lê um arquivo .pptx e reconstrói apresentações nativas mantendo imagens de alta resolução,
 * títulos e formatações com Auto-Fit dinâmico do Altaris.
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

  // 1. Encontra todos os slides ordenados
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

  const parser = new DOMParser();

  // 2. Processa cada slide individualmente
  for (let i = 0; i < total; i++) {
    const entry = slideEntries[i];
    onProgress?.(i + 1, total, `Extraindo slide ${i + 1} de ${total} (imagens e textos)...`);

    // A. Mapeia imagens do slide a partir do arquivo .rels
    const mediaMap: ExtractedMedia = {};
    const relsXml = await zip.file(entry.relsPath)?.async("text");
    if (relsXml) {
      try {
        const relsDoc = parser.parseFromString(relsXml, "application/xml");
        const relNodes = relsDoc.getElementsByTagName("Relationship");
        for (let r = 0; r < relNodes.length; r++) {
          const rNode = relNodes[r];
          const rId = rNode.getAttribute("Id") || "";
          const target = rNode.getAttribute("Target") || "";
          const type = rNode.getAttribute("Type") || "";

          // Relacionamento com mídia/imagem
          if (type.includes("image") || /\.(png|jpe?g|webp|gif|svg)$/i.test(target)) {
            // Normaliza caminho relativo (ex: "../media/image1.png" -> "ppt/media/image1.png")
            const normalized = target.startsWith("../")
              ? `ppt/${target.substring(3)}`
              : target.startsWith("ppt/")
                ? target
                : `ppt/slides/${target}`;

            const mediaFile = zip.file(normalized);
            if (mediaFile) {
              const base64 = await mediaFile.async("base64");
              const ext = target.split(".").pop()?.toLowerCase() || "png";
              const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "svg" ? "image/svg+xml" : "image/png";
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

    // Identifica imagem principal do slide (fundo ou ilustração central)
    let primaryImageUrl: string | undefined = undefined;
    const blipNodes = doc.getElementsByTagName("a:blip");
    for (let b = 0; b < blipNodes.length; b++) {
      const embedId = blipNodes[b].getAttribute("r:embed") || blipNodes[b].getAttribute("r:link");
      if (embedId && mediaMap[embedId]) {
        primaryImageUrl = mediaMap[embedId];
        break; // Primeira imagem como destaque/fundo
      }
    }

    // Identifica formas de texto (<p:sp>)
    const shapes = doc.getElementsByTagName("p:sp");
    let slideTitle = "";
    const contentBlocks: string[] = [];

    for (let s = 0; s < shapes.length; s++) {
      const sp = shapes[s];
      // Verifica se é placeholder de título
      const ph = sp.getElementsByTagName("p:ph")[0];
      const phType = ph ? ph.getAttribute("type") : null;
      const isTitleShape = phType === "title" || phType === "ctrTitle";

      const txBody = sp.getElementsByTagName("p:txBody")[0];
      if (!txBody) continue;

      const paragraphs = txBody.getElementsByTagName("a:p");
      const shapeLines: string[] = [];

      for (let p = 0; p < paragraphs.length; p++) {
        const pElem = paragraphs[p];
        const textNodes = pElem.getElementsByTagName("a:t");
        let line = "";
        for (let t = 0; t < textNodes.length; t++) {
          line += textNodes[t].textContent || "";
        }
        line = line.trim();
        if (line) shapeLines.push(line);
      }

      const shapeText = shapeLines.join("\n").trim();
      if (!shapeText) continue;

      if (isTitleShape && !slideTitle) {
        slideTitle = shapeText;
      } else if (!slideTitle && shapeLines.length === 1 && shapeText.length < 50) {
        // Primeiro texto curto se comporta como título
        slideTitle = shapeText;
      } else {
        contentBlocks.push(shapeText);
      }
    }

    if (!slideTitle) {
      slideTitle = `${baseTitle} • Slide ${entry.index}`;
    }

    // Concatena blocos de texto respeitando parágrafos
    const fullBodyText = contentBlocks.join("\n\n").trim();

    // Detecção bíblica simples (ex: Jr 2.13, Sl 78.37, João 3:16)
    const isBibleRef = /\b([1-3]?\s?[A-Za-zçãéíóú]{2,12})\s+\d+[:.]\d+/i.test(fullBodyText) ||
                       /\b(Jr|Sl|Mt|Mc|Lc|Jo|Rm|Ef|Fp|Cl|Hb|Ap)\s+\d+/i.test(fullBodyText);

    // Cria o slide nativo Altaris
    slides.push({
      id: `pptx-native-${Date.now()}-${entry.index}`,
      title: slideTitle,
      header: baseTitle,
      text: fullBodyText,
      category: isBibleRef ? "bible" : (primaryImageUrl ? "media" : "verse"),
      mediaUrl: primaryImageUrl,
      mediaType: primaryImageUrl ? "image" : undefined,
      background: primaryImageUrl
        ? { type: "image", value: primaryImageUrl }
        : { type: "gradient", value: "nebula" }
    });
  }

  return slides;
}

/**
 * Conector opcional com IA Local (Ollama ou LLM local compatível com API OpenAI).
 * Permite resumir tópicos extensos de lições da EBD em slides enxutos para projeção.
 */
export async function optimizeSlideWithLocalAI(
  title: string,
  rawText: string,
  ollamaEndpoint: string = "http://localhost:11434"
): Promise<{ title: string; bullets: string[] } | null> {
  const prompt = `Você é um assistente de projeção de igreja e professor de EBD.
Resuma e formate o seguinte conteúdo para apresentação em telão 16:9 de forma clara, bonita e sem textos longos.
Regras:
1. Máximo de 3 a 4 linhas por slide.
2. Destaque versículos bíblicos se houver.
3. Retorne no formato JSON: {"title": "...", "bullets": ["linha 1", "linha 2"]}

Título atual: ${title}
Conteúdo:
${rawText}
`;

  try {
    const res = await fetch(`${ollamaEndpoint}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2",
        prompt,
        stream: false,
        format: "json"
      })
    });

    if (!res.ok) return null;
    const data = await res.json();
    const parsed = JSON.parse(data.response);
    return {
      title: parsed.title || title,
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets : [rawText]
    };
  } catch (err) {
    console.warn("IA Local (Ollama) não disponível no momento:", err);
    return null;
  }
}
