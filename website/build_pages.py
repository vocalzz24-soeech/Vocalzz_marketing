#!/usr/bin/env python3
"""Generates the inner pages of vocalzz.com from the content below.

Header, footer and floating buttons are copied from public/index.html so every page matches.
Run after editing:  python3 website/build_pages.py
Clinical text must be approved by Dr. Tanu Garg before publishing. No guarantees, timelines or statistics.
"""
import html
import json
import re
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent / "public"
SITE = "https://vocalzz.com"
WA = "https://wa.me/918800230240"
TEL = "tel:+918800230240"
ADDRESS = "Tower E-004, Logix Blossom County, Sector 137, Noida, Uttar Pradesh 201304"

index = (ROOT / "index.html").read_text(encoding="utf-8")
HEADER = index[index.index('<header class="site-header">'): index.index("</header>") + len("</header>")]
FOOTER = index[index.index('<footer class="site-footer">'): index.index("</body>")]


def wa(text: str) -> str:
    return f"{WA}?text={quote(text)}"


def esc(s: str) -> str:
    return html.escape(s, quote=True)


def page(path: str, title: str, description: str, crumbs: list[tuple[str, str]], body: str, schema: list[dict]) -> None:
    url = f"{SITE}{path}"
    crumb_items = [{"@type": "ListItem", "position": i + 1, "name": name, "item": f"{SITE}{href}"}
                   for i, (name, href) in enumerate(crumbs)]
    schema = schema + [{"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": crumb_items}]
    crumb_html = " › ".join(
        f'<a href="{href}">{esc(name)}</a>' if i < len(crumbs) - 1 else f'<span aria-current="page">{esc(name)}</span>'
        for i, (name, href) in enumerate(crumbs))
    doc = f"""<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(description)}">
<link rel="canonical" href="{url}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta name="theme-color" content="#0B1220">
<meta property="og:type" content="website">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(description)}">
<meta property="og:url" content="{url}">
<link rel="preload" href="/fonts/fraunces.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/nunito-sans.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/styles.css">
{"".join(f'<script type="application/ld+json">{json.dumps(s, ensure_ascii=False)}</script>' + chr(10) for s in schema)}</head>
<body>

{HEADER}

<main class="wrap">
<nav class="crumbs" aria-label="Breadcrumb">{crumb_html}</nav>
{body}
</main>

{FOOTER}</body>
</html>
"""
    out = ROOT / path.strip("/") / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(doc, encoding="utf-8")


CLINIC = {"@type": "MedicalClinic", "name": "Vocalzz", "url": f"{SITE}/", "telephone": "+91-88002-30240",
          "address": {"@type": "PostalAddress", "streetAddress": "Tower E-004, Logix Blossom County, Sector 137",
                      "addressLocality": "Noida", "addressRegion": "Uttar Pradesh", "postalCode": "201304", "addressCountry": "IN"}}


def aside(service: str, wa_text: str) -> str:
    return f"""<aside class="aside-card" aria-label="Book an assessment">
<h2>Talk to our team</h2>
<p>Tell us your concern and the age of the person who needs support. We'll suggest a time for an assessment.</p>
<a class="btn btn-wa" href="{esc(wa(wa_text))}" target="_blank" rel="noopener">Book on WhatsApp</a>
<a class="btn btn-ghost" href="{TEL}">Call +91 88002 30240</a>
<ul>
<li>Open every day, 10 am to 9 pm</li>
<li>Tower E-004, Logix Blossom County, Sector 137, Noida</li>
<li>In-clinic and online sessions</li>
</ul>
</aside>"""


def faq_html(faqs):
    return '<div class="faq" style="margin:12px 0 0">' + "".join(
        f"<details><summary>{esc(q)}</summary><p>{esc(a)}</p></details>" for q, a in faqs) + "</div>"


def faq_schema(faqs):
    return {"@context": "https://schema.org", "@type": "FAQPage",
            "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]}


SERVICES = [
    {
        "slug": "speech-language-therapy", "name": "Speech & Language Therapy", "short": "Speech therapy",
        "title": "Speech Therapy in Sector 137, Noida | Children & Adults | Vocalzz",
        "desc": "Speech and language therapy in Sector 137, Noida for late talkers, autism, stammering, unclear speech and adults after stroke. Assessment-led, with home practice after every session.",
        "h1": "Speech & Language Therapy in Sector 137, Noida",
        "lead": "Support for children and adults who find it hard to talk, understand, be understood or swallow, led by Dr. Tanu Garg, Speech-Language Therapist with 10+ years' experience.",
        "wa": "Hi Vocalzz, I'd like to know about speech therapy.",
        "who": ["Toddlers who are talking later than expected, or have stopped using words they used to say",
                "Children whose speech is hard for others to understand",
                "Autistic children who need support with communication",
                "Children, teens and adults who stammer",
                "Adults with voice problems, or with speech and language difficulties after a stroke (aphasia)",
                "Children or adults with difficulty chewing or swallowing"],
        "work": ["Understanding and using words, sentences and gestures",
                 "Clear speech sounds (articulation) and speech planning (apraxia)",
                 "Social communication: turn-taking, eye contact, play and conversation",
                 "Fluency: strategies for stammering and confidence when speaking",
                 "Voice care and voice therapy",
                 "Language and communication rehabilitation after stroke"],
        "extra": ("Speech therapy for adults",
                  "Adults can benefit too, for example after a stroke, with a voice problem or with long-standing stammering. Sessions are planned around your goals at work and at home, and can be in the clinic or online. Family members are welcome to join so they know how to help."),
        "faqs": [("At what age should my child start speech therapy?",
                  "There is no fixed age. If you are worried about your child's speech or understanding, an assessment can help at any age. It is often useful to seek advice early rather than wait and see."),
                 ("How long will my child need speech therapy?",
                  "Every child is different, so we don't promise fixed timelines. After the assessment we share realistic goals and review progress with you regularly."),
                 ("Can I practise at home?",
                  "Yes. After every session we show you simple activities to practise at home, because practice between sessions makes a real difference."),
                 ("Do you offer online speech therapy?",
                  "Yes, online sessions are available for families and adults anywhere in India. We'll advise whether online sessions suit your needs.")],
    },
    {
        "slug": "occupational-therapy", "name": "Occupational Therapy", "short": "Occupational therapy",
        "title": "Occupational Therapy for Children in Sector 137, Noida | Vocalzz",
        "desc": "Paediatric occupational therapy in Sector 137, Noida: sensory integration, fine motor skills, handwriting, attention and daily living skills, with guidance for parents.",
        "h1": "Occupational Therapy in Sector 137, Noida",
        "lead": "Helping children build the everyday skills that make home and school easier, from holding a pencil to managing busy, noisy places.",
        "wa": "Hi Vocalzz, I'd like to know about occupational therapy for my child.",
        "who": ["Children who are very sensitive to noise, touch, clothes or food, or who seek a lot of movement",
                "Children who find buttons, scissors, cutlery or handwriting difficult",
                "Children who find it hard to sit, focus or follow a routine",
                "Children with autism, ADHD or developmental delay who need support with daily activities",
                "Children who seem clumsy or find balance and coordination hard"],
        "work": ["Sensory integration: helping the body process sensations calmly",
                 "Fine motor skills: grip, hand strength and control",
                 "Handwriting readiness and handwriting",
                 "Attention and organisation for learning",
                 "Daily living skills: dressing, eating and self-care"],
        "extra": ("Working together with speech and behaviour therapy",
                  "Many children need more than one kind of support. Our occupational therapists, speech therapist and behaviour therapist plan together, so your child works towards one shared set of goals."),
        "faqs": [("What is sensory integration therapy?",
                  "It uses play-based activities to help children respond more comfortably to sights, sounds, touch and movement. Your therapist will explain how it may help your child after the assessment."),
                 ("Is occupational therapy only for children with a diagnosis?",
                  "No. Many children without a diagnosis benefit from support with handwriting, coordination or daily routines."),
                 ("What should my child wear?",
                  "Comfortable clothes they can move and play in.")],
    },
    {
        "slug": "behavioral-therapy", "name": "Behavioural Therapy", "short": "Behavioural therapy",
        "title": "Behavioural Therapy for Children in Sector 137, Noida | ADHD & Autism | Vocalzz",
        "desc": "Behavioural therapy in Sector 137, Noida for ADHD, autism behaviour support, tantrums and emotional regulation. Calm, practical strategies for children and parents.",
        "h1": "Behavioural Therapy in Sector 137, Noida",
        "lead": "Calm, practical support for big feelings and behaviour that is hard to manage, for your child and for you as a parent.",
        "wa": "Hi Vocalzz, I'd like to know about behavioural therapy for my child.",
        "who": ["Children with frequent or intense tantrums or meltdowns",
                "Children with ADHD, or who find it very hard to wait, sit or follow instructions",
                "Autistic children who need support with routines, transitions or behaviour",
                "Children who find it hard to manage emotions such as anger, worry or frustration",
                "Parents who want consistent, positive strategies to use at home"],
        "work": ["Understanding what a behaviour is communicating and what triggers it",
                 "Building positive routines and clear, achievable expectations",
                 "Teaching new skills to replace difficult behaviours",
                 "Emotional regulation: recognising and calming big feelings",
                 "Parent guidance so strategies are used consistently at home and school"],
        "extra": ("Parents are part of the plan",
                  "Behaviour changes best when home and clinic work the same way. We share simple strategies with you after sessions and review together what is working."),
        "faqs": [("Is behavioural therapy the same as ABA?",
                  "ABA (Applied Behaviour Analysis) is one approach used in behavioural therapy. Your therapist will explain which approaches suit your child after the assessment."),
                 ("Do I need a diagnosis to start?",
                  "No. If your child's behaviour is worrying you, you can book an assessment without a diagnosis."),
                 ("Will I be involved in sessions?",
                  "Yes. Parent involvement is an important part of behavioural therapy, and we guide you after every session.")],
    },
    {
        "slug": "special-education", "name": "Special Education", "short": "Special education",
        "title": "Special Education & Learning Support in Sector 137, Noida | Vocalzz",
        "desc": "One-on-one special education in Sector 137, Noida for learning difficulties, dyslexia and academic support, planned alongside speech and occupational therapy.",
        "h1": "Special Education in Sector 137, Noida",
        "lead": "One-on-one support for children who learn differently, so they can build skills and confidence at their own pace.",
        "wa": "Hi Vocalzz, I'd like to know about special education support for my child.",
        "who": ["Children who find reading, spelling or writing much harder than expected (including dyslexia)",
                "Children who find numbers and maths concepts difficult",
                "Children with attention or memory difficulties that affect learning",
                "Children with autism or developmental delay who need adapted teaching",
                "Children who need help keeping up with school work"],
        "work": ["Reading, phonics and spelling",
                 "Writing and expressing ideas",
                 "Early numeracy and maths skills",
                 "Attention, memory and study skills",
                 "Individualised learning goals shared with parents and, where helpful, school"],
        "extra": ("Learning support that fits with therapy",
                  "Our special educator works with our speech and occupational therapists, so learning goals and therapy goals support each other."),
        "faqs": [("Do you assess for dyslexia?",
                  "We assess your child's learning strengths and difficulties and explain what we find. If a formal diagnosis is needed, we'll guide you on next steps."),
                 ("Can you coordinate with my child's school?",
                  "With your permission, we can share strategies that may help at school."),
                 ("How often are sessions?",
                  "We recommend a schedule after the assessment, based on your child's needs.")],
    },
    {
        "slug": "audiology", "name": "Audiology & Hearing Tests", "short": "Audiology",
        "title": "Hearing Test & Audiologist in Sector 137, Noida | Children & Adults | Vocalzz",
        "desc": "Hearing tests for children and adults and hearing aid consultations in Sector 137, Noida, by an experienced audiologist.",
        "h1": "Audiology & Hearing Tests in Sector 137, Noida",
        "lead": "Hearing checks for every age and hearing aid consultations, with Dr. Tanu Garg, Speech-Language Therapist & Audiologist.",
        "wa": "Hi Vocalzz, I'd like to book a hearing test.",
        "who": ["Children whose speech is delayed, as hearing should be checked when speech is late",
                "Children who don't respond to their name or seem to ignore sounds",
                "Adults and seniors who find conversations, the TV or phone calls hard to follow",
                "Anyone with ringing in the ears or a sudden change in hearing (please see a doctor urgently for sudden hearing loss)",
                "People considering a hearing aid or reviewing their current one"],
        "work": ["Hearing tests for children and adults",
                 "Explaining results in simple words",
                 "Hearing aid consultation and guidance",
                 "Referral to an ENT doctor where needed",
                 "Communication support alongside speech therapy"],
        "extra": ("Hearing and speech, under one roof",
                  "Hearing and speech are closely linked. Because our audiologist is also a speech therapist, a child with late speech can have hearing checked and speech assessed without going to different clinics."),
        "faqs": [("Can young children have a hearing test?",
                  "Yes. Tests are chosen to suit the child's age. Tell us your child's age when booking and we'll explain what to expect."),
                 ("Do you sell hearing aids?",
                  "We offer hearing aid consultations and guidance. Message us to discuss your needs."),
                 ("How long does a hearing test take?",
                  "It depends on the test and the person's age. We'll let you know when you book.")],
    },
    {
        "slug": "physiotherapy", "name": "Paediatric Physiotherapy", "short": "Paediatric physiotherapy",
        "title": "Paediatric Physiotherapy in Sector 137, Noida | Vocalzz",
        "desc": "Paediatric physiotherapy in Sector 137, Noida to help children build movement, strength, balance and coordination, alongside occupational and speech therapy.",
        "h1": "Paediatric Physiotherapy in Sector 137, Noida",
        "lead": "Helping little bodies move with more strength and confidence, with Dr. Samriddhi, Physiotherapist and certified Occupational Therapist.",
        "wa": "Hi Vocalzz, I'd like to know about physiotherapy for my child.",
        "who": ["Babies and children reaching motor milestones (sitting, crawling, walking) later than expected",
                "Children with low muscle tone or weakness",
                "Children who find balance, running, jumping or stairs difficult",
                "Children with cerebral palsy or other conditions that affect movement"],
        "work": ["Gross motor milestones: sitting, crawling, standing and walking",
                 "Strength and posture",
                 "Balance and coordination",
                 "Movement through play, with exercises to continue at home"],
        "extra": ("Physiotherapy for children",
                  "Our physiotherapy service is for children. Sessions are play-based, and parents learn simple exercises to continue at home."),
        "faqs": [("Do you offer physiotherapy for adults?",
                  "Our physiotherapy service focuses on children. Message us and we'll guide you."),
                 ("What happens in the first session?",
                  "The physiotherapist observes how your child moves and plays, talks with you about your concerns, and suggests a plan.")],
    },
]

STEPS = """<ol class="steps" style="margin-top:12px">
<li><strong>Assessment</strong><span>We meet you, listen to your concerns and understand strengths and needs.</span></li>
<li><strong>A plan made together</strong><span>Clear goals, shared with you, and coordinated with other therapies if needed.</span></li>
<li><strong>Regular sessions</strong><span>One-on-one, in a group or online, depending on what suits best.</span></li>
<li><strong>Home practice</strong><span>After every session you get simple things to practise at home.</span></li>
<li><strong>Progress reviews</strong><span>We review what's working and adjust the plan.</span></li>
</ol>"""


def build_service(s):
    others = [o for o in SERVICES if o["slug"] != s["slug"]]
    related = "".join(f'<a href="/{o["slug"]}/">{esc(o["name"])}<span>{esc(o["lead"][:80].rsplit(" ", 1)[0])}…</span></a>' for o in others[:3])
    extra_h, extra_p = s["extra"]
    body = f"""<header class="page-hero">
<span class="eyebrow">Our services</span>
<h1>{esc(s["h1"])}</h1>
<p class="lead">{esc(s["lead"])}</p>
<div class="cta-row">
<a class="btn btn-wa" href="{esc(wa(s["wa"]))}" target="_blank" rel="noopener">Book an assessment</a>
<a class="btn btn-ghost" href="{TEL}">Call +91 88002 30240</a>
</div>
</header>
<div class="content">
<article class="prose">
<h2>Who it can help</h2>
<ul>{"".join(f"<li>{esc(x)}</li>" for x in s["who"])}</ul>
<h2>What we work on</h2>
<ul>{"".join(f"<li>{esc(x)}</li>" for x in s["work"])}</ul>
<h2>{esc(extra_h)}</h2>
<p>{esc(extra_p)}</p>
<h2>How it works at Vocalzz</h2>
{STEPS}
<p class="callout">Every person is different, so we don't promise fixed results or timelines. We start with an assessment, set realistic goals with you and review progress regularly.</p>
<h2>Frequently asked questions</h2>
{faq_html(s["faqs"])}
<h2>Other services at Vocalzz</h2>
<div class="related">{related}</div>
<p style="margin-top:18px"><a href="/services/">See all services →</a></p>
</article>
{aside(s["name"], s["wa"])}
</div>"""
    schema = [{"@context": "https://schema.org", "@type": "MedicalWebPage", "name": s["h1"], "url": f'{SITE}/{s["slug"]}/',
               "about": {"@type": "MedicalTherapy", "name": s["name"]}, "provider": CLINIC, "inLanguage": "en-IN"},
              faq_schema(s["faqs"])]
    page(f'/{s["slug"]}/', s["title"], s["desc"], [("Home", "/"), ("Services", "/services/"), (s["name"], f'/{s["slug"]}/')], body, schema)


def build_services_index():
    cards = "".join(f"""<a class="service-link" href="/{s['slug']}/"><strong>{esc(s['name'])}</strong><span>{esc(s['lead'])}</span><em>Learn more →</em></a>""" for s in SERVICES)
    body = f"""<header class="page-hero">
<span class="eyebrow">Our services</span>
<h1>Therapy services in Sector 137, Noida</h1>
<p class="lead">Every therapy under one roof. Our therapists plan together, and after every session you get guidance on what to practise at home.</p>
</header>
<div class="related services-index" style="margin:12px 0 28px">{cards}</div>
<p class="callout">Not sure which service you need? That's completely normal. Message us with your concern and we'll suggest where to start, usually with an assessment.</p>
<div class="cta-row" style="margin:18px 0 64px">
<a class="btn btn-wa" href="{esc(wa("Hi Vocalzz, I'm not sure which therapy my child needs. Can you help?"))}" target="_blank" rel="noopener">Ask us on WhatsApp</a>
<a class="btn btn-ghost" href="{TEL}">Call +91 88002 30240</a>
</div>"""
    schema = [{"@context": "https://schema.org", "@type": "ItemList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "url": f"{SITE}/{s['slug']}/", "name": s["name"]} for i, s in enumerate(SERVICES)]}]
    page("/services/", "Therapy Services in Sector 137, Noida | Vocalzz",
         "Speech therapy, occupational therapy, behavioural therapy, special education, audiology and paediatric physiotherapy in Sector 137, Noida, all under one roof.",
         [("Home", "/"), ("Services", "/services/")], body, schema)


TEAM = [("TG", "Dr. Tanu Garg", "Founder · Speech-Language Therapist & Audiologist",
         "10+ years' experience, previously at Fortis Noida and BL Kapoor Hospital. Leads speech, language and hearing services at Vocalzz.", True),
        ("S", "Dr. Samriddhi", "Physiotherapist & Certified Occupational Therapist",
         "Helps children build movement, sensory and everyday skills.", False),
        ("TK", "Tanishk Kaushik", "Occupational Therapist",
         "Focuses on fine motor skills, handwriting, attention and independence.", False),
        ("MH", "Minhaj Hashmi", "Special Educator & Communication Therapist",
         "Supports learning differences, academics and communication.", False)]


def build_about():
    members = "".join(f"""<article class="member{' lead-member' if lead else ''}"><div class="avatar" aria-hidden="true">{ini}</div>
<h3>{esc(name)}</h3><div class="role">{esc(role)}</div><p>{esc(bio)}</p></article>""" for ini, name, role, bio, lead in TEAM)
    body = f"""<header class="page-hero">
<span class="eyebrow">About us</span>
<h1>About Vocalzz</h1>
<p class="lead">Vocalzz is a multi-therapy clinic in Sector 137, Noida for children, adults and seniors. Our promise is simple: <strong>Better Communication, Better Life</strong>.</p>
</header>
<div class="content" style="grid-template-columns:1fr">
<article class="prose">
<figure class="team-photo" style="margin:0 0 8px"><img src="/photos/team.jpg" width="1600" height="1205" loading="lazy" decoding="async" alt="The Vocalzz team in the clinic's rainbow-painted room"><figcaption>Our team at the clinic in Sector 137</figcaption></figure>
<h2>Why families choose Vocalzz</h2>
<ul>
<li><strong>Every therapy under one roof:</strong> speech, occupational and behavioural therapy, special education, audiology and paediatric physiotherapy.</li>
<li><strong>One team, one plan:</strong> our therapists share notes and agree goals together, so nothing pulls in different directions.</li>
<li><strong>Parents are part of therapy:</strong> after every session you get simple activities to practise at home.</li>
<li><strong>Honest guidance:</strong> every person is different, so we set realistic goals and review progress with you, without promising fixed results or timelines.</li>
<li><strong>Flexible:</strong> one-on-one, group and online sessions, open every day from 10 am to 9 pm.</li>
</ul>
<h2>Our team</h2>
<div class="team-grid" style="margin-top:12px">{members}</div>
<h2>Visit us</h2>
<p>{esc(ADDRESS)}. <a href="/contact-us/">Directions, hours and contact details →</a></p>
<div class="cta-row" style="margin:18px 0 64px">
<a class="btn btn-wa" href="{esc(wa("Hi Vocalzz, I'd like to book an assessment."))}" target="_blank" rel="noopener">Book an assessment</a>
<a class="btn btn-ghost" href="{TEL}">Call +91 88002 30240</a>
</div>
</article>
</div>"""
    schema = [{"@context": "https://schema.org", "@type": "AboutPage", "url": f"{SITE}/about/", "mainEntity": dict(CLINIC, **{
        "@context": "https://schema.org",
        "employee": [{"@type": "Person", "name": name, "jobTitle": role} for _, name, role, _, _ in TEAM]})}]
    page("/about/", "About Vocalzz | Therapy Team in Sector 137, Noida",
         "Meet the Vocalzz team in Sector 137, Noida: speech therapy, audiology, occupational therapy, physiotherapy and special education, planned together around each child.",
         [("Home", "/"), ("About us", "/about/")], body, schema)


def build_contact():
    body = f"""<header class="page-hero">
<span class="eyebrow">Contact</span>
<h1>Contact Vocalzz</h1>
<p class="lead">The quickest way to reach us is WhatsApp. You can also call, email or visit the clinic.</p>
</header>
<div class="content">
<article class="prose">
<ul class="info-list contact-light">
<li><span class="ic" aria-hidden="true">📍</span><span><strong>Address</strong><br>Tower E-004, Logix Blossom County,<br>Sector 137, Noida, Uttar Pradesh 201304</span></li>
<li><span class="ic" aria-hidden="true">🕙</span><span><strong>Hours</strong><br>Open every day, 10 am to 9 pm</span></li>
<li><span class="ic" aria-hidden="true">💬</span><span><strong>WhatsApp</strong><br><a href="{WA}" target="_blank" rel="noopener">+91 88002 30240</a></span></li>
<li><span class="ic" aria-hidden="true">📞</span><span><strong>Phone</strong><br><a href="{TEL}">+91 88002 30240</a></span></li>
<li><span class="ic" aria-hidden="true">✉️</span><span><strong>Email</strong><br><a href="mailto:contactus@vocalzz.com">contactus@vocalzz.com</a></span></li>
<li><span class="ic" aria-hidden="true">📸</span><span><strong>Instagram</strong><br><a href="https://www.instagram.com/vocalzz_4u/" target="_blank" rel="noopener">@vocalzz_4u</a></span></li>
</ul>
<div class="cta-row" style="margin-top:18px">
<a class="btn btn-ghost" href="https://www.google.com/maps/dir/?api=1&amp;destination=Vocalzz%20Sector%20137%20Noida&amp;destination_place_id=ChIJz71slSnpDDkRpzljahBPIU0" target="_blank" rel="noopener">Get directions</a>
<a class="btn btn-ghost" href="https://maps.google.com/maps?cid=5557810347074861479" target="_blank" rel="noopener">See us on Google Maps</a>
</div>
<div class="map" style="margin-top:20px"><iframe title="Map showing Vocalzz in Sector 137, Noida" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
src="https://maps.google.com/maps?q=Vocalzz%2C%20Tower%20E-004%2C%20Logix%20Blossom%20County%2C%20Sector%20137%2C%20Noida%20201304&amp;z=16&amp;output=embed"></iframe></div>
<h2>Questions about your data</h2>
<p>To see, correct or delete your information, write to <a href="mailto:contactus@vocalzz.com">contactus@vocalzz.com</a> or message us on WhatsApp. Read our <a href="/privacy.html">privacy notice</a>.</p>
</article>
{aside("assessment", "Hi Vocalzz, I'd like to book an assessment.")}
</div>"""
    schema = [{"@context": "https://schema.org", "@type": "ContactPage", "url": f"{SITE}/contact-us/", "mainEntity": dict(CLINIC, **{
        "@context": "https://schema.org", "email": "contactus@vocalzz.com", "hasMap": "https://maps.google.com/maps?cid=5557810347074861479",
        "openingHoursSpecification": [{"@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], "opens": "10:00", "closes": "21:00"}]})}]
    page("/contact-us/", "Contact Vocalzz | Sector 137, Noida | +91 88002 30240",
         "Contact Vocalzz therapy clinic: Tower E-004, Logix Blossom County, Sector 137, Noida 201304. Open every day 10 am to 9 pm. WhatsApp or call +91 88002 30240.",
         [("Home", "/"), ("Contact", "/contact-us/")], body, schema)


def sync_simple_pages():
    """Keep the header and footer of privacy.html and 404.html identical to the homepage."""
    for name in ["privacy.html", "404.html"]:
        f = ROOT / name
        doc = f.read_text(encoding="utf-8")
        doc = re.sub(r'<header class="site-header">.*?</header>', lambda m: HEADER, doc, count=1, flags=re.S)
        doc = re.sub(r'<footer class="site-footer">.*?</body>', lambda m: FOOTER + "</body>", doc, count=1, flags=re.S)
        f.write_text(doc, encoding="utf-8")


from blog_posts import POSTS  # noqa: E402

DRAFTS = Path(__file__).resolve().parent / "drafts"
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]


def nice_date(d: str) -> str:
    y, m, day = d.split("-")
    return f"{int(day)} {MONTHS[int(m) - 1]} {y}"


def published_posts():
    return sorted([p for p in POSTS if p["status"] == "published" and p.get("reviewed_on")], key=lambda p: p["date"], reverse=True)


def build_post(post):
    svc_name, svc_url = post["service"]
    reviewed = f' · Reviewed by Dr. Tanu Garg, Speech-Language Therapist, on {nice_date(post["reviewed_on"])}' if post.get("reviewed_on") else " · <strong>DRAFT, not yet reviewed</strong>"
    body = f"""<article class="prose article">
<header class="page-hero">
<span class="eyebrow">Parent tips</span>
<h1>{esc(post["title"])}</h1>
<p class="muted">{nice_date(post["date"])}{reviewed}</p>
</header>
{post["body"]}
<p class="callout">This article is general information, not a diagnosis. Every child is different. If you're worried, an assessment is the best way to get advice for your child.</p>
<div class="cta-row" style="margin:18px 0">
<a class="btn btn-wa" href="{esc(wa(post["wa"]))}" target="_blank" rel="noopener">Ask us on WhatsApp</a>
<a class="btn btn-ghost" href="{TEL}">Call +91 88002 30240</a>
</div>
<p>Learn more about <a href="{svc_url}">{esc(svc_name)} at Vocalzz</a> · <a href="/blog/">More parent tips</a></p>
<div style="height:48px"></div>
</article>"""
    schema = [{"@context": "https://schema.org", "@type": "Article", "headline": post["title"], "description": post["description"],
               "datePublished": post["date"], "url": f'{SITE}/blog/{post["slug"]}/', "inLanguage": "en-IN",
               "author": {"@type": "Organization", "name": "Vocalzz", "url": f"{SITE}/"},
               "publisher": {"@type": "Organization", "name": "Vocalzz", "url": f"{SITE}/"}}]
    if post.get("reviewed_on"):
        schema[0]["reviewedBy"] = {"@type": "Person", "name": "Dr. Tanu Garg", "jobTitle": "Speech-Language Therapist & Audiologist"}
    path = f'/blog/{post["slug"]}/'
    crumbs = [("Home", "/"), ("Parent tips", "/blog/"), (post["title"], path)]
    if post["status"] == "published" and post.get("reviewed_on"):
        page(path, post["seo_title"], post["description"], crumbs, body, schema)
    else:
        global ROOT
        saved, ROOT = ROOT, DRAFTS  # drafts are written outside public/, so they are never served
        try:
            page(path, "[DRAFT] " + post["seo_title"], post["description"], crumbs, body, schema)
        finally:
            ROOT = saved


def update_redirects(has_blog: bool):
    """The old /blog address points to the homepage until the first article is published."""
    f = ROOT / "_redirects"
    lines = [l for l in f.read_text(encoding="utf-8").splitlines() if not l.startswith(("/blog ", "/blog/ ", "# Old blog"))]
    if not has_blog:
        lines += ["# Old blog had no replacement yet: temporary.", "/blog / 302", "/blog/ / 302"]
    f.write_text("\n".join(lines) + "\n", encoding="utf-8")


def build_blog_index():
    posts = published_posts()
    update_redirects(bool(posts))
    if not posts:
        return
    cards = "".join(f"""<a class="service-link" href="/blog/{p['slug']}/"><strong>{esc(p['title'])}</strong><span>{esc(p['summary'])}</span><em>{nice_date(p['date'])} · Read →</em></a>""" for p in posts)
    body = f"""<header class="page-hero">
<span class="eyebrow">Parent tips</span>
<h1>Parent tips from the Vocalzz team</h1>
<p class="lead">Simple, practical guidance on speech, language, learning and behaviour, reviewed by our therapists.</p>
</header>
<div class="related services-index" style="margin:12px 0 64px">{cards}</div>"""
    page("/blog/", "Parent Tips on Speech, Learning & Behaviour | Vocalzz Noida",
         "Practical tips for parents on speech delay, stammering, sensory needs, learning and behaviour, from the Vocalzz therapy team in Sector 137, Noida.",
         [("Home", "/"), ("Parent tips", "/blog/")], body, [])


def build_sitemap():
    urls = ["/", "/services/"] + [f"/{s['slug']}/" for s in SERVICES] + ["/about/", "/contact-us/", "/privacy.html"]
    if published_posts():
        urls += ["/blog/"] + [f"/blog/{p['slug']}/" for p in published_posts()]
    (ROOT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                                      + "".join(f"  <url><loc>{SITE}{u}</loc></url>\n" for u in urls) + "</urlset>\n", encoding="utf-8")


if __name__ == "__main__":
    for s in SERVICES:
        build_service(s)
    build_services_index()
    build_about()
    build_contact()
    for post in POSTS:
        build_post(post)
    build_blog_index()
    build_sitemap()
    sync_simple_pages()
    print("Built", len(SERVICES) + 3, "pages,", len(published_posts()), "published articles,",
          len(POSTS) - len(published_posts()), "draft(s) in website/drafts/, and sitemap.xml")
