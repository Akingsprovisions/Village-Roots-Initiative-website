# Village Roots — Community Research Agent

This is the deployable version of the "Plant a Seed" research tool: a
directory-first program finder for Village Roots Youth Initiative.

## How it works

1. A family enters a city/region, an interest category, and an age.
2. The app checks the **vetted directory** first — `src/directory.json`,
   221 real, researched program entries across all 20 target markets. This
   match happens instantly in the browser, for free, with no API call.
3. Only if the directory has **no match** for that region + category + age
   does the app fall back to a **live web search**, run through the
   `search-programs` Netlify function. Live results are clearly labeled
   "not yet phone-verified" in the UI so families can tell the difference.

This directory-first design is intentional: it's fast, it costs nothing for
the common case, and it only calls out to a live AI web search when the
vetted data genuinely doesn't have an answer yet.

## Project structure

```
village-roots-site/
├── index.html
├── package.json
├── vite.config.js
├── netlify.toml
├── src/
│   ├── main.jsx            # React entry point
│   ├── ResearchAgent.jsx    # the tool itself (directory-first + live fallback)
│   └── directory.json       # the vetted directory data (221 entries, 20 regions)
└── netlify/
    └── functions/
        └── search-programs.js   # server-side proxy to the Anthropic API (live fallback only)
```

## Local development

```bash
npm install
npm run dev
```

This starts the Vite dev server for the frontend. The live-search fallback
function won't work with plain `npm run dev` because it needs Netlify's
function runtime — for that, install the Netlify CLI and run:

```bash
npm install -g netlify-cli
netlify dev
```

`netlify dev` runs the Vite frontend AND the Netlify function together, and
reads environment variables from Netlify (or a local `.env` file — see
below) so the live-search fallback works locally too.

## Deploying to Netlify

1. **Push this project to a Git repo** (GitHub, GitLab, or Bitbucket).
2. In Netlify, choose **Add new site → Import an existing project** and
   connect that repo. Netlify will read `netlify.toml` automatically, so
   the build command (`npm run build`), publish directory (`dist`), and
   functions directory (`netlify/functions`) are already configured.
3. **Set the API key** — this is the one manual step required before live
   search will work:
   - Go to **Site settings → Environment variables**
   - Add a variable named `ANTHROPIC_API_KEY` with your Anthropic API key
     as the value
   - Redeploy (or trigger a new deploy) after adding it
4. Deploy. Netlify will build the site and deploy the function together.

**Important:** the API key must ONLY ever be set as this environment
variable, never written into any file in the repo. The whole point of the
`search-programs.js` function is that it's the one place the key is used,
server-side — the browser never sees it. If a key is ever pasted into
frontend code, request headers, or committed to Git, treat it as
compromised and rotate it immediately in the Anthropic Console.

## Updating the vetted directory

`src/directory.json` is a static file — to add, correct, or remove
programs, edit that file (or regenerate it from source data) and redeploy.
There's no database or admin UI wired up yet; that would be a reasonable
next step once the directory needs to be edited more often than a code
deploy allows.

## Known data gaps (as of this build)

Two regions have incomplete category coverage because the research process
hit a web-search budget limit before finishing every category:

- **Fresno – Clovis, CA** — missing Mentorship and Mindfulness entries
- **Myrtle Beach – Conway, SC** — missing Mentorship and Mindfulness entries

Families searching those two regions in those two categories will
currently fall through to live search rather than finding a directory
match. Re-running research for just those two region/category
combinations would close the gap — flag this if/when you want that done.

## Things still worth deciding

- **West Palm Beach vs. Treasure Coast overlap** — these two target
  markets share some geography; worth confirming the intended service-area
  boundary so a family near the edge gets consistent results either way.
- **Collecting a child's age/email from a minor visitor** — if teens are
  expected to use "I'm searching for myself" directly (rather than a
  parent), it's worth reviewing what data the form should and shouldn't
  retain, given COPPA applies to children under 13.
- **Category taxonomy** — the directory and this tool both use the six
  categories baked into `ResearchAgent.jsx` (Mindfulness, Arts, Sports,
  Outdoor exploration, Mentorship, Practical life skills). If the public
  intake form or any other Village Roots system uses different category
  names, those should be reconciled so a family's intake doesn't map to
  the wrong bucket.
