import { BarChart3, BookOpen, CalendarDays, Gauge, Landmark, Newspaper, Settings, Wrench } from "lucide-react";

export const NAV = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/cot", label: "COT Report", icon: Landmark },
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/settings", label: "Settings", icon: Settings },
];

export const SECONDARY_NAV = NAV.filter((n) => ["/calendar", "/tools", "/news", "/settings"].includes(n.href));
