import { NextResponse, type NextRequest } from "next/server";
import { KiskError, loadFromKisk } from "@/lib/kisk/source";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const region = p.get("region"), server = p.get("server"), name = p.get("name");
  if (!region || !server || !name) return NextResponse.json({ error: "region, server und name fehlen" }, { status: 400 });
  try {
    const char = await loadFromKisk(region, server, name);
    if (!char.gear.length && !char.arcana.length) return NextResponse.json({ error: "Keine Ausrüstung auf kisk.app erkannt" }, { status: 422 });
    return NextResponse.json(char);
  } catch (e) {
    const status = e instanceof KiskError ? e.status : 502;
    return NextResponse.json({ error: e instanceof Error ? e.message : "kisk.app nicht erreichbar" }, { status: status >= 400 ? status : 502 });
  }
}
