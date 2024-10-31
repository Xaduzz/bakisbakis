// src/MainPage.js
// src/MainPage.js
import React, { useEffect, useState } from 'react';

function MainPage() {
  const [recentActivity, setRecentActivity] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [configurations, setConfigurations] = useState([]);

  useEffect(() => {
    fetchRecentActivity();
    fetchAlerts();
    fetchDevices();
    fetchConfigurations();
  }, []);

  const fetchRecentActivity = async () => {
    const res = await fetch('http://10.255.255.211:5000/recent-activity');
    const data = await res.json();
    setRecentActivity(data);
  };

  const fetchAlerts = async () => {
    const res = await fetch('http://10.255.255.211:5000/alerts');
    const data = await res.json();
    setAlerts(data);
  };

  const fetchDevices = async () => {
    const res = await fetch('http://10.255.255.211:5000/devices');
    const data = await res.json();
    setDevices(data);
  };

  const fetchConfigurations = async () => {
    const res = await fetch('http://10.255.255.211:5000/configurations');
    const data = await res.json();
    setConfigurations(data);
  };

  return (
    <div className="main-page">
      <div className="grid-container">
        {/* Recent Activity */}
        <div className="grid-item">
          <h3>Recent Activity</h3>
          <ul className="activity-list">
            {recentActivity.map((activity, index) => (
              <li key={index}>
                <p>{activity.user} on {activity.device}: {activity.action}</p>
                <span>{new Date(activity.timestamp).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Alerts */}
        <div className="grid-item">
          <h3>Alerts</h3>
          <ul className="alert-list">
            {alerts.map((alert, index) => (
              <li key={index}>
                <p>{alert.message}</p>
                <span>Severity: {alert.level}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Devices */}
        <div className="grid-item">
          <h3>Devices</h3>
          <ul className="device-list">
            {devices.map((device, index) => (
              <li key={index}>
                <p>{device.name} - {device.ip_address}</p>
                <span>{device.status}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Configurations */}
        <div className="grid-item">
          <h3>Configurations</h3>
          <ul className="config-list">
            {configurations.map((config, index) => (
              <li key={index}>{config.name}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default MainPage;

