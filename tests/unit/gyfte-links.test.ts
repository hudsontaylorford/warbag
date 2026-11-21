import { describe, expect, it } from "vitest";
import { cleanLink, nameFromLink, parseLink, storeName } from "@/lib/gyfte/links";

const amazon =
  "https://www.amazon.com/YONGHEE-Travertine-Coasters-Farmhouse-Housewarming/dp/B0DTK92MHP/ref=sims_dp_d_dex_ai_rank_model_1_d_v1_d_sccl_3_2/138-5105278-4031718?pd_rd_w=pCJ0X&content-id=amzn1.sym.da0b&pf_rd_p=da0b&th=1";
const jcrew =
  "https://www.jcrew.com/p/womens/categories/accessories/bags/berkeley/berkeley-big-bucket-bag-in-leather/CM931?color_name=warmed-walnut&N=ONE%20SIZE&noPopUp=true&srcCode=Paid_Search|Shopping&utm_source=Google&gclid=abc";
const pura = "https://pura.com/products/pura-plus?variant=41779671367789&utm_medium=product_sync&gad_source=1";

describe("gift links", () => {
  it("shrinks Amazon product links to /dp/<id>", () => {
    expect(cleanLink(amazon)).toBe("https://www.amazon.com/dp/B0DTK92MHP");
  });

  it("strips tracking but keeps product options", () => {
    const out = cleanLink(jcrew);
    expect(out).toContain("color_name=warmed-walnut");
    expect(out).not.toMatch(/utm_|gclid|srcCode|noPopUp/i);
    expect(cleanLink(pura)).toBe("https://pura.com/products/pura-plus?variant=41779671367789");
  });

  it("names the store", () => {
    expect(storeName(amazon)).toBe("Amazon");
    expect(storeName(jcrew)).toBe("J.Crew");
    expect(storeName("https://williamellery.co/products/socks")).toBe("williamellery.co");
  });

  it("guesses a readable name from the link", () => {
    expect(nameFromLink(amazon)).toBe("YONGHEE Travertine Coasters Farmhouse Housewarming".replace("YONGHEE", "Yonghee"));
    expect(nameFromLink(jcrew)).toBe("Berkeley Big Bucket Bag In Leather");
    expect(nameFromLink(pura)).toBe("Pura Plus");
    expect(nameFromLink("https://a.co/d/76O65Vt")).toBe("Something from Amazon");
  });

  it("tells links from plain names", () => {
    expect(parseLink("Pearl earrings")).toBeNull();
    expect(parseLink("javascript:alert(1)")).toBeNull();
    expect(parseLink("etsy.com/listing/123/vintage-quilt")?.hostname).toBe("etsy.com");
    expect(cleanLink("Pearl earrings")).toBe("Pearl earrings");
  });
});
