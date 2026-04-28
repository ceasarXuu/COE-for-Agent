// Server-side confirm token machinery now lives in @coe/auth-core; this file
// remains as a thin compatibility shim. The server historically returned just
// the encoded token string from `issueConfirmToken`, so we adapt the shared
// API here to preserve the existing call signature.
import {
  issueConfirmToken as issueConfirmTokenCore,
  type IssueConfirmTokenInput
} from '@coe/auth-core';

export type {
  ConfirmTokenClaims,
  IssueConfirmTokenInput,
  VerifyConfirmTokenOptions
} from '@coe/auth-core';
export { hashConfirmationReason, verifyConfirmToken } from '@coe/auth-core';

export function issueConfirmToken(
  input: IssueConfirmTokenInput,
  secret: string,
  now: Date = new Date()
): string {
  return issueConfirmTokenCore(input, secret, now).confirmToken;
}
