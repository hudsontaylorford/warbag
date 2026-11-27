import { publicGroupPage } from "@/lib/gyfte/groups";
import { notFoundImage, previewCard } from "@/lib/preview";

/** A family link's preview picture: the family's gift lists. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const page = await publicGroupPage((await params).token);
  if (!page) return notFoundImage();
  return previewCard({ kicker: "Family gift lists", title: page.name, lines: ["See everyone's lists"], app: "Gyfte", letter: "G" });
}
