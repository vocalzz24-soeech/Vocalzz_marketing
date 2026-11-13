"""Parent tips articles for vocalzz.com/blog/.

status: "draft" -> built into website/drafts/ for review only (not served on the live site)
        "published" -> built into public/blog/<slug>/ and listed on /blog/ and in the sitemap
Only publish after Dr. Tanu Garg has reviewed the article (set reviewed_on).
Write simply and warmly. No guarantees, timelines or statistics; "every child is different".
Body is HTML made of <p>, <h2>, <ul>/<li> and <strong> only.
"""

POSTS = [
    {
        "slug": "late-talker-signs",
        "status": "draft",
        "date": "2026-11-16",
        "reviewed_on": None,  # e.g. "2026-11-17" once Dr. Tanu approves
        "title": "Late talker or speech delay? Signs to watch in toddlers, and when to get help",
        "seo_title": "Late Talker or Speech Delay? Signs to Watch in Toddlers | Vocalzz Noida",
        "description": "Is your toddler a late talker? Simple signs to watch at 12 months, 18 months, 2 and 3 years, what you can do at home, and when a speech assessment may help.",
        "summary": "\"Kab bolega?\" Signs to watch at each age, what you can try at home, and when it's worth getting advice.",
        "service": ("Speech & Language Therapy", "/speech-language-therapy/"),
        "wa": "Hi Vocalzz, I read your article on late talkers and I'd like advice about my child.",
        "body": """
<p>"Kab bolega?" It's one of the most common worries we hear from parents in Noida. Maybe a cousin of the same age is already chatting away, or a relative says "boys talk late, don't worry". It's hard to know when to wait and when to ask for advice.</p>
<p>Every child develops at their own pace, so there is a wide range of normal. This guide explains what is usually expected at each age, the signs that are worth checking, and simple things you can start at home today.</p>

<h2>What's usually expected, roughly by age</h2>
<ul>
<li><strong>Around 12 months:</strong> babbles with different sounds ("ba-ba", "da-da"), turns to their name, uses gestures like waving or pointing, and may say a first word.</li>
<li><strong>Around 18 months:</strong> says several single words and understands simple instructions like "give me the ball".</li>
<li><strong>Around 2 years:</strong> uses many words and starts joining two words together, like "more milk" or "papa gaya".</li>
<li><strong>Around 3 years:</strong> talks in short sentences, and family members understand most of what they say.</li>
</ul>
<p>These are general guides, not tests. A child who is a little behind in one area may be doing very well in another.</p>

<h2>Signs it's worth getting advice</h2>
<ul>
<li>By <strong>12 months</strong>: little babbling, doesn't respond to their name, or doesn't point or wave.</li>
<li>By <strong>18 months</strong>: few or no words, or doesn't seem to understand simple words.</li>
<li>By <strong>2 years</strong>: not joining two words, or mostly copying rather than using their own words.</li>
<li>By <strong>3 years</strong>: speech is very hard for family to understand, or they don't use short sentences.</li>
<li>At <strong>any age</strong>: frequent frustration or tantrums because they can't make themselves understood.</li>
</ul>
<p><strong>Please don't wait</strong> if your child <strong>stops using words or skills they had before</strong>, at any age. Speak to your paediatrician and get an assessment promptly.</p>

<h2>Why hearing should be checked too</h2>
<p>Children learn to talk by listening. Even a mild or temporary hearing problem, for example after repeated ear infections, can affect speech. If your child's speech is late, a hearing check is a simple and important first step.</p>

<h2>Things you can try at home, starting today</h2>
<ul>
<li><strong>Talk through daily routines.</strong> Name what you're doing during bath time, meals and getting dressed: "Shirt on! Now socks."</li>
<li><strong>Follow your child's lead.</strong> Talk about what they are looking at or playing with, not what you want them to look at.</li>
<li><strong>Add one word.</strong> If your child says "ball", you say "big ball" or "ball gone".</li>
<li><strong>Wait.</strong> After you ask a question or pause in a game, count silently to five. Children often need time to respond.</li>
<li><strong>Read and sing together</strong> every day, in whichever languages your family speaks at home.</li>
<li><strong>Reduce background screens.</strong> Face-to-face play and conversation are what help speech the most.</li>
</ul>

<h2>"Wait and see" or get advice?</h2>
<p>If you're unsure, getting advice early doesn't hurt. An assessment can either reassure you that your child is on track, or help you start the right support sooner. Either way, you'll know more than you do today.</p>

<h2>What happens at a speech assessment at Vocalzz</h2>
<p>We start by listening to you: your concerns, your child's history and what they enjoy. Then we play and interact with your child to understand how they communicate and understand. Afterwards we explain what we noticed in simple words, suggest whether a hearing check is needed, and share a plan if support would help, including activities to practise at home. Every child is different, so we don't promise fixed timelines; we set realistic goals together and review them.</p>
""",
    },
]
