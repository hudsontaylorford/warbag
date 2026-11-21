import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { SignInForm } from "./SignInForm";
import { Monogram } from "@/components/ui/Monogram";

export const metadata: Metadata = { title: "Sign in · warbag" };

/** Only same-site paths are allowed as a destination after sign-in. */
function safeNext(next: string | string[] | undefined): string {
  const value = Array.isArray(next) ? next[0] : next;
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/home";
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const next = safeNext((await searchParams).next);
  if (await currentUser()) redirect(next);

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-16">
      <Monogram letter="W" size="md" label="warbag" />
      <h1 className="title">Sign in to warbag</h1>
      <SignInForm next={next} />
    </main>
  );
}
