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
      "Oil diffuser https://shop.example.com/products/diffuser-plus?utm_source=x\nhttps://www.amazon.com/Stone-Coasters/dp/B000000001/ref=x",
    );
    expect(a).toMatchObject({ name: "Oil diffuser", links: ["https://shop.example.com/products/diffuser-plus"] });
    expect(b).toMatchObject({ name: "Stone Coasters", links: ["https://www.amazon.com/dp/B000000001"] });
  });

  it("pulls out prices, sizes and colors", () => {
    expect(parseBulk("Soccer jersey - under $30 (size 6-7)")[0]).toMatchObject({
      name: "Soccer jersey",
      price: "under $30",
      size: "6-7",
    });
    expect(parseBulk("Chelsea boots, color: dark brown, size 9.5, $200")[0]).toMatchObject({
      name: "Chelsea boots",
      color: "dark brown",
      size: "9.5",
      price: "$200",
    });
  });

  it("reads rows pasted from a sheet with the family sheet's columns", () => {
    const sheet = [
      "Gift / Idea\tDescription\tSize\tColor\tLocation\tOther",
      "2025",
      "A big canvas tote\t\tLarge\tOlive\tAny shop is fine, not picky on the brand\t",
      "Steel water bottle\t\t24oz\tYellow\thttps://shop.example.com/products/bottle?variant=1&gclid=abc\t",
      "Keyboard - under $30\thttps://a.co/d/EXAMPLE1\t\t\t\t",
    ].join("\n");
    const gifts = parseBulk(sheet);
    expect(gifts.map((g) => g.name)).toEqual(["A big canvas tote", "Steel water bottle", "Keyboard"]);
    expect(gifts[0]).toMatchObject({ size: "Large", color: "Olive", notes: expect.stringContaining("not picky") });
    expect(gifts[1]).toMatchObject({ size: "24oz", color: "Yellow", links: ["https://shop.example.com/products/bottle?variant=1"] });
    expect(gifts[2]).toMatchObject({ price: "under $30", links: ["https://a.co/d/EXAMPLE1"] });
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

  it("doesn't read the word color in a name as a color", () => {
    expect(parseBulk("color film camera")[0]).toMatchObject({ name: "color film camera", color: "" });
  });

  it("flags likely headings in a bulleted paste, and only there", () => {
    const gifts = parseBulk("Music Stuff\n- Drum machine\n- Mic, under $150\nClothes\n- Boxers, size M");
    expect(gifts.filter((g) => g.likelyHeading).map((g) => g.name)).toEqual(["Music Stuff", "Clothes"]);
    expect(parseBulk("Socks\nHat\nScarf").some((g) => g.likelyHeading)).toBe(false);
  });
});
