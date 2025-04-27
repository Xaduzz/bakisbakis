import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { authFetch } from './utils/authFetch';
import { toast } from 'react-toastify';
import './deviceProfile.css';

function DeviceProfile() {
  const { deviceId } = useParams();
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [deviceConfig, setDeviceConfig] = useState('');

  useEffect(() => {
    fetchDeviceInfo();
  }, []);

  const fetchDeviceInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await authFetch(`http://10.255.255.218:5000/devices/${deviceId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (res.ok) {
        setDeviceInfo(data);
      } else {
        toast.error(data.error || 'Failed to fetch device information');
      }
    } catch (error) {
      console.error('Error fetching device info:', error);
      toast.error('Server connection error');
    }
  };

  const handleFetchConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await authFetch(`http://10.255.255.218:5000/devices/${deviceId}/config`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (res.ok) {
        setDeviceConfig(data.config);
        toast.success('Configuration fetched successfully!');
      } else {
        toast.error(data.error || 'Failed to fetch configuration');
      }
    } catch (error) {
      console.error('Error fetching config:', error);
      toast.error('Server connection error');
    }
  };

  const handleDownloadConfig = () => {
    const element = document.createElement("a");
    const file = new Blob([deviceConfig], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${deviceInfo.name || deviceInfo.ip_address}_running-config.txt`;
    document.body.appendChild(element); // for firefox browser, other way is not working, nzn kodel :D
    element.click();
    document.body.removeChild(element);
  };

  if (!deviceInfo) {
    return <div>Loading device information...</div>;
  }

  return (
    <div className="device-profile">
      <h2>Viewing Device: {deviceInfo.name ? `${deviceInfo.name} (${deviceInfo.ip_address})` : deviceInfo.ip_address}</h2>
      <p><strong>Hostname:</strong> {deviceInfo.name || 'N/A'}</p>
      <p><strong>🌐 IP Address:</strong> {deviceInfo.ip_address || 'N/A'}</p>
      <p><strong>Model:</strong> {deviceInfo.model || 'N/A'}</p>
      <p><strong>Manufacturer:</strong> {deviceInfo.manufacturer || 'N/A'}</p>
      <p><strong>📶 Status:</strong> {deviceInfo.status || 'N/A'}</p>
      <p><strong>📍 Location:</strong> {deviceInfo.location || 'N/A'}</p>

      <button onClick={handleFetchConfig} className="fetch-config-button">
        Get Full Configuration
      </button>

      {deviceConfig && (
  <>
    <div className="device-config-buttons">
      <button onClick={handleDownloadConfig} className="download-config-button">
        Download Config
      </button>
    </div>

    <div className="device-config-output">
      <h3>Running Configuration:</h3>
      <pre>{deviceConfig}</pre>
    </div>
  </>
)}
    </div>
  );
}

export default DeviceProfile;
