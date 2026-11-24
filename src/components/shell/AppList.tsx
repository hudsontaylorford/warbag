import Link from "next/link";
import { hostOf, type App } from "@/lib/apps";

const row =
  "group flex min-h-16 items-center gap-4 py-3 " +
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cream";

/**
 * The launcher's apps, on the navy field: names only, in the display serif.
 * warbag's own apps come first under "Apps"; external products (Chirk, CMX)
 * sit under "Other sites" and open in a new tab, marked with ↗.
 */
export function AppList({ apps }: { apps: App[] }) {
  const own = apps.filter((app) => app.kind === "native");
  const other = apps.filter((app) => app.kind === "external");
  return (
    <div className="flex flex-col gap-10">
      {own.length > 0 && <Group title="Apps" apps={own} />}
      {other.length > 0 && <Group title="Other sites" apps={other} />}
    </div>
  );
}

function Group({ title, apps }: { title: string; apps: App[] }) {
  return (
    <section aria-label={title}>
      <h2 className="pb-1 text-sm font-semibold text-mist">{title}</h2>
      <ul className="divide-y divide-cream/20">
        {apps.map((app) => (
          <li key={app.id}>
            <AppRow app={app} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function AppRow({ app }: { app: App }) {
  const name = (
    <span className="display min-w-0 flex-1 text-[2.5rem] leading-tight tracking-[-0.015em] text-page group-hover:text-cream md:text-[2.75rem]">
      {app.name}
    </span>
  );

  if (app.status === "soon") {
    return (
      <div className={row} aria-disabled="true">
        {name}
        <span className="text-sm text-mist">Coming soon</span>
      </div>
    );
  }

  if (app.kind === "external") {
    return (
      <a href={app.href} target="_blank" rel="noopener noreferrer" className={row}>
        {name}
        <span className="text-xl text-cream">
          <span aria-hidden>↗</span>
          <span className="sr-only">Opens {hostOf(app.href)} in a new tab</span>
        </span>
      </a>
    );
  }

  return (
    <Link href={app.href} className={row}>
      {name}
      <span aria-hidden className="text-xl text-cream">
        ›
      </span>
    </Link>
  );
}
