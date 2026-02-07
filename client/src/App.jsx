import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import AccountPage from './pages/AccountPage';
import LobbyPage from './pages/LobbyPage';
import BattleArenaPage from './pages/BattleArenaPage';
import CustomRoomDashboard from './pages/CustomRoomDashboard';
import RoomBrowserPage from './pages/RoomBrowserPage';
import socket from './socket'; // Import the singleton

function App() {
  useEffect(() => {
    // Connect when the app starts
    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/battle" element={<BattleArenaPage />} />
        <Route path="/custom" element={<RoomBrowserPage />} />
        <Route path="/custom/create" element={<CustomRoomDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;