// Deterministic resume renderer — the single source of layout for both the
// tailor preview and the printed PDF. The app owns all formatting; the AI only
// supplies content. Styling is scoped under .resume-doc so it's safe to embed.
const RESUME_CSS = `
.resume-doc { color: #1f2937; font-family: Georgia, "Times New Roman", serif; line-height: 1.42; }
.resume-doc .rd-name { font-size: 23px; font-weight: 700; margin: 0 0 2px; }
.resume-doc .rd-contact { color: #4b5563; font-size: 12.5px; margin: 0 0 14px; }
.resume-doc .rd-sec { font-size: 12px; letter-spacing: .11em; text-transform: uppercase; color: #111827;
  border-bottom: 1px solid #d1d5db; padding-bottom: 3px; margin: 18px 0 8px; font-weight: 700; }
.resume-doc .rd-row { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
.resume-doc .rd-title { font-size: 14px; font-weight: 700; }
.resume-doc .rd-sub { font-size: 13px; color: #374151; }
.resume-doc .rd-dates { font-size: 12px; color: #6b7280; white-space: nowrap; }
.resume-doc ul { margin: 4px 0 8px; padding-left: 18px; }
.resume-doc li { font-size: 13px; margin-bottom: 3px; }
.resume-doc .rd-summary { font-size: 13px; margin: 0; }
.resume-doc .rd-skills { font-size: 13px; }
.resume-doc .rd-line { font-size: 13px; margin: 2px 0; }
.resume-doc .rd-block { margin-bottom: 10px; }
`;

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

  return (
    <div className="resume-doc">
      <style>{RESUME_CSS}</style>

      {(p.name || p.contact) && (
        <header>
          {p.name && <h1 className="rd-name">{p.name}</h1>}
          {p.contact && <p className="rd-contact">{p.contact}</p>}
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
            <div className="rd-block" key={e.id}>
              <div className="rd-row">
                <span className="rd-title">
                  {e.role}
                  {e.role && e.company ? " · " : ""}
                  <span className="rd-sub">{e.company}</span>
                </span>
                {e.dates && <span className="rd-dates">{e.dates}</span>}
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
            <div className="rd-block" key={pr.id}>
              <div className="rd-row">
                <span className="rd-title">{pr.name}</span>
                {pr.dates && <span className="rd-dates">{pr.dates}</span>}
              </div>
              <Bullets bullets={pr.bullets} />
            </div>
          ))}
        </section>
      )}

      {has(resume.skills) && (
        <section>
          <h2 className="rd-sec">Skills</h2>
          <p className="rd-skills">{resume.skills.join(" · ")}</p>
        </section>
      )}

      {has(resume.education) && (
        <section>
          <h2 className="rd-sec">Education</h2>
          {resume.education.map((ed) => (
            <p className="rd-line" key={ed.id}>
              {ed.text}
            </p>
          ))}
        </section>
      )}

      {has(resume.certifications) && (
        <section>
          <h2 className="rd-sec">Certifications</h2>
          {resume.certifications.map((c) => (
            <p className="rd-line" key={c.id}>
              {c.text}
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
