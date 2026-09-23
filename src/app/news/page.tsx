"use client";

import { useEffect, useRef, useState } from "react";
import { Card, PageHeader } from "@/components/ui";

const ZONES = [
  ["Europe/Rome", "Roma"],
  ["Europe/London", "Londra"],
  ["America/New_York", "New York"],
  ["Etc/UTC", "UTC"],
] as const;

/** Calendario economico di TradingView: il widget va reinserito da zero a ogni cambio di fuso. */
function EconomicCalendar({ timezone }: { timezone: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.innerHTML = '<div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div>';
    const s = document.createElement("script");
    s.src = "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
    s.async = true;
    s.innerHTML = JSON.stringify({
      colorTheme: "dark",
      isTransparent: true,
      width: "100%",
      height: "100%",
      locale: "it",
      importanceFilter: "0,1",
      countryFilter: "us,eu,gb,jp,au,ca,ch,nz,cn,de",
      timezone,
    });
    host.appendChild(s);
    return () => {
      host.innerHTML = "";
    };
  }, [timezone]);
  return <div ref={ref} className="tradingview-widget-container h-[70dvh] min-h-[520px] w-full" />;
}

export default function NewsPage() {
  const [tz, setTz] = useState("Europe/Rome");
  return (
    <>
      <PageHeader
        title="News"
        description="Calendario macro con impatto medio e alto. Dati forniti da TradingView."
        actions={
          <select className="field w-44" value={tz} onChange={(e) => setTz(e.target.value)} aria-label="Fuso orario">
            {ZONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        }
      />
      <Card className="p-2 md:p-3">
        <EconomicCalendar timezone={tz} />
      </Card>
    </>
  );
}
