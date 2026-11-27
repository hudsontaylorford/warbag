import { describe, expect, it } from "vitest";
import { appForPath } from "@/lib/app-paths";

describe("the sign-in page names the app you're headed to", () => {
  it("knows each app's pages and share links", () => {
    expect(appForPath("/mosey/abc")?.name).toBe("Mosey");
    expect(appForPath("/m/token/ideas")?.name).toBe("Mosey");
    expect(appForPath("/gyfte")?.name).toBe("Gyfte");
    expect(appForPath("/j/token")?.name).toBe("Gyfte");
    expect(appForPath("/rt/token")?.name).toBe("Room Tuner");
    expect(appForPath("/jot/1")?.name).toBe("Jot");
  });
  it("leaves warbag's own pages as warbag", () => {
    for (const p of ["/home", "/admin", "/account", "/", "/mosaic", "/jotter"]) expect(appForPath(p)).toBeNull();
  });
});
