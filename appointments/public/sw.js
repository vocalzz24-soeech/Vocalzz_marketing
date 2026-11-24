// Vocalzz Appointments service worker: makes the app installable.
// It does NOT cache pages or data (patient data must always be live and private); it only shows a friendly
// "you're offline" page when there is no connection.
const OFFLINE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline · Vocalzz</title><body style="font-family:system-ui,sans-serif;background:#f4f7fb;color:#0b1220;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px">
<div><img src="/pwa/icon-192.png" width="72" height="72" alt="" style="border-radius:16px"><h1 style="font-size:20px">You're offline</h1>
<p style="color:#5b6474">Vocalzz needs an internet connection. Check Wi-Fi or mobile data, then try again.</p>
<button onclick="location.reload()" style="font-size:16px;padding:10px 18px;border-radius:10px;border:0;background:#1f6fd1;color:#fff">Try again</button></div>`;
self.addEventListener("install", (e) => { e.waitUntil(caches.open("vocalzz-shell-v1").then((c) => c.add("/pwa/icon-192.png"))); self.skipWaiting(); });
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return; // everything else goes straight to the network
  e.respondWith(fetch(e.request).catch(() => new Response(OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } })));
});
