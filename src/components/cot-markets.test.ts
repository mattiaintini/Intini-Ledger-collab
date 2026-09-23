import { describe, expect, it } from "vitest";
import { tradeCount } from "./cot-markets";

const assets = new Map([["XAUUSD", 14], ["EURUSD", 8], ["GBPUSD", 5], ["US500", 4], ["EURJPY", 2], ["NAS100", 3], ["GOLD", 1]]);

describe("mercati COT dal journal", () => {
  it("simboli esatti e alias dei broker", () => {
    expect(tradeCount("XAUUSD", assets)).toBe(15); // XAUUSD + GOLD
    expect(tradeCount("US500", assets)).toBe(4);
    expect(tradeCount("US100", assets)).toBe(3);
  });
  it("i cambi incrociati contano per entrambe le valute", () => {
    expect(tradeCount("EURUSD", assets)).toBe(10); // EURUSD + EURJPY
    expect(tradeCount("USDJPY", assets)).toBe(2); // EURJPY
    expect(tradeCount("GBPUSD", assets)).toBe(5);
  });
  it("nessuna corrispondenza per strumenti mai tradati", () => {
    expect(tradeCount("USDCHF", assets)).toBe(0);
    expect(tradeCount("DXY", assets)).toBe(0);
    expect(tradeCount("BTCUSD", assets)).toBe(0);
  });
});
