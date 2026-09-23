import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SECONDARY_NAV } from "@/components/nav";
import { Group, PageHeader } from "@/components/ui";

export default function MorePage() {
  return (
    <>
      <PageHeader title="Altro" />
      <Group>
        {[...SECONDARY_NAV, { href: "/cot/verification", label: "Data verification", icon: null }].map((n) => (
          <Link key={n.href} href={n.href} className="flex min-h-11 items-center justify-between px-4 text-[15px] active:bg-surface-3">
            {n.label}
            <ChevronRight size={16} className="text-subtle" />
          </Link>
        ))}
      </Group>
    </>
  );
}
