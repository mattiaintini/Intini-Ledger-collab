// Preferenze di aspetto, per dispositivo: tema chiaro/scuro e look "terminal" (come la v8) o "clean".
export type Theme = "dark" | "light";
export type Look = "terminal" | "clean";
export interface Prefs {
  theme: Theme;
  look: Look;
}

export const PREFS_KEY = "ijs_prefs";
export const DEFAULT_PREFS: Prefs = { theme: "dark", look: "terminal" };

export function readPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<Prefs>;
    return {
      theme: p.theme === "light" ? "light" : "dark",
      look: p.look === "clean" ? "clean" : "terminal",
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function applyPrefs(p: Prefs) {
  document.documentElement.dataset.theme = p.theme;
  document.documentElement.dataset.look = p.look;
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {}
  applyPrefs(p);
}

/**
 * Script inline nel <head>: applica le preferenze prima del primo paint, niente lampo di tema.
 * `?look=` e `?theme=` nell'URL hanno la precedenza (servono per confrontare i look negli screenshot).
 */
export const PREFS_BOOT_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem("${PREFS_KEY}")||"{}");var q=new URLSearchParams(location.search);var t=q.get("theme")||p.theme;var l=q.get("look")||p.look;var d=document.documentElement;d.dataset.theme=t==="light"?"light":"dark";d.dataset.look=l==="clean"?"clean":"terminal";}catch(e){}})();`;
