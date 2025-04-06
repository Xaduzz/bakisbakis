// src/MainPage.js
// src/MainPage.js
import React, { useEffect, useState } from 'react';

function MainPage() {
  const [recentActivity, setRecentActivity] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [topConfigs, setTopConfigs] = useState([]);


  useEffect(() => {
    fetchRecentActivity();
    fetchDevices();
    fetchTopUsedConfigs();
    fetchAlerts();
  
    const interval = setInterval(() => {
      fetchDevices();
      fetchRecentActivity();
      fetchTopUsedConfigs();
      fetchAlerts();
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

  const fetchTopUsedConfigs = async () => {
  try {
    const res = await fetch('http://10.255.255.218:5000/playbooks/top-used');
    const data = await res.json();
    setTopConfigs(data);
  } catch (error) {
    console.error("Error fetching top used configurations:", error);
  }
};

const fetchAlerts = async () => {
  try {
    const res = await fetch('http://10.255.255.218:5000/alerts');
    if (res.ok) {
      const data = await res.json();
      setAlerts(data);
    } else {
      console.error("Failed to fetch alerts:", await res.json());
    }
  } catch (error) {
    console.error("Error fetching alerts:", error);
  }
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
            {alerts.length > 0 ? (
             alerts.map((alert, index) => (
              <li key={index} className={`alert-item severity-${alert.severity}`}>
                <p>{alert.message}</p>
                <span>Severity: {alert.severity}</span><br />
                <small>{new Date(alert.timestamp).toLocaleString()}</small>
              </li>
             ))
           ) : (
            <li>No alerts</li>
          )}
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
  <h3>Recently Used Configurations</h3>
  <ul className="config-list">
    {topConfigs.length > 0 ? (
      topConfigs.map((config, index) => (
        <li key={index}>
          <strong>{config.playbook_name}</strong><br />
          <small>
            Last used:{' '}
            {config.last_used
              ? new Date(config.last_used).toLocaleString()
              : 'Never'}
          </small><br />
          <small>Used {config.usage_count} times</small>
        </li>
      ))
    ) : (
      <li>No usage data available.</li>
    )}
  </ul>
</div>

      </div>
    </div>
  );
}

export default MainPage;

