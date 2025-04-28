import React, { useState } from 'react';
import { authFetch } from './utils/authFetch';
import { toast } from 'react-toastify';
import './pswChange.css';
import { useNavigate } from 'react-router-dom';

function ChangePassword() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigate = useNavigate();

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await authFetch('http://10.255.255.218:5000/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Password changed successfully!');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');

        setTimeout(() => {
        navigate('/Home');
        }, 2000); //2 seconds ant redirect to home page
      } else {
        toast.error(data.error || 'Failed to change password');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error('Server connection error');
    }
  };

  return (
    <div className="change-password-container">
      <h2>Change Password</h2>
      <form className="change-password-form" onSubmit={handleChangePassword}>
        <label>
          Old Password:
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            required
          />
        </label>
        <label>
          New Password:
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </label>
        <label>
          Confirm New Password:
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </label>
        <button type="submit">Change Password</button>
      </form>
    </div>
  );
}

export default ChangePassword;
