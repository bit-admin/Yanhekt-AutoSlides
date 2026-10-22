import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Footer, Header, useTerms } from './components/Chrome';
import { useT } from './i18n';
import { Course } from './pages/Course';
import { Home } from './pages/Home';
import { Results } from './pages/Results';
import { linkClick, navigate, useRoute } from './router';
import './site.css';

function Missing() {
  const t = useT();
  const info = useTerms();
  return (
    <div className="page">
      <Header q="" onSearch={(q) => navigate(`/search?q=${encodeURIComponent(q)}`)} />
      <main className="main">
        <p className="notice">
          {t.errors['not-found']}{' '}
          <a href="/" onClick={linkClick}>
            {t.backToSearch}
          </a>
        </p>
      </main>
      <Footer info={info} />
    </div>
  );
}

function App() {
  const route = useRoute();
  switch (route.page) {
    case 'home':
      return <Home />;
    case 'search':
      return <Results q={route.q} term={route.term} p={route.p} />;
    case 'course':
      return <Course id={route.id} />;
    default:
      return <Missing />;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
