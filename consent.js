/**
 * Gestion du consentement aux traceurs — ob-lepuy.fr
 *
 * Le pixel Meta n'est chargé qu'après acceptation explicite.
 * Aucun traceur publicitaire n'est déposé avant le clic de l'Utilisateur.
 *
 * ─────────────────────────────────────────────────────────────
 * À FAIRE : renseigner PIXEL_ID ci-dessous avec l'identifiant du
 * pixel créé dans le Gestionnaire d'événements Meta.
 * Tant que la valeur est vide, le bandeau fonctionne normalement
 * mais aucun pixel n'est chargé.
 * ─────────────────────────────────────────────────────────────
 */
(function () {
  var PIXEL_ID = ""; // ex. "123456789012345"
  var CLE = "ob_consent";
  var DUREE_MOIS = 6;

  // ---------------------------------------------------------------- stockage
  // Enveloppé : certains navigateurs bloquent le stockage local.
  // En cas d'échec, le bandeau se réaffiche à chaque visite, ce qui reste
  // conforme — mieux vaut redemander que présumer un accord.
  var memoire = null;

  function lire() {
    try {
      var v = JSON.parse(localStorage.getItem(CLE) || "null");
      if (v && v.exp > Date.now()) return v.choix;
      if (v) localStorage.removeItem(CLE);
      return null;
    } catch (e) {
      return memoire;
    }
  }

  function ecrire(choix) {
    var exp = Date.now() + DUREE_MOIS * 30 * 24 * 3600 * 1000;
    memoire = choix;
    try {
      localStorage.setItem(CLE, JSON.stringify({ choix: choix, exp: exp }));
    } catch (e) {}
  }

  // ------------------------------------------------------------------ pixel
  var pixelCharge = false;

  function chargerPixel() {
    if (pixelCharge || !PIXEL_ID) return;
    pixelCharge = true;

    /* eslint-disable */
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    /* eslint-enable */

    fbq("init", PIXEL_ID);
    fbq("track", "PageView");
  }

  // ------------------------------------------------------------------ styles
  var css = document.createElement("style");
  css.textContent = [
    "#ob-consent{position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#10113C;color:#fff;",
    "border-top:1px solid rgba(255,255,255,.18);padding:20px 4vw calc(20px + env(safe-area-inset-bottom));",
    "font-family:'Inter',system-ui,sans-serif;line-height:1.55;box-shadow:0 -8px 30px rgba(0,0,0,.25)}",
    "#ob-consent .in{width:min(1120px,100%);margin-inline:auto;display:flex;flex-direction:column;gap:16px}",
    "@media(min-width:900px){#ob-consent .in{flex-direction:row;align-items:center;gap:32px}}",
    "#ob-consent p{margin:0;font-size:.87rem;color:rgba(255,255,255,.78);max-width:70ch}",
    "#ob-consent strong{color:#fff;display:block;font-family:'Jost',system-ui,sans-serif;text-transform:uppercase;",
    "letter-spacing:.02em;font-size:.98rem;font-weight:700;margin-bottom:6px}",
    "#ob-consent a{color:#fff}",
    "#ob-consent .act{display:flex;gap:10px;flex-shrink:0}",
    "@media(max-width:520px){#ob-consent .act{flex-direction:column-reverse}}",
    "#ob-consent button{font-family:'Jost',system-ui,sans-serif;text-transform:uppercase;font-weight:700;",
    "letter-spacing:.06em;font-size:.79rem;padding:14px 24px;border-radius:10px;cursor:pointer;border:1.5px solid transparent;",
    "white-space:nowrap;transition:background .12s}",
    "#ob-consent .ok{background:#1941FF;color:#fff}",
    "#ob-consent .ok:hover{background:#0f31d6}",
    "#ob-consent .no{background:transparent;color:#fff;border-color:rgba(255,255,255,.5)}",
    "#ob-consent .no:hover{background:rgba(255,255,255,.12)}",
    "#ob-consent button:focus-visible{outline:3px solid #fff;outline-offset:2px}"
  ].join("");
  document.head.appendChild(css);

  // ----------------------------------------------------------------- bandeau
  var banniere = null;

  function afficher() {
    if (banniere) return;

    banniere = document.createElement("div");
    banniere.id = "ob-consent";
    banniere.setAttribute("role", "dialog");
    banniere.setAttribute("aria-label", "Gestion des traceurs");
    banniere.innerHTML =
      '<div class="in">' +
      "<p><strong>Cookies</strong>" +
      "Nous utilisons un cookie à des fins de mesures statistiques. " +
      "Il n'est déposé qu'avec ton accord. Le refus n'a aucune conséquence sur ta navigation ni sur ta demande. " +
      'En savoir plus dans la <a href="/confidentialite">politique de confidentialité</a>.</p>' +
      '<div class="act">' +
      '<button type="button" class="no">Refuser</button>' +
      '<button type="button" class="ok">Accepter</button>' +
      "</div></div>";

    document.body.appendChild(banniere);

    banniere.querySelector(".ok").addEventListener("click", function () {
      ecrire("accepte");
      fermer();
      chargerPixel();
    });
    banniere.querySelector(".no").addEventListener("click", function () {
      ecrire("refuse");
      fermer();
    });
  }

  function fermer() {
    if (!banniere) return;
    banniere.remove();
    banniere = null;
  }

  // -------------------------------------------------------------- ouverture
  // Le lien « Gérer mes préférences » du pied de page réaffiche le bandeau.
  // Tout élément portant l'attribut data-consent déclenche cette réouverture.
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-consent]");
    if (!el) return;
    e.preventDefault();
    afficher();
    banniere.scrollIntoView({ block: "end" });
  });

  window.obConsent = { ouvrir: afficher, etat: lire };

  // ------------------------------------------------------------- initialisation
  var choix = lire();
  if (choix === "accepte") chargerPixel();
  else if (choix === null) afficher();
})();
