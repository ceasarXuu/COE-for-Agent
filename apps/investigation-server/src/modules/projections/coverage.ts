import type { ProjectedCaseState } from './replay.js';

export interface CoverageItem {
  symptomId: string;
  statement: string;
  coverage: 'direct' | 'indirect' | 'none';
  supportingFactIds: string[];
  relatedHypothesisIds: string[];
}

export interface CoverageProjection {
  items: CoverageItem[];
  summary: {
    direct: number;
    indirect: number;
    none: number;
  };
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0) : [];
}

export function buildCoverageProjection(state: ProjectedCaseState): CoverageProjection {
  const directFactsBySymptom = new Map<string, string[]>();
  const indirectHypothesesBySymptom = new Map<string, string[]>();

  for (const fact of state.tables.facts.values()) {
    const payload = asObject(fact.payload);
    if (payload.observationScope === null || payload.observationScope === undefined) {
      continue;
    }

    for (const aboutRef of asStringArray(payload.aboutRefs)) {
      if (!aboutRef.startsWith('symptom_')) {
        continue;
      }

      directFactsBySymptom.set(aboutRef, [...(directFactsBySymptom.get(aboutRef) ?? []), fact.id]);
    }
  }

  for (const hypothesis of state.tables.hypotheses.values()) {
    const payload = asObject(hypothesis.payload);
    if (asStringArray(payload.dependsOnFactIds).length === 0) {
      continue;
    }

    for (const symptomId of asStringArray(payload.explainsSymptomIds)) {
      indirectHypothesesBySymptom.set(symptomId, [...(indirectHypothesesBySymptom.get(symptomId) ?? []), hypothesis.id]);
    }
  }

  const items = [...state.tables.symptoms.values()]
    .map((symptom) => {
      const payload = asObject(symptom.payload);
      const supportingFactIds = [...new Set(directFactsBySymptom.get(symptom.id) ?? [])].sort();
      const relatedHypothesisIds = [...new Set(indirectHypothesesBySymptom.get(symptom.id) ?? [])].sort();
      const coverage = supportingFactIds.length > 0
        ? 'direct'
        : relatedHypothesisIds.length > 0
          ? 'indirect'
          : 'none';

      return {
        symptomId: symptom.id,
        statement: asString(payload.statement) ?? symptom.id,
        coverage,
        supportingFactIds,
        relatedHypothesisIds
      } satisfies CoverageItem;
    })
    .sort((left, right) => left.symptomId.localeCompare(right.symptomId));

  return {
    items,
    summary: {
      direct: items.filter((item) => item.coverage === 'direct').length,
      indirect: items.filter((item) => item.coverage === 'indirect').length,
      none: items.filter((item) => item.coverage === 'none').length
    }
  };
}