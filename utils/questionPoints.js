import mongoose from "mongoose";
import Question from "../src/models/QuestionsModel.js";

const QUESTION_OPTION_TYPES = new Set(["dropdown", "radio", "checkbox"]);

const parseSelectedValues = (value) => {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const findMatchingOption = (options = [], selected) =>
  options.find((opt) => opt.value === selected || opt.label === selected);

const normalizeServiceIds = (child_category, service_category) =>
  [child_category, service_category]
    .filter((id) => id && mongoose.Types.ObjectId.isValid(String(id)))
    .map(String);

async function loadQuestionsForServiceCategories(serviceIds) {
  if (!serviceIds.length) return [];

  return Question.find({
    deletedAt: null,
    status: "ACTIVE",
    service_id: { $in: serviceIds },
  })
    .select("key type point options is_multiple")
    .lean();
}

export function calculateComputedPointFromAnswers(
  dynamicAnswers = [],
  questions = [],
) {
  if (!Array.isArray(dynamicAnswers) || !dynamicAnswers.length) return 0;
  if (!Array.isArray(questions) || !questions.length) return 0;

  const questionById = new Map(
    questions.map((question) => [question._id.toString(), question]),
  );
  const questionByKey = new Map(
    questions.map((question) => [question.key, question]),
  );

  let total = 0;

  for (const answer of dynamicAnswers) {
    const question =
      (answer?.question_id &&
        questionById.get(String(answer.question_id))) ||
      (answer?.key && questionByKey.get(answer.key));

    if (!question) continue;

    const selectedValues = parseSelectedValues(answer.value);
    if (!selectedValues.length) continue;

    if (QUESTION_OPTION_TYPES.has(question.type)) {
      for (const selected of selectedValues) {
        const option = findMatchingOption(question.options, selected);
        if (option) total += Number(option.point) || 0;
      }
      continue;
    }

    total += Number(question.point) || 0;
  }

  return total;
}

export function calculateMaxPossiblePoint(questions = []) {
  if (!Array.isArray(questions) || !questions.length) return 0;

  let total = 0;

  for (const question of questions) {
    if (QUESTION_OPTION_TYPES.has(question.type)) {
      const options = question.options || [];
      if (!options.length) continue;

      const optionPoints = options.map((opt) => Number(opt.point) || 0);

      if (question.type === "checkbox" && question.is_multiple) {
        total += optionPoints.reduce((sum, point) => sum + point, 0);
      } else {
        total += Math.max(...optionPoints, 0);
      }
      continue;
    }

    total += Number(question.point) || 0;
  }

  return total;
}

export function computePointScorePercent(computedPoint, maxPossiblePoint) {
  const computed = Number(computedPoint) || 0;
  const max = Number(maxPossiblePoint) || 0;
  if (max <= 0) return 0;

  return Math.min(100, Math.round((computed / max) * 100));
}

export function pointsToStars(computedPoint, maxPossiblePoint) {
  const max = Number(maxPossiblePoint) || 0;
  if (max <= 0) return 0;

  const percent = Math.min(
    100,
    ((Number(computedPoint) || 0) / max) * 100,
  );

  if (percent <= 20) return 1;
  if (percent <= 40) return 2;
  if (percent <= 60) return 3;
  if (percent <= 80) return 4;
  return 5;
}

const LEAD_STARS_LABELS = {
  0: "NON ÉVALUÉ",
  1: "LOW",
  2: "BASIC",
  3: "MEDIUM",
  4: "HIGH",
  5: "PREMIUM",
};

export function getLeadStarsLabel(leadStars) {
  const stars = Number(leadStars) || 0;
  return LEAD_STARS_LABELS[stars] ?? LEAD_STARS_LABELS[0];
}

export function buildLeadStarFields(computedPoint, maxPossiblePoint) {
  const computed_point = Number(computedPoint) || 0;
  const max_possible_point = Number(maxPossiblePoint) || 0;
  const point_score_percent = computePointScorePercent(
    computed_point,
    max_possible_point,
  );
  const lead_stars = pointsToStars(computed_point, max_possible_point);
  const lead_stars_label = getLeadStarsLabel(lead_stars);

  return {
    computed_point,
    max_possible_point,
    point_score_percent,
    lead_stars,
    lead_stars_label,
  };
}

export async function resolveLeadPointFieldsForServiceRequest({
  dynamic_answers = [],
  child_category,
  service_category,
}) {
  const serviceIds = normalizeServiceIds(child_category, service_category);
  const questions = await loadQuestionsForServiceCategories(serviceIds);
  const answers = Array.isArray(dynamic_answers) ? dynamic_answers : [];

  const computed_point = calculateComputedPointFromAnswers(answers, questions);
  const max_possible_point = calculateMaxPossiblePoint(questions);

  return buildLeadStarFields(computed_point, max_possible_point);
}

export async function resolveLeadStars({
  computed_point = 0,
  max_possible_point,
  child_category,
  service_category,
  dynamic_answers = [],
}) {
  if (
    max_possible_point !== undefined &&
    max_possible_point !== null &&
    max_possible_point !== ""
  ) {
    return buildLeadStarFields(computed_point, max_possible_point);
  }

  return resolveLeadPointFieldsForServiceRequest({
    dynamic_answers,
    child_category,
    service_category,
  });
}

/** @deprecated Use resolveLeadPointFieldsForServiceRequest */
export async function resolveComputedPointForServiceRequest(params) {
  const result = await resolveLeadPointFieldsForServiceRequest(params);
  return result.computed_point;
}

export function attachLeadStarFieldsToLead(lead) {
  if (!lead || typeof lead !== "object") return lead;

  const lead_stars = lead.lead_stars ?? 0;

  return {
    computed_point: lead.computed_point ?? 0,
    max_possible_point: lead.max_possible_point ?? 0,
    point_score_percent: lead.point_score_percent ?? 0,
    lead_stars,
    lead_stars_label: lead.lead_stars_label ?? getLeadStarsLabel(lead_stars),
  };
}
