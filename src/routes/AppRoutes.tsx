import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { FullPageLoader } from '../components/ui/FullPageLoader';
import { CrmWorkspaceProvider } from '../context/CrmWorkspaceContext';
import { CrmWorkspaceRoute } from './CrmWorkspaceRoute';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicOnlyRoute } from './PublicOnlyRoute';

const HomePage = lazy(() => import('../pages/HomePage').then((module) => ({ default: module.HomePage })));
const SignInPage = lazy(() => import('../pages/SignInPage').then((module) => ({ default: module.SignInPage })));
const SignUpPage = lazy(() => import('../pages/SignUpPage').then((module) => ({ default: module.SignUpPage })));
const CompleteOnboardingPage = lazy(() =>
  import('../pages/CompleteOnboardingPage').then((module) => ({ default: module.CompleteOnboardingPage })),
);
const DashboardPage = lazy(() =>
  import('../pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
);
const RecordsPage = lazy(() => import('../pages/RecordsPage').then((module) => ({ default: module.RecordsPage })));
const RecordCreatePage = lazy(() =>
  import('../pages/RecordCreatePage').then((module) => ({ default: module.RecordCreatePage })),
);
const RecordDetailPage = lazy(() =>
  import('../pages/RecordDetailPage').then((module) => ({ default: module.RecordDetailPage })),
);
const ImportsPage = lazy(() => import('../pages/ImportsPage').then((module) => ({ default: module.ImportsPage })));
const VoiceSettingsPage = lazy(() =>
  import('../pages/VoiceSettingsPage').then((module) => ({ default: module.VoiceSettingsPage })),
);
const VoiceOpsPage = lazy(() =>
  import('../pages/VoiceOpsPage').then((module) => ({ default: module.VoiceOpsPage })),
);

export function AppRoutes() {
  return (
    <Suspense fallback={<FullPageLoader label="Loading page..." />}>
      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route element={<PublicOnlyRoute />}>
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/signup" element={<SignUpPage />} />
        </Route>

        <Route element={<ProtectedRoute allowWithoutWorkspace />}>
          <Route path="/onboarding/complete" element={<CompleteOnboardingPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dashboard/:crmType" element={<DashboardPage />} />
          <Route
            path="/settings/voice"
            element={(
              <CrmWorkspaceProvider>
                <VoiceSettingsPage />
              </CrmWorkspaceProvider>
            )}
          />
          <Route path="/voice" element={<VoiceOpsPage />} />
          <Route element={<CrmWorkspaceRoute />}>
            <Route path="/records" element={<RecordsPage />} />
            <Route path="/records/new" element={<RecordCreatePage />} />
            <Route path="/records/:recordId" element={<RecordDetailPage />} />
            <Route path="/imports" element={<ImportsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
