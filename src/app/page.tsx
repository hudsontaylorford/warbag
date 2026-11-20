import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-2xl font-semibold">warbag</h1>
      <p className="mt-2 text-soft">Coming soon.</p>
      <p className="mt-8">
        <Link href="/sign-in" className="text-accent underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </main>
  );
}
