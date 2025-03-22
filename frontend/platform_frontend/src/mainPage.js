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
    fetchDevices();
    fetchConfigurations();
  
    const interval = setInterval(() => {
      fetchDevices();
      fetchConfigurations();
      fetchRecentActivity();
    }, 10000);
  
    return () => clearInterval(interval);
  }, []);



  const fetchRecentActivity = async () => {
    try{
      const res = await fetch('http://10.255.255.218:5000/recent-activity');
      const data = await res.json();
      setRecentActivity(data);
  } catch (error){
    console.error("Error fetching recent activity:", error);
  }
  };



  const fetchDevices = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://10.255.255.218:5000/devices', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,  // Adding auth token
          'Content-Type': 'application/json'
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log("Device data:", data);
        setDevices(data);  // Saving device list
      } else {
        console.error("Failed to fetch devices:", await res.json());
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
    }
  };

  const fetchConfigurations = async () => {
    const res = await fetch('http://10.255.255.218:5000/configurations');
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
            {recentActivity.length > 0 ? (
            recentActivity.map((activity, index) => (
              <li key={index}>
                <p>{activity.message}</p>
                <span>{new Date(activity.timestamp).toLocaleString()}</span>
              </li>
    ))
  ) : (
    <p>No recent activity found.</p>
  )}
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
          <h3>Latest Added Devices</h3>
          <table className="device-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Model</th>
                <th>IP Address</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {devices.slice(-5).map((device, index) => (
                <tr key={index}>
                  <td>{device.name || 'N/A'}</td>
                  <td>{device.model || 'N/A'}</td>
                  <td>{device.ip_address}</td>
                  <td>{device.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
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

