import { Link } from 'react-router-dom';

import type { CaseListItem } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';

export function CaseList(props: { items: CaseListItem[] }) {
  const { formatDateTime, formatEnumLabel, t } = useI18n();

  return (
    <div className="case-grid">
      {props.items.map((item) => (
        <Link className="case-card" data-testid={`case-card-${item.caseId}`} key={item.caseId} to={`/cases/${item.caseId}`}>
          <div className="case-card-header">
            <p>{item.caseId.slice(0, 12)}</p>
            <span className={`pill pill-${(item.severity ?? 'medium').toLowerCase()}`}>{formatEnumLabel(item.severity ?? 'unknown')}</span>
          </div>
          <h3>{item.title ?? t('caseList.untitled')}</h3>
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