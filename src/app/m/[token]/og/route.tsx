import { tripByLink } from "@/lib/mosey/trips";
import { tripPreview } from "@/lib/mosey/preview";
import { notFoundImage, previewCard } from "@/lib/preview";

/** The trip link's preview picture: "You're invited", the trip, its dates and place. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const trip = await tripByLink(token);
  if (!trip) return notFoundImage();
  return previewCard({ kicker: "You're invited", title: trip.name, lines: tripPreview(trip, token).lines, app: "Mosey", letter: "M" });
}
