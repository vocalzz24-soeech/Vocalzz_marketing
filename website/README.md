# Vocalzz website

A fast, single-page clinic website (plus privacy and 404 pages). Plain HTML and CSS, so there's no build step.

| File | What it is |
|---|---|
| `public/index.html` | The home page: all text, sections and WhatsApp links |
| `public/styles.css` | Colours, fonts and layout |
| `public/privacy.html` | Privacy notice (DPDP Act) |
| `public/404.html` | "Page not found" page |
| `public/fonts/` | Fraunces and Nunito Sans, self-hosted (SIL Open Font License) |

## Put it online (Cloudflare, free)

Cloudflare dashboard → **Compute → Workers & Pages → Create → Import a repository** → pick this repository:

- **Project name:** `vocalzz-website`
- **Branch:** the branch this code is on
- **Root directory / Path:** `website`
- **Deploy command:** `npx wrangler deploy`
- **Build command:** leave empty

Then connect the domain: on the project, go to **Settings → Domains & Routes → Add → Custom domain** and enter
`vocalzz.com` (and `www.vocalzz.com`). The domain needs to use Cloudflare's nameservers. Cloudflare shows the steps
when you add the domain under **Domains**.

## Common edits

- **Team photos:** put a square photo in `public/team/` (e.g. `tanu.jpg`) and replace the initials inside the
  matching `<div class="avatar">` with `<img src="/team/tanu.jpg" alt="Dr. Tanu Garg">`.
- **Rating / review count:** search `4.9` and `129` in `index.html`.
- **WhatsApp message text:** each button's `wa.me/918800230240?text=…` link carries a pre-filled message.
