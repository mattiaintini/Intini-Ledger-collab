// Preferenze di aspetto per dispositivo: tema automatico (segue il sistema), chiaro o scuro.
export type ThemePref = "system" | "light" | "dark";
export interface Prefs {
  theme: ThemePref;
}

export const PREFS_KEY = "ijs_prefs";
export const DEFAULT_PREFS: Prefs = { theme: "system" };

export function readPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<Prefs>;
    return { theme: p.theme === "light" || p.theme === "dark" ? p.theme : "system" };
  } catch {
    return DEFAULT_PREFS;
  }
}

const resolve = (t: ThemePref) =>
  t === "system" ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : t;

export function applyPrefs(p: Prefs) {
  document.documentElement.dataset.theme = resolve(p.theme);
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {}
  applyPrefs(p);
}

/**
 * Script inline nel <head>: applica il tema prima del primo paint e segue il cambio di tema del sistema.
 * `?theme=light|dark` nell'URL ha la precedenza (serve per gli screenshot di confronto).
 */
export const PREFS_BOOT_SCRIPT = `(function(){try{var d=document.documentElement;var m=window.matchMedia("(prefers-color-scheme: light)");function pref(){try{var p=JSON.parse(localStorage.getItem("${PREFS_KEY}")||"{}");return p.theme||"system"}catch(e){return "system"}}function apply(){var q=new URLSearchParams(location.search).get("theme");var t=q||pref();d.dataset.theme=t==="system"?(m.matches?"light":"dark"):(t==="light"?"light":"dark");}apply();m.addEventListener("change",function(){if(pref()==="system")apply();});}catch(e){}})();`;
