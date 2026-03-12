import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import PlanPage from './pages/PlanPage';
import TripResultPage from './pages/TripResultPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/homepage" element={<HomePage />} />
        <Route path="/trips/new" element={<PlanPage />} />
        <Route path="/trip-result/:id" element={<TripResultPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
