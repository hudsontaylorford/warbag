import { setupByLink } from "@/lib/roomtune/setups";
import { notFoundImage, previewCard } from "@/lib/preview";

/** A Room Tuner view link's preview picture: the setup's name. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const setup = await setupByLink((await params).token);
  if (!setup) return notFoundImage();
  return previewCard({ kicker: "Room EQ", title: setup.name, lines: ["View the setup"], app: "Room Tuner", letter: "R" });
}
