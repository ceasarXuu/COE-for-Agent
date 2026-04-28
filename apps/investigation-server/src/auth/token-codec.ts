// Server-side auth token primitives now live in @coe/auth-core; this file
// remains as a thin compatibility shim for legacy import paths.
export { issueSignedToken, verifySignedToken } from '@coe/auth-core';
