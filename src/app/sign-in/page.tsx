import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { SignInForm } from "./SignInForm";
import { Monogram } from "@/components/ui/Monogram";
import { appForPath } from "@/lib/app-paths";

type Props = { searchParams: Promise<{ next?: string | string[] }> };

/** On the way into an app (a trip, a gift list), the page is that app's: "Sign in to Mosey". */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const app = appForPath(safeNext((await searchParams).next));
  return { title: app ? `Sign in · ${app.name}` : "Sign in · warbag" };
}

/** Only same-site paths are allowed as a destination after sign-in. */
function safeNext(next: string | string[] | undefined): string {
  const value = Array.isArray(next) ? next[0] : next;
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/home";
}

export default async function SignInPage({ searchParams }: Props) {
  const next = safeNext((await searchParams).next);
  const app = appForPath(next);
  if (await currentUser()) redirect(next);

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-16">
      {app ? <Monogram letter={app.letter} size="md" tone="ember" label={app.name} /> : <Monogram letter="W" size="md" label="warbag" />}
      <h1 className="title">Sign in to {app ? app.name : "warbag"}</h1>
      {next.startsWith("/mosey/") && next !== "/mosey/" && (
        <p className="text-soft">This trip is private. Sign in with the email it was shared with. Got a trip link instead? Open it to see the plan and ask to join.</p>
      )}
      <SignInForm next={next} />
    </main>
  );
}
