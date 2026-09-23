import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SECONDARY_NAV } from "@/components/nav";
import { PageHeader } from "@/components/ui";

export default function MorePage() {
  return (
    <>
      <PageHeader title="More" />
      <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
        {[...SECONDARY_NAV, { href: "/cot/verification", label: "Data verification" }].map((n) => (
          <li key={n.href}>
            <Link href={n.href} className="flex items-center justify-between px-4 py-4 text-sm">
              {n.label}
              <ChevronRight size={16} className="text-subtle" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
