import { describe, expect, it } from "vitest";
import { safeUrl } from "./safeUrl";

describe("safeUrl", () => {
  it("passes through ordinary web URLs", () => {
    expect(safeUrl("https://weber.de")).toBe("https://weber.de/");
    expect(safeUrl("http://weber.de/path?a=1")).toBe("http://weber.de/path?a=1");
  });

  it("upgrades a bare domain to https", () => {
    expect(safeUrl("weber.de")).toBe("https://weber.de/");
  });

  it("rejects script-bearing schemes", () => {
    for (const bad of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "  javascript:alert(1)  ",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
    ]) {
      expect(safeUrl(bad), bad).toBeUndefined();
    }
  });

  it("returns undefined for empty or unparseable input", () => {
    expect(safeUrl(undefined)).toBeUndefined();
    expect(safeUrl("")).toBeUndefined();
    expect(safeUrl("   ")).toBeUndefined();
    expect(safeUrl("http://")).toBeUndefined();
  });
});
