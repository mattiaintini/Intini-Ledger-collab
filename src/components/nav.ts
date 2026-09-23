import { BookOpen, CalendarDays, ChartColumn, ChartLine, Landmark, Newspaper, Settings, Wrench } from "lucide-react";

export const NAV = [
  { href: "/", label: "Dashboard", icon: ChartLine, section: "Trading" },
  { href: "/journal", label: "Journal", icon: BookOpen, section: "Trading" },
  { href: "/analytics", label: "Analytics", icon: ChartColumn, section: "Trading" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, section: "Trading" },
  { href: "/cot", label: "COT Report", icon: Landmark, section: "Markets" },
  { href: "/news", label: "News", icon: Newspaper, section: "Markets" },
  { href: "/tools", label: "Tools", icon: Wrench, section: "Altro" },
  { href: "/settings", label: "Settings", icon: Settings, section: "Altro" },
] as const;

export const SECONDARY_NAV = NAV.filter((n) => ["/calendar", "/tools", "/news", "/settings"].includes(n.href));
