import { countryFillColor, getVisitCount, getCountryGeoStyle, VISIT_CAP } from "./mapStyle";

function feature(name: string, isoA3: string) {
  return { properties: { name, "ISO3166-1-Alpha-3": isoA3 } };
}

describe("countryFillColor", () => {
  it("is near-white pink at zero intensity", () => {
    expect(countryFillColor(0)).toBe("hsl(356, 80%, 85%)");
  });

  it("is deep vivid red at full intensity", () => {
    expect(countryFillColor(1)).toBe("hsl(356, 90%, 35%)");
  });

  it("darkens and saturates monotonically as intensity rises", () => {
    const low = countryFillColor(0.2);
    const high = countryFillColor(0.8);
    const parse = (hsl: string) => hsl.match(/hsl\(356, ([\d.]+)%, ([\d.]+)%\)/)!.slice(1).map(Number);
    const [satLow, lightLow] = parse(low);
    const [satHigh, lightHigh] = parse(high);
    expect(satHigh).toBeGreaterThan(satLow);
    expect(lightHigh).toBeLessThan(lightLow);
  });
});

describe("getVisitCount", () => {
  it("matches by name when present", () => {
    const visited = new Map([["Japan", 3]]);
    expect(getVisitCount(feature("Japan", "JPN"), visited)).toBe(3);
  });

  it("falls back to ISO alpha-3 when the name doesn't match", () => {
    const visited = new Map([["JPN", 3]]);
    expect(getVisitCount(feature("日本", "JPN"), visited)).toBe(3);
  });

  it("returns 0 for a country with no posts", () => {
    const visited = new Map([["Japan", 3]]);
    expect(getVisitCount(feature("France", "FRA"), visited)).toBe(0);
  });

  it("returns 0 when the feature is undefined", () => {
    expect(getVisitCount(undefined, new Map())).toBe(0);
  });
});

describe("getCountryGeoStyle", () => {
  it("renders an unvisited country fully transparent and non-interactive-looking", () => {
    const style = getCountryGeoStyle(feature("France", "FRA"), new Map());
    expect(style).toEqual({
      fillColor: "transparent",
      weight: 0,
      opacity: 0,
      color: "#e63946",
      fillOpacity: 0,
    });
  });

  it("renders a visited country with the brand outline and a non-zero fill", () => {
    const visited = new Map([["Japan", 3]]);
    const style = getCountryGeoStyle(feature("Japan", "JPN"), visited);
    expect(style.weight).toBe(1.5);
    expect(style.opacity).toBe(0.7);
    expect(style.fillOpacity).toBe(0.5);
    expect(style.fillColor).not.toBe("transparent");
  });

  it("gives a country at the visit cap the same intensity as one far beyond it", () => {
    // Regression check for the log-scale-against-a-fixed-cap design: the
    // home-base outlier (e.g. hundreds of posts) must not visually swamp
    // every other visited country by comparison.
    const atCap = getCountryGeoStyle(feature("China", "CHN"), new Map([["China", VISIT_CAP]]));
    const wayOverCap = getCountryGeoStyle(feature("Taiwan", "TWN"), new Map([["Taiwan", VISIT_CAP * 10]]));
    expect(atCap.fillColor).toBe(wayOverCap.fillColor);
  });

  it("gives a country with more visits a visibly darker fill than one with fewer", () => {
    const few = getCountryGeoStyle(feature("A", "AAA"), new Map([["A", 1]]));
    const many = getCountryGeoStyle(feature("B", "BBB"), new Map([["B", 20]]));
    const lightness = (hsl: string) => Number(hsl.match(/([\d.]+)%\)$/)![1]);
    expect(lightness(many.fillColor)).toBeLessThan(lightness(few.fillColor));
  });
});
