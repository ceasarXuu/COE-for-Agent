import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { I18nProvider } from './lib/i18n.js';
import { RootLayout } from './routes/__root.js';
import { CasesIndexRoute } from './routes/cases.index.js';
import { CaseWorkspaceRoute } from './routes/cases.$caseId.js';

export function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<RootLayout />}>
            <Route index element={<Navigate replace to="/cases" />} />
            <Route path="/cases" element={<CasesIndexRoute />} />
            <Route path="/cases/:caseId" element={<CaseWorkspaceRoute />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  );
}