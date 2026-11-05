import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import '@fontsource-variable/noto-sans-bengali';
import './styles/base.css';
import { SiteProvider } from './lib/site.jsx';
import { LangProvider } from './lib/i18n.jsx';
import PublicLayout from './site/PublicLayout.jsx';
import { Spinner } from './lib/ui.jsx';

// Pages load on demand, so visitors never download the admin panel.
const Home = lazy(() => import('./site/Home.jsx'));
const Notices = lazy(() => import('./site/Notices.jsx'));
const NoticeDetail = lazy(() => import('./site/NoticeDetail.jsx'));
const Results = lazy(() => import('./site/Results.jsx'));
const Admission = lazy(() => import('./site/Admission.jsx'));
const AdmissionStatus = lazy(() => import('./site/AdmissionStatus.jsx'));
const PaymentResult = lazy(() => import('./site/PaymentResult.jsx'));
const Info = lazy(() => import('./site/Info.jsx'));
const SignIn = lazy(() => import('./admin/SignIn.jsx'));
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));

const institution = (name) => lazy(() => import('./site/Institution.jsx').then((m) => ({ default: m[name] })));
const PeoplePage = institution('PeoplePage');
const PersonDetail = institution('PersonDetail');
const DepartmentsPage = institution('DepartmentsPage');
const DepartmentDetail = institution('DepartmentDetail');
const EventsPage = institution('EventsPage');
const NewsPage = institution('NewsPage');
const NewsDetail = institution('NewsDetail');
const PublicationsPage = institution('PublicationsPage');
const ActivitiesPage = institution('ActivitiesPage');
const FeedbackPage = institution('FeedbackPage');
const HistoryPage = institution('HistoryPage');
const AlbumPage = institution('AlbumPage');
const OurPridePage = institution('OurPridePage');

const lazyInfo = (page) => <Info page={page} />;

// The server only names the admin address when the browser is already on it,
// so the address never appears in this code or in any public page.
function findAdminBase() {
  try {
    const base = JSON.parse(document.getElementById('boot-data')?.textContent || '{}').adminBase;
    if (base) return base;
  } catch {
    /* treated as a public page */
  }
  if (import.meta.env.DEV) {
    const stored = sessionStorage.getItem('adminBase');
    if (stored && window.location.pathname.startsWith(stored)) return stored;
  }
  return null;
}

const adminBase = findAdminBase();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={adminBase || import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <SiteProvider>
        <LangProvider>
        <Suspense fallback={<Spinner />}>
          {adminBase ? <AdminApp /> : (
            <Routes>
              <Route path="signin/*" element={<SignIn />} />
              <Route element={<PublicLayout />}>
                <Route index element={<Home />} />
                <Route path="notices" element={<Notices />} />
                <Route path="notices/:id" element={<NoticeDetail />} />
                <Route path="results" element={<Results />} />
                <Route path="admission" element={<Admission />} />
                <Route path="admission/status" element={<AdmissionStatus />} />
                <Route path="payment/result" element={<PaymentResult />} />
                <Route path="message" element={lazyInfo('message')} />
                <Route path="about" element={lazyInfo('about')} />
                <Route path="achievements" element={lazyInfo('achievements')} />
                <Route path="gallery" element={lazyInfo('gallery')} />
                <Route path="facilities" element={lazyInfo('facilities')} />
                <Route path="contact" element={lazyInfo('contact')} />
                <Route path="p/:slug" element={lazyInfo('custom')} />
                <Route path="search" element={lazyInfo('search')} />
                <Route path="officers" element={<PeoplePage type="officer" />} />
                <Route path="teachers" element={<PeoplePage type="teacher" />} />
                <Route path="staff" element={<PeoplePage type="staff" />} />
                <Route path="information-officer" element={<PeoplePage type="information" />} />
                <Route path="people/:id" element={<PersonDetail />} />
                <Route path="departments" element={<DepartmentsPage />} />
                <Route path="departments/:id" element={<DepartmentDetail />} />
                <Route path="events" element={<EventsPage />} />
                <Route path="news" element={<NewsPage />} />
                <Route path="news/:id" element={<NewsDetail />} />
                <Route path="publications" element={<PublicationsPage />} />
                <Route path="activities" element={<ActivitiesPage />} />
                <Route path="feedback" element={<FeedbackPage />} />
                <Route path="history" element={<HistoryPage />} />
                <Route path="history/albums/:id" element={<AlbumPage />} />
                <Route path="our-pride" element={<OurPridePage />} />
                <Route path="*" element={lazyInfo('notfound')} />
              </Route>
            </Routes>
          )}
        </Suspense>
        </LangProvider>
      </SiteProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
