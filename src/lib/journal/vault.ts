// Cifratura del journal nel browser (Web Crypto).
// Il journal è cifrato con una chiave dati casuale (AES-GCM 256). La chiave dati è salvata due volte,
// cifrata con la password e con la recovery key (entrambe via PBKDF2-SHA256): si sblocca con l'una o l'altra.
// Senza password e senza recovery key i dati non sono recuperabili: è il senso della cifratura.

const ITERATIONS = 310_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

export interface Sealed {
  iv: string;
  data: string;
}

export interface VaultFile {
  vault: 1;
  iterations: number;
  password: Sealed & { salt: string };
  recovery: Sealed & { salt: string };
  payload: Sealed;
}

export const isVault = (v: unknown): v is VaultFile =>
  !!v && typeof v === "object" && (v as VaultFile).vault === 1 && !!(v as VaultFile).payload && !!(v as VaultFile).password;

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

async function deriveKek(secret: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function seal(key: CryptoKey, bytes: Uint8Array): Promise<Sealed> {
  const iv = random(12);
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, bytes as BufferSource);
  return { iv: b64(iv), data: b64(data) };
}

async function open(key: CryptoKey, s: Sealed): Promise<Uint8Array> {
  const out = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(s.iv) as BufferSource }, key, unb64(s.data) as BufferSource);
  return new Uint8Array(out);
}

const importDek = (raw: Uint8Array) => crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);

/** Recovery key leggibile: 4 gruppi da 5 caratteri senza simboli ambigui (0/O, 1/I). */
export function generateRecoveryKey(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = random(20);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
  return chars.match(/.{5}/g)!.join("-");
}

const normalizeRecovery = (k: string) => k.toUpperCase().replace(/[^A-Z0-9]/g, "").match(/.{1,5}/g)?.join("-") ?? "";

/** Crea il vault: restituisce file da salvare, chiave dati da tenere in memoria e recovery key da mostrare una volta. */
export async function createVault(plaintext: string, password: string, iterations = ITERATIONS) {
  const rawDek = random(32);
  const dek = await importDek(rawDek);
  const recoveryKey = generateRecoveryKey();
  const pSalt = random(16);
  const rSalt = random(16);
  const file: VaultFile = {
    vault: 1,
    iterations,
    password: { salt: b64(pSalt), ...(await seal(await deriveKek(password, pSalt, iterations), rawDek)) },
    recovery: { salt: b64(rSalt), ...(await seal(await deriveKek(normalizeRecovery(recoveryKey), rSalt, iterations), rawDek)) },
    payload: await seal(dek, enc.encode(plaintext)),
  };
  return { file, dek, recoveryKey };
}

/** Sblocca con la password o con la recovery key. Restituisce null se il segreto è sbagliato. */
export async function unlockVault(file: VaultFile, secret: string, via: "password" | "recovery" = "password") {
  const slot = via === "password" ? file.password : file.recovery;
  const s = via === "password" ? secret : normalizeRecovery(secret);
  try {
    const kek = await deriveKek(s, unb64(slot.salt), file.iterations);
    const dek = await importDek(await open(kek, slot));
    const plaintext = dec.decode(await open(dek, file.payload));
    return { dek, plaintext };
  } catch {
    return null; // AES-GCM fallisce l'autenticazione: segreto errato o file alterato
  }
}

/** Nuovo contenuto con la stessa chiave dati: password e recovery key restano valide. */
export async function resealVault(file: VaultFile, dek: CryptoKey, plaintext: string): Promise<VaultFile> {
  return { ...file, payload: await seal(dek, enc.encode(plaintext)) };
}

/** Cambia la password tenendo la stessa chiave dati e la stessa recovery key. */
export async function changeVaultPassword(file: VaultFile, oldPassword: string, newPassword: string): Promise<VaultFile | null> {
  const kekOld = await deriveKek(oldPassword, unb64(file.password.salt), file.iterations);
  let rawDek: Uint8Array;
  try {
    rawDek = await open(kekOld, file.password);
  } catch {
    return null;
  }
  const salt = random(16);
  return { ...file, password: { salt: b64(salt), ...(await seal(await deriveKek(newPassword, salt, file.iterations), rawDek)) } };
}
