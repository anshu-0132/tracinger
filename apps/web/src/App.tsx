import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useIsFetching } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { OverviewPage } from './pages/OverviewPage';
import { ServicesPage } from './pages/ServicesPage';
import { ServiceDetailPage } from './pages/ServiceDetailPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { IncidentInvestigationPage } from './pages/IncidentInvestigationPage';
import { AlertRulesPage } from './pages/AlertRulesPage';
import { DeploymentsPage } from './pages/DeploymentsPage';
import { ReplayLabPage } from './pages/ReplayLabPage';
import { ExplorerPage } from './pages/ExplorerPage';
import { SettingsPage } from './pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 10000,
      retry: 1,
    },
  },
});

const AppShellWithRefresh: React.FC = () => {
  const isFetching = useIsFetching();

  const handleManualRefresh = () => {
    queryClient.invalidateQueries();
  };

  return (
    <Layout onRefresh={handleManualRefresh} isRefreshing={isFetching > 0}>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/services/:id" element={<ServiceDetailPage />} />
        <Route path="/incidents" element={<IncidentsPage />} />
        <Route path="/incidents/:id" element={<IncidentInvestigationPage />} />
        <Route path="/alert-rules" element={<AlertRulesPage />} />
        <Route path="/deployments" element={<DeploymentsPage />} />
        <Route path="/replay-lab" element={<ReplayLabPage />} />
        <Route path="/explorer" element={<ExplorerPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Layout>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShellWithRefresh />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
