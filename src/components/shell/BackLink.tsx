import Link from "next/link";
import type { Back } from "@/lib/back";

/** "‹ Back to Ford Christmas" at the top of a page you visited on the way. */
export function BackLink({ back }: { back: Back | null }) {
  if (!back) return null;
  return (
    <Link href={back.href} className="min-h-11 content-center self-start text-accent underline-offset-4 hover:underline">
      ‹ Back to <span className="break-words">{back.label}</span>
    </Link>
  );
}
