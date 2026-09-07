# PITCOMS Academy — pitcoms.com

Source for the pitcoms.com website, deployed via GitHub Pages and edited
through a git-backed CMS ([Decap CMS](https://decapcms.org)).

## How it works

- `content/homepage.yml` is the source of truth for the homepage — its
  `body` field holds the full page HTML.
- `.github/workflows/deploy.yml` runs on every push to `main`: it reads
  `content/homepage.yml`, writes it out as `dist/index.html`, and deploys
  that to GitHub Pages.
- `admin/` is the Decap CMS admin app. Visit `https://pitcoms.com/admin/`
  to log in with GitHub and edit the page through a web UI — saving there
  commits straight to this repo and triggers a new deploy.

## Editing directly instead

You can also just edit `content/homepage.yml` directly (locally or in the
GitHub web editor) and push to `main` — no CMS required.

## Local preview

Open `content/homepage.yml`, copy the `body:` value, or run:

```
python3 -c "import yaml,pathlib; print(yaml.safe_load(pathlib.Path('content/homepage.yml').read_text())['body'])" > preview.html
```

then open `preview.html` in a browser.

<!-- Pages: source=GitHub Actions, enabled 2026-09-07 -->
