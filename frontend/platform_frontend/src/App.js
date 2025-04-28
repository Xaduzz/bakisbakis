// src/App.js
import React, { useState, useEffect, Suspense, lazy } from 'react';
import './App.css';
import { BrowserRouter as Router, Route, Routes, Navigate, Link } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import DeviceProfile from './deviceProfile';
import Login from './login';
import MainPage from './mainPage';
import UserMenu from './userMenu';
import ChangePassword from './pswChange';


const UserManagement = lazy(() => import('./userManagement'));
const NetworkEquipment = lazy(() => import('./networkEquipment'));
const ConfigurationManagement = lazy(() => import('./configurationManagement'));

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem('token')
  );
  const [userRole, setUserRole] = useState(null);

  const handleLoginSuccess = async () => {
    setIsAuthenticated(true);
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserRole(payload.role);
      } catch (error) {
        console.error("Error decoding token:", error);
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setIsAuthenticated(false);
    setUserRole(null);
  };

  useEffect(() => {
    if (isAuthenticated) {
      handleLoginSuccess();
    }
  }, [isAuthenticated]);

  return (
    <Router>
      <div className="App">
        {isAuthenticated ? (
          <>
            <header className="App-header">
              <h1>NetCentral</h1>
              <nav className="navigation">
                <Link to="/Home">Home</Link>
                {userRole === 'admin' && <Link to="/userManagement">User Management</Link>}
                <Link to="/Devices">Network Equipment</Link>
                <Link to="/configurations">Configurations</Link>
                <UserMenu onLogout={handleLogout} />
              </nav>
            </header>
            <main>
              <Suspense fallback={<div>Loading...</div>}>
                <Routes>
                  <Route path="/Home" element={<MainPage />} />
                  <Route path="/" element={<MainPage />} />
                  {userRole === 'admin' && <Route path="/userManagement" element={<UserManagement />} />}
                  <Route path="/Devices" element={<NetworkEquipment />} />
                  <Route path="/devices/:deviceId" element={<DeviceProfile />} />
                  <Route path="/configurations" element={<ConfigurationManagement />} />
                  <Route path="/change-password" element={<ChangePassword />} />
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </Suspense>
            </main>

            <ToastContainer
              position="top-center"
              autoClose={3000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="dark"
            /> {}
          </>
        ) : (
          <Login onLoginSuccess={handleLoginSuccess} />
        )}
      </div>
    </Router>
  );
}

export default App;
