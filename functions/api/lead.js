/**
 * Réception des leads de la landing page.
 * Cloudflare Pages Function — route automatique : POST /api/lead
 *
 * Variables d'environnement à définir dans le tableau de bord Cloudflare
 * (Pages > le projet > Settings > Environment variables) :
 *
 *   RESEND_API_KEY     clé API Resend (à créer comme "secret", pas comme texte)
 *   MAIL_FROM          ex. "L'Orange bleue Le Puy <contact@ob-lepuy.fr>"
 *   MAIL_TO            lorangebleue.lepuyenvelay@gmail.com
 *   SHEET_URL          URL du script Google Apps Script déployé
 *   SHEET_SECRET       mot de passe partagé avec le script Google (à créer comme "secret")
 *   FB_PIXEL_ID        1471922334761207
 *   FB_CAPI_TOKEN      token généré dans Événements Manager > API Conversions (à créer comme "secret")
 */

const CORS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const ok = (data) => new Response(JSON.stringify(data), { status: 200, headers: CORS });
const ko = (msg, code = 400) =>
  new Response(JSON.stringify({ ok: false, error: msg }), { status: code, headers: CORS });

/** Nettoie une chaîne : coupe, limite la longueur, neutralise le HTML. */
function clean(v, max = 120) {
  return String(v ?? "")
    .trim()
    .slice(0, max)
    .replace(/[<>]/g, "");
}

const isEmail = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v);
const isTel = (v) => v.replace(/[^\d+]/g, "").length >= 10;

/** Hash SHA-256 requis par Meta pour email/téléphone (PII jamais envoyée en clair). */
async function sha256Hex(v) {
  const data = new TextEncoder().encode(v.trim().toLowerCase());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return ko("Corps de requête illisible");
  }

  // --- Anti-robot ---------------------------------------------------------
  // 1. Champ piège : invisible pour un humain, rempli par la plupart des bots.
  if (clean(body.societe)) return ok({ ok: true }); // on répond 200 pour ne pas informer le bot
  // 2. Délai de saisie : un formulaire rempli en moins de 3 secondes n'est pas humain.
  if (Number(body.duree_ms) > 0 && Number(body.duree_ms) < 3000) return ok({ ok: true });

  // --- Validation ---------------------------------------------------------
  const lead = {
    prenom: clean(body.prenom, 60),
    nom: clean(body.nom, 60),
    email: clean(body.email, 120).toLowerCase(),
    tel: clean(body.tel, 30),
    offre: clean(body.offre, 80),
    source: clean(body.source, 60),
    campagne: clean(body.campagne, 80),
    recu_le: new Date().toISOString(),
    pays: request.headers.get("CF-IPCountry") || "",
  };

  if (!lead.prenom || !lead.nom) return ko("Prénom et nom obligatoires");
  if (!isEmail(lead.email)) return ko("Email invalide");
  if (!isTel(lead.tel)) return ko("Téléphone invalide");

  // --- Envois en parallèle ------------------------------------------------
  const [sheet, mail, meta] = await Promise.allSettled([
    versSheet(lead, env),
    versEmail(lead, env),
    versMeta(lead, request, env),
  ]);

  const sheetOk = sheet.status === "fulfilled";
  const mailOk = mail.status === "fulfilled";
  const metaEventId = meta.status === "fulfilled" ? meta.value : null;

  if (!sheetOk) console.error("Sheet KO :", sheet.reason);
  if (!mailOk) console.error("Email KO :", mail.reason);
  if (!metaEventId) console.error("Meta CAPI KO :", meta.reason);

  // Tant qu'un des deux canaux principaux a fonctionné, le lead n'est pas perdu :
  // on confirme au visiteur plutôt que de lui faire ressaisir le formulaire.
  // La CAPI est un bonus de tracking, jamais bloquant pour la confirmation.
  if (sheetOk || mailOk) return ok({ ok: true, sheet: sheetOk, mail: mailOk, metaEventId });
  return ko("Enregistrement impossible", 502);
}

/** Écriture dans la Google Sheet via Apps Script. */
async function versSheet(lead, env) {
  if (!env.SHEET_URL) throw new Error("SHEET_URL absente");
  const r = await fetch(env.SHEET_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...lead, secret: env.SHEET_SECRET }),
  });
  if (!r.ok) throw new Error("Apps Script HTTP " + r.status);
  return true;
}

/** Notification email via Resend. */
async function versEmail(lead, env) {
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY absente");

  const l = (k, v) =>
    `<tr><td style="padding:6px 14px 6px 0;color:#6b6b7a;font:14px system-ui">${k}</td>` +
    `<td style="padding:6px 0;font:600 14px system-ui;color:#10113C">${v || "—"}</td></tr>`;

  const html = `
  <div style="font:14px/1.6 system-ui,sans-serif;color:#10113C;max-width:520px">
    <p style="font:700 16px system-ui;margin:0 0 4px">Nouveau lead — landing page</p>
    <p style="color:#6b6b7a;margin:0 0 18px">${lead.offre || "Sans offre précisée"}</p>
    <table style="border-collapse:collapse">
      ${l("Prénom", lead.prenom)}
      ${l("Nom", lead.nom)}
      ${l("Email", `<a href="mailto:${lead.email}">${lead.email}</a>`)}
      ${l("Téléphone", `<a href="tel:${lead.tel.replace(/\s/g, "")}">${lead.tel}</a>`)}
      ${l("Source", lead.source)}
      ${l("Campagne", lead.campagne)}
      ${l("Reçu le", new Date(lead.recu_le).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }))}
    </table>
    <p style="color:#6b6b7a;font-size:12px;margin-top:22px">
      Répondre à ce message écrit directement au prospect.
    </p>
  </div>`;

  const texte = [
    `Nouveau lead — ${lead.offre}`,
    `${lead.prenom} ${lead.nom}`,
    `Email : ${lead.email}`,
    `Téléphone : ${lead.tel}`,
    `Source : ${lead.source} / ${lead.campagne}`,
  ].join("\n");

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [env.MAIL_TO],
      reply_to: lead.email,
      subject: `Lead — ${lead.prenom} ${lead.nom}`,
      html,
      text: texte,
    }),
  });

  if (!r.ok) throw new Error("Resend HTTP " + r.status + " " + (await r.text()));
  return true;
}

/** Envoi côté serveur à l'API Conversions Meta — événement Lead. */
async function versMeta(lead, request, env) {
  if (!env.FB_CAPI_TOKEN || !env.FB_PIXEL_ID) throw new Error("FB_CAPI_TOKEN/FB_PIXEL_ID absente(s)");

  const eventId = crypto.randomUUID();
  const cookies = request.headers.get("Cookie") || "";
  const fbp = cookies.match(/_fbp=([^;]+)/)?.[1];
  const fbc = cookies.match(/_fbc=([^;]+)/)?.[1];

  const userData = {
    client_ip_address: request.headers.get("CF-Connecting-IP"),
    client_user_agent: request.headers.get("User-Agent"),
    em: [await sha256Hex(lead.email)],
    ph: [await sha256Hex(lead.tel.replace(/\D/g, ""))],
  };
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  const payload = {
    data: [
      {
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        event_source_url: "https://ob-lepuy.fr/",
        action_source: "website",
        user_data: userData,
      },
    ],
    access_token: env.FB_CAPI_TOKEN,
  };

  const r = await fetch(`https://graph.facebook.com/v21.0/${env.FB_PIXEL_ID}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error("Meta CAPI HTTP " + r.status + " " + (await r.text()));
  return eventId;
}

/** Toute autre méthode que POST est refusée. */
export const onRequest = ({ request }) =>
  request.method === "POST" ? undefined : ko("Méthode non autorisée", 405);
