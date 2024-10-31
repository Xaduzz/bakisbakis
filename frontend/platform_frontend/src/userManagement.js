// src/UserManagement.js
import React, { useState, useEffect } from 'react';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [editingUserId, setEditingUserId] = useState(null);
  const [message, setMessage] = useState('');

  // Load all users
  const fetchUsers = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('http://10.255.255.211:5000/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      console.error("Connection error: ", error);
      setMessage("Connection with server error: ");
    }
  };

  // add new user
  const saveUser = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const url = editingUserId 
      ? `http://10.255.255.211:5000/users/${editingUserId}` 
      : 'http://10.255.255.211:5000/users';
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
      setMessage(editingUserId ? 'User updated' : 'User added');
      setUsername('');
      setPassword('');
      setRole('user');
      setEditingUserId(null);
      fetchUsers();
    } catch (error) {
      console.error("Connection Error: ", error);
      setMessage("Error with connection to server or with data in user management fields");
    }
  };

  // Удаление пользователя
  const deleteUser = async (userId) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`http://10.255.255.211:5000/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("User successfully deleted");
        fetchUsers();
      } else {
        setMessage(data.error || "User delete error");
      }
    } catch (error) {
      console.error("Connection Error:", error);
      setMessage("Connection with server error");
    }
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
          {editingUserId ? 'Update' : 'Add'} User
        </button>
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
