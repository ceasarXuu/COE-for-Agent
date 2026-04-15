import type { InvestigationServerServices } from '../../services.js';

import { handleEntityRegister } from './entity-register.js';

export async function handleContextRegister(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  return handleEntityRegister(services, {
    ...input,
    entityKind: input.contextKind ?? input.entityKind
  });
}
