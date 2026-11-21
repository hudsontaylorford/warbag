import Link from "next/link";
import { Monogram } from "@/components/ui/Monogram";
import { FieldMark } from "@/components/shell/FieldMark";

export default function Home() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-ink text-page">
      <FieldMark />
      <main className="relative mx-auto flex max-w-2xl flex-col gap-6 px-4 py-16">
        <Monogram letter="W" size="lg" tone="cream" label="warbag" />
        <h1 className="title text-cream">warbag</h1>
        <p className="text-mist">A personal collection of tools. Coming soon.</p>
        <p>
          <Link href="/sign-in" className="text-cream underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
