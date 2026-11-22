// Google Ads conversion tracking: counts a conversion when someone taps a WhatsApp link.
// The Google tag (GTM-KSX477XK) is loaded in <head>; this only sends the conversion event.
(function () {
  var WHATSAPP_CLICK = "AW-18589489528/3wyfCKjmwL0dEPiylKBF";
  function send(sendTo) {
    if (typeof window.gtag !== "function") return;
    window.gtag("event", "conversion", { send_to: sendTo, transport_type: "beacon" });
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (/^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(href)) send(WHATSAPP_CLICK);
  }, true);
})();
