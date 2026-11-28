"""PREVIEW ONLY (not published): two alternative layouts for /child-not-talking/, to compare with layout A
(drafts/pilot_child_not_talking.py).

  B = "Doctor first": Dr. Tanu up front, reviews strip, "wait and see vs. assessment", sticky mobile action bar.
  C = "Quiz first": colourful band with a one-question-at-a-time check (age → signs → result → WhatsApp), photo strip.

Run:  python3 drafts/pilot_layouts_bc.py <output_dir>   → writes <out>/child-not-talking-b/ and <out>/child-not-talking-c/
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_pages as bp  # noqa: E402
from pilot_child_not_talking import REVIEWS, CHECKS, WA_TEXT, img  # noqa: E402

FLAG = '<p class="preview-flag" style="background:#fff3cd;color:#664d03;border:1px solid #ffe69c;border-radius:12px;padding:8px 12px;font-size:.9rem;margin:8px 0 0">PREVIEW ONLY: {name}. Not live.</p>'
WA = bp.esc(bp.wa(WA_TEXT))
FAQS = [
    ("Mera 2 saal ka baccha nahi bolta. Kya yeh normal hai?", "Children develop at different speeds, but most 2 year olds use many single words and are starting to join two. If your child isn't, an assessment helps you understand why and what to do next."),
    ("Is screen time causing my child's speech delay?", "Too much screen time can mean fewer chances to talk and play together. Reducing it often helps, but speech delay usually has more than one cause, which is why we start with an assessment."),
    ("Could it be autism?", "Late talking on its own doesn't mean autism. During the assessment we look at communication, play and social interaction, and explain what we see in simple words."),
]

# ---------------------------------------------------------------- Layout B: doctor first
CSS_B = """
.b-hero{display:grid;gap:22px;align-items:center;background:#0b1220;color:#fff;border-radius:28px;padding:22px;margin-top:10px}
@media (min-width:900px){.b-hero{grid-template-columns:.9fr 1.1fr;padding:36px}}
.b-hero img{width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;border-radius:20px;display:block}
.b-hero h1{color:#fff;margin:.2em 0}.b-hero .lead{color:#c9d4e5}.b-hero .eyebrow{color:#7fb4ff}
.b-cred{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}.b-cred span{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:6px 12px;font-size:.9rem;font-weight:700}
.b-hero .btn-ghost{color:#fff;border-color:#fff}
.b-strip{display:flex;gap:12px;overflow-x:auto;padding:4px 2px 10px;margin:22px 0;scroll-snap-type:x mandatory}
.b-strip figure{flex:0 0 min(85%,360px);scroll-snap-align:start;margin:0;background:var(--white);border:1px solid var(--line);border-radius:18px;padding:14px 16px}
.b-strip .stars{color:#e2a400;letter-spacing:2px}.b-strip p{margin:.3em 0}.b-strip cite{color:var(--muted);font-style:normal;font-size:.9rem}
.b-sec{margin:40px 0}
.b-vs{display:grid;gap:14px}@media (min-width:800px){.b-vs{grid-template-columns:1fr 1fr}}
.b-vs div{border-radius:20px;padding:18px 20px;border:1px solid var(--line);background:var(--white)}
.b-vs div.good{border:2px solid var(--teal);background:var(--teal-soft)}
.b-vs h3{margin-top:0}.b-vs ul{margin:0;padding-left:1.1em}
.b-icons{display:grid;gap:12px;grid-template-columns:repeat(2,1fr)}@media (min-width:800px){.b-icons{grid-template-columns:repeat(4,1fr)}}
.b-icons div{background:var(--white);border:1px solid var(--line);border-radius:18px;padding:16px;text-align:center}
.b-icons b{display:block;font-size:1.8rem}.b-icons span{font-size:.95rem;color:var(--muted)}
.b-video{position:relative;border-radius:22px;overflow:hidden;background:#0b1220}
.b-video img{width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;display:block;opacity:.6}
.b-video span{position:absolute;inset:0;display:grid;place-items:center;color:#fff;font-weight:800;font-size:1.1rem;text-align:center;padding:12px}
.b-bar{position:sticky;bottom:0;display:flex;gap:8px;padding:10px;background:rgba(255,255,255,.96);border-top:1px solid var(--line);margin:0 -16px;z-index:5}
.b-bar a{flex:1;text-align:center}
@media (min-width:900px){.b-bar{display:none}}
"""


def layout_b():
    reviews = "".join(f'<figure><div class="stars">★★★★★</div><p>“{bp.esc(q)}”</p><cite>{bp.esc(w)}</cite></figure>' for q, w in REVIEWS)
    return f"""<style>{CSS_B}</style>{FLAG.format(name="Layout B, Doctor first")}
<section class="b-hero">
<div>{img("assessment-desk", "Dr. Tanu Garg at the Vocalzz consultation desk", lazy=False)}</div>
<div>
<span class="eyebrow">Late talkers · Speech delay</span>
<h1>Worried your child isn't talking yet? Talk to Dr. Tanu Garg.</h1>
<p class="lead">Speech-Language Therapist with 10+ years helping toddlers find their first words. One assessment, a clear plan, and simple practice for home.</p>
<div class="b-cred"><span>★ 4.9 · 129 Google reviews</span><span>Ex-Fortis Noida</span><span>Ex-BL Kapoor Hospital</span><span>Sector 137, Noida</span></div>
<div class="cta-row"><a class="btn btn-wa" href="{WA}" target="_blank" rel="noopener">WhatsApp Dr. Tanu's team</a><a class="btn btn-ghost" href="{bp.TEL}">Call now</a></div>
</div>
</section>

<div class="b-strip" aria-label="Reviews">{reviews}</div>

<section class="b-sec"><h2>Wait and see, or get advice now?</h2>
<div class="b-vs">
<div><h3>Waiting and wondering</h3><ul><li>Months of worry and comparing with other children</li><li>No clear idea what's normal for your child</li><li>Fewer chances to help during an important stage</li></ul></div>
<div class="good"><h3>A speech assessment</h3><ul><li>Know where your child is, in plain words</li><li>A short plan and activities for home this week</li><li>If your child is on track, peace of mind</li></ul></div>
</div>
<p style="color:var(--muted)">Every child is different. Getting advice early does no harm.</p></section>

<section class="b-sec"><h2>Why families choose Vocalzz</h2>
<div class="b-icons">
<div><b>🧸</b><span>Play-based sessions your child enjoys</span></div>
<div><b>🏠</b><span>Home practice plan after every session</span></div>
<div><b>🤝</b><span>Speech, OT and special education plan together</span></div>
<div><b>📍</b><span>Clinic, home visits or online</span></div>
</div></section>

<section class="b-sec"><h2>Hear it from Dr. Tanu</h2>
<div class="b-video">{img("play-tent", "Dr. Tanu Garg with children", sizes="100vw")}<span>▶ 45-second video: "My child isn't talking. What should I do?" (to be recorded)</span></div></section>

<section class="b-sec"><h2>Questions parents ask</h2>{bp.faq_html(FAQS)}</section>
<div class="b-bar"><a class="btn btn-wa" href="{WA}" target="_blank" rel="noopener">WhatsApp</a><a class="btn btn-ghost" href="{bp.TEL}">Call</a></div>
"""


# ---------------------------------------------------------------- Layout C: quiz first
CSS_C = """
.c-band{background:linear-gradient(135deg,#1e6fd9,#5aa2f5);color:#fff;border-radius:28px;padding:26px 20px;margin-top:10px;text-align:center}
.c-band h1{color:#fff;margin:.1em 0 .3em}.c-band p{color:#e8f1ff;max-width:640px;margin:0 auto}
.c-quiz{background:#fff;color:var(--ink);border-radius:22px;padding:18px;max-width:640px;margin:20px auto 0;text-align:left;box-shadow:0 12px 30px rgba(0,0,0,.18)}
.c-steps{display:flex;gap:6px;margin-bottom:12px}.c-steps i{flex:1;height:6px;border-radius:9px;background:var(--line)}.c-steps i.on{background:var(--teal)}
.c-q{display:none}.c-q.on{display:block}
.c-q h2{font-size:1.3rem;margin:0 0 12px}
.c-opts{display:grid;gap:10px}.c-opts button{all:unset;cursor:pointer;border:2px solid var(--line);border-radius:14px;padding:14px 16px;font-weight:700}
.c-opts button:hover,.c-opts button.sel{border-color:var(--teal);background:var(--teal-soft)}
.c-next{margin-top:14px}
.c-res{background:var(--teal-soft);border-radius:14px;padding:14px;font-weight:600;margin-bottom:12px}
.c-gallery{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:28px 0}@media (min-width:800px){.c-gallery{grid-template-columns:repeat(4,1fr)}}
.c-gallery img{width:100%;height:auto;aspect-ratio:1/1;object-fit:cover;border-radius:18px;display:block}
.c-sec{margin:36px 0}
.c-cards{display:grid;gap:12px}@media (min-width:800px){.c-cards{grid-template-columns:repeat(3,1fr)}}
.c-cards div{background:var(--white);border:1px solid var(--line);border-radius:18px;padding:16px}
.c-cards b{display:block;color:var(--teal);font-size:1.6rem}
.c-quote{font-family:var(--font-head);font-size:1.35rem;text-align:center;max-width:720px;margin:36px auto}
.c-quote small{display:block;font-family:inherit;font-size:.9rem;color:var(--muted);margin-top:6px}
"""


def layout_c():
    ages = ["Under 18 months", "18 months – 2 years", "2 – 3 years", "Older than 3"]
    signs = [x for _, items in CHECKS for x in items]
    age_btns = "".join(f'<button type="button" data-age="{bp.esc(a)}">{bp.esc(a)}</button>' for a in ages)
    sign_btns = "".join(f'<button type="button" data-sign="{bp.esc(s)}">{bp.esc(s)}</button>' for s in signs[:6])
    q = REVIEWS[1]
    return f"""<style>{CSS_C}</style>{FLAG.format(name="Layout C, Quiz first")}
<section class="c-band">
<span class="eyebrow" style="color:#dbe9ff">Speech therapy for late talkers · Sector 137, Noida</span>
<h1>Is my child a late talker?</h1>
<p>Answer 2 quick questions. Get a simple next step, and send it to our speech therapist on WhatsApp.</p>
<div class="c-quiz" id="cq">
<div class="c-steps"><i class="on"></i><i></i><i></i></div>
<div class="c-q on" data-step="1"><h2>1. How old is your child?</h2><div class="c-opts">{age_btns}</div></div>
<div class="c-q" data-step="2"><h2>2. Which of these sound familiar? (tap all that apply)</h2><div class="c-opts">{sign_btns}</div>
<p class="c-next"><button type="button" class="btn btn-wa" id="cq-next">See my next step</button></p></div>
<div class="c-q" data-step="3"><div class="c-res" id="cq-res"></div>
<a class="btn btn-wa" id="cq-wa" href="{WA}" target="_blank" rel="noopener">Send to the therapist on WhatsApp</a>
<p style="color:var(--muted);font-size:.9rem;margin:10px 0 0">This is not a diagnosis. Every child is different.</p></div>
</div>
</section>

<div class="c-gallery">
{img("play-tent", "Dr. Tanu Garg with children in a play tent", sizes="(min-width:800px) 25vw, 50vw")}
{img("attention-tablet", "A therapist and children during an activity", sizes="(min-width:800px) 25vw, 50vw")}
{img("sensory-room", "The Vocalzz sensory room", sizes="(min-width:800px) 25vw, 50vw")}
{img("assessment-desk", "Dr. Tanu Garg at the consultation desk", sizes="(min-width:800px) 25vw, 50vw")}
</div>

<section class="c-sec"><h2 style="text-align:center">What happens next</h2>
<div class="c-cards">
<div><b>1</b>We chat on WhatsApp and find a time that suits you</div>
<div><b>2</b>A play-based assessment with Dr. Tanu Garg (10+ years)</div>
<div><b>3</b>A clear plan, and activities for home from day one</div>
</div></section>

<p class="c-quote">“{bp.esc(q[0])}”<small>★★★★★ {bp.esc(q[1])} · 4.9 from 129 reviews</small></p>

<section class="c-sec"><h2>Questions parents ask</h2>{bp.faq_html(FAQS)}</section>
<section class="c-sec" style="text-align:center"><a class="btn btn-wa" href="{WA}" target="_blank" rel="noopener">WhatsApp us 7 days a week</a>
<p style="color:var(--muted)">Tower E-004, Logix Blossom County, Sector 137, Noida · Clinic visits Mon–Sat, 10 am–8 pm</p></section>
<script>
(function () {{
  var box = document.getElementById("cq"), age = "", picked = [];
  function show(n) {{
    box.querySelectorAll(".c-q").forEach(function (q) {{ q.classList.toggle("on", q.dataset.step == n); }});
    box.querySelectorAll(".c-steps i").forEach(function (b, i) {{ b.classList.toggle("on", i < n); }});
  }}
  box.querySelectorAll("[data-age]").forEach(function (b) {{ b.onclick = function () {{ age = b.dataset.age; show(2); }}; }});
  box.querySelectorAll("[data-sign]").forEach(function (b) {{ b.onclick = function () {{
    b.classList.toggle("sel"); var s = b.dataset.sign, i = picked.indexOf(s); if (i < 0) picked.push(s); else picked.splice(i, 1); }}; }});
  document.getElementById("cq-next").onclick = function () {{
    var n = picked.length;
    document.getElementById("cq-res").textContent = n === 0
      ? "Good to hear. If you're still unsure, a quick chat with a speech therapist can put your mind at rest."
      : n === 1 ? "You picked 1 sign. It's worth talking to a speech therapist; early advice does no harm."
      : "You picked " + n + " signs. An assessment can show what's going on and what will help.";
    document.getElementById("cq-wa").href = "{bp.WA}?text=" + encodeURIComponent("Hi Vocalzz, my child is " + age + ". Signs I noticed: " + (picked.join("; ") || "none") + ".");
    show(3);
  }};
}})();
</script>
"""


def build(out: Path):
    old = bp.ROOT
    bp.ROOT = out
    try:
        crumbs = [("Home", "/"), ("Services", "/services/"), ("Child Not Talking Yet?", "/child-not-talking/")]
        bp.page("/child-not-talking-b/", "Layout B preview | Vocalzz Speech & Audio", "Preview", crumbs, layout_b(), [])
        bp.page("/child-not-talking-c/", "Layout C preview | Vocalzz Speech & Audio", "Preview", crumbs, layout_c(), [])
    finally:
        bp.ROOT = old


if __name__ == "__main__":
    build(Path(sys.argv[1]))
