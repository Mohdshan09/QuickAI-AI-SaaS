import { ViteReactSSG } from "vite-react-ssg";
import { routes } from "./routes.jsx";
import "./index.css";

// vite-react-ssg entry: it prerenders each route (including every exam page via
// getStaticPaths) to static HTML at build time and hydrates on the client. `basename` is the
// Vite base without its trailing slash, so routes work both at a domain root and in a
// subfolder (see scripts/site.mjs).
const basename = (import.meta.env.BASE_URL || "/").replace(/\/$/, "") || "/";
export const createRoot = ViteReactSSG({ routes, basename });
