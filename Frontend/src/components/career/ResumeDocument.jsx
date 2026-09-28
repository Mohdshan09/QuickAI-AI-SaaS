// Deterministic resume renderer — the single source of layout for both the
// tailor preview and the printed PDF. The app owns all formatting; the AI only
// supplies content. URLs render as clickable labeled links (never raw), skills
// are grouped, and page breaks are controlled on small semantic units.
const RESUME_CSS = `
.resume-doc { color: #1f2937; font-family: Georgia, "Times New Roman", serif; line-height: 1.42; overflow-wrap: anywhere; }
.resume-doc a { color: #1d4ed8; text-decoration: none; }
.resume-doc a:hover { text-decoration: underline; }
.resume-doc .rd-name { font-size: 23px; font-weight: 700; margin: 0 0 3px; }
.resume-doc .rd-contact { color: #4b5563; font-size: 12.5px; margin: 0 0 14px; display: flex; flex-wrap: wrap; gap: 4px 10px; }
.resume-doc .rd-sec { font-size: 12px; letter-spacing: .11em; text-transform: uppercase; color: #111827;
  border-bottom: 1px solid #d1d5db; padding-bottom: 3px; margin: 18px 0 8px; font-weight: 700; }
.resume-doc .rd-item { margin-bottom: 11px; break-inside: avoid; page-break-inside: avoid; }
.resume-doc .rd-head { break-inside: avoid; page-break-inside: avoid; }
.resume-doc .rd-row { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
.resume-doc .rd-title { font-size: 14px; font-weight: 700; }
.resume-doc .rd-sub { font-weight: 400; color: #374151; }
.resume-doc .rd-meta { font-size: 12.5px; color: #4b5563; font-style: italic; }
.resume-doc .rd-tech { font-size: 12px; color: #4b5563; margin: 1px 0 2px; }
.resume-doc .rd-dates { font-size: 12px; color: #6b7280; white-space: nowrap; }
.resume-doc .rd-links { font-size: 12px; display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 1px; }
.resume-doc ul { margin: 4px 0 0; padding-left: 18px; }
.resume-doc li { font-size: 13px; margin-bottom: 3px; break-inside: avoid; page-break-inside: avoid; }
.resume-doc .rd-summary { font-size: 13px; margin: 0; }
.resume-doc .rd-skill-line { font-size: 13px; margin: 2px 0; }
.resume-doc .rd-skill-group { font-weight: 700; }
.resume-doc .rd-line { font-size: 13px; margin: 2px 0; }
`;

const Link = ({ link }) =>
  link && link.url ? (
    <a href={link.url} target="_blank" rel="noreferrer">
      {link.label || "Link"}
    </a>
  ) : null;

const Links = ({ links }) =>
  Array.isArray(links) && links.filter((l) => l && l.url).length ? (
    <span className="rd-links">
      {links
        .filter((l) => l && l.url)
        .map((l, i) => (
          <Link key={i} link={l} />
        ))}
    </span>
  ) : null;

const Bullets = ({ bullets }) =>
  bullets && bullets.length ? (
    <ul>
      {bullets.map((b) => (
        <li key={b.id || b.text}>{b.text}</li>
      ))}
    </ul>
  ) : null;

const ResumeDocument = ({ resume }) => {
  if (!resume) return null;
  const p = resume.personal || {};
  const has = (a) => Array.isArray(a) && a.length > 0;
  const contact = [
    p.email && (
      <a key="e" href={`mailto:${p.email}`}>
        {p.email}
      </a>
    ),
    p.phone && (
      <a key="p" href={`tel:${String(p.phone).replace(/\s+/g, "")}`}>
        {p.phone}
      </a>
    ),
    p.location && <span key="l">{p.location}</span>,
    ...(Array.isArray(p.links) ? p.links.filter((l) => l && l.url) : []).map((l, i) => (
      <Link key={`ln-${i}`} link={l} />
    )),
  ].filter(Boolean);

  return (
    <div className="resume-doc">
      <style>{RESUME_CSS}</style>

      {(p.name || contact.length > 0) && (
        <header className="rd-head">
          {p.name && <h1 className="rd-name">{p.name}</h1>}
          {contact.length > 0 && <div className="rd-contact">{contact}</div>}
        </header>
      )}

      {resume.summary && (
        <section>
          <h2 className="rd-sec">Summary</h2>
          <p className="rd-summary">{resume.summary}</p>
        </section>
      )}

      {has(resume.experience) && (
        <section>
          <h2 className="rd-sec">Experience</h2>
          {resume.experience.map((e) => (
            <div className="rd-item" key={e.id}>
              <div className="rd-head">
                <div className="rd-row">
                  <span className="rd-title">
                    {e.role}
                    {e.role && e.company ? " · " : ""}
                    <span className="rd-sub">{e.company}</span>
                  </span>
                  {e.dates && <span className="rd-dates">{e.dates}</span>}
                </div>
                {e.location && <div className="rd-meta">{e.location}</div>}
                {e.tech && <div className="rd-tech">{e.tech}</div>}
              </div>
              <Bullets bullets={e.bullets} />
            </div>
          ))}
        </section>
      )}

      {has(resume.projects) && (
        <section>
          <h2 className="rd-sec">Projects</h2>
          {resume.projects.map((pr) => (
            <div className="rd-item" key={pr.id}>
              <div className="rd-head">
                <div className="rd-row">
                  <span className="rd-title">{pr.name}</span>
                  {pr.dates && <span className="rd-dates">{pr.dates}</span>}
                </div>
                {pr.meta && <div className="rd-meta">{pr.meta}</div>}
                {pr.tech && <div className="rd-tech">{pr.tech}</div>}
                <Links links={pr.links} />
              </div>
              <Bullets bullets={pr.bullets} />
            </div>
          ))}
        </section>
      )}

      {has(resume.skills) && (
        <section>
          <h2 className="rd-sec">Skills</h2>
          {resume.skills.map((g, i) => (
            <p className="rd-skill-line" key={i}>
              {g.group && g.group !== "Skills" && (
                <span className="rd-skill-group">{g.group}: </span>
              )}
              {(g.items || []).join(" · ")}
            </p>
          ))}
        </section>
      )}

      {has(resume.education) && (
        <section>
          <h2 className="rd-sec">Education</h2>
          {resume.education.map((ed) => (
            <div className="rd-item" key={ed.id}>
              <div className="rd-row">
                <span className="rd-title">
                  {ed.degree}
                  {ed.degree && ed.institution ? " · " : ""}
                  <span className="rd-sub">{ed.institution}</span>
                </span>
                {ed.dates && <span className="rd-dates">{ed.dates}</span>}
              </div>
              {ed.details && <div className="rd-meta">{ed.details}</div>}
              {ed.text && <div className="rd-line">{ed.text}</div>}
            </div>
          ))}
        </section>
      )}

      {has(resume.certifications) && (
        <section>
          <h2 className="rd-sec">Certifications</h2>
          {resume.certifications.map((c) => (
            <p className="rd-line" key={c.id}>
              {c.name || c.text}
              {c.issuer ? ` — ${c.issuer}` : ""}
              {c.date ? `, ${c.date}` : ""}
              {c.link && c.link.url ? <> · <Link link={c.link} /></> : null}
            </p>
          ))}
        </section>
      )}

      {has(resume.publications) && (
        <section>
          <h2 className="rd-sec">Publications</h2>
          {resume.publications.map((pub) => (
            <p className="rd-line" key={pub.id}>
              {pub.title}
              {pub.venue ? ` — ${pub.venue}` : ""}
              {pub.date ? `, ${pub.date}` : ""}
              {pub.link && pub.link.url ? <> · <Link link={pub.link} /></> : null}
            </p>
          ))}
        </section>
      )}

      {has(resume.other) &&
        resume.other.map((o) => (
          <section key={o.id}>
            <h2 className="rd-sec">{o.heading || "More"}</h2>
            {(o.lines || []).map((l, i) => (
              <p className="rd-line" key={i}>
                {l}
              </p>
            ))}
          </section>
        ))}
    </div>
  );
};

export default ResumeDocument;
