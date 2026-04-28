// Console BFF auth token machinery now lives in @coe/auth-core; this file
// remains as a thin compatibility shim that preserves the previous
// `create*` naming convention used by adjacent session/confirm helpers.
export {
  hashConfirmationReason,
  issueConfirmToken as createConfirmToken,
  issueSessionToken as createSessionToken,
  verifySessionToken
} from '@coe/auth-core';
