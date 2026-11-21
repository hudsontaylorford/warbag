import Link from "next/link";
import { hostOf, type App } from "@/lib/apps";

const row =
  "flex min-h-16 items-center justify-between gap-4 py-3 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** The launcher's list of apps. Native apps open here; external ones in a new tab. */
export function AppList({ apps }: { apps: App[] }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
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
    <span className="flex flex-col">
      <span className="text-lg font-semibold">{app.name}</span>
      <span className="text-sm text-soft">{app.description}</span>
    </span>
  );

  if (app.status === "soon") {
    return (
      <div className={row} aria-disabled="true">
        {label}
        <span className="text-sm text-soft">Coming soon</span>
      </div>
    );
  }

  if (app.kind === "external") {
    return (
      <a href={app.href} target="_blank" rel="noopener noreferrer" className={row}>
        {label}
        <span className="text-lg text-accent">
          <span aria-hidden>↗</span>
          <span className="sr-only">Opens {hostOf(app.href)} in a new tab</span>
        </span>
      </a>
    );
  }

  return (
    <Link href={app.href} className={row}>
      {label}
      <span aria-hidden className="text-soft">
        ›
      </span>
    </Link>
  );
}
