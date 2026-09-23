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

  it("inputNum usa la virgola", () => {
    expect(inputNum(200)).toBe("200,00");
    expect(inputNum(-101.2)).toBe("-101,20");
    expect(inputNum(NaN)).toBe("");
    expect(parseNum(inputNum(1234.5))).toBe(1234.5);
  });
});
