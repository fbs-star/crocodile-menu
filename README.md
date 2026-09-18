# Crocodile Bar & Grill — Menu Site

A real, multi-language restaurant menu website with an admin panel, built the
same way as the existing Marisa Menu site (Node.js + Express, deployed on
Render).

## What's included

- **Public site** (`/`): full-screen hero with a 5-language switcher (EN /
  TH / RU / ZH / AR), then "Food Menu", "Drinks Menu" and "Promotion" pages
  with a category sidebar, item cards, tags, and prices.
- **Admin panel** (`/admin`): categories, menu items, promotions, and home
  screen settings — all editable per language, with photo upload or a pasted
  image URL. Includes a CSV bulk-import tool for adding a full menu at once.

No menu items, prices, or dishes have been invented — the site ships with
empty category shells only (Starters, Flame Grill, Burgers, Cocktails, etc.,
all hidden from the public site until filled in). Add real content through
`/admin` or by importing a CSV (see the Import Menu page for the exact
column format).

## Running locally

```
npm install
npm run seed   # creates data/db.json on first run only
npm start
```

Visit http://localhost:3000, and http://localhost:3000/admin for the admin
panel.

Default admin login (change this before going live — see below):
- Username: `admin`
- Password: `crocodile2026`

## Configuration (environment variables)

| Variable | Purpose | Default |
|---|---|---|
| `ADMIN_USER` | Admin panel username | `admin` |
| `ADMIN_PASS` | Admin panel password | `crocodile2026` |
| `SESSION_SECRET` | Cookie signing secret | a built-in dev value — set a real one in production |
| `PORT` | Port to listen on | `3000` (Render sets this automatically) |

## Deploying on Render

This mirrors the Marisa Menu service exactly:
- **Runtime:** Node
- **Build command:** `npm install && npm run seed`
- **Start command:** `npm start`
- Set `ADMIN_USER`, `ADMIN_PASS`, and `SESSION_SECRET` as environment
  variables in the Render dashboard before going live.

## A note on data persistence

Like Marisa Menu, this site stores its data in a single file
(`data/db.json`) rather than a separate database, and that file is not
committed to git. That keeps things simple, but it means: content you add
through `/admin` lives on the running server and survives restarts, but a
fresh deploy (a new code push) starts from the empty seed again. If you'd
like real menu content to survive every future deploy no matter what, the
next step is moving this to a proper Render Postgres database — happy to do
that whenever you're ready.
