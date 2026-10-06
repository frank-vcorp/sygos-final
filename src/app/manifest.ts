import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SYGOS 3.0",
    short_name: "SYGOS",
    description: "Operación de SYSTRON y Servomotores",
    start_url: "/inicio",
    display: "standalone",
    background_color: "#f4f6f5",
    theme_color: "#1f6b4a",
    lang: "es-MX",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
