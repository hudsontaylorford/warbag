import { openGuestLink } from "@/lib/mosey/link-join";
import { notFoundImage, previewCard } from "@/lib/preview";

/** Someone's own trip link: whose it is and which trip. Opening the picture signs nothing in. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const link = await openGuestLink((await params).token);
  if (!link) return notFoundImage();
  return previewCard({ kicker: `For ${link.name}`, title: link.tripName, lines: ["Your own link to the trip"], app: "Mosey", letter: "M" });
}
