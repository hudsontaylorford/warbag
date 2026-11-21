import { describe, expect, it } from "vitest";
import { parseBulk } from "@/lib/gyfte/bulk";

const names = (text: string) => parseBulk(text).map((g) => g.name);

describe("bulk add parsing", () => {
  it("takes one gift per line and skips blanks", () => {
    expect(names("Wool socks\n\n  Beanie  \nScarf\n")).toEqual(["Wool socks", "Beanie", "Scarf"]);
  });

  it("strips bullets, numbers and checkboxes", () => {
    expect(names("- Socks\n• Hat\n* Gloves\n1. Mug\n2) Pan\n[ ] Book\n[x] Lamp\n— Candle")).toEqual([
      "Socks", "Hat", "Gloves", "Mug", "Pan", "Book", "Lamp", "Candle",
    ]);
  });

  it("splits a link from its name, and names bare links from the address", () => {
    const [a, b] = parseBulk(
      "Pura diffuser https://pura.com/products/pura-plus?utm_source=x\nhttps://www.amazon.com/Travertine-Coasters/dp/B0DTK92MHP/ref=x",
    );
    expect(a).toMatchObject({ name: "Pura diffuser", links: ["https://pura.com/products/pura-plus"] });
    expect(b).toMatchObject({ name: "Travertine Coasters", links: ["https://www.amazon.com/dp/B0DTK92MHP"] });
  });

  it("pulls out prices, sizes and colors", () => {
    expect(parseBulk("Ronaldo jersey - under $30 (size 6-7)")[0]).toMatchObject({
      name: "Ronaldo jersey",
      price: "under $30",
      size: "6-7",
    });
    expect(parseBulk("Blundstones, color: rustic brown, size 9.5, $200")[0]).toMatchObject({
      name: "Blundstones",
      color: "rustic brown",
      size: "9.5",
      price: "$200",
    });
  });

  it("reads rows pasted from the family sheet", () => {
    const sheet = [
      "Gift / Idea\tDescription\tSize\tColor\tLocation\tOther",
      "2025",
      "I'd love a large leather tote\t\tLarge\tBrown\tPortland Leather has a good one but i'm not picky on the brand\t",
      "Owala water bottle\t\t24oz\tSunny Daze\thttps://owalalife.com/products/freesip?variant=1&gclid=abc\t",
      "Keyboard - under $30\thttps://a.co/d/132bFof\t\t\t\t",
    ].join("\n");
    const gifts = parseBulk(sheet);
    expect(gifts.map((g) => g.name)).toEqual(["I'd love a large leather tote", "Owala water bottle", "Keyboard"]);
    expect(gifts[0]).toMatchObject({ size: "Large", color: "Brown", notes: expect.stringContaining("Portland Leather") });
    expect(gifts[1]).toMatchObject({ size: "24oz", color: "Sunny Daze", links: ["https://owalalife.com/products/freesip?variant=1"] });
    expect(gifts[2]).toMatchObject({ price: "under $30", links: ["https://a.co/d/132bFof"] });
  });

  it("skips header rows, year lines and exact repeats", () => {
    expect(names("Gift\n2024\n2022 LIST:\nSocks\nsocks\nHat")).toEqual(["Socks", "Hat"]);
  });

  it("caps a paste at 100 gifts and long fields at their limits", () => {
    const many = Array.from({ length: 150 }, (_, i) => `Gift ${i}`).join("\n");
    expect(parseBulk(many)).toHaveLength(100);
    expect(parseBulk("x".repeat(500))[0].name).toHaveLength(200);
  });

  it("numbers gifts in paste order for the preview", () => {
    expect(parseBulk("A\n\nB\nC").map((g) => g.index)).toEqual([0, 1, 2]);
  });

  it("flags likely headings in a bulleted paste, and only there", () => {
    const gifts = parseBulk("Music Stuff\n- Drum machine\n- Mic, under $150\nClothes\n- Boxers, size M");
    expect(gifts.filter((g) => g.likelyHeading).map((g) => g.name)).toEqual(["Music Stuff", "Clothes"]);
    expect(parseBulk("Socks\nHat\nScarf").some((g) => g.likelyHeading)).toBe(false);
  });
});
