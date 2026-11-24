import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { appsFor } from "@/lib/apps";
import { AppHeader } from "@/components/shell/AppHeader";
import { AppList } from "@/components/shell/AppList";

export const metadata: Metadata = { title: "Home · warbag" };

/** The signed-in launcher: the apps this person may use, by name, on the navy field. */
export default async function HomePage() {
  const user = await requireUser("/home");
  const apps = await appsFor({ id: user.id, isAdmin: user.isAdmin === true });
  const first = user.name?.trim().split(/\s+/)[0];

  return (
    <div className="min-h-dvh bg-ink text-page">
      <AppHeader email={user.email} isAdmin={user.isAdmin === true} people={user.isPeopleManager === true} tone="dark" />
      <main className="mx-auto grid max-w-2xl gap-10 px-4 pt-10 pb-16 md:max-w-5xl md:grid-cols-[5fr_7fr] md:items-start md:gap-16 md:pt-20">
        <h1 className="masthead text-cream">{first ? `Hi, ${first}` : "Home"}</h1>
        {apps.length > 0 ? (
          <AppList apps={apps} />
        ) : (
          <p className="text-mist">Nothing here yet. When someone shares an app or a list with you, it shows up here.</p>
        )}
      </main>
    </div>
  );
}
