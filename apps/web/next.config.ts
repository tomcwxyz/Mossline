import type { NextConfig } from "next";

/**
 * No page may be framed by another site (clickjacking), except a published
 * story's embed view, which is made to be put on other sites.
 */
const EMBED = "/p/:slug/embed";
const nextConfig: NextConfig = {
  transpilePackages: ["@mossline/graph-core"],
  // Link preview pictures read their fonts from disk at run time.
  outputFileTracingIncludes: { "/p/[slug]/opengraph-image": ["./assets/og/**"] },
  async headers() {
    return [
      { source: "/((?!p/[^/]+/embed).*)", headers: [
        { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" }
      ] },
      { source: "/:path*", headers: [{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }] },
      { source: EMBED, headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }] }
    ];
  }
};
export default nextConfig;
