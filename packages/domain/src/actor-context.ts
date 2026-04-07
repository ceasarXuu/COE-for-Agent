export type ActorType = 'agent' | 'user' | 'system' | 'adapter' | 'tool_runner';
export type ActorRole = 'Viewer' | 'Operator' | 'Reviewer' | 'Admin';
export type AuthMode = 'local' | 'oidc' | 'service';

export interface ActorContext {
  actorType: ActorType;
  actorId: string;
  sessionId: string;
  role: ActorRole;
  issuer: string;
  authMode: AuthMode;
  confirmToken?: string;
}

export function isReviewerRole(role: ActorRole): boolean {
  return role === 'Reviewer' || role === 'Admin';
}