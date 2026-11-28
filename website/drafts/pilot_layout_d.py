"""PREVIEW ONLY (not published): Layout D "Play & Learn" — a colourful, child-friendly version of /child-not-talking/.

Run:  python3 drafts/pilot_layout_d.py <output_dir>   → writes <out>/child-not-talking-d/index.html
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_pages as bp  # noqa: E402
from pilot_child_not_talking import REVIEWS, CHECKS, WA_TEXT, img  # noqa: E402

WA = bp.esc(bp.wa(WA_TEXT))

CSS = """
.pl{--sun:#ffd23f;--coral:#ff7a6b;--mint:#3ccfa0;--sky:#4fb3ff;--grape:#9b7bff;--ink2:#2b2350}
.pl h1,.pl h2,.pl h3{font-family:var(--font-body,inherit);font-weight:900;letter-spacing:-.01em;color:var(--ink2)}
.pl-hero{position:relative;overflow:hidden;border-radius:36px;padding:28px 20px 34px;margin-top:10px;
  background:radial-gradient(circle at 15% 20%,#fff6c9 0 18%,transparent 19%),radial-gradient(circle at 90% 80%,#d9f6ec 0 22%,transparent 23%),linear-gradient(160deg,#fff1e6,#e9f4ff)}
.pl-hero .grid{display:grid;gap:22px;align-items:center;position:relative;z-index:1}
@media (min-width:900px){.pl-hero{padding:40px}.pl-hero .grid{grid-template-columns:1.1fr .9fr}}
.pl-hero h1{font-size:clamp(2rem,5vw,3.2rem);line-height:1.05;margin:.2em 0}
.pl-hero h1 .w1{color:var(--coral)}.pl-hero h1 .w2{color:var(--sky)}.pl-hero h1 .w3{color:var(--mint)}
.pl-tag{display:inline-block;background:var(--sun);color:var(--ink2);font-weight:800;border-radius:999px;padding:6px 14px;transform:rotate(-2deg)}
.pl-hero p.lead{font-size:1.1rem;color:#4a4468}
.pl-photo{position:relative;transform:rotate(2deg)}
.pl-photo img{width:100%;height:auto;border-radius:28px;border:8px solid #fff;box-shadow:0 14px 30px rgba(43,35,80,.18);display:block}
.pl-photo::after{content:"";position:absolute;top:-14px;left:40%;width:90px;height:28px;background:rgba(255,210,63,.85);transform:rotate(-4deg);border-radius:4px}
.pl-float{position:absolute;font-size:2rem;z-index:0;animation:pl-bob 4s ease-in-out infinite}
@keyframes pl-bob{50%{transform:translateY(-10px)}}
@media (prefers-reduced-motion:reduce){.pl-float{animation:none}}
.pl .btn-wa{background:var(--coral);box-shadow:0 8px 0 #d85a4c;border-radius:999px}
.pl .btn-wa:hover{background:#ff8b7e}
.pl .btn-ghost{border-radius:999px;border-color:var(--ink2);color:var(--ink2)}
.pl-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.pl-chips span{background:#fff;border:2px dashed var(--grape);color:var(--ink2);border-radius:999px;padding:6px 12px;font-weight:800;font-size:.9rem}
.pl-wave{display:block;width:100%;height:40px;margin:18px 0 0}
.pl-sec{margin:38px 0}
.pl-sec h2{font-size:clamp(1.6rem,4vw,2.3rem);text-align:center}
.pl-sec > p.sub{text-align:center;color:#5a5478;margin-top:-6px}
.pl-quiz{max-width:680px;margin:0 auto;background:#fff;border-radius:30px;padding:20px;border:4px solid var(--sky);box-shadow:0 10px 0 #cfe8ff}
.pl-quiz h3{margin:0 0 12px;text-align:center}
.pl-ages{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.pl-ages button,.pl-signs button{all:unset;cursor:pointer;text-align:center;border-radius:22px;padding:14px 10px;font-weight:800;color:var(--ink2);border:3px solid transparent}
.pl-ages button:nth-child(1){background:#fff1c2}.pl-ages button:nth-child(2){background:#ffe0dc}.pl-ages button:nth-child(3){background:#d6f5ea}.pl-ages button:nth-child(4){background:#e6dfff}
.pl-ages button b{display:block;font-size:2rem}
.pl-signs{display:grid;gap:8px}.pl-signs button{text-align:left;background:#f3f7ff}
.pl-signs button.sel,.pl-ages button:hover,.pl-signs button:hover{border-color:var(--sky)}
.pl-signs button.sel::before{content:"✅ "}
.pl-q{display:none}.pl-q.on{display:block}
.pl-res{background:#fff6c9;border-radius:18px;padding:14px;font-weight:700;margin-bottom:12px;text-align:center}
.pl-play{display:grid;gap:14px;grid-template-columns:repeat(2,1fr)}@media (min-width:800px){.pl-play{grid-template-columns:repeat(4,1fr)}}
.pl-play div{border-radius:26px;padding:16px;text-align:center;color:var(--ink2);font-weight:700}
.pl-play b{display:block;font-size:2.2rem;margin-bottom:6px}
.pl-play div:nth-child(1){background:#fff1c2}.pl-play div:nth-child(2){background:#ffe0dc}.pl-play div:nth-child(3){background:#d6f5ea}.pl-play div:nth-child(4){background:#e6dfff}
.pl-polaroids{display:flex;gap:14px;overflow-x:auto;padding:12px 4px 18px;scroll-snap-type:x mandatory}
.pl-polaroids figure{flex:0 0 min(70%,260px);margin:0;background:#fff;padding:10px 10px 14px;border-radius:14px;box-shadow:0 8px 18px rgba(43,35,80,.14);scroll-snap-align:start}
.pl-polaroids figure:nth-child(odd){transform:rotate(-2deg)}.pl-polaroids figure:nth-child(even){transform:rotate(2deg)}
.pl-polaroids img{width:100%;height:auto;aspect-ratio:1/1;object-fit:cover;border-radius:8px;display:block}
.pl-polaroids figcaption{text-align:center;font-weight:800;color:var(--ink2);margin-top:8px}
.pl-path{display:grid;gap:14px}@media (min-width:800px){.pl-path{grid-template-columns:repeat(3,1fr)}}
.pl-path div{position:relative;background:#fff;border-radius:26px;padding:18px 16px 16px;border:3px solid var(--line)}
.pl-path i{position:absolute;top:-16px;left:16px;font-style:normal;background:var(--grape);color:#fff;font-weight:900;border-radius:999px;width:36px;height:36px;display:grid;place-items:center}
.pl-path b{display:block;margin:6px 0 4px;color:var(--ink2);font-size:1.1rem}
.pl-teacher{display:grid;gap:16px;align-items:center;background:linear-gradient(135deg,#e9f4ff,#fff1e6);border-radius:30px;padding:18px}
@media (min-width:700px){.pl-teacher{grid-template-columns:220px 1fr}}
.pl-teacher img{width:100%;height:auto;aspect-ratio:1/1;object-fit:cover;border-radius:50%;border:6px solid #fff;display:block}
.pl-bubbles{display:grid;gap:12px}@media (min-width:800px){.pl-bubbles{grid-template-columns:repeat(3,1fr)}}
.pl-bubbles figure{margin:0;background:#fff;border-radius:24px 24px 24px 6px;padding:14px 16px;border:3px solid #ffe0dc}
.pl-bubbles .stars{color:#ffb800}.pl-bubbles cite{font-style:normal;color:#6b6590;font-size:.9rem}
.pl-end{text-align:center;border-radius:36px;padding:30px 18px;background:linear-gradient(160deg,#fff1c2,#ffe0dc)}
.pl-note{text-align:center;color:#6b6590;font-size:.9rem}
"""

WAVE = '<svg class="pl-wave" viewBox="0 0 1200 40" preserveAspectRatio="none" aria-hidden="true"><path d="M0 20 Q 75 0 150 20 T 300 20 T 450 20 T 600 20 T 750 20 T 900 20 T 1050 20 T 1200 20" fill="none" stroke="#ffd23f" stroke-width="6" stroke-linecap="round"/></svg>'


def body():
    ages = [("🍼", "Under 18 months"), ("🧸", "18 months – 2 years"), ("🎈", "2 – 3 years"), ("🎒", "Older than 3")]
    age_btns = "".join(f'<button type="button" data-age="{bp.esc(a)}"><b>{e}</b>{bp.esc(a)}</button>' for e, a in ages)
    signs = [x for _, items in CHECKS for x in items][:6]
    sign_btns = "".join(f'<button type="button" data-sign="{bp.esc(s)}">{bp.esc(s)}</button>' for s in signs)
    bubbles = "".join(f'<figure><div class="stars">★★★★★</div><p style="margin:.3em 0">“{bp.esc(q)}”</p><cite>{bp.esc(w)}</cite></figure>' for q, w in REVIEWS)
    return f"""<style>{CSS}</style>
<div class="pl">
<p style="background:#fff3cd;color:#664d03;border:1px solid #ffe69c;border-radius:12px;padding:8px 12px;font-size:.9rem;margin:8px 0 0">PREVIEW ONLY: Layout D, Play &amp; Learn. Not live.</p>
<section class="pl-hero">
<span class="pl-float" style="top:14px;right:18px">⭐</span><span class="pl-float" style="bottom:18px;left:14px;animation-delay:1s">🎨</span><span class="pl-float" style="top:46%;right:46%;animation-delay:2s">💬</span>
<div class="grid">
<div>
<span class="pl-tag">🎈 Play · Talk · Grow</span>
<h1><span class="w1">Little words</span> <span class="w2">start</span> <span class="w3">with play!</span></h1>
<p class="lead">Is your toddler taking a little longer to talk? At Vocalzz, children learn to talk through games, songs, puppets and play, with a speech therapist who keeps every visit playful. And you get easy play ideas to try at home.</p>
<div class="cta-row"><a class="btn btn-wa" href="{WA}" target="_blank" rel="noopener">💬 Say hello on WhatsApp</a><a class="btn btn-ghost" href="{bp.TEL}">📞 Call us</a></div>
<div class="pl-chips"><span>⭐ 4.9 · 129 Google reviews</span><span>🧑‍⚕️ Dr. Tanu Garg · 10+ years</span><span>📍 Logix Blossom County, Sector 137</span></div>
</div>
<div class="pl-photo">{img("play-tent", "Dr. Tanu Garg playing with children inside a play tent", lazy=False)}</div>
</div>
</section>
{WAVE}

<section class="pl-sec"><h2>🎯 Quick check for parents</h2><p class="sub">Two taps. No pressure. Not a diagnosis, just a friendly first step.</p>
<div class="pl-quiz" id="pq">
<div class="pl-q on" data-step="1"><h3>How old is your little one?</h3><div class="pl-ages">{age_btns}</div></div>
<div class="pl-q" data-step="2"><h3>Does any of this sound familiar?</h3><div class="pl-signs">{sign_btns}</div>
<p style="text-align:center;margin:14px 0 0"><button type="button" class="btn btn-wa" id="pq-next">Show my next step ✨</button></p></div>
<div class="pl-q" data-step="3"><div class="pl-res" id="pq-res"></div>
<p style="text-align:center;margin:0"><a class="btn btn-wa" id="pq-wa" href="{WA}" target="_blank" rel="noopener">💬 Send to our therapist</a></p>
<p class="pl-note" style="margin:10px 0 0">Every child is different and grows at their own pace.</p></div>
</div></section>

<section class="pl-sec"><h2>🧩 How we learn through play</h2>
<div class="pl-play">
<div><b>🎵</b>Songs &amp; rhymes for new sounds</div>
<div><b>🧸</b>Toys &amp; pretend play for first words</div>
<div><b>📚</b>Picture books for understanding</div>
<div><b>🤸</b>Movement &amp; sensory play for focus</div>
</div></section>

<section class="pl-sec"><h2>📸 A peek inside our play rooms</h2>
<div class="pl-polaroids">
<figure>{img("play-tent", "Play tent time", sizes="260px")}<figcaption>Tent time! ⛺</figcaption></figure>
<figure>{img("sensory-room", "The sensory room", sizes="260px")}<figcaption>Our sensory room 🌈</figcaption></figure>
<figure>{img("attention-tablet", "Activity time with a therapist", sizes="260px")}<figcaption>Learning together ✏️</figcaption></figure>
<figure>{img("sensory-swing-puzzle", "Swing and puzzle play", sizes="260px")}<figcaption>Swing &amp; puzzle 🧩</figcaption></figure>
</div></section>

<section class="pl-sec"><h2>🗺️ Your first visit</h2>
<div class="pl-path">
<div><i>1</i><b>Say hello 👋</b>Tell us about your child on WhatsApp. We'll find a time that suits you.</div>
<div><i>2</i><b>Play together 🎲</b>Your child plays while our therapist gently observes how they communicate.</div>
<div><i>3</i><b>Your play plan 🌱</b>Simple goals in plain words and fun activities to try at home.</div>
</div></section>

<section class="pl-sec"><h2>👋 Meet Dr. Tanu</h2>
<div class="pl-teacher">{img("assessment-desk", "Dr. Tanu Garg", sizes="220px")}
<div><h3 style="margin:0">Dr. Tanu Garg</h3><p style="margin:.3em 0">Speech-Language Therapist with 10+ years of helping little ones find their words. Previously at Fortis Noida and BL Kapoor Hospital. Her sessions are built around play, so children enjoy coming back.</p></div>
</div></section>

<section class="pl-sec"><h2>💛 Happy parents</h2><div class="pl-bubbles">{bubbles}</div></section>

<section class="pl-sec"><h2>🤔 Parents often ask</h2>{bp.faq_html([
    ("Mera 2 saal ka baccha nahi bolta. Kya yeh normal hai?", "Children grow at different speeds, but most 2 year olds use many single words and are starting to join two. If yours isn't, a play-based assessment helps you understand why and what to do next."),
    ("Will my child enjoy it?", "Sessions are built around games, toys and songs, so most children see it as play time. We go at your child's pace."),
    ("Is screen time the reason?", "Too much screen time can mean fewer chances to talk and play together. Reducing it often helps, but there's usually more than one reason, so we start with an assessment."),
])}</section>

<section class="pl-end"><h2 style="margin-top:0">Let's play, talk and grow together 🌈</h2>
<p>Send us your child's age and what you've noticed. We reply on WhatsApp 7 days a week.</p>
<a class="btn btn-wa" href="{WA}" target="_blank" rel="noopener">💬 WhatsApp us</a>
<p class="pl-note" style="margin:12px 0 0">Tower E-004, Logix Blossom County, Sector 137, Noida · Clinic visits Mon–Sat, 10 am–8 pm</p></section>
</div>
<script>
(function () {{
  var box = document.getElementById("pq"), age = "", picked = [];
  function show(n) {{ box.querySelectorAll(".pl-q").forEach(function (q) {{ q.classList.toggle("on", q.dataset.step == n); }}); }}
  box.querySelectorAll("[data-age]").forEach(function (b) {{ b.onclick = function () {{ age = b.dataset.age; show(2); }}; }});
  box.querySelectorAll("[data-sign]").forEach(function (b) {{ b.onclick = function () {{
    b.classList.toggle("sel"); var s = b.dataset.sign, i = picked.indexOf(s); if (i < 0) picked.push(s); else picked.splice(i, 1); }}; }});
  document.getElementById("pq-next").onclick = function () {{
    var n = picked.length;
    document.getElementById("pq-res").textContent = n === 0 ? "Lovely! If you're still unsure, a friendly chat can put your mind at rest. 😊"
      : n === 1 ? "You picked 1 sign. A quick chat with our speech therapist is a great next step. 🌱"
      : "You picked " + n + " signs. A play-based assessment can show what will help your child most. 🌈";
    document.getElementById("pq-wa").href = "{bp.WA}?text=" + encodeURIComponent("Hi Vocalzz, my child is " + age + ". Signs I noticed: " + (picked.join("; ") || "none") + ".");
    show(3);
  }};
}})();
</script>"""


def build(out: Path):
    old = bp.ROOT
    bp.ROOT = out
    try:
        bp.page("/child-not-talking-d/", "Layout D preview | Vocalzz Speech & Audio", "Preview",
                [("Home", "/"), ("Services", "/services/"), ("Child Not Talking Yet?", "/child-not-talking/")], body(), [])
    finally:
        bp.ROOT = old


if __name__ == "__main__":
    build(Path(sys.argv[1]))
