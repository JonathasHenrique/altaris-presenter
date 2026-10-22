// Altaris PPTX Native Presentation Extractor & Slide Rebuilder
// Extrai apresentações instantaneamente (< 1s), mantendo textos dinâmicos e editáveis,
// com suporte a Auto-Fit do Altaris e Otimização opcional via IA Local (Ollama).
import type { Slide } from "../engine/state";

interface ExtractedMedia {
  [rId: string]: string; // Data URL (base64)
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
 * Lê um arquivo .pptx e reconstrói apresentações nativas como slides editáveis do Altaris
 * em menos de 1 segundo, sem depender de conversões pesadas do LibreOffice.
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

  // 1. Encontra todos os slides ordenados numericamente
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
    onProgress?.(i + 1, total, `Carregando slide ${i + 1} de ${total}...`);

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

          if (type.includes("image") || /\.(png|jpe?g|webp|gif|svg)$/i.test(target)) {
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

    // Identifica imagem principal do slide (fundo ou ilustração)
    let primaryImageUrl: string | undefined = undefined;
    const blipNodes = doc.getElementsByTagName("a:blip");
    for (let b = 0; b < blipNodes.length; b++) {
      const embedId = blipNodes[b].getAttribute("r:embed") || blipNodes[b].getAttribute("r:link");
      if (embedId && mediaMap[embedId]) {
        primaryImageUrl = mediaMap[embedId];
        break;
      }
    }

    // C. Extrai formas de texto (<p:sp>)
    const shapes = doc.getElementsByTagName("p:sp");
    const extractedShapes: { isTitlePlaceholder: boolean; text: string }[] = [];

    for (let s = 0; s < shapes.length; s++) {
      const sp = shapes[s];
      const ph = sp.getElementsByTagName("p:ph")[0];
      const phType = ph ? ph.getAttribute("type") : null;
      const isTitlePlaceholder = phType === "title" || phType === "ctrTitle";

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
        line = cleanText(line);
        if (line && !isFooterNoise(line)) {
          shapeLines.push(line);
        }
      }

      const fullShapeText = shapeLines.join("\n").trim();
      if (fullShapeText) {
        extractedShapes.push({ isTitlePlaceholder, text: fullShapeText });
      }
    }

    // D. Inteligência de Título e Conteúdo
    let slideTitle = "";
    const bodyParagraphs: string[] = [];

    // 1. Títulos canônicos conhecidos de EBD
    const canonicalPattern = /^(TEXTO\s+ÁUREO|VERDADE\s+PRÁTICA|OBJETIVOS(\s+DA\s+LIÇÃO)?|LEITURA\s+BÍBLICA(\s+EM\s+CLASSE)?|INTRODUÇÃO|CONCLUSÃO|LIÇÃO\s+\d+|[IVXLCDM]+\s*[-–—]\s*[^.]+)$/i;
    for (const sh of extractedShapes) {
      const st = sh.text.trim();
      if (canonicalPattern.test(st)) {
        if (!slideTitle || st.length < slideTitle.length) {
          slideTitle = st;
        }
      }
    }

    // 2. Se não achou canônico, verifica placeholder de título
    if (!slideTitle) {
      for (const sh of extractedShapes) {
        if (sh.isTitlePlaceholder && sh.text.trim().length <= 60) {
          slideTitle = sh.text.trim();
          break;
        }
      }
    }

    // 3. Separa formas de texto que não são o título
    for (const sh of extractedShapes) {
      if (sh.text.trim() === slideTitle) continue;
      bodyParagraphs.push(sh.text.trim());
    }

    // 4. Se ainda sem título e temos formas curtas (< 45 chars)
    if (!slideTitle && bodyParagraphs.length > 0) {
      const shortIdx = bodyParagraphs.findIndex(b => b.length <= 45 && !b.includes("\n") && !b.endsWith("."));
      if (shortIdx !== -1) {
        slideTitle = bodyParagraphs[shortIdx];
        bodyParagraphs.splice(shortIdx, 1);
      }
    }

    if (!slideTitle) {
      slideTitle = `Slide ${entry.index}`;
    }

    const fullBodyText = bodyParagraphs.join("\n\n").trim();

    // Detecção bíblica simples (ex: Jr 2.13, Sl 78.37, João 3:16, Dt 4.1)
    const combined = `${slideTitle} ${fullBodyText}`;
    const isBibleRef = /\b([1-3]?\s?[A-Za-zçãéíóú]{2,12})\s+\d+[:.]\d+/i.test(combined) ||
                       /\b(Jr|Sl|Mt|Mc|Lc|Jo|Rm|Ef|Fp|Cl|Hb|Ap|Deuteronômio|Salmos?|Mateus|João)\b/i.test(combined);

    // Se o slide não tem NENHUM texto (slide puramente visual ou gráfico)
    const isPureVisual = !fullBodyText && !slideTitle.replace(/^Slide \d+$/, "").trim();

    if (isPureVisual && primaryImageUrl) {
      slides.push({
        id: `pptx-native-${Date.now()}-${entry.index}`,
        title: `Slide ${entry.index}`,
        header: baseTitle,
        text: "",
        category: "media",
        mediaUrl: primaryImageUrl,
        mediaType: "image",
        background: { type: "image", value: primaryImageUrl }
      });
    } else {
      // Slide de conteúdo nativo Altaris com texto ajustável e tipografia profissional
      slides.push({
        id: `pptx-native-${Date.now()}-${entry.index}`,
        title: slideTitle,
        header: isBibleRef ? slideTitle : baseTitle,
        text: fullBodyText,
        category: isBibleRef ? "bible" : "verse",
        mediaUrl: primaryImageUrl,
        mediaType: primaryImageUrl ? "image" : undefined,
        background: primaryImageUrl
          ? { type: "image", value: primaryImageUrl }
          : { type: "gradient", value: "nebula" }
      });
    }
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
    const recommended = models.find(m => m.includes("llama3.2") || m.includes("llama3") || m.includes("phi3") || m.includes("gemma2")) || models[0];

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
