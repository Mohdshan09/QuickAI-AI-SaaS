import { lazy, Suspense } from "react";
import { ClientOnly } from "vite-react-ssg";

// The interactive tool (crop + engine + worker + react-easy-crop) is client-only and needs
// no SEO, so we render it only in the browser and load it as a separate chunk. This keeps
// the prerendered exam pages pure HTML and the initial JS bundle small.
const ToolFlow = lazy(() => import("./ToolFlow.jsx"));

export default function ClientToolFlow(props) {
  return (
    <ClientOnly>
      {() => (
        <Suspense fallback={<p className="py-10 text-center text-slate-500">Loading tool…</p>}>
          <ToolFlow {...props} />
        </Suspense>
      )}
    </ClientOnly>
  );
}
