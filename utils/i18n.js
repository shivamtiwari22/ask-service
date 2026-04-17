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
  "Invalid OTP": "OTP invalide",
  "OTP expired": "OTP expire",
  "Invalid OTP for": "OTP invalide pour",
  "Invalid Email OTP": "OTP e-mail invalide",
  "Invalid Phone OTP": "OTP telephone invalide",
  "Email OTP required": "OTP e-mail requis",
  "Phone OTP required": "OTP telephone requis",
  "Email OTP expired": "OTP e-mail expire",
  "Phone OTP expired": "OTP telephone expire",
  "Email Verification OTP expired": "OTP de verification e-mail expire",
  "Phone Verification OTP expired": "OTP de verification telephone expire",
  "New Lead Received": "Nouveau prospect reçu",
  "You have received a new lead. Check the details and respond quickly.":
    "Vous avez reçu un nouveau prospect. Consultez les détails et répondez rapidement.",
  "Low Point Balance": "Solde de points faible",
  "Quote Received 💰": "Devis reçu 💰",
  "You have received a new quote from a vendor. Review it now":
    "Vous avez reçu un nouveau devis d'un prestataire. Consultez-le maintenant.",
  "Quote Accepted": "Devis accepté",
  "New Message": "Nouveau message",
  "This is the dummy push notification!":
    "Ceci est une notification push de test !",
  "📎 Media message": "📎 Message média",
  "Business information not found": "Informations de l'entreprise introuvables",
  "Cannot restore category without restoring its parent category":
    "Impossible de restaurer la catégorie sans restaurer sa catégorie parente",
  "Category cannot be parent of itself":
    "Une catégorie ne peut pas être sa propre parente",
  "Category with same title already exists":
    "Une catégorie avec le même titre existe déjà",
  "Chat Id is required": "L'identifiant du chat est requis",
  "Chat not found": "Discussion introuvable",
  "Contact details are required": "Les coordonnées sont requises",
  "Credit package name already exists":
    "Le nom du pack de crédits existe déjà",
  "Credit package not found": "Pack de crédits introuvable",
  "Credit package not found or not deleted":
    "Pack de crédits introuvable ou non supprimé",
  "Credit wallet not found": "Portefeuille de crédits introuvable",
  "Delete child categories before deleting this category":
    "Supprimez les catégories enfants avant de supprimer cette catégorie",
  "Deleted FAQ not found": "FAQ supprimée introuvable",
  "Deleted question not found": "Question supprimée introuvable",
  "Deleted service category not found":
    "Catégorie de service supprimée introuvable",
  "Email already associated with another account":
    "Cet e-mail est déjà associé à un autre compte",
  "Email already in use": "E-mail déjà utilisé",
  "Email already verified": "E-mail déjà vérifié",
  "Email is not verified": "L'e-mail n'est pas vérifié",
  "Email is required": "L'e-mail est requis",
  "Email not verified": "E-mail non vérifié",
  "Email or phone is required": "L'e-mail ou le téléphone est requis",
  "Error approving innovation": "Erreur lors de l'approbation",
  "FAQ not found": "FAQ introuvable",
  "Failed to create user": "Échec de la création de l'utilisateur",
  "Failed to generate OTP": "Échec de la génération de l'OTP",
  "Failed to reset password":
    "Échec de la réinitialisation du mot de passe",
  "Failed to update profile": "Échec de la mise à jour du profil",
  "Identifier and password are required":
    "L'identifiant et le mot de passe sont requis",
  "Identifier, identifier type and type are required":
    "L'identifiant, le type d'identifiant et le type sont requis",
  "Identifier, password, identifier type and type are required":
    "L'identifiant, le mot de passe, le type d'identifiant et le type sont requis",
  "Insufficient points. Please buy more points.":
    "Points insuffisants. Veuillez acheter plus de points.",
  "Internal server": "Serveur interne",
  "Invalid Code": "Code invalide",
  "Invalid available_start_date": "Date de début disponible invalide",
  "Invalid child category": "Sous-catégorie invalide",
  "Invalid kyc_status. Must be one of: ACTIVE, PENDING, REJECTED":
    "Statut KYC invalide. Doit être l'un de : ACTIVE, PENDING, REJECTED",
  "Invalid old password": "Ancien mot de passe invalide",
  "Invalid package": "Pack invalide",
  "Invalid password": "Mot de passe invalide",
  "Invalid quote price": "Prix du devis invalide",
  "Invalid reason. Use one of: \" + CLOSE_REASONS.join(":
    "Raison invalide. Utilisez une des valeurs autorisées",
  "Invalid report id": "Identifiant du signalement invalide",
  "Invalid role type": "Type de rôle invalide",
  "Invalid service category": "Catégorie de service invalide",
  "Invalid service_id": "service_id invalide",
  "Invalid status value": "Valeur de statut invalide",
  "Invalid status. Must be one of: ${...}":
    "Statut invalide. Doit être l'un de : ${...}",
  "Invalid status. Must be one of: Pending, Verified, Rejected":
    "Statut invalide. Doit être l'un de : Pending, Verified, Rejected",
  "Invalid token": "Jeton invalide",
  "Invalid type": "Type invalide",
  "Invoice transaction not found": "Transaction de facture introuvable",
  "Lead not found or no longer available":
    "Prospect introuvable ou plus disponible",
  "Maximum ${...} quotes have already been submitted for this request. No more quotes can be accepted.":
    "Le maximum de ${...} devis a déjà été soumis pour cette demande. Aucun autre devis ne peut être accepté.",
  "New password & confirm password does not match":
    "Le nouveau mot de passe et la confirmation ne correspondent pas",
  "No email found for this user":
    "Aucun e-mail trouvé pour cet utilisateur",
  "No files uploaded. Send files with fieldname = document_id (ServiceDocumentRequirement _id).":
    "Aucun fichier téléchargé. Envoyez les fichiers avec fieldname = document_id (ServiceDocumentRequirement _id).",
  "No token provided": "Aucun jeton fourni",
  "Only one level child category is allowed":
    "Un seul niveau de sous-catégorie est autorisé",
  "Parent category not found": "Catégorie parente introuvable",
  "Payment not completed": "Paiement non terminé",
  "Phone already in use": "Téléphone déjà utilisé",
  "Phone already verified": "Téléphone déjà vérifié",
  "Phone and OTP are required": "Le téléphone et l'OTP sont requis",
  "Phone is not verified": "Le téléphone n'est pas vérifié",
  "Phone is required": "Le téléphone est requis",
  "Phone number already in use": "Numéro de téléphone déjà utilisé",
  "Phone or email are required": "Le téléphone ou l'e-mail sont requis",
  "Phone or email is required": "Le téléphone ou l'e-mail est requis",
  "Phone, first name and last name are required":
    "Le téléphone, le prénom et le nom sont requis",
  "Please Verify Your account": "Veuillez vérifier votre compte",
  "Please select a service": "Veuillez sélectionner un service",
  "Please select a service first":
    "Veuillez d'abord sélectionner un service",
  "Question key already exists for this service":
    "La clé de question existe déjà pour ce service",
  "Question not found": "Question introuvable",
  "Quote not found": "Devis introuvable",
  "Rating must be between 1 and 5":
    "La note doit être comprise entre 1 et 5",
  "Report not found": "Signalement introuvable",
  "Required fields are missing": "Des champs requis sont manquants",
  "Requirement already exists for this service":
    "L'exigence existe déjà pour ce service",
  "Review not found": "Avis introuvable",
  "Roles not found": "Rôles introuvables",
  "Service Category is required": "La catégorie de service est requise",
  "Service category not found": "Catégorie de service introuvable",
  "Service document requirement not found":
    "Exigence de document de service introuvable",
  "Service document requirement not found or not deleted":
    "Exigence de document de service introuvable ou non supprimée",
  "Service document requirement not found or not soft deleted":
    "Exigence de document de service introuvable ou non supprimée logiquement",
  "Service not found": "Service introuvable",
  "Service request is not active": "La demande de service n'est pas active",
  "Service request not found": "Demande de service introuvable",
  "Session ID required": "L'identifiant de session est requis",
  "Session not found": "Session introuvable",
  "Testimonial master not found":
    "Élément principal de témoignage introuvable",
  "Testimonial master not found or not deleted":
    "Élément principal de témoignage introuvable ou non supprimé",
  "Token has expired": "Le jeton a expiré",
  "Unauthorized access": "Accès non autorisé",
  "Unauthorized user": "Utilisateur non autorisé",
  "User already exists": "L'utilisateur existe déjà",
  "User already exists with this email":
    "Un utilisateur existe déjà avec cet e-mail",
  "User already exists with this phone":
    "Un utilisateur existe déjà avec ce téléphone",
  "User is not active": "L'utilisateur n'est pas actif",
  "UserId body not sent with request":
    "L'identifiant utilisateur n'a pas été envoyé dans la requête",
  "Vendor document not found": "Document prestataire introuvable",
  "Vendor not found": "Prestataire introuvable",
  "Vendor role not found": "Rôle prestataire introuvable",
  "Verification incomplete": "Vérification incomplète",
  "You are not allowed to access this resource":
    "Vous n'êtes pas autorisé à accéder à cette ressource",
  "You are not authorized to access this resource":
    "Vous n'êtes pas autorisé à accéder à cette ressource",
  "You can only review vendors who have purchased your lead":
    "Vous ne pouvez évaluer que les prestataires ayant acheté votre prospect",
  "You cannot report yourself": "Vous ne pouvez pas vous signaler vous-même",
  "You cannot unlock your own lead":
    "Vous ne pouvez pas débloquer votre propre prospect",
  "You have already reported this user":
    "Vous avez déjà signalé cet utilisateur",
  "You have already submitted a quote for this lead":
    "Vous avez déjà soumis un devis pour ce prospect",
  "You have already submitted a review for this service":
    "Vous avez déjà soumis un avis pour ce service",
  "You have already unlocked this lead":
    "Vous avez déjà débloqué ce prospect",
  "You must unlock this lead before submitting a quote":
    "Vous devez débloquer ce prospect avant de soumettre un devis",
  "Your account is not active": "Votre compte n'est pas actif",
  "Your documents are under review. You cannot purchase leads at this time.":
    "Vos documents sont en cours de vérification. Vous ne pouvez pas acheter de prospects pour le moment.",
  "Your service request not found": "Votre demande de service est introuvable",
  "category not found": "Catégorie introuvable",
  error: "erreur",
  "package_id or package_key is required":
    "package_id ou package_key est requis",
  phone: "téléphone",
  "quote_price, service_description and available_start_date are required":
    "quote_price, service_description et available_start_date sont requis",
  "service not found": "service introuvable",
  "service_id is required": "service_id est requis",
  "service_request_id, vendor and rating are required":
    "service_request_id, vendor et rating sont requis",
  "transactionId is required": "transactionId est requis",
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

export function translateNotificationText(text) {
  if (typeof text !== "string") return text;

  if (
    text.startsWith("Your quote for request ") &&
    text.endsWith(" has been accepted.")
  ) {
    const reference = text
      .replace("Your quote for request ", "")
      .replace(" has been accepted.", "");
    return `Votre devis pour la demande ${reference} a ete accepte.`;
  }

  if (text.startsWith("You have a new message from ") && text.endsWith("!")) {
    const senderName = text
      .replace("You have a new message from ", "")
      .replace("!", "");
    return `Vous avez un nouveau message de ${senderName} !`;
  }

  return translateText(text, "fr");
}

