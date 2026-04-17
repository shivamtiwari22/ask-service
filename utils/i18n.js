const SUPPORTED_LANGUAGES = new Set(["en", "fr"]);

const FR_TRANSLATIONS = {
  Continue: "Continuer",
  Processing: "Traitement en cours",
  OK: "OK",
  Created: "Créé",
  Accepted: "Accepté",
  "No Content": "Aucun contenu",
  "Bad Request": "Requête invalide",
  Unauthorized: "Non autorisé",
  Forbidden: "Interdit",
  "Not Found": "Introuvable",
  Conflict: "Conflit",
  "Too Many Requests": "Trop de requêtes",
  "Internal Server Error": "Erreur interne du serveur",
  "Service Unavailable": "Service indisponible",
  "Rate limit exceeded. You are temporarily blocked for 4 minutes.":
    "Limite de requêtes dépassée. Vous êtes temporairement bloqué pendant 4 minutes.",
  "Too many requests. You are blocked for 4 minutes.":
    "Trop de requêtes. Vous êtes bloqué pendant 4 minutes.",
  "User not found": "Utilisateur introuvable",
  Unauthorized: "Non autorisé",
  "Invalid credentials": "Identifiants invalides",
  "Login successful": "Connexion réussie",
  "Password reset successfully": "Mot de passe réinitialisé avec succès",
  "Profile updated successfully": "Profil mis à jour avec succès",
  "Service request created": "Demande de service créée",
  "Service request updated successfully":
    "Demande de service mise à jour avec succès",
  "Service request closed successfully":
    "Demande de service fermée avec succès",
  "Service requests fetched successfully":
    "Demandes de service récupérées avec succès",
  "Quote accepted successfully": "Devis accepté avec succès",
  "Quote ignored successfully": "Devis ignoré avec succès",
  "Quote submitted successfully": "Devis envoyé avec succès",
  "Quotes fetched successfully": "Devis récupérés avec succès",
  "Quote details fetched successfully":
    "Détails du devis récupérés avec succès",
  "Questions fetched successfully":
    "Questions récupérées avec succès",
  "Cities fetched successfully": "Villes récupérées avec succès",
  "Service categories fetched successfully":
    "Catégories de service récupérées avec succès",
  "Notification preferences saved successfully":
    "Préférences de notification enregistrées avec succès",
  "Notification preferences fetched successfully":
    "Préférences de notification récupérées avec succès",
  "Credits purchased successfully": "Crédits achetés avec succès",
  "Balance fetched successfully": "Solde récupéré avec succès",
  "Transactions fetched successfully":
    "Transactions récupérées avec succès",
  "Verification successful": "Vérification réussie",
  "Phone verification required": "Vérification du téléphone requise",
  "Email verification required": "Vérification de l'e-mail requise",
};

const DICTIONARIES = {
  en: {},
  fr: FR_TRANSLATIONS,
};

export function detectLanguage(req) {
  const explicit = String(req?.query?.lang || req?.headers?.["x-lang"] || "")
    .trim()
    .toLowerCase();
  if (SUPPORTED_LANGUAGES.has(explicit)) return explicit;

  const acceptLanguage = String(req?.headers?.["accept-language"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (acceptLanguage.startsWith("fr")) return "fr";
  if (acceptLanguage.startsWith("en")) return "en";
  return "fr";
}

export function translateText(text, lang = "fr") {
  if (typeof text !== "string") return text;
  if (lang === "en") return text;
  const dict = DICTIONARIES[lang] || {};
  return dict[text] || text;
}

