import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { appsFor } from "@/lib/apps";
import { AppHeader } from "@/components/shell/AppHeader";
import { AppList } from "@/components/shell/AppList";
import { FieldMark } from "@/components/shell/FieldMark";

export const metadata: Metadata = { title: "Home · warbag" };

/** The signed-in launcher: the apps this person may use, on the navy field. */
export default async function HomePage() {
  const user = await requireUser("/home");
  const apps = await appsFor({ id: user.id, isAdmin: user.isAdmin === true });
  const first = user.name?.trim().split(/\s+/)[0];

  return (
    <div className="relative min-h-dvh overflow-hidden bg-ink text-page">
      <FieldMark />
      <AppHeader email={user.email} isAdmin={user.isAdmin === true} tone="dark" />
      <main className="relative mx-auto grid max-w-2xl gap-8 px-4 pt-10 pb-16 md:max-w-5xl md:grid-cols-[5fr_7fr] md:gap-16 md:pt-20">
        <div>
          {first && <p className="text-sm text-mist">Hi, {first}</p>}
          <h1 className="title mt-1 text-cream md:text-7xl md:leading-[0.95]">What&apos;s in your warbag</h1>
        </div>
        {apps.length > 0 ? (
          <AppList apps={apps} />
        ) : (
          <p className="text-mist">Nothing here yet. When someone shares an app or a list with you, it shows up here.</p>
        )}
      </main>
    </div>
  );
}
