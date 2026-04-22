import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { ThemeProvider } from '@coe/ui/theme-provider';

import { I18nProvider } from '@/lib/i18n.js';
import { CasesPage } from '@/routes/cases-page.js';
import { RootLayout } from '@/routes/root-layout.js';
import { WorkspacePage } from '@/routes/workspace-page.js';

export function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="investigation-console-v2.theme">
      <I18nProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<RootLayout />}>
              <Route index element={<Navigate replace to="/cases" />} />
              <Route path="/cases" element={<CasesPage />} />
              <Route path="/cases/:caseId" element={<WorkspacePage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </I18nProvider>
    </ThemeProvider>
  );
}
