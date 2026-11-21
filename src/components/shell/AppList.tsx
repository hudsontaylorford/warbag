import Link from "next/link";
import { hostOf, type App } from "@/lib/apps";
import { Monogram } from "@/components/ui/Monogram";

const row =
  "group flex min-h-20 items-center gap-4 py-4 " +
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cream";

/**
 * The launcher's apps, on the navy field. warbag's own apps show their
 * letter mark; external apps are plain links that open in a new tab.
 */
export function AppList({ apps }: { apps: App[] }) {
  return (
    <ul className="divide-y divide-cream/20 border-y border-cream/20">
      {apps.map((app) => (
        <li key={app.id}>
          <AppRow app={app} />
        </li>
      ))}
    </ul>
  );
}

function AppRow({ app }: { app: App }) {
  const label = (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="display text-3xl leading-tight text-page group-hover:text-cream">{app.name}</span>
      <span className="text-sm text-mist">{app.description}</span>
    </span>
  );
  const mark = app.letter ? <Monogram letter={app.letter} size="md" tone="ember" /> : <span className="size-11 shrink-0" aria-hidden />;

  if (app.status === "soon") {
    return (
      <div className={row} aria-disabled="true">
        {mark}
        {label}
        <span className="text-sm text-mist">Coming soon</span>
      </div>
    );
  }

  if (app.kind === "external") {
    return (
      <a href={app.href} target="_blank" rel="noopener noreferrer" className={row}>
        {mark}
        {label}
        <span className="text-xl text-cream">
          <span aria-hidden>↗</span>
          <span className="sr-only">Opens {hostOf(app.href)} in a new tab</span>
        </span>
      </a>
    );
  }

  return (
    <Link href={app.href} className={row}>
      {mark}
      {label}
      <span aria-hidden className="text-xl text-cream">
        ›
      </span>
    </Link>
  );
}
