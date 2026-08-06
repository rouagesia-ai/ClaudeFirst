// Netlify Function — relais sécurisé vers l'API Claude (Anthropic) pour le chatbot du site.
// La clé API n'est jamais exposée au navigateur : elle vit uniquement en variable
// d'environnement Netlify (ANTHROPIC_API_KEY), lue ici côté serveur.

const SYSTEM_PROMPT = `Tu es l'assistant virtuel de Rouages IA, une agence d'automatisation IA qui construit des sites web, des automatisations et des agents IA sur mesure pour les PME et organismes.

RÈGLES:
- Réponds UNIQUEMENT à partir des informations ci-dessous. Si la question sort de ce cadre, invite poliment la personne à réserver un appel ou à écrire à rouages.ia@gmail.com plutôt que d'inventer une réponse.
- Sois concis, chaleureux et professionnel — pas de blabla, réponses de quelques phrases maximum.
- Ne donne jamais de conseil légal ou financier.
- Ne mentionne jamais que tu es "Claude" ou "Anthropic" : présente-toi simplement comme l'assistant de Rouages IA.
- Pour un projet plus complexe que les deux forfaits listés, dis que ça se discute lors de l'appel gratuit de 20 minutes.
- Réponds dans la même langue que la personne (français ou anglais).

SERVICES:
1. Sites web — sites vitrines et applications sur mesure, conçus pour convertir et faciliter la gestion au quotidien.
2. Automatisations — formulaires, notifications, relances, intégrations CRM ; élimine les tâches répétitives.
3. Agents IA — chatbots, assistants et agents autonomes qui répondent, traitent et exécutent en continu.

MÉTHODE (4 étapes): Diagnostic → Conception → Construction (développement rapide avec Claude Code) → Mise en marche (déploiement, formation rapide, ajustements).

FORFAITS:
- "Site" — 1 500 $ CAD, paiement unique. Inclut : site vitrine sur mesure, jusqu'à 5 pages, formulaire de contact, mise en ligne incluse.
- "Site + Automatisation" (le plus populaire) — 3 200 $ CAD, paiement unique. Inclut : tout le forfait Site + système de réservation intégré + automatisation des formulaires et notifications + 1 mois de support inclus.
- Projet plus large ou sur mesure : à discuter lors d'un appel.

DÉLAIS: site vitrine simple livré en 5 à 10 jours ouvrables. Avec automatisations, 2 à 3 semaines selon la complexité.

PAIEMENT: carte de crédit ou de débit via Stripe, en un seul paiement sécurisé. Aucune information bancaire ne transite par Rouages IA.

ZONE DE SERVICE: travail à distance, clients acceptés partout, peu importe leur localisation.

CONTACT: rouages.ia@gmail.com, ou réserver un appel de 20 minutes directement sur le site (bouton "Réserver un appel" / "Discutons").`;

const MODEL = process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001";

exports.handler = async (event) => {
  const headers = {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY manquante dans les variables d'environnement Netlify.");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Le chatbot n'est pas encore configuré (clé API manquante)." }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Requête invalide." }) };
  }

  const incoming = Array.isArray(payload.messages) ? payload.messages : [];
  if (incoming.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Aucun message fourni." }) };
  }

  // On ne garde que les derniers échanges et on tronque chaque message,
  // pour limiter le coût et empêcher les abus.
  const messages = incoming.slice(-12).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content || "").slice(0, 2000),
  }));

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Erreur API Anthropic:", data);
      return {
        statusCode: res.status,
        headers,
        body: JSON.stringify({ error: data?.error?.message || "Erreur de l'API Claude." }),
      };
    }

    const reply = (data.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply: reply || "Désolé, je n'ai pas de réponse à donner pour le moment." }),
    };
  } catch (err) {
    console.error("Erreur fonction chat:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Erreur serveur." }) };
  }
};
