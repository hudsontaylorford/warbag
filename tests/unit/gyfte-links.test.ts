import { describe, expect, it } from "vitest";
import { cleanLink, nameFromLink, parseLink, storeName } from "@/lib/gyfte/links";

const amazon =
  "https://www.amazon.com/STONEWARE-Stone-Coasters-Set-Four/dp/B000000001/ref=sims_dp_d_dex_ai_rank_model_1/138-0000000-0000000?pd_rd_w=abc&content-id=amzn1.sym.x&pf_rd_p=x&th=1";
const jcrew =
  "https://www.jcrew.com/p/mens/categories/clothing/sweaters/cotton-rollneck-sweater/AB123?color_name=navy&N=ONE%20SIZE&noPopUp=true&srcCode=Paid_Search|Shopping&utm_source=Google&gclid=abc";
const shop = "https://shop.example.com/products/diffuser-plus?variant=1234567&utm_medium=product_sync&gad_source=1";

describe("gift links", () => {
  it("shrinks Amazon product links to /dp/<id>", () => {
    expect(cleanLink(amazon)).toBe("https://www.amazon.com/dp/B000000001");
  });

  it("strips tracking but keeps product options", () => {
    const out = cleanLink(jcrew);
    expect(out).toContain("color_name=navy");
    expect(out).not.toMatch(/utm_|gclid|srcCode|noPopUp/i);
    expect(cleanLink(shop)).toBe("https://shop.example.com/products/diffuser-plus?variant=1234567");
  });

  it("names the store", () => {
    expect(storeName(amazon)).toBe("Amazon");
    expect(storeName(jcrew)).toBe("J.Crew");
    expect(storeName("https://williamellery.co/products/socks")).toBe("williamellery.co");
  });

  it("guesses a readable name from the link", () => {
    expect(nameFromLink(amazon)).toBe("Stoneware Stone Coasters Set Four");
    expect(nameFromLink(jcrew)).toBe("Cotton Rollneck Sweater");
    expect(nameFromLink(shop)).toBe("Diffuser Plus");
    expect(nameFromLink("https://a.co/d/EXAMPLE1")).toBe("Something from Amazon");
  });

  it("tells links from plain names", () => {
    expect(parseLink("Pearl earrings")).toBeNull();
    expect(parseLink("javascript:alert(1)")).toBeNull();
    expect(parseLink("etsy.com/listing/123/vintage-quilt")?.hostname).toBe("etsy.com");
    expect(cleanLink("Pearl earrings")).toBe("Pearl earrings");
  });
});
