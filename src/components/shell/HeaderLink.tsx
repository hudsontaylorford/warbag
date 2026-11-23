"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * People and Account in the header: they remember the page you were on
 * (?from=), so those pages can offer "‹ Back to …". Moving between People
 * and Account keeps the original page.
 */
export function HeaderLink({ href, className, title, children }: { href: string; className: string; title?: string; children: React.ReactNode }) {
  const path = usePathname();
  const params = useSearchParams();
  const onTheWay = path.startsWith("/admin") || path.startsWith("/account");
  const query = params.toString();
  const from = onTheWay ? params.get("from") : `${path}${query ? `?${query}` : ""}`;
  return (
    <Link href={from ? `${href}?from=${encodeURIComponent(from)}` : href} className={className} title={title}>
      {children}
    </Link>
  );
}
