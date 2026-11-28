"""PREVIEW ONLY (not published): upgraded landing page for /child-not-talking/.

Run:  python3 drafts/pilot_child_not_talking.py <output_dir>
It copies nothing into public/; it writes <output_dir>/child-not-talking/index.html using the site's header,
footer and styles, so the page can be viewed locally next to a copy of public/.
Review quotes are short excerpts from the clinic's public Google reviews; the owner must approve which ones to use.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import build_pages as bp  # noqa: E402

WA_TEXT = "Hi Vocalzz, my child is not talking yet. Age: "
REVIEWS = [  # (quote, who) — owner to approve
    ("Good experience with the doctor and staff.", "S., Google review"),
    ("Professional staff, expert doctor and result oriented therapy.", "Google review"),
    ("Doctors are very supportive in nature.", "Google review"),
]
CHECKS = [
    ("By 18 months", ["Says no words yet", "Doesn't point to show you things", "Doesn't respond to their name most of the time"]),
    ("By 2 years", ["Says fewer than about 50 words", "Doesn't join two words (\"more milk\", \"papa go\")", "Uses gestures or pulls you instead of words"]),
    ("By 3 years", ["Family members find speech hard to understand", "Doesn't use short sentences", "Stopped using words they used to say (any age)"]),
]

CSS = """
.lp-hero{display:grid;gap:28px;align-items:center;padding:8px 0 24px}
@media (min-width:900px){.lp-hero{grid-template-columns:1.1fr .9fr}}
.lp-hero figure{margin:0}.lp-hero img{width:100%;height:auto;border-radius:24px;box-shadow:var(--shadow);border:5px solid var(--white);display:block}
.lp-hero figcaption{font-size:.85rem;color:var(--muted);margin-top:8px;text-align:center}
.lp-sec{margin:44px 0}
.lp-sec h2{margin-bottom:.4em}
.lp-check{background:var(--white);border:1px solid var(--line);border-radius:20px;padding:20px;box-shadow:var(--shadow)}
.lp-check fieldset{border:0;padding:0;margin:0 0 14px}
.lp-check legend{font-weight:700;margin-bottom:6px;color:var(--teal)}
.lp-check label{display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border-radius:12px;cursor:pointer}
.lp-check label:hover{background:var(--teal-soft)}
.lp-check input{width:20px;height:20px;margin-top:2px;flex:0 0 auto;accent-color:var(--teal)}
.lp-check .result{margin-top:10px;padding:12px 14px;border-radius:14px;background:var(--teal-soft);font-weight:600}
.lp-check small{display:block;color:var(--muted);margin-top:10px}
.lp-therapist{display:grid;gap:18px;align-items:center;background:var(--white);border:1px solid var(--line);border-radius:24px;padding:18px;box-shadow:var(--shadow)}
@media (min-width:700px){.lp-therapist{grid-template-columns:240px 1fr}}
.lp-therapist img{width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;border-radius:18px;display:block}
.lp-therapist ul{margin:.4em 0 0;padding-left:1.1em}
.lp-reviews{display:grid;gap:14px}
@media (min-width:800px){.lp-reviews{grid-template-columns:repeat(3,1fr)}}
.lp-review{margin:0;background:var(--white);border:1px solid var(--line);border-radius:18px;padding:16px 18px}
.lp-review .stars{color:#e2a400;letter-spacing:2px}
.lp-review p{margin:.4em 0;font-size:1.02rem}
.lp-review cite{color:var(--muted);font-style:normal;font-size:.9rem}
.lp-visit{display:grid;gap:14px}
@media (min-width:800px){.lp-visit{grid-template-columns:repeat(3,1fr)}}
.lp-visit div{background:var(--white);border:1px solid var(--line);border-radius:18px;overflow:hidden}
.lp-visit img{width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;display:block}
.lp-visit b{display:block;padding:12px 14px 0;font-size:1.05rem}
.lp-visit span{display:block;padding:4px 14px 14px;color:var(--muted);font-size:.95rem}
.lp-tips{display:grid;gap:10px}
@media (min-width:700px){.lp-tips{grid-template-columns:1fr 1fr}}
.lp-tips div{background:var(--white);border-left:4px solid var(--teal);border-radius:12px;padding:12px 14px}
.lp-cta{text-align:center;background:var(--teal-soft);border-radius:24px;padding:28px 18px;margin:44px 0}
.preview-flag{background:#fff3cd;color:#664d03;border:1px solid #ffe69c;border-radius:12px;padding:8px 12px;font-size:.9rem;margin:8px 0 0}
"""


def img(name, alt, sizes="(min-width: 900px) 520px, 100vw", lazy=True):
    return (f'<img src="/photos/slider/{name}-1200.webp" srcset="/photos/slider/{name}-640.webp 640w, /photos/slider/{name}-1200.webp 1200w" '
            f'sizes="{sizes}" width="1200" height="900" {"loading=\"lazy\" " if lazy else "fetchpriority=\"high\" "}decoding="async" alt="{bp.esc(alt)}">')


def build(out: Path):
    checks = "".join(
        f'<fieldset><legend>{bp.esc(age)}</legend>' + "".join(
            f'<label><input type="checkbox" value="{bp.esc(age)}: {bp.esc(x)}"><span>{bp.esc(x)}</span></label>' for x in items) + "</fieldset>"
        for age, items in CHECKS)
    reviews = "".join(
        f'<figure class="lp-review"><div class="stars" aria-label="5 stars">★★★★★</div><p>“{bp.esc(q)}”</p><cite>{bp.esc(w)}</cite></figure>'
        for q, w in REVIEWS)
    body = f"""<style>{CSS}</style>
<p class="preview-flag">PREVIEW ONLY — not live. Review quotes to be approved by the clinic.</p>
<section class="lp-hero">
<div>
<span class="eyebrow">Speech therapy for late talkers</span>
<h1>Child not talking yet? You're not alone.</h1>
<p class="lead">If your 2 or 3 year old says fewer words than other children, it's nobody's fault, and you don't have to wait and wonder. A speech therapy assessment shows where your child is, and you leave with simple things to do at home from this week.</p>
<div class="cta-row">
<a class="btn btn-wa" href="{bp.esc(bp.wa(WA_TEXT))}" target="_blank" rel="noopener">Book an assessment on WhatsApp</a>
<a class="btn btn-ghost" href="{bp.TEL}">Call +91 99106 71188</a>
</div>
<ul class="trust" aria-label="Why families trust us">
<li><span class="star" aria-hidden="true">★</span> 4.9 on Google · 129 reviews</li>
<li>Dr. Tanu Garg · 10+ years</li>
<li>Sector 137, Noida Expressway</li>
</ul>
</div>
<figure>{img("play-tent", "Dr. Tanu Garg playing with children inside a play tent in the Vocalzz therapy room", lazy=False)}<figcaption>Therapy at Vocalzz feels like play</figcaption></figure>
</section>

<section class="lp-sec" aria-labelledby="check-title">
<h2 id="check-title">Quick check: is my child a late talker?</h2>
<p>Tick anything that sounds like your child. It takes a minute.</p>
<form class="lp-check" id="lt-check" onsubmit="return false">
{checks}
<div class="result" id="lt-result" aria-live="polite">Tick the boxes that apply.</div>
<p style="margin:14px 0 0"><a class="btn btn-wa" id="lt-send" href="{bp.esc(bp.wa(WA_TEXT))}" target="_blank" rel="noopener">Send my answers on WhatsApp</a></p>
<small>This is not a diagnosis. Children develop at different speeds; an assessment is the way to know.</small>
</form>
</section>

<section class="lp-sec" aria-labelledby="who-title">
<h2 id="who-title">Meet your therapist</h2>
<div class="lp-therapist">
{img("assessment-desk", "Dr. Tanu Garg at the Vocalzz consultation desk", sizes="240px")}
<div>
<h3 style="margin:0">Dr. Tanu Garg</h3>
<p style="margin:.2em 0;color:var(--muted)">Speech-Language Therapist &amp; Audiologist · Founder</p>
<ul>
<li>10+ years helping children start talking</li>
<li>Previously at Fortis Noida and BL Kapoor Hospital</li>
<li>Sessions in Hindi and English, with parents involved</li>
</ul>
</div>
</div>
</section>

<section class="lp-sec" aria-labelledby="rev-title">
<h2 id="rev-title">What families say</h2>
<div class="lp-reviews">{reviews}</div>
<p style="margin-top:12px"><a href="https://maps.google.com/maps?cid=5557810347074861479" target="_blank" rel="noopener">Read all 129 reviews on Google →</a></p>
</section>

<section class="lp-sec" aria-labelledby="visit-title">
<h2 id="visit-title">Your first visit, step by step</h2>
<div class="lp-visit">
<div>{img("assessment-desk", "Consultation desk at Vocalzz", sizes="(min-width: 800px) 33vw, 100vw")}<b>1 · We listen</b><span>You tell us what worries you: words, understanding, play, eating, sleep.</span></div>
<div>{img("attention-tablet", "A therapist guiding children through an activity", sizes="(min-width: 800px) 33vw, 100vw")}<b>2 · We play together</b><span>A play-based assessment, so your child feels at ease while we observe.</span></div>
<div>{img("sensory-room", "The Vocalzz sensory room", sizes="(min-width: 800px) 33vw, 100vw")}<b>3 · A clear plan</b><span>Simple goals in plain words, and activities to practise at home from day one.</span></div>
</div>
</section>

<section class="lp-sec" aria-labelledby="tips-title">
<h2 id="tips-title">4 things you can start today</h2>
<div class="lp-tips">
<div><b>Talk about what they're doing.</b> "You're pouring water! Splash!" Short, simple words, many times a day.</div>
<div><b>Wait before you help.</b> Pause and look at them, so they have a reason and a moment to try a sound or word.</div>
<div><b>Less screen, more face time.</b> Sing, read picture books and play face to face; it gives more chances to talk.</div>
<div><b>Don't ask them to "say it".</b> Repeat the word happily instead: "Ball! Big ball!"</div>
</div>
</section>

<section class="lp-sec" aria-labelledby="faq-title">
<h2 id="faq-title">Questions parents ask</h2>
{bp.faq_html([
    ("Mera 2 saal ka baccha nahi bolta. Kya yeh normal hai?", "Children develop at different speeds, but most 2 year olds use many single words and are starting to join two. If your child isn't, an assessment helps you understand why and what to do next."),
    ("Is screen time causing my child's speech delay?", "Too much screen time can mean fewer chances to talk and play together. Reducing it often helps, but speech delay usually has more than one cause, which is why we start with an assessment."),
    ("Could it be autism?", "Late talking on its own doesn't mean autism. During the assessment we look at communication, play and social interaction, and explain what we see in simple words."),
    ("Do you offer sessions at home or online?", "Yes: home sessions in parts of Noida and Greater Noida (depending on therapist availability), and online sessions with a parent joining."),
])}
</section>

<section class="lp-cta">
<h2 style="margin-top:0">Not sure? Just ask.</h2>
<p>Send us your child's age and what worries you. We reply on WhatsApp 7 days a week.</p>
<a class="btn btn-wa" href="{bp.esc(bp.wa(WA_TEXT))}" target="_blank" rel="noopener">WhatsApp us</a>
<p style="margin:12px 0 0;color:var(--muted)">Tower E-004, Logix Blossom County, Sector 137, Noida · Clinic visits Mon–Sat, 10 am–8 pm</p>
</section>

<script>
(function () {{
  var f = document.getElementById("lt-check"), out = document.getElementById("lt-result"), send = document.getElementById("lt-send");
  var base = "{bp.WA}?text=";
  function update() {{
    var ticked = Array.prototype.filter.call(f.querySelectorAll("input"), function (i) {{ return i.checked; }}).map(function (i) {{ return i.value; }});
    out.textContent = ticked.length === 0 ? "Tick the boxes that apply."
      : ticked.length === 1 ? "You ticked 1 sign. It's worth talking to a speech therapist; early advice does no harm."
      : "You ticked " + ticked.length + " signs. An assessment can show what's going on and what will help.";
    send.href = base + encodeURIComponent("Hi Vocalzz, my child is not talking yet. Age: \\nI ticked: " + ticked.join("; "));
  }}
  f.addEventListener("change", update);
}})();
</script>"""
    old = bp.ROOT
    bp.ROOT = out
    try:
        bp.page("/child-not-talking/", "Child Not Talking Yet? Speech Therapy for Late Talkers in Noida | Vocalzz Speech & Audio",
                "Is your 2 or 3 year old not talking yet? Speech therapy for late talkers in Sector 137, Noida: a quick checklist, your first visit step by step, and tips to start today.",
                [("Home", "/"), ("Services", "/services/"), ("Child Not Talking Yet?", "/child-not-talking/")], body, [])
    finally:
        bp.ROOT = old


if __name__ == "__main__":
    build(Path(sys.argv[1]))
