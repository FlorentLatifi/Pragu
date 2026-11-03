import { duplicateName } from './duplicate-name.js';
import { focusUnreachable } from './focus-unreachable.js';
import { genericName } from './generic-name.js';
import { imageMissingName } from './image-missing-name.js';
import { inputMissingLabel } from './input-missing-label.js';
import { interactiveMissingName } from './interactive-missing-name.js';
import { noHeadings } from './no-headings.js';
import { nonTextContrast } from './non-text-contrast.js';
import { platformTargetSize } from './platform-target-size.js';
import { roleInLabel } from './role-in-label.js';
import { stateNotExposed } from './state-not-exposed.js';
import { targetSize } from './target-size.js';
import { textContrast } from './text-contrast.js';
import { textScalingTruncation } from './text-scaling-truncation.js';
import type { Rule } from './types.js';

export {
  duplicateName,
  focusUnreachable,
  genericName,
  imageMissingName,
  inputMissingLabel,
  interactiveMissingName,
  noHeadings,
  nonTextContrast,
  platformTargetSize,
  roleInLabel,
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
  duplicateName,
  genericName,
  nonTextContrast,
  platformTargetSize,
  roleInLabel,
  noHeadings,
];
