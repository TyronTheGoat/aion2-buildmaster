import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aion 2 BuildMaster",
    short_name: "BuildMaster",
    description: "Gear bewerten und Upgrade-Pfad für Aion 2",
    start_url: "/",
    display: "standalone",
    background_color: "#03070f",
    theme_color: "#03070f",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
