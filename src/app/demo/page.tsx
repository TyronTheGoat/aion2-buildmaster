import { CharacterView } from "@/components/CharacterView";
import { FLORENTINA } from "@/lib/fixtures/florentina";

export const metadata = { title: "Demo: Florentina · Aion 2 BuildMaster" };

export default function Demo() {
  return <CharacterView char={FLORENTINA} />;
}
