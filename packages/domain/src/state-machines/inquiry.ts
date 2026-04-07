export type InquiryStatus = 'open' | 'paused' | 'closed' | 'merged';
export type InquiryResolutionKind = 'answered' | 'superseded' | 'invalid' | 'merged';

export interface InquiryLifecycleState {
  status: InquiryStatus;
}

export interface ClosedInquiryState {
  status: 'closed';
  resolutionKind: InquiryResolutionKind;
}

export function closeInquiry(
  current: InquiryLifecycleState,
  resolutionKind: InquiryResolutionKind
): ClosedInquiryState {
  if (current.status !== 'open' && current.status !== 'paused') {
    throw new Error(`Invalid inquiry transition: ${current.status} -> closed`);
  }

  return {
    status: 'closed',
    resolutionKind
  };
}