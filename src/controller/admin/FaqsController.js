import handleResponse from "../../../utils/http-response.js";
import ContactUs from "../../models/ContactUsModel.js";
import Faqs from "../../models/FaqsModel.js";

// create FAQ
export const createFaq = async (req, resp) => {
  try {
    const { question, type, answer, status } = req.body;

    const faq = await Faqs.create({
      question,
      type: type || "general",
      answer
    });

    return handleResponse(201, "FAQ created successfully", faq, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// get all FAQs with pagination and search
export const getAllFaqs = async (req, resp) => {
  try {
    const { search, type, status, isDeleted } = req.query;
    const page = parseInt(req.query.page ?? "1");
    const limit = parseInt(req.query.limit ?? "10");

    const isPaginationDisabled = page === 0 && limit === 0;
    const skip = isPaginationDisabled ? 0 : (page - 1) * limit;

    const filter = {};

    if (isDeleted === "true") {
      filter.deletedAt = { $ne: null };
    } else {
      filter.deletedAt = null;
    }

    if (type) {
      filter.type = type;
    }

    if (status !== undefined && status !== "") {
      filter.status = status === "true";
    }

    if (search) {
      filter.$or = [
        { question: { $regex: search, $options: "i" } },
        { answer: { $regex: search, $options: "i" } },
      ];
    }

    let query = Faqs.find(filter).sort({ createdAt: -1 });

    if (!isPaginationDisabled) {
      query = query.skip(skip).limit(limit);
    }

    const [list, total] = await Promise.all([
      query.lean(),
      Faqs.countDocuments(filter),
    ]);

    return handleResponse(
      200,
      "FAQs fetched successfully",
      {
        list,
        pagination: isPaginationDisabled
          ? null
          : {
              total,
              page,
              limit,
              totalPages: Math.ceil(total / limit),
            },
      },
      resp
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// get FAQ by id
export const getFaqById = async (req, resp) => {
  try {
    const { id } = req.params;

    const faq = await Faqs.findOne({ _id: id, deletedAt: null }).lean();

    if (!faq) {
      return handleResponse(404, "FAQ not found", {}, resp);
    }

    return handleResponse(200, "FAQ fetched successfully", faq, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// update FAQ
export const updateFaq = async (req, resp) => {
  try {
    const { id } = req.params;
    const { question, type, answer, status } = req.body;

    const faq = await Faqs.findOne({ _id: id, deletedAt: null });
    if (!faq) {
      return handleResponse(404, "FAQ not found", {}, resp);
    }

    const payload = {};
    if (question !== undefined) payload.question = question;
    if (type !== undefined) payload.type = type;
    if (answer !== undefined) payload.answer = answer;
    if (status !== undefined) payload.status = status;

    const updatedFaq = await Faqs.findByIdAndUpdate(
      id,
      { $set: payload },
      { new: true }
    );

    return handleResponse(200, "FAQ updated successfully", updatedFaq, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// delete FAQ (soft delete)
export const deleteFaq = async (req, resp) => {
  try {
    const { id } = req.params;

    const faq = await Faqs.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { new: true }
    );

    if (!faq) {
      return handleResponse(404, "FAQ not found", {}, resp);
    }

    return handleResponse(200, "FAQ deleted successfully", {}, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// FAQ type order for consistent grouping (matches model enum)
const FAQ_TYPE_ORDER = ["general", "payments", "licensing", "support"];

// get FAQs for user (only active, non-deleted) - grouped by type
export const getFaqsForUser = async (req, resp) => {
  try {
    const { type } = req.query;

    const filter = { deletedAt: null, status: true };
    if (type) {
      filter.type = type;
    }

    const faqs = await Faqs.find(filter).sort({ createdAt: -1 }).lean();

    // Group by type
    const byType = {};
    for (const faq of faqs) {
      const t = faq.type || "general";
      if (!byType[t]) byType[t] = [];
      byType[t].push(faq);
    }

    // Build list in fixed type order (only include types that have FAQs)
    const order = type ? [type] : FAQ_TYPE_ORDER;
    const list = order
      .filter((t) => byType[t]?.length)
      .map((t) => ({ type: t, faqs: byType[t] }));

    return handleResponse(
      200,
      "FAQs fetched successfully",
      { list },
      resp
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// restore deleted FAQ
export const restoreFaq = async (req, resp) => {
  try {
    const { id } = req.params;

    const faq = await Faqs.findOneAndUpdate(
      { _id: id, deletedAt: { $ne: null } },
      { $set: { deletedAt: null } },
      { new: true }
    );

    if (!faq) {
      return handleResponse(404, "Deleted FAQ not found", {}, resp);
    }

    return handleResponse(200, "FAQ restored successfully", faq, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};


export const contactUs = async (req, res) => {
    try {
      const all = await ContactUs.find().sort({ id: -1 });

      handleResponse(200, "All", all, res);

    } catch (error) {
      return handleResponse(500, error.message, {}, res);
    }
  };
