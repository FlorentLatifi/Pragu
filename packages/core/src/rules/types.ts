import type { Raster } from '../color.js';
import type { Confidence, DeviceInfo, FixGuidance, PamNode, PamScreen, Severity } from '../model.js';

/** Everything the rules reference docs are generated from. */
export interface RuleMeta {
  id: string;
  title: string;
  severity: Severity;
  confidence: Confidence;
  wcag: string[];
  en301549: string[];
  whoIsAffected: string;
  whatTheyExperience: string;
  fix: FixGuidance;
}

export interface RuleContext {
  screen: PamScreen;
  device: DeviceInfo;
  /** Screenshot pixels, when the capture has them. */
  raster: Raster | null;
}

export interface Finding {
  node: PamNode;
  message: string;
  evidence: Record<string, string | number>;
  /** Overrides the rule's default, e.g. lower confidence when a measurement is borderline. */
  severity?: Severity;
  confidence?: Confidence;
}

export interface Rule {
  meta: RuleMeta;
  check(context: RuleContext): Finding[];
}
