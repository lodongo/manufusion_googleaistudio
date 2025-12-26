import type { SupplierEvaluationCategory, SupplierEvaluationCriterion } from '../types/in_types';

type CategorySeed = Omit<SupplierEvaluationCategory, 'id' | 'criteria'> & { criteria: Omit<SupplierEvaluationCriterion, 'id'>[] };

export const defaultSupplierEvaluationTemplate: CategorySeed[] = [];
