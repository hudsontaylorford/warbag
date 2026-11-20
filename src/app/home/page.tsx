import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { appsFor } from "@/lib/apps";
import { AppHeader } from "@/components/shell/AppHeader";
import { AppList } from "@/components/shell/AppList";

export const metadata: Metadata = { title: "Home · warbag" };

/** The signed-in launcher: the apps this person may use. */
export default async function HomePage() {
  const user = await requireUser("/home");
  const apps = await appsFor({ id: user.id, isAdmin: user.isAdmin === true });

  return (
    <>
      <AppHeader email={user.email} />
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-8">
        <h1 className="text-2xl font-semibold">Your apps</h1>
        {apps.length > 0 ? (
          <AppList apps={apps} />
        ) : (
          <p className="text-soft">
            Nothing here yet. When someone shares an app or a list with you, it shows up here.
          </p>
        )}
      </main>
    </>
  );
}
