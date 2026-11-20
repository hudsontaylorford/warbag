import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { SignOutButton } from "./SignOutButton";

export const metadata: Metadata = { title: "Home · warbag" };

// Placeholder launcher. The app list arrives with the app registry (PR 3).
export default async function HomePage() {
  const user = await requireUser("/home");

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold">warbag</h1>
        <p className="mt-1 text-soft">Signed in as {user.email}</p>
      </div>
      <p>Your apps will show up here.</p>
      <div className="max-w-xs">
        <SignOutButton />
      </div>
    </main>
  );
}
