import { describe, expect, it } from "vitest";
import { extractPortrait } from "../kisk/html-to-text";

describe("portrait from kisk", () => {
  it("takes the NCSOFT profile image kisk links", () => {
    const html = `<meta property="og:image" content="https://profileimg.plaync.com/game_profile_images/aion2global/images?gameServerKey=2314&amp;charKey=1"/>`;
    expect(extractPortrait(html)).toBe("https://profileimg.plaync.com/game_profile_images/aion2global/images?gameServerKey=2314&charKey=1");
  });
  it("ignores other images", () => {
    expect(extractPortrait(`<img src="https://example.com/a.png">`)).toBeUndefined();
  });
});
