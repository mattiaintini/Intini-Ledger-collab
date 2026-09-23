export interface MonteCarloInput {
  start: number;
  winRate: number; // 0..1
  rr: number;
  riskPct: number; // 0..100, composto sul capitale corrente
  trades: number;
  runs: number;
  ddThresholdPct: number;
}

export interface MonteCarloResult {
  paths: number[][];
  p5: number;
  median: number;
  p95: number;
  medianMaxDdPct: number;
  probDd: number; // quota di simulazioni con drawdown oltre la soglia
  probLoss: number; // quota che chiude sotto il capitale iniziale
}

const quantile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];

export function monteCarlo(p: MonteCarloInput, rand: () => number = Math.random, keepPaths = 30): MonteCarloResult {
  const ends: number[] = [];
  const dds: number[] = [];
  const paths: number[][] = [];
  for (let r = 0; r < p.runs; r++) {
    let eq = p.start;
    let peak = eq;
    let maxDd = 0;
    const path = [eq];
    for (let t = 0; t < p.trades; t++) {
      const risk = (eq * p.riskPct) / 100;
      eq += rand() < p.winRate ? risk * p.rr : -risk;
      peak = Math.max(peak, eq);
      maxDd = Math.max(maxDd, (peak - eq) / peak);
      if (r < keepPaths) path.push(eq);
    }
    ends.push(eq);
    dds.push(maxDd * 100);
    if (r < keepPaths) paths.push(path);
  }
  const se = [...ends].sort((a, b) => a - b);
  const sd = [...dds].sort((a, b) => a - b);
  return {
    paths,
    p5: quantile(se, 0.05),
    median: quantile(se, 0.5),
    p95: quantile(se, 0.95),
    medianMaxDdPct: quantile(sd, 0.5),
    probDd: dds.filter((d) => d >= p.ddThresholdPct).length / p.runs,
    probLoss: ends.filter((e) => e < p.start).length / p.runs,
  };
}
