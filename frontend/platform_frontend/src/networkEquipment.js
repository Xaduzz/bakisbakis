// src/NetworkEquipment.js
import React, { useState, useEffect } from 'react';
import './networkEquipment.css';

function NetworkEquipment() {
  const [devices, setDevices] = useState([]);
  const [ipAddress, setIpAddress] = useState('');
  const [snmpSettings, setSnmpSettings] = useState({
    community: 'public',
    version: '2c',
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const res = await fetch('http://10.255.255.211:5000/devices');
      const data = await res.json();
      setDevices(data);
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  const handleAddDevice = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://10.255.255.211:5000/devices/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ip_address: ipAddress, ...snmpSettings }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Device added successfully');
        setIpAddress('');
        fetchDevices(); // Refresh the device list
      } else {
        setMessage(data.error || 'Failed to add device');
      }
    } catch (error) {
      console.error('Error adding device:', error);
      setMessage('Server connection error');
    }
  };

  return (
    <div className="equipment-container">
      <h2>Network Equipment</h2>

      {/* Форма добавления устройства */}
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
      {message && <p>{message}</p>}

      {/* Список устройств */}
      <ul className="device-list">
        {devices.map((device, index) => (
          <li key={index}>
            <p>{device.name} - {device.ip_address}</p>
            <span>{device.status}</span>
          </li>
        ))}
      </ul>

      {/* Настройки SNMP */}
      <div className="snmp-settings">
        <h3>SNMP Settings</h3>
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
  );
}

export default NetworkEquipment;
