import type { MetadataRoute } from "next";

/**
 * PWA web-app manifest — makes Beagle Classroom installable on the phone
 * home screen (students are 95%+ mobile). Install-only scope: no service
 * worker / offline layer yet, matching the roadmap's "PWA install
 * activate" item. Colors follow Calm Ledger's off-white surface.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Beagle Classroom",
    short_name: "Beagle",
    description:
      "ระบบจัดการห้องเรียน — คะแนน เช็คชื่อ การบ้าน และข่าวสารในที่เดียว",
    lang: "th",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F5F5F5",
    theme_color: "#F5F5F5",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
