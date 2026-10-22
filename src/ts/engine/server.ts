// Informações do servidor local (porta, IP, PIN, QR) fornecidas pelo backend nativo (Electron / Tauri).
export interface ServerInfo {
  port: number;
  ip: string;
  pin: string;
  remote_url: string;
  obs_url: string;
  qr_svg: string;
}

export const inTauri = (): boolean =>
  typeof window !== "undefined" && ("electronAPI" in window || "__TAURI_INTERNALS__" in window);

let cache: Promise<ServerInfo | null> | null = null;

export function getServerInfo(): Promise<ServerInfo | null> {
  if (!inTauri()) return Promise.resolve(null);
  const w = window as any;
  if (w.electronAPI && typeof w.electronAPI.invoke === "function") {
    return w.electronAPI.invoke("server_info");
  }
  cache ??= import("@tauri-apps/api/core")
    .then(({ invoke }) => invoke<ServerInfo>("server_info"))
    .catch(() => null);
  return cache;
}

export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const w = window as any;
  if (w.electronAPI && typeof w.electronAPI.invoke === "function") {
    return w.electronAPI.invoke(cmd, args) as Promise<T>;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}
