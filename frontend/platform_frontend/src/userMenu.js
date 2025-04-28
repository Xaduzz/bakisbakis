import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './userMenu.css'; 

function UserMenu({ onLogout }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const username = localStorage.getItem('username') || 'User';

  const handleLogout = () => {
    onLogout();
  };

  const handleChangePassword = () => {
    navigate('/change-password');
    setOpen(false);
  };

  return (
    <div className="user-menu">
      <div className="user-info" onClick={() => setOpen(!open)}>
        {username} ⬇
      </div>

      {open && (
        <div className="user-dropdown">
          <button onClick={handleChangePassword}>Change Password</button>
          <button onClick={handleLogout}>Logout</button>
        </div>
      )}
    </div>
  );
}

export default UserMenu;
