import { Head } from "vite-react-ssg";
import { localePath, useLocale } from "../i18n/index.jsx";
import { siteUrl } from "../lib/site.js";

// Per-page metadata. `path` is the locale-neutral app route ("/" for home); the canonical,
// og:url and hreflang alternates are derived from the build-time SITE_URL plus the active
// language, so the English page, the Hindi page and the sitemap always point at each other.
// `jsonLd` takes one object or an array of objects.

const SITE_NAME = "ExamSnap by Quick AI";

export default function Seo({
  title,
  description,
  path = "/",
  type = "website",
  image = "/og-image.png",
  jsonLd,
}) {
  const { lang } = useLocale();
  const enUrl = siteUrl(path);
  const hiUrl = siteUrl(localePath("hi", path));
  const url = lang === "hi" ? hiUrl : enUrl;
  const imageUrl = siteUrl(image);

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <link rel="alternate" hrefLang="en-IN" href={enUrl} />
      <link rel="alternate" hrefLang="hi-IN" href={hiUrl} />
      <link rel="alternate" hrefLang="x-default" href={enUrl} />

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:locale" content={lang === "hi" ? "hi_IN" : "en_IN"} />
      <meta property="og:locale:alternate" content={lang === "hi" ? "en_IN" : "hi_IN"} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />

      {jsonLd ? (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      ) : null}
    </Head>
  );
}
