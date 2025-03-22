import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './networkEquipment.css';

function NetworkEquipment() {
  const [devices, setDevices] = useState([]);
  const [ipAddress, setIpAddress] = useState('');
  const [snmpSettings, setSnmpSettings] = useState({
    community: 'public',
    version: '2c',
  });
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState(''); // For error display
  const navigate = useNavigate();

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://10.255.255.218:5000/devices', {
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
    setMessage('');
    setErrorMessage(''); // Drop error message
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://10.255.255.218:5000/devices/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ ip_address: ipAddress, ...snmpSettings }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Device added successfully');
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
              </li>
            ))}
          </ul>
        </div>

        {/* SNMP Settings */}
        <div className="grid-item snmp-settings-container">
          <h3>SNMP Settings</h3>
          <div className="snmp-settings">
            <label>
              Community String:
              <input
                type="text"
                value={snmpSettings.community}
                onChange={(e) =>
                  setSnmpSettings({ ...snmpSettings, community: e.target.value })
                }
              />
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
          </div>
        </div>
      </div>
    </div>
  );
}

export default NetworkEquipment;
