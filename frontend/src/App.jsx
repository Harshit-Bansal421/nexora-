import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/authContextValue';
import { ToastProvider } from './context/ToastContext';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const SecuritySettingsPage = lazy(() => import('./pages/SecuritySettingsPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const SearchResultsPage = lazy(() => import('./pages/SearchResultsPage'));
const UserProfilePage = lazy(() => import('./pages/UserProfilePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const PageExplorePage = lazy(() => import('./pages/PageExplorePage'));
const PageViewPage = lazy(() => import('./pages/PageViewPage'));
const PageInfoPage = lazy(() => import('./pages/PageInfoPage'));
const PostCommentsPage = lazy(() => import('./pages/PostCommentsPage'));
const UploadPostPage = lazy(() => import('./pages/UploadPostPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const EditProfilePage = lazy(() => import('./pages/EditProfilePage'));

function RequireAuth({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface p-4 sm:p-8" role="status" aria-label="Loading account">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="h-12 rounded-2xl bg-surface-container-low animate-pulse" />
          <div className="h-64 rounded-3xl bg-surface-container-low animate-pulse" />
        </div>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={
            <div className="min-h-[60vh] bg-surface p-4 sm:p-8" role="status" aria-label="Loading page">
              <div className="mx-auto max-w-3xl space-y-4">
                <div className="h-10 w-1/2 rounded-xl bg-surface-container-low animate-pulse" />
                <div className="h-48 rounded-3xl bg-surface-container-low animate-pulse" />
                <div className="h-36 rounded-3xl bg-surface-container-low animate-pulse" />
              </div>
            </div>
          }>
          <Routes>
            {/* Public Discovery & Landing */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/landing" element={<LandingPage />} />

            {/* Authentication & Account Lifecycle */}
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/settings/security" element={<RequireAuth><SecuritySettingsPage /></RequireAuth>} />

            {/* Core Feed & Search */}
            <Route path="/feed" element={<HomePage />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/search" element={<SearchResultsPage />} />

            {/* Community Hubs (Pages) */}
            <Route path="/pages/explore" element={<PageExplorePage />} />
            <Route path="/pages/:pageId" element={<PageViewPage />} />
            <Route path="/pages/:pageId/info" element={<PageInfoPage />} />

            {/* Discussions & Post Creation */}
            <Route path="/posts/new" element={<RequireAuth><UploadPostPage /></RequireAuth>} />
            <Route path="/posts/:postId/comments" element={<PostCommentsPage />} />

            {/* Notifications */}
            <Route path="/notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />

            {/* User Profile & Settings */}
            <Route path="/profile/edit" element={<RequireAuth><EditProfilePage /></RequireAuth>} />
            <Route path="/profile/:username" element={<UserProfilePage />} />
            <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />

            {/* Catch-all Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
