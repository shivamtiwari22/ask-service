import handleResponse from "../../../utils/http-response.js";
import Question from "../../models/QuestionsModel.js";

const getPagination = (req) => {
  const page = parseInt(req.query.page ?? "1");
  const limit = parseInt(req.query.limit ?? "10");
  const isPaginationDisabled = page === 0 && limit === 0;
  const skip = isPaginationDisabled ? 0 : (page - 1) * limit;
  return { page, limit, skip, isPaginationDisabled };
};

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// create question
export const createQuestion = async (req, resp) => {
  try {
    const payload = {
      label: req.body.label,
      key: req.body.key,
      type: req.body.type,
      options: req.body.options || [],
      is_multiple: req.body.is_multiple ?? false,
      is_required: req.body.is_required ?? false,
      placeholder: req.body.placeholder,
      service_id: req.body.service_id,
      step: req.body.step,
      order: req.body.order ?? 0,
      status: req.body.status || "ACTIVE",
    };

        if (payload.type === "checkbox") {
      payload.is_multiple = true;
    }

    const question = await Question.create(payload);
    return handleResponse(201, "Question created successfully", question, resp);
  } catch (err) {
    if (err?.code === 11000) {
      return handleResponse(
        409,
        "Question key already exists for this service",
        {},
        resp,
      );
    }
    return handleResponse(500, err.message, {}, resp);
  }
};

// get all questions (deleted / non-deleted) with pagination & search
export const getAllQuestions = async (req, resp) => {
  try {
    const { search, service_id, status, step, isDeleted } = req.query;
    const { page, limit, skip, isPaginationDisabled } = getPagination(req);

    const filter = {};

    if (isDeleted === "true") {
      filter.deletedAt = { $ne: null };
    } else {
      filter.deletedAt = null;
    }

    if (service_id) filter.service_id = service_id;
    if (status) filter.status = status; // "ACTIVE" | "INACTIVE"
    if (step !== undefined && step !== "") filter.step = Number(step);

    if (search) {
      const q = escapeRegex(search.trim());
      filter.$or = [
        { label: { $regex: q, $options: "i" } },
        { key: { $regex: q, $options: "i" } },
        { placeholder: { $regex: q, $options: "i" } },
        { "options.label": { $regex: q, $options: "i" } },
        { "options.value": { $regex: q, $options: "i" } },
      ];
    }

    let query = Question.find(filter)
      .populate("service_id", "title")
      .sort({ step: 1, order: 1, createdAt: -1 });

    if (!isPaginationDisabled) {
      query = query.skip(skip).limit(limit);
    }

    const [list, total] = await Promise.all([
      query.lean(),
      Question.countDocuments(filter),
    ]);

    return handleResponse(
      200,
      "Questions fetched successfully",
      {
        list,
        pagination: isPaginationDisabled
          ? null
          : { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// get question by id
export const getQuestionById = async (req, resp) => {
  try {
    const question = await Question.findOne({
      _id: req.params.id,
      deletedAt: null,
    })
      .populate("service_id", "title")
      .lean();

    if (!question) return handleResponse(404, "Question not found", {}, resp);

    return handleResponse(200, "Question fetched successfully", question, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// update question
export const updateQuestion = async (req, resp) => {
  try {
    const question = await Question.findOne({ _id: req.params.id, deletedAt: null });
    if (!question) return handleResponse(404, "Question not found", {}, resp);

    const allowed = [
      "label",
      "key",
      "type",
      "options",
      "is_multiple",
      "is_required",
      "placeholder",
      "service_id",
      "step",
      "order",
      "status",
    ];


      if (req.body.type === "checkbox") {
      req.body.is_multiple = true;
    }


    const payload = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) payload[k] = req.body[k];
    }

    const updated = await Question.findByIdAndUpdate(
      req.params.id,
      { $set: payload },
      { new: true },
    )
      .populate("service_id", "title");

    return handleResponse(200, "Question updated successfully", updated, resp);
  } catch (err) {
    if (err?.code === 11000) {
      return handleResponse(
        409,
        "Question key already exists for this service",
        {},
        resp,
      );
    }
    return handleResponse(500, err.message, {}, resp);
  }
};

// delete question (soft delete)
export const deleteQuestion = async (req, resp) => {
  try {
    const deleted = await Question.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { new: true },
    );

    if (!deleted) return handleResponse(404, "Question not found", {}, resp);

    return handleResponse(200, "Question deleted successfully", {}, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// restore deleted question
export const restoreQuestion = async (req, resp) => {
  try {
    const restored = await Question.findOneAndUpdate(
      { _id: req.params.id, deletedAt: { $ne: null } },
      { $set: { deletedAt: null } },
      { new: true },
    );

    if (!restored) {
      return handleResponse(404, "Deleted question not found", {}, resp);
    }

    return handleResponse(200, "Question restored successfully", restored, resp);
  } catch (err) {
    if (err?.code === 11000) {
      return handleResponse(
        409,
        "Question key already exists for this service",
        {},
        resp,
      );
    }
    return handleResponse(500, err.message, {}, resp);
  }
};


export const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const question = await Question.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!question) {
      return handleResponse(404, "Question not found", {}, res);
    }

    return handleResponse(200, "Status updated", question, res);
  } catch (error) {
    return handleCatchError(error, res);
  }
};

export const reorderQuestions = async (req, res) => {
  try {
    const { questions } = req.body;
    // [{ id, order }]

    const bulkOps = questions.map((q) => ({
      updateOne: {
        filter: { _id: q.id },
        update: { order: q.order },
      },
    }));

    await Question.bulkWrite(bulkOps);

    return handleResponse(200, "Order updated", {}, res);
  } catch (error) {
    return handleCatchError(error, res);
  }
};