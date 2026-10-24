interface Member {
  name: string
  school: string
  github: string
  linkedin: string
}

const TEAM: Member[] = [
  {
    name: 'Pratham Saurabh',
    school: 'Georgia Institute of Technology',
    github: 'https://github.com/prathamsaurabh',
    linkedin: 'https://linkedin.com/in/pratham-saurabh',
  },
  {
    name: 'Sarthak Das',
    school: 'Georgia Institute of Technology',
    github: 'https://github.com/Skenix64',
    linkedin: 'https://www.linkedin.com/in/sarthak-das19/',
  },
  {
    name: 'Aaron Luu',
    school: 'Georgia Institute of Technology',
    github: 'https://github.com/gdawerty',
    linkedin: 'https://www.linkedin.com/in/aaron-luu123/',
  },
]

const GitHubIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.17c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
  </svg>
)

const LinkedInIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
  </svg>
)

const initials = (name: string) =>
  name.split(' ').map((p) => p[0]).join('').toUpperCase()

export function AboutUs() {
  return (
    <section className="about">
      <div className="hero">
        <div className="eyebrow">About us</div>
        <h1>Built by three people<br />who like a good mix.</h1>
        <p className="subtitle">
          PromptMix started as a weekend project at Georgia Tech: type a vibe, get a
          beat-matched set of Creative Commons tracks, blended in the browser.
        </p>
      </div>

      <div className="team-grid">
        {TEAM.map((m) => (
          <article key={m.name} className="team-card">
            <div className="avatar">{initials(m.name)}</div>
            <h2 className="member-name">{m.name}</h2>
            <div className="member-school">{m.school}</div>
            <div className="member-links">
              <a className="btn btn-outline btn-icon" href={m.github} target="_blank" rel="noreferrer">
                <GitHubIcon /> GitHub
              </a>
              <a className="btn btn-outline btn-icon" href={m.linkedin} target="_blank" rel="noreferrer">
                <LinkedInIcon /> LinkedIn
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
