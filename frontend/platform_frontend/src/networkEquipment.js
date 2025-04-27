import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './networkEquipment.css';
import { authFetch } from './utils/authFetch';
import { toast } from 'react-toastify';

function NetworkEquipment() {
  const [devices, setDevices] = useState([]);
  const [ipAddress, setIpAddress] = useState('');
  const [snmpSettings, setSnmpSettings] = useState({
    community: 'public',
    version: '2c',
    username: '',
    authProtocol: 'MD5',
    authPassword: '',
    privProtocol: 'DES',
    privPassword: ''
  });
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState(''); // For error display
  const navigate = useNavigate();

  const currentUsername = localStorage.getItem('username');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
  
    if (!token || !username) {
      // If token or username is not exist in local storage. User is redirecting to the login page.
      navigate('/login');
    } else {
      fetchDevices();
    }
  }, []);

  const fetchDevices = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await authFetch('http://10.255.255.218:5000/devices', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        console.error('Failed to fetch devices:', await res.json());
      } else {
        const data = await res.json();
        console.log('Fetched devices:', data);
        setDevices(data);
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  const handleAddDevice = async (e) => {
    e.preventDefault();
    setErrorMessage(''); // Drop error message

    if (snmpSettings.version === '2c' && !snmpSettings.community.trim()) {
      toast.error('Community string is required for SNMP v2c');
      return;
    }

    if (snmpSettings.version === '3') {
      if (!snmpSettings.username.trim()) {
        toast.error('Username is required for SNMP v3');
        return;
      }
      if (!snmpSettings.authPassword.trim()) {
        toast.error('Authentication password is required for SNMP v3');
        return;
      }
      if (!snmpSettings.privPassword.trim()) {
        toast.error('Encryption password is required for SNMP v3');
        return;
      }
    }

    try {
      const token = localStorage.getItem('token');
      const res = await authFetch('http://10.255.255.218:5000/devices/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ ip_address: ipAddress, ...snmpSettings }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Device added successfully');
        setIpAddress('');
        fetchDevices();
      } else {
        setErrorMessage(data.error || 'Failed to add device'); // Getting error message
      }
    } catch (error) {
      console.error('Error adding device:', error);
      setErrorMessage('Server connection error');
    }
  };

  const handleDeleteDevice = async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const username = localStorage.getItem('username');
      const res = await authFetch(`http://10.255.255.218:5000/devices/${deviceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Username': username,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Device deleted successfully');
        fetchDevices();
      } else {
        setErrorMessage(data.error || 'Failed to delete device');
      }
    } catch (error) {
      console.error('Error deleting device:', error);
      setErrorMessage('Server connection error');
    }
  };

  const handleUpdateAllDevices = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await authFetch('http://10.255.255.218:5000/devices/update_all', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Devices updated successfully!');
        fetchDevices(); // load devices
      } else {
        toast.error(data.error || 'Failed to update devices');
      }
    } catch (error) {
      console.error('Error updating devices:', error);
      toast.error('Server connection error');
    }
  };
  
  
  

  return (
    <div className="equipment-container">
      <h2>Network Equipment</h2>

      {/* Grid Container */}
      <div className="grid-container">
        {/* Form to add a new device */}
        <div className="grid-item form-container">
          <form className="add-device-form" onSubmit={handleAddDevice}>
            
            <label>
              IP Address:
              <input
                type="text"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                required
              />
            </label>
            <button type="submit">Add Device</button>
          </form>
          {message && <p className="success-message">{message}</p>}
          {errorMessage && <p className="error-message">{errorMessage}</p>} {/* error message */}
        </div>

        {/* Device list */}
        <div className="grid-item device-list-container">
          <h3>Device List</h3>
          <ul className="device-list">
          <button onClick={handleUpdateAllDevices} className="update-all-button">
  Update All Devices
</button>
            {devices.map((device, index) => (
              <li key={index}>
                <p>
                  <strong>Hostname:</strong> {device.name || 'N/A'} <br />
                  <strong>IP:</strong> {device.ip_address || 'N/A'} <br />
                  <strong>Model:</strong> {device.model || 'N/A'} <br />
                  <strong>Manufacturer:</strong> {device.manufacturer || 'N/A'} <br />
                  <strong>Status:</strong> {device.status || 'N/A'}
                </p>
                <button onClick={() => navigate(`/devices/${device.id}`)}>
                  View Profile
                </button>
                <button onClick={() => handleDeleteDevice(device.id)} className="delete-device-button">
                Delete Device
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* SNMP Settings */}
        <div className="grid-item snmp-settings-container">
          <h3>SNMP Settings</h3>
          <div className="snmp-settings">
            <label>
            {snmpSettings.version === '2c' && (
              <label>
                Community String:
                <input
                  type="text"
                  value={snmpSettings.community}
                  onChange={(e) =>
                    setSnmpSettings({ ...snmpSettings, community: e.target.value })
                  }
                  required
                />
              </label>
            )}
            </label>
            <label>
              SNMP Version:
              <select
                value={snmpSettings.version}
                onChange={(e) =>
                  setSnmpSettings({ ...snmpSettings, version: e.target.value })
                }
              >
                <option value="2c">2c</option>
                <option value="3">3</option>
              </select>
            </label>
                
            {snmpSettings.version === '3' && (
              <>
                <label>
                  SNMP Username:
                  <input
                    type="text"
                    value={snmpSettings.username}
                    onChange={(e) =>
                      setSnmpSettings({ ...snmpSettings, username: e.target.value })
                    }
                  />
                </label>

                <label>
                  Authentication Protocol:
                  <select
                    value={snmpSettings.authProtocol}
                    onChange={(e) =>
                      setSnmpSettings({ ...snmpSettings, authProtocol: e.target.value })
                    }
                  >
                    <option value="MD5">MD5</option>
                    <option value="SHA">SHA</option>
                  </select>
                </label>

                <label>
                  Authentication Password:
                  <input
                    type="password"
                    value={snmpSettings.authPassword}
                    onChange={(e) =>
                      setSnmpSettings({ ...snmpSettings, authPassword: e.target.value })
                    }
                  />
                </label>

                <label>
                  Encryption Protocol:
                  <select
                    value={snmpSettings.privProtocol}
                    onChange={(e) =>
                      setSnmpSettings({ ...snmpSettings, privProtocol: e.target.value })
                    }
                  >
                    <option value="DES">DES</option>
                    <option value="AES">AES</option>
                  </select>
                </label>

                <label>
                  Encryption Password:
                  <input
                    type="password"
                    value={snmpSettings.privPassword}
                    onChange={(e) =>
                      setSnmpSettings({ ...snmpSettings, privPassword: e.target.value })
                    }
                  />
              </label>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

export default NetworkEquipment;
