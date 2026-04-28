// Server-side session token machinery now lives in @coe/auth-core; this file
// remains as a thin compatibility shim for legacy import paths.
export type { IssueSessionTokenInput } from '@coe/auth-core';
export { issueSessionToken, verifySessionToken } from '@coe/auth-core';
