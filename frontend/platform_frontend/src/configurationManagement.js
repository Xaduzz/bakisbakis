import React, { useEffect, useState } from 'react';
import './configuration.css';
import { authFetch } from './utils/authFetch';

function PlaybookManagement() {
  const [playbooks, setPlaybooks] = useState([]);
  const [devices, setDevices] = useState([]);
  const [selectedPlaybook, setSelectedPlaybook] = useState(null);
  const [editorContent, setEditorContent] = useState('');
  const [selectedDevice, setSelectedDevice] = useState('');
  const [isExecuteModalOpen, setIsExecuteModalOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPlaybookName, setNewPlaybookName] = useState('');
  const [userRole, setUserRole] = useState('user');

  useEffect(() => {
    fetchPlaybooks();
    fetchDevices();
    checkUserRole();
  }, []);

  const fetchPlaybooks = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await authFetch('http://10.255.255.218:5000/playbooks', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPlaybooks(data);
      } else {
        console.error("Failed to fetch playbooks");
      }
    } catch (error) {
      console.error('Error fetching playbooks:', error);
    }
  };

  const fetchDevices = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await authFetch('http://10.255.255.218:5000/devices', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDevices(data);
      } else {
        console.error("Failed to fetch devices");
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  const checkUserRole = () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const decoded = JSON.parse(atob(token.split('.')[1]));
      setUserRole(decoded.role);
    } catch (error) {
      console.error("Error decoding token", error);
    }
  };

  const openPlaybook = async (filename) => {
    try {
      const token = localStorage.getItem('token');
      const res = await authFetch(`http://10.255.255.218:5000/playbooks/${filename}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setSelectedPlaybook(filename);
        setEditorContent(data.content || '');
        setIsEditorOpen(true);
      } else {
        alert("Failed to load playbook");
      }
    } catch (error) {
      console.error('Error opening playbook:', error);
    }
  };

  const savePlaybook = async () => {
    if (!selectedPlaybook) {
      alert("No playbook selected.");
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await authFetch(`http://10.255.255.218:5000/playbooks/${selectedPlaybook}`, {
        method: "PUT",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: editorContent })
      });

      if (res.ok) {
        alert("Playbook saved successfully.");
        setIsEditorOpen(false);
        fetchPlaybooks();
      } else {
        alert("Failed to save playbook.");
      }
    } catch (error) {
      console.error("Error saving playbook:", error);
    }
  };

  const createPlaybook = async () => {
    if (!newPlaybookName.endsWith('.yml')) {
      alert("Filename must end with .yml");
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await authFetch(`http://10.255.255.218:5000/playbooks/${newPlaybookName}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: '' })
      });
      if (res.ok) {
        alert('Playbook created');
        setIsCreateModalOpen(false);
        setNewPlaybookName('');
        fetchPlaybooks();
      } else {
        alert('Failed to create playbook');
      }
    } catch (error) {
      console.error("Error creating playbook:", error);
    }
  };

  const executePlaybook = async () => {
    if (!selectedPlaybook || !selectedDevice) {
      alert("Please select a playbook and a device.");
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await authFetch(`http://10.255.255.218:5000/playbooks/${selectedPlaybook}/execute`, {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ device_ip: selectedDevice })
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Playbook executed successfully!\n\nOutput:\n${data.output}`);
      } else {
        const errorData = await res.json();
        alert(`Execution failed: ${errorData.error}`);
      }
    } catch (error) {
      console.error("Error executing playbook:", error);
    }

    setIsExecuteModalOpen(false);
  };

  const confirmDelete = (filename) => {
    setSelectedPlaybook(filename);
    setIsDeleteModalOpen(true);
  };

  const deletePlaybook = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await authFetch(`http://10.255.255.218:5000/playbooks/${selectedPlaybook}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        alert("Playbook deleted");
        fetchPlaybooks();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Error deleting playbook:", error);
    }
    setIsDeleteModalOpen(false);
  };

  return (
    <div className="playbook-management">
      <h2>Playbook Management</h2>
      <div className="playbook-container">
        <table className="playbook-table">
          <thead>
            <tr>
              <th className="left-align">Playbook Name</th>
              <th className="right-align">Actions</th>
            </tr>
          </thead>
          <tbody>
            {playbooks.map((filename) => (
              <tr key={filename}>
                <td className="left-align">{filename}</td>
                <td className="right-align playbook-actions">
                  <button onClick={() => openPlaybook(filename)} className="open-button">Open</button>
                  <button onClick={() => { setSelectedPlaybook(filename); setIsExecuteModalOpen(true); }} className="execute-button">Execute</button>
                  {userRole === 'admin' && (
                    <button onClick={() => confirmDelete(filename)} className="delete-button">Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={() => setIsCreateModalOpen(true)} className="create-button">Add Configuration</button>
      </div>

      {isEditorOpen && (
        <div className="modal">
          <div className="modal-content editor-modal">
            <h3>Editing: {selectedPlaybook}</h3>
            <textarea
              className="yaml-editor"
              value={editorContent}
              onChange={(e) => setEditorContent(e.target.value)}
            />
            <div className="modal-actions">
              <button onClick={savePlaybook} className="save-button">Save</button>
              <button onClick={() => setIsEditorOpen(false)} className="cancel-button">Close</button>
            </div>
          </div>
        </div>
      )}

      {isExecuteModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h3>Execute Playbook: {selectedPlaybook}</h3>
            <label>Select Device:</label>
              <select value={selectedDevice} onChange={(e) => {
                setSelectedDevice(e.target.value);
                console.log("Selected device IP:", e.target.value);
              }}>
                <option value="">-- Select a Device --</option>
                {devices.map(device => (
                  <option key={device.ip_address} value={device.ip_address}>
                    {device.name} ({device.ip_address})
                  </option>
                ))}
            </select>
            <div className="modal-actions">
              <button onClick={executePlaybook} className="execute-confirm-button">Run</button>
              <button onClick={() => setIsExecuteModalOpen(false)} className="cancel-button">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="modal">
          <div className="modal-content delete-modal">
            <h3>Are you sure?</h3>
            <div className="modal-actions">
              <button onClick={deletePlaybook} className="delete-confirm-button">YES</button>
              <button onClick={() => setIsDeleteModalOpen(false)} className="cancel-button">NO</button>
            </div>
          </div>
        </div>
      )}

      {isCreateModalOpen && (
        <div className="modal">
          <div className="modal-content create-playbook-modal">
            <h3>Create New Playbook</h3>
            <input
              type="text"
              placeholder="Enter filename (e.g. my_playbook.yml)"
              value={newPlaybookName}
              onChange={(e) => setNewPlaybookName(e.target.value)}
            />
            <div className="modal-actions">
              <button onClick={createPlaybook} className="save-button">Create</button>
              <button onClick={() => setIsCreateModalOpen(false)} className="cancel-button">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlaybookManagement;