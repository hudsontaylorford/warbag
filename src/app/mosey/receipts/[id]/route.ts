import { currentActor } from "@/lib/session";
import { AccessDenied } from "@/lib/access";
import { openReceipt } from "@/lib/mosey/receipts";

/**
 * A receipt photo, for members of its trip only. Never cached by shared
 * caches, never sniffed as anything but an image, never framed elsewhere.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { body, contentType } = await openReceipt(await currentActor(), id);
    const payload: BodyInit = Buffer.isBuffer(body) ? new Uint8Array(body) : (body as ReadableStream<Uint8Array>);
    return new Response(payload, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'self'",
        "Content-Disposition": "inline",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (err) {
    if (err instanceof AccessDenied) return new Response("Not found", { status: 404 });
    throw err;
  }
}
