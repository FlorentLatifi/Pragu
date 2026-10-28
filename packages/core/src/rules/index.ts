import { inputMissingLabel } from './input-missing-label.js';
import { interactiveMissingName } from './interactive-missing-name.js';
import { targetSize } from './target-size.js';
import { textContrast } from './text-contrast.js';
import type { Rule } from './types.js';

export { inputMissingLabel, interactiveMissingName, targetSize, textContrast };
export { requiredTextRatio } from './text-contrast.js';
export { inScope } from './scope.js';
export type { Finding, Rule, RuleContext, RuleMeta } from './types.js';

/** The rules a scan runs when the config does not choose. */
export const defaultRules: readonly Rule[] = [interactiveMissingName, inputMissingLabel, textContrast, targetSize];
