# Vocalzz website

A fast, single-page clinic website (plus privacy and 404 pages). Plain HTML and CSS, so there's no build step.

| File | What it is |
|---|---|
| `public/index.html` | The home page: all text, sections and WhatsApp links |
| `public/styles.css` | Colours, fonts and layout |
| `public/privacy.html` | Privacy notice (DPDP Act) |
| `public/404.html` | "Page not found" page |
| `public/fonts/` | Fraunces and Nunito Sans, self-hosted (SIL Open Font License) |

## Pages

| Address | Page |
|---|---|
| `/` | Home (`public/index.html`, edited by hand) |
| `/services/` | All services |
| `/speech-language-therapy/`, `/occupational-therapy/`, `/behavioral-therapy/`, `/special-education/`, `/audiology/`, `/physiotherapy/` | One page per service |
| `/about/` | About us and team |
| `/contact-us/` | Contact, hours and map |

The inner pages, `sitemap.xml`, and the header/footer of `privacy.html` and `404.html` are **generated** by
`build_pages.py` from the content inside it and the homepage's header and footer. After changing the homepage
header/footer or any page text, run:

```bash
python3 website/build_pages.py
```

and commit the generated files. Old WordPress addresses are redirected in `public/_redirects`.
Clinical text must be approved by Dr. Tanu Garg; no guarantees, timelines or statistics.

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
