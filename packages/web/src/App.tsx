import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import LegalPage from "./pages/LegalPage";
import SeoLandingPage from "./pages/SeoLandingPage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/legal" element={<LegalPage />} />
        <Route path="/exif-remover" element={<SeoLandingPage slug="exif-remover" />} />
        <Route path="/gps-remover-photo" element={<SeoLandingPage slug="gps-remover-photo" />} />
        <Route path="/pdf-metadata-remove" element={<SeoLandingPage slug="pdf-metadata-remove" />} />
        <Route path="/mp4-metadata-strip" element={<SeoLandingPage slug="mp4-metadata-strip" />} />
        <Route path="/heic-metadata" element={<SeoLandingPage slug="heic-metadata" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}
