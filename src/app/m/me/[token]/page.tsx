import type { Metadata } from "next";
import { previewMetadata } from "@/lib/preview";
import { redirect } from "next/navigation";
import { Monogram } from "@/components/ui/Monogram";
import { openGuestLink } from "@/lib/mosey/link-join";
import { currentUser } from "@/lib/session";
import { OpenGuestLink } from "@/app/mosey/LinkJoin";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const token = (await params).token;
  const link = await openGuestLink(token);
  if (!link) return { title: "Trip · Mosey", robots: { index: false, follow: false } };
  return previewMetadata({
    title: `${link.tripName} · Mosey`,
    headline: `Your link to ${link.tripName}`,
    description: `For ${link.name}. Tap to open the trip.`,
    image: `/m/me/${token}/og`,
  });
}

/**
 * Someone's own link to a trip they joined by the trip link. One tap signs
 * this device in as them (a tap, not on open, so link previews in Messages
 * don't sign anything in). Already them here: straight to the trip.
 */
export default async function GuestLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [link, user] = await Promise.all([openGuestLink(token), currentUser()]);
  if (link && user?.id === link.userId) redirect(`/mosey/${link.tripId}`);
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <p className="flex items-center gap-2 text-sm text-soft">
        <Monogram letter="M" size="sm" tone="ember" />
        Mosey
      </p>
      {link ? (
        <>
          <h1 className="title break-words">{link.tripName}</h1>
          <p>
            This is <span className="font-semibold">{link.name}</span>&apos;s own link to the trip.
            {user ? ` You're signed in as ${user.isGuest ? user.name : user.email} here; opening it switches this device to ${link.name}.` : ""}
          </p>
          <OpenGuestLink token={token} name={link.name} />
        </>
      ) : (
        <>
          <h1 className="title">This link isn&apos;t working</h1>
          <p>The organizer may have turned it off. Ask them for the trip link.</p>
        </>
      )}
    </main>
  );
}
