import type { MetadataRoute } from "next";

// Web app manifest — lets the site be "Added to Home Screen" with the right
// name, colours and icon on phones.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "J&N Balloon Sculpting",
    short_name: "J&N Balloons",
    description:
      "Handcrafted balloon arches, garlands and centrepieces delivered across Cambridgeshire.",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF7F2",
    theme_color: "#4A2C4D",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
