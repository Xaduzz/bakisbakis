// src/UserManagement.js
import React, { useState, useEffect } from 'react';
import { authFetch } from './utils/authFetch';
import { toast } from 'react-toastify';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [editingUserId, setEditingUserId] = useState(null);
  const [message, setMessage] = useState('');

  const fetchUsers = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await authFetch('http://10.255.255.218:5000/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      console.error("Connection error: ", error);
      toast.error("Error connecting to server");
    }
  };

  const saveUser = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const url = editingUserId
      ? `http://10.255.255.218:5000/users/${editingUserId}`
      : 'http://10.255.255.218:5000/users';
    const method = editingUserId ? 'PUT' : 'POST';

    const body = { username, role };
    if (password) body.password = password;

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(editingUserId ? 'User updated successfully!' : 'User created successfully!');
        setUsername('');
        setPassword('');
        setRole('user');
        setEditingUserId(null);
        fetchUsers();
      } else {
        toast.error(data.error || "An error occurred");
      }
    } catch (error) {
      console.error("Connection Error: ", error);
      toast.error("Server connection error");
    }
  };

  const deleteUser = async (userId) => {
    const token = localStorage.getItem('token');
    try {
      const res = await authFetch(`http://10.255.255.218:5000/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("User deleted successfully");
        fetchUsers();
      } else {
        toast.error(data.error || "User deletion error");
      }
    } catch (error) {
      console.error("Connection Error:", error);
      toast.error("Server connection error");
    }
  };

  const startEditing = (user) => {
    setEditingUserId(user.id);
    setUsername(user.username);
    setRole(user.role);
    setPassword('');
  };

  const cancelEditing = () => {
    setEditingUserId(null);
    setUsername('');
    setPassword('');
    setRole('user');
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div className="user-management">
      <h2>User Management</h2>
      {message && <p>{message}</p>}

      <form onSubmit={saveUser} className="user-form">
        <label>
          Username:
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label>
          Password:
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={editingUserId ? 'Leave empty to keep current' : ''}
          />
        </label>
        <label>
          Role / Permissions:
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="user">User</option>
            <option value="admin">Administrator</option>
          </select>
        </label>
        <button type="submit">
          {editingUserId ? 'Update User' : 'Add User'}
        </button>
        {editingUserId && (
          <button type="button" onClick={cancelEditing}>
            Cancel
          </button>
        )}
      </form>

      <table className="user-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Role</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {Array.isArray(users) && users.map((user) => (
            <tr key={user.id}>
              <td>{user.username}</td>
              <td>{user.role}</td>
              <td>
                <button
                  onClick={() => startEditing(user)}
                  className="action-button edit-button"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteUser(user.id)}
                  className="action-button delete-button"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default UserManagement;
