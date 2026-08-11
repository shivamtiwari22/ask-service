import ServiceDocumentRequirement from "../src/models/ServiceDocumentRequirementModel.js";
import VendorDocument from "../src/models/VendorDocumentModel.js";

const toIdString = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  return value.toString?.() || null;
};

/**
 * Resolve the service category id used for document checks on a lead.
 * Prefers child_category when present, otherwise service_category.
 */
export const getLeadDocumentCategoryId = (lead) => {
  return (
    toIdString(lead?.child_category) ||
    toIdString(lead?.service_category) ||
    null
  );
};

/**
 * Build a map: serviceCategoryId -> document_verified (boolean)
 * for the given vendor and category ids.
 *
 * Rules:
 * - No required ACTIVE docs for the category → true
 * - All required docs Verified for the vendor → true
 * - Otherwise → false
 */
export async function buildDocumentVerifiedByCategoryMap(
  vendorId,
  categoryIds = [],
) {
  const uniqueIds = [
    ...new Set(
      (categoryIds || []).map((id) => toIdString(id)).filter(Boolean),
    ),
  ];
  const result = new Map();
  for (const id of uniqueIds) {
    result.set(id, true);
  }
  if (!vendorId || !uniqueIds.length) return result;

  const requiredDocs = await ServiceDocumentRequirement.find({
    service_category: { $in: uniqueIds },
    status: "ACTIVE",
    deletedAt: null,
    is_required: true,
  })
    .select("_id service_category")
    .lean();

  const requiredByCategory = new Map(uniqueIds.map((id) => [id, []]));
  for (const doc of requiredDocs) {
    const cats = Array.isArray(doc.service_category)
      ? doc.service_category
      : [doc.service_category];
    for (const cat of cats) {
      const catId = toIdString(cat);
      if (catId && requiredByCategory.has(catId)) {
        requiredByCategory.get(catId).push(doc._id.toString());
      }
    }
  }

  const allRequiredIds = [
    ...new Set(requiredDocs.map((d) => d._id.toString())),
  ];
  if (!allRequiredIds.length) return result;

  const verifiedDocs = await VendorDocument.find({
    user_id: vendorId,
    document_id: { $in: allRequiredIds },
    status: "Verified",
  })
    .select("document_id")
    .lean();

  const verifiedSet = new Set(
    verifiedDocs.map((d) => d.document_id.toString()),
  );

  for (const [catId, reqIds] of requiredByCategory.entries()) {
    result.set(
      catId,
      reqIds.length === 0 || reqIds.every((id) => verifiedSet.has(id)),
    );
  }

  return result;
}

export async function isLeadDocumentVerified(vendorId, lead) {
  const categoryId = getLeadDocumentCategoryId(lead);
  if (!categoryId) return true;
  const map = await buildDocumentVerifiedByCategoryMap(vendorId, [categoryId]);
  return map.get(categoryId) ?? true;
}
