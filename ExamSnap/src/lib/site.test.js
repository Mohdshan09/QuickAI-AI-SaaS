import { describe, expect, it } from "vitest";
import { BASE, SITE_URL, siteUrl } from "./site.js";

describe("siteUrl", () => {
  it("returns the public root without a trailing slash", () => {
    expect(siteUrl()).toBe(SITE_URL);
    expect(siteUrl("/")).toBe(SITE_URL);
    expect(siteUrl("/")).not.toMatch(/\/$/);
  });

  it("mounts app paths directly under the public root", () => {
    const root = siteUrl("/");
    expect(siteUrl("/custom")).toBe(`${root}/custom`);
    expect(siteUrl("check/x")).toBe(`${root}/check/x`);
    expect(siteUrl("/custom/")).toBe(`${root}/custom`);
  });

  it("keeps the deployment subfolder exactly once", () => {
    const folder = BASE.replace(/\/$/, "");
    if (folder) {
      expect(SITE_URL.endsWith(folder)).toBe(true);
      expect(siteUrl("/custom").match(new RegExp(folder, "g"))).toHaveLength(1);
    } else {
      expect(siteUrl("/custom")).toBe(`${SITE_URL}/custom`);
    }
  });

  it("produces absolute https URLs", () => {
    expect(siteUrl("/")).toMatch(/^https:\/\//);
  });
});
