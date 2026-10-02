import { ViteReactSSG } from "vite-react-ssg";
import { routes } from "./routes.jsx";
import "./index.css";

// vite-react-ssg entry: it prerenders each route (including every exam page via
// getStaticPaths) to static HTML at build time and hydrates on the client. `basename`
// matches the /examsnap/ subfolder the app is served under.
export const createRoot = ViteReactSSG({ routes, basename: "/examsnap" });
