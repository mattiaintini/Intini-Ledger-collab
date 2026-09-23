import { describe, expect, it } from "vitest";
import { changeVaultPassword, createVault, generateRecoveryKey, isVault, resealVault, unlockVault } from "./vault";

// iterazioni basse solo nei test: la derivazione reale (310.000) è lenta di proposito
const FAST = 1000;
const journal = JSON.stringify({ version: 9, profile: { name: "m" }, trades: [{ id: "1", pnl: -120 }] });

describe("vault del journal", () => {
  it("il file salvato non contiene i dati in chiaro", async () => {
    const { file } = await createVault(journal, "Segreta!1", FAST);
    const stored = JSON.stringify(file);
    expect(isVault(file)).toBe(true);
    expect(stored).not.toContain("trades");
    expect(stored).not.toContain("-120");
    expect(stored).not.toContain("Segreta");
  });

  it("si apre con la password giusta e con la recovery key, non con quella sbagliata", async () => {
    const { file, recoveryKey } = await createVault(journal, "Segreta!1", FAST);
    expect((await unlockVault(file, "Segreta!1"))?.plaintext).toBe(journal);
    expect(await unlockVault(file, "segreta!1")).toBeNull();
    expect((await unlockVault(file, recoveryKey, "recovery"))?.plaintext).toBe(journal);
    // la recovery key si può scrivere minuscola e senza trattini
    expect((await unlockVault(file, recoveryKey.toLowerCase().replaceAll("-", ""), "recovery"))?.plaintext).toBe(journal);
    expect(await unlockVault(file, "AAAAA-BBBBB-CCCCC-DDDDD", "recovery")).toBeNull();
  });

  it("un file alterato non si apre", async () => {
    const { file } = await createVault(journal, "Segreta!1", FAST);
    const data = file.payload.data;
    const tampered = { ...file, payload: { ...file.payload, data: (data[0] === "A" ? "B" : "A") + data.slice(1) } };
    expect(await unlockVault(tampered, "Segreta!1")).toBeNull();
  });

  it("salvataggi successivi e cambio password mantengono valida la recovery key", async () => {
    const { file, dek, recoveryKey } = await createVault(journal, "Segreta!1", FAST);
    const next = await resealVault(file, dek, '{"v":2}');
    expect((await unlockVault(next, "Segreta!1"))?.plaintext).toBe('{"v":2}');
    const changed = (await changeVaultPassword(next, "Segreta!1", "Nuova#2026"))!;
    expect(await unlockVault(changed, "Segreta!1")).toBeNull();
    expect((await unlockVault(changed, "Nuova#2026"))?.plaintext).toBe('{"v":2}');
    expect((await unlockVault(changed, recoveryKey, "recovery"))?.plaintext).toBe('{"v":2}');
    expect(await changeVaultPassword(next, "sbagliata", "x")).toBeNull();
  });

  it("recovery key: 4 gruppi da 5, senza caratteri ambigui", () => {
    const k = generateRecoveryKey();
    expect(k).toMatch(/^[A-HJ-NP-Z2-9]{5}(-[A-HJ-NP-Z2-9]{5}){3}$/);
    expect(generateRecoveryKey()).not.toBe(k);
  });
});
