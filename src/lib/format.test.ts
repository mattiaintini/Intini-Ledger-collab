import { describe, expect, it } from "vitest";
import { inputNum, parseNum } from "./format";

describe("parseNum", () => {
  it.each([
    ["1234,56", 1234.56],
    ["1234.56", 1234.56],
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["1.234.567", 1234567],
    ["0,5", 0.5],
    ["0.5", 0.5],
    ["-120", -120],
    ["-0,75", -0.75],
    ["+80", 80],
    [" 10 000,5 ", 10000.5],
  ])("%s -> %d", (s, n) => expect(parseNum(s)).toBe(n));

  it.each(["", "abc", "1,2,3", "12a", "-", ",", "1.2,3.4", "12,34.567,8"])("%s -> NaN", (s) => {
    expect(parseNum(s)).toBeNaN();
  });

  it("importi: un punto seguito da 3 cifre è il separatore delle migliaia", () => {
    expect(parseNum("10.000", { money: true })).toBe(10000);
    expect(parseNum("-1.250", { money: true })).toBe(-1250);
    expect(parseNum("120.50", { money: true })).toBe(120.5);
    expect(parseNum("0.500", { money: true })).toBe(0.5);
    expect(parseNum("1234.567", { money: true })).toBe(1234.567);
    // fuori dagli importi resta decimale: 1.500 lotti non esistono, 1,5 sì
    expect(parseNum("10.000")).toBe(10);
  });

  it("inputNum usa la virgola", () => {
    expect(inputNum(200)).toBe("200,00");
    expect(inputNum(-101.2)).toBe("-101,20");
    expect(inputNum(NaN)).toBe("");
    expect(parseNum(inputNum(1234.5))).toBe(1234.5);
  });
});
