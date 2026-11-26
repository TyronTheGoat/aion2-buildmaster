import { describe, expect, it } from "vitest";
import { noteTopics, parsePatchNote } from "../patch-notes";

const body = `[img src="https://fizz-download.playnccdn.com/x"][p][b]Hello, this is AION 2.[/b] [/p][h2][b]\\[Content & Systems] [/b][/h2][h3]Stigma[/h3][list][*][p]Up to 5 Stigma Skills. [/p][list][*][p]50 shards[/p][/*][/list][/*][/list][h3]​Ranger[/h3][table][tr][th][p][b]Skill Name[/b][/p][/th][th][p]Changes[/p][/th][/tr][tr][td][p]Marking Shot[/p][p]Gale Arrow[/p][/td][td][p]Better.[/p][/td][/tr][/table][p][weapon/Wings/Pet] stays text[/p]`;

describe("patch notes", () => {
  const b = parsePatchNote(body);
  it("turns BBCode into blocks", () => {
    expect(b[0]).toEqual({ t: "img", src: "https://fizz-download.playnccdn.com/x" });
    expect(b).toContainEqual({ t: "h", level: 2, text: "[Content & Systems]" });
    expect(b).toContainEqual({ t: "li", depth: 2, text: "50 shards" });
    expect(b).toContainEqual({ t: "p", text: "[weapon/Wings/Pet] stays text" });
  });
  it("marks skill tables with their class", () => {
    const tbl = b.find((x) => x.t === "table");
    expect(tbl).toMatchObject({ cls: "Ranger", rows: [{ head: true, cells: ["Skill Name", "Changes"] }, { head: false, cells: ["Marking Shot\nGale Arrow", "Better."] }] });
  });
  it("lists the main topics", () => expect(noteTopics(b)).toEqual(["Content & Systems"]));
});
