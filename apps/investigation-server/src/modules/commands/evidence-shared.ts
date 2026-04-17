import type { CanonicalEvidenceEffect, CanonicalGraphNodeKind } from '@coe/domain';

export function assertEvidenceEffectMatchesParent(
  parentKind: CanonicalGraphNodeKind,
  effectOnParent: CanonicalEvidenceEffect
) {
  if (parentKind === 'hypothesis') {
    if (effectOnParent !== 'supports' && effectOnParent !== 'refutes' && effectOnParent !== 'neutral') {
      throw new Error(`Invalid evidence effect for hypothesis parent: ${effectOnParent}`);
    }
    return;
  }

  if (parentKind === 'repair_attempt') {
    if (effectOnParent !== 'validates' && effectOnParent !== 'invalidates' && effectOnParent !== 'neutral') {
      throw new Error(`Invalid evidence effect for repair_attempt parent: ${effectOnParent}`);
    }
    return;
  }

  throw new Error(`Unsupported evidence parent kind: ${parentKind}`);
}
