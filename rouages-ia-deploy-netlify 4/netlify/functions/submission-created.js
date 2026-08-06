// Netlify Function spéciale : le nom exact "submission-created" est reconnu
// automatiquement par Netlify Forms, qui appelle cette fonction à CHAQUE
// soumission de formulaire du site (aucune configuration supplémentaire requise
// à part la variable d'environnement SLACK_WEBHOOK_URL).
// Doc Netlify: https://docs.netlify.com/forms/notifications/#notifications-with-serverless-functions

exports.handler = async (event) => {
  try {
    const payload = JSON.parse(event.body || "{}");
    const submission = payload.payload || {};
    const data = submission.data || {};
    const formName = submission.form_name || "contact";

    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      console.warn("SLACK_WEBHOOK_URL non configurée — notification Slack ignorée.");
      return { statusCode: 200, body: "ok (no webhook configured)" };
    }

    const nom = data.nom || "(non fourni)";
    const courriel = data.courriel || "(non fourni)";
    const message = data.message || "(vide)";

    const text = [
      `📬 *Nouveau message via le formulaire "${formName}" — Rouages IA*`,
      `*Nom:* ${nom}`,
      `*Courriel:* ${courriel}`,
      `*Message:*\n${message}`,
    ].join("\n");

    const slackRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!slackRes.ok) {
      console.error("Échec envoi Slack:", slackRes.status, await slackRes.text());
    }

    return { statusCode: 200, body: "ok" };
  } catch (err) {
    console.error("Erreur notify Slack:", err);
    // On répond quand même 200 pour ne pas faire échouer la soumission du formulaire
    // côté visiteur — l'erreur est seulement loguée côté Netlify.
    return { statusCode: 200, body: "error logged" };
  }
};
