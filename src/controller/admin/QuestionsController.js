import handleResponse from "../../../utils/http-response.js";
import Question from "../../models/QuestionsModel.js";
import ServiceCategory from "../../models/ServiceCategoryModel.js";
import { sanitizeObjectIdArray } from "../../../utils/helperFunction.js";

const resolveServiceIds = (body) => {
  const fromArray = sanitizeObjectIdArray(body.service_ids);
  if (fromArray.length) return [...new Set(fromArray.map(String))];

  const single = body.service_id;
  if (single && String(single).trim()) return [String(single)];

  return [];
};

const validateServiceIds = async (serviceIds) => {
  if (!serviceIds.length) {
    return { error: "At least one service category is required" };
  }

  const foundCount = await ServiceCategory.countDocuments({
    _id: { $in: serviceIds },
    deletedAt: null,
  });
  if (foundCount !== serviceIds.length) {
    return { error: "One or more service categories not found" };
  }

  return { serviceIds };
};

const getPagination = (req) => {
  const page = parseInt(req.query.page ?? "1");
  const limit = parseInt(req.query.limit ?? "10");
  const isPaginationDisabled = page === 0 && limit === 0;
  const skip = isPaginationDisabled ? 0 : (page - 1) * limit;
  return { page, limit, skip, isPaginationDisabled };
};

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const QUESTION_OPTION_TYPES = new Set(["dropdown", "radio", "checkbox"]);

const normalizePoint = (value) => {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : 0;
};

const normalizeQuestionOptions = (options = []) =>
  options.map((opt) => ({
    label: opt.label,
    value: opt.value,
    point: normalizePoint(opt.point),
  }));

const buildQuestionFields = (body) => {
  const type = body.type;
  const hasOptions = QUESTION_OPTION_TYPES.has(type);

  const fields = {
    label: body.label,
    key: body.key,
    type,
    is_multiple: body.is_multiple ?? false,
    is_required: body.is_required ?? false,
    placeholder: body.placeholder,
    step: body.step,
    order: body.order ?? 0,
    status: body.status || "ACTIVE",
  };

  if (hasOptions) {
    fields.options = normalizeQuestionOptions(body.options || []);
    fields.point = 0;
  } else {
    fields.point = normalizePoint(body.point);
    fields.options = [];
  }

  if (type === "checkbox") {
    fields.is_multiple = true;
  }

  return fields;
};

const applyQuestionPointUpdates = (body, existingType) => {
  const type = body.type ?? existingType;
  const hasOptions = QUESTION_OPTION_TYPES.has(type);
  const updates = {};

  if (hasOptions) {
    updates.point = 0;
    if (body.options !== undefined) {
      updates.options = normalizeQuestionOptions(body.options);
    }
    return updates;
  }

  if (body.point !== undefined) {
    updates.point = normalizePoint(body.point);
  }
  if (body.type !== undefined) {
    updates.options = [];
  }

  return updates;
};

// create question (one record per selected service category)
export const createQuestion = async (req, resp) => {
  try {
    const serviceIds = resolveServiceIds(req.body);
    const { serviceIds: validServiceIds, error } = await validateServiceIds(serviceIds);
    if (error) {
      return handleResponse(400, error, {}, resp);
    }

    const basePayload = buildQuestionFields(req.body);

    const created = [];
    for (const service_id of validServiceIds) {
      const question = await Question.create({ ...basePayload, service_id });
      created.push(question);
    }

    const message =
      created.length === 1
        ? "Question created successfully"
        : `Question created successfully for ${created.length} categories`;

    return handleResponse(
      201,
      message,
      created.length === 1 ? created[0] : { list: created, count: created.length },
      resp,
    );
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
      "point",
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

    Object.assign(
      payload,
      applyQuestionPointUpdates(req.body, question.type),
    );

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