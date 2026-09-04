import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { ServerSelectPage } from './pages/ServerSelectPage';
import { Layout } from './components/Layout';
import { OverviewPage } from './pages/OverviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { AutoModPage } from './pages/AutoModPage';
import { EconomyPage } from './pages/EconomyPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { LogsPage } from './pages/LogsPage';
import { AdminPage } from './pages/AdminPage';

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/servers" element={<ServerSelectPage />} />
      <Route path="/server/:id" element={<Layout />}>
        <Route index element={<OverviewPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="automod" element={<AutoModPage />} />
        <Route path="economy" element={<EconomyPage />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
