# Tafara Chikuku — Portfolio

Personal portfolio website of **Tafara Chikuku**, Electrical Engineer (Harare, Zimbabwe).
**Live at https://tafara-tifah.github.io/**

**How it works:** all content lives in the [`vault/`](vault/) folder — an **Obsidian vault** of Markdown notes that doubles as the site's database. The website (`index.html` + `js/main.js`) reads those notes and renders them. Only the owner of this GitHub account can change content; visitors get a read-only published site.

**Design:** see-through royal-blue glass panels with bright white, gold and sky-blue text, floating over a mountain landscape that deepens from light blue at the top of the page to navy at the bottom as you scroll.

```
├── index.html            ← the website
├── css/style.css         ← styling (colours are the variables at the top)
├── js/main.js            ← reads the vault and renders the page; drives the scroll effects
├── img/
│   ├── brand-stylehive.png  ← Style Hive badge used in the menu bar and browser tab
│   └── scene/            ← the Mount Cook ink sketch (shows while the background photo loads)
├── vault/                ← ★ THE CONTENT DATABASE (open this folder in Obsidian)
│   ├── profile.md        ← name, title, about me, social links, photo, background
│   ├── skills.md         ← skills section
│   ├── achievements.md   ← achievements section
│   ├── education.md      ← education & certifications
│   ├── references.md     ← referees with LinkedIn links
│   ├── career/           ← one note per job (timeline)
│   ├── projects/         ← one note per project (cards)
│   ├── assets/images/    ← your photos, logos and the background landscape
│   └── manifest.json     ← auto-generated list of notes (don't edit by hand)
├── scripts/
│   ├── build-manifest.mjs   ← regenerates manifest.json
│   └── gen-mountains.mjs    ← redraws the Mount Cook sketch in img/scene/
└── .github/workflows/deploy.yml ← auto-deploys to GitHub Pages on every push
```

## ✏️ Editing your site (the owner workflow)

1. Open the `vault/` folder in **Obsidian** (Open folder as vault) — or edit the `.md` files directly on GitHub.
2. Change any note: your bio in `profile.md`, bullet points in a job, a new achievement, etc.
3. Commit & push (or click "Commit changes" on GitHub). GitHub Actions rebuilds and republishes the site automatically in ~1 minute.

### Add a new project
Create a new note in `vault/projects/`, e.g. `my-new-project.md`:

```markdown
---
title: My New Project
period: 2026
tags: Automation, PLC
image: vault/assets/images/my-new-project.jpg
order: 4
---

One-paragraph summary of the project.

- Key contribution 1
- Key contribution 2
```

Drop the picture into `vault/assets/images/`, push, done — the deploy workflow rebuilds `manifest.json` automatically so the new note appears.

### Add a new job to the career timeline
Same idea: add a note to `vault/career/` with `company`, `role`, `period`, `location`, and `order` in the frontmatter. Add `logo:` with an image path to show the company logo (several logos separated by commas).

### Update social links, photo or background
Edit the frontmatter at the top of `vault/profile.md`:
- `linkedin:`, `facebook:`, `whatsapp:` — social buttons (a button hides itself if its line is removed)
- `photo:` — your portrait
- `background:` — the landscape behind the page. Any photo works: it is recoloured into the site's blues automatically. Remove the line to show the Mount Cook sketch instead.

## 🖥️ Preview locally

Browsers block `fetch()` on pages opened from disk, so run a tiny server:

```bash
npx serve .
# then open http://localhost:3000
```

## 🚀 Publishing

The repository is named `<username>.github.io`, which makes GitHub Pages serve it at the root address `https://<username>.github.io/` (Settings → Pages → Source: GitHub Actions). Every push to `main` republishes the site in about a minute.

To change the address to `https://tafarachikuku.github.io/`: rename the GitHub account to `tafarachikuku` (Settings → Account → Change username), then rename this repository to `tafarachikuku.github.io`.
