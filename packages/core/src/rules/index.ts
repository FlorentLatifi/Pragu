import { focusUnreachable } from './focus-unreachable.js';
import { imageMissingName } from './image-missing-name.js';
import { inputMissingLabel } from './input-missing-label.js';
import { interactiveMissingName } from './interactive-missing-name.js';
import { stateNotExposed } from './state-not-exposed.js';
import { targetSize } from './target-size.js';
import { textContrast } from './text-contrast.js';
import { textScalingTruncation } from './text-scaling-truncation.js';
import type { Rule } from './types.js';

export {
  focusUnreachable,
  imageMissingName,
  inputMissingLabel,
  interactiveMissingName,
  stateNotExposed,
  targetSize,
  textContrast,
  textScalingTruncation,
};
export { requiredTextRatio } from './text-contrast.js';
export { inScope } from './scope.js';
export type { Finding, Rule, RuleContext, RuleMeta } from './types.js';

/** The rules a scan runs when the config does not choose. */
export const defaultRules: readonly Rule[] = [
  interactiveMissingName,
  imageMissingName,
  inputMissingLabel,
  stateNotExposed,
  focusUnreachable,
  textContrast,
  textScalingTruncation,
  targetSize,
];
