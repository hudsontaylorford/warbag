import type { Metadata } from "next";
import Link from "next/link";
import { requireMosey } from "@/lib/mosey/page";
import { AppHeader } from "@/components/shell/AppHeader";
import { TripForm } from "../TripForm";

export const metadata: Metadata = { title: "New trip · Mosey", robots: { index: false, follow: false } };

export default async function NewTripPage() {
  const { user, actor } = await requireMosey("/mosey/new", { needCreate: true });
  return (
    <>
      <AppHeader email={user.email} app="Mosey" isAdmin={actor.isAdmin} />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        <div>
          <Link href="/mosey" className="text-accent underline-offset-4 hover:underline">
            ‹ Trips
          </Link>
          <h1 className="mt-2 title">New trip</h1>
        </div>
        <TripForm />
      </main>
    </>
  );
}
