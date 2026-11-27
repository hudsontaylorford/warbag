import { listByLink } from "@/lib/gyfte/sharing";
import { notFoundImage, previewCard } from "@/lib/preview";
import { giftCount } from "@/lib/gyfte/preview";

/** A shared gift list's preview picture: the list and how many gifts. Never claims. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const list = await listByLink((await params).token);
  if (!list) return notFoundImage();
  return previewCard({ kicker: "Gift list", title: list.title, lines: [giftCount(list.items.length)], app: "Gyfte", letter: "G" });
}
