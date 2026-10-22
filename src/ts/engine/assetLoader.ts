/**
 * Utilitário central de carregamento de dados e recursos (Bíblias, Hinos, etc.)
 * Funciona de forma 100% offline tanto em ambiente Electron (desktop nativo) quanto em navegador/web.
 */
export async function loadAppJson<T = any>(relPath: string): Promise<T | null> {
  const clean = relPath.replace(/^(\.\/|\/)/, "");

  // 1. No Electron, utiliza leitura direta de arquivo pelo IPC (imune a limitações de protocolo file://)
  if (typeof (window as any).electronAPI?.invoke === "function") {
    try {
      const text = await (window as any).electronAPI.invoke("read_app_file", { relativePath: clean });
      if (text && typeof text === "string") {
        return JSON.parse(text.replace(/^\uFEFF/, ""));
      }
    } catch (e) {
      // Continua para o fallback de fetch
    }
  }

  // 2. Fetch com caminhos relativos e absolutos
  const pathsToTry = [
    `./${clean}`,
    `/${clean}`,
    `http://localhost:7878/${clean}`
  ];

  for (const p of pathsToTry) {
    try {
      const res = await fetch(p);
      if (res.ok) {
        const text = await res.text();
        return JSON.parse(text.replace(/^\uFEFF/, ""));
      }
    } catch (_) {}
  }

  return null;
}
