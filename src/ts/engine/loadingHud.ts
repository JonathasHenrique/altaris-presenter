/**
 * Loading HUD - Apple Style overlay with progress feedback
 */

export function showLoadingHUD(title: string, subtitle?: string): void {
  const modal = document.getElementById("modal-loading-hud");
  const titleEl = document.getElementById("loading-hud-title");
  const subEl = document.getElementById("loading-hud-subtitle");
  const bar = document.getElementById("loading-hud-progress");
  const countEl = document.getElementById("loading-hud-count");

  if (!modal) return;
  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = subtitle || "Processando arquivo...";
  if (bar) bar.style.width = "5%";
  if (countEl) countEl.textContent = "Iniciando processamento...";

  modal.style.display = "flex";
}

export function updateLoadingHUD(percent: number, countText?: string, subtitle?: string): void {
  const bar = document.getElementById("loading-hud-progress");
  const countEl = document.getElementById("loading-hud-count");
  const subEl = document.getElementById("loading-hud-subtitle");

  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  if (bar) bar.style.width = `${clamped}%`;
  if (countEl && countText) countEl.textContent = countText;
  if (subEl && subtitle) subEl.textContent = subtitle;
}

export function hideLoadingHUD(): void {
  const modal = document.getElementById("modal-loading-hud");
  if (!modal) return;
  // Fade out effect
  modal.style.transition = "opacity 0.25s ease";
  modal.style.opacity = "0";
  setTimeout(() => {
    modal.style.display = "none";
    modal.style.opacity = "1";
    modal.style.transition = "";
    const bar = document.getElementById("loading-hud-progress");
    if (bar) bar.style.width = "0%";
  }, 260);
}

