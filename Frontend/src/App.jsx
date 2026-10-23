import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { I18nProvider } from './i18n/I18nContext';
import ProtectedRoute from './components/ProtectedRoute';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Marketplace from './pages/Marketplace';
import Market from './pages/Market';
import BuyersIntro from './pages/BuyersIntro';
import BuyerDashboard from './pages/BuyerDashboard';
import Emissions from './pages/Emissions';
import BuyerIntroductions from './pages/BuyerIntroductions';
import SellerDashboard from './pages/SellerDashboard';
import ProjectSubmission from './pages/ProjectSubmission';
import ListingEditor from './pages/ListingEditor';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminIntegrations from './pages/AdminIntegrations';
import AdminInbox from './pages/AdminInbox';
import Reports from './pages/Reports';
import Chatbot from './components/Chatbot';

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => { if (!hash) window.scrollTo(0, 0); }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <I18nProvider>
        <AuthProvider>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/market" element={<Market />} />
            <Route path="/buyers" element={<BuyersIntro />} />

            <Route path="/buyer" element={<ProtectedRoute role="buyer"><BuyerDashboard /></ProtectedRoute>} />
            <Route path="/buyer/emissions" element={<ProtectedRoute role="buyer"><Emissions /></ProtectedRoute>} />
            <Route path="/buyer/introductions" element={<ProtectedRoute role="buyer"><BuyerIntroductions /></ProtectedRoute>} />

            <Route path="/seller" element={<ProtectedRoute role="seller"><SellerDashboard /></ProtectedRoute>} />
            <Route path="/seller/claims/new" element={<ProtectedRoute role="seller"><ProjectSubmission /></ProtectedRoute>} />
            <Route path="/seller/listings/new" element={<ProtectedRoute role="seller"><ListingEditor /></ProtectedRoute>} />
            <Route path="/seller/listings/:id" element={<ProtectedRoute role="seller"><ListingEditor /></ProtectedRoute>} />

            <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute role="admin"><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/integrations" element={<ProtectedRoute role="admin"><AdminIntegrations /></ProtectedRoute>} />
            <Route path="/admin/inbox" element={<ProtectedRoute role="admin"><AdminInbox /></ProtectedRoute>} />

            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/reports/:id" element={<ProtectedRoute><Reports /></ProtectedRoute>} />

            <Route path="*" element={<Landing />} />
          </Routes>
          <Chatbot />
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}
