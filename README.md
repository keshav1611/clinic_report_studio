# Clinic Report Studio

A private, static web app for creating laryngoscopy reports in a clinic browser.

## Features

- Patient profiles stored locally in the browser with IndexedDB
- Report findings for common laryngoscopy sections
- Up to four report images per patient
- A4 report preview
- Browser print flow for saving the report as PDF
- No backend and no cloud patient database by default

## Run Locally

Use any static file server from this folder:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Deploy

This app is static and standalone. It can be deployed on GitHub Pages, Cloudflare Pages, Netlify, or Vercel. The repository includes a GitHub Pages workflow at:

```text
.github/workflows/deploy.yml
```

For patient privacy, this first version stores data only in the browser where it
is used. Clearing browser data will delete saved patients.
