// Link clean-up for gift items. Pure functions, no network: we never fetch
// the shop's page, we only tidy the address someone pasted.

const TRACKING_PARAMS = [
  /^utm_/i, /^gclid$/i, /^gclsrc$/i, /^gbraid$/i, /^wbraid$/i, /^gad_/i, /^fbclid$/i, /^mc_/i,
  /^ref$/i, /^ref_$/i, /^tag$/i, /^ascsubtag$/i, /^pd_rd_/i, /^pf_rd_/i, /^content-id$/i,
  /^srccode$/i, /^nopopup$/i, /^nb_/i, /^nbt$/i, /^wl\d+$/i, /^adid$/i, /^veh$/i,
  /^wmlspartner$/i, /^selectedsellerid$/i, /^selectiontype$/i, /^sp_/i, /^psc$/i, /^th$/i,
];

const STORES: Record<string, string> = {
  "amazon.com": "Amazon", "a.co": "Amazon", "amzn.to": "Amazon",
  "etsy.com": "Etsy", "ebay.com": "eBay", "reverb.com": "Reverb", "walmart.com": "Walmart",
  "target.com": "Target", "homedepot.com": "Home Depot", "jcrew.com": "J.Crew",
  "cos.com": "COS", "ssense.com": "SSENSE", "mejuri.com": "Mejuri", "llbean.com": "L.L.Bean",
  "costco.com": "Costco", "bestbuy.com": "Best Buy", "apple.com": "Apple", "nike.com": "Nike",
  "patagonia.com": "Patagonia", "rei.com": "REI", "uniqlo.com": "Uniqlo", "madewell.com": "Madewell",
  "anthropologie.com": "Anthropologie", "urbanoutfitters.com": "Urban Outfitters",
  "food52.com": "Food52", "crateandbarrel.com": "Crate & Barrel", "williams-sonoma.com": "Williams Sonoma",
  "sidelineswap.com": "SidelineSwap", "macys.com": "Macy's", "nordstrom.com": "Nordstrom",
};

/** Parses a pasted URL, or null if it isn't a web link. */
export function parseLink(raw: string): URL | null {
  const text = raw.trim();
  if (!/^https?:\/\//i.test(text) && !/^[a-z0-9-]+(\.[a-z0-9-]+)+\/\S*$/i.test(text)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".")) return null;
    return url;
  } catch {
    return null;
  }
}

function baseDomain(host: string): string {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".");
  // shop.example.co.uk is rare here; keep the last two labels.
  return parts.slice(-2).join(".");
}

/**
 * The same link without tracking junk. Amazon product links shrink to
 * amazon.com/dp/<id>. Anything we can't parse comes back unchanged.
 */
export function cleanLink(raw: string): string {
  const url = parseLink(raw);
  if (!url) return raw.trim();
  url.hash = "";
  const domain = baseDomain(url.hostname);

  if (domain === "amazon.com") {
    const asin = url.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i)?.[1];
    if (asin) return `https://www.amazon.com/dp/${asin.toUpperCase()}`;
  }

  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.some((re) => re.test(key))) url.searchParams.delete(key);
  }
  url.protocol = "https:";
  let out = url.toString();
  if (out.endsWith("?")) out = out.slice(0, -1);
  return out;
}

/** "Amazon", "J.Crew", or the bare domain ("williamellery.co") for others. */
export function storeName(link: string): string {
  const url = parseLink(link);
  if (!url) return "";
  const domain = baseDomain(url.hostname);
  return STORES[domain] ?? url.hostname.replace(/^www\./, "");
}

/**
 * A readable name guessed from the link itself, e.g.
 * amazon.com/STONEWARE-Stone-Coasters/dp/B000... -> "Stoneware Stone Coasters".
 * Falls back to "Something from <store>". Always editable afterwards.
 */
export function nameFromLink(link: string): string {
  const url = parseLink(link);
  if (!url) return link.trim().slice(0, 200);
  const segments = url.pathname.split("/").map((s) => decodeURIComponent(s));
  const words = segments
    .filter((s) => /[a-z]{3,}/i.test(s) && /[-_]/.test(s) && !/^\d+$/.test(s))
    .map((s) => s.replace(/\.(html?|php|aspx?)$/i, ""))
    .sort((a, b) => b.length - a.length)[0];
  if (words) {
    const name = words
      .split(/[-_]+/)
      .filter((w) => w && !/^\d+$/.test(w) && !/^[a-z]{0,2}\d+[a-z\d]*$/i.test(w))
      .slice(0, 8)
      .map((w) => (w === w.toUpperCase() && w.length > 1 ? w[0] + w.slice(1).toLowerCase() : w[0].toUpperCase() + w.slice(1)))
      .join(" ");
    if (name.length >= 3) return name.slice(0, 200);
  }
  // Some shops name the product in the query: /product?id=fm-1 -> "FM 1".
  for (const key of ["id", "product", "item", "name", "slug", "p"]) {
    const value = url.searchParams.get(key);
    if (!value || !/[a-z]/i.test(value) || value.length > 60) continue;
    const name = value
      .split(/[-_+\s]+/)
      .filter(Boolean)
      .map((w) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
      .join(" ");
    if (name.length >= 2) return name.slice(0, 200);
  }
  return `Something from ${storeName(link)}`;
}
