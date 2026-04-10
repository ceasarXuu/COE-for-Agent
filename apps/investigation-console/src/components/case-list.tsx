import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';

import type { CaseListItem } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';

const CARD_TONES = [
  { background: 'rgba(82, 61, 54, 0.82)', accent: 'rgba(255, 181, 132, 0.22)' },
  { background: 'rgba(56, 63, 42, 0.84)', accent: 'rgba(180, 255, 116, 0.18)' },
  { background: 'rgba(52, 55, 73, 0.86)', accent: 'rgba(160, 186, 255, 0.18)' },
  { background: 'rgba(66, 66, 45, 0.86)', accent: 'rgba(255, 226, 112, 0.16)' },
  { background: 'rgba(67, 51, 66, 0.86)', accent: 'rgba(255, 159, 240, 0.18)' },
  { background: 'rgba(46, 61, 55, 0.88)', accent: 'rgba(105, 255, 215, 0.18)' }
] as const;

function toneForCase(caseId: string) {
  const hash = Array.from(caseId).reduce((accumulator, character) => accumulator + character.charCodeAt(0), 0);
  return CARD_TONES[hash % CARD_TONES.length] ?? CARD_TONES[0];
}

export function CaseList(props: { items: CaseListItem[]; onCreateRequest: () => void; search?: string }) {
  const { formatDateTime, formatEnumLabel, t } = useI18n();

  return (
    <div className="case-grid" data-testid="cases-gallery">
      <button
        className="case-card case-card-create"
        data-testid="case-create-card"
        onClick={props.onCreateRequest}
        type="button"
      >
        <span aria-hidden="true" className="case-create-plus">+</span>
        <div className="case-create-copy">
          <h3>{t('caseCreate.galleryTitle')}</h3>
          <p>{t('caseCreate.galleryCopy')}</p>
        </div>
      </button>

      {props.items.map((item) => (
        <Link
          className="case-card"
          data-testid={`case-card-${item.caseId}`}
          key={item.caseId}
          style={{
            '--case-card-accent': toneForCase(item.caseId).accent,
            '--case-card-bg': toneForCase(item.caseId).background
          } as CSSProperties}
          to={{
            pathname: `/cases/${item.caseId}`,
            search: props.search ? `?${props.search}` : ''
          }}
        >
          <div className="case-card-header">
            <p title={item.caseId} translate="no">{item.caseId.slice(0, 12)}</p>
            <span className={`pill pill-${(item.severity ?? 'medium').toLowerCase()}`}>{formatEnumLabel(item.severity ?? 'unknown')}</span>
          </div>
          <h3>{item.title ?? t('caseList.untitled')}</h3>
          <p className="case-card-summary">{item.summary ?? t('caseList.defaultSummary')}</p>
          <p>{item.updatedAt ? t('caseList.updated', { dateTime: formatDateTime(item.updatedAt) }) : t('caseList.noTimestamp')}</p>
          <dl className="case-metadata">
            <div>
              <dt>{t('caseList.status')}</dt>
              <dd>{formatEnumLabel(item.status ?? 'active')}</dd>
            </div>
            <div>
              <dt>{t('caseList.stage')}</dt>
              <dd>{formatEnumLabel(item.stage ?? 'intake')}</dd>
            </div>
            <div>
              <dt>{t('caseList.revision')}</dt>
              <dd>{item.headRevision}</dd>
            </div>
          </dl>
        </Link>
      ))}
    </div>
  );
}
