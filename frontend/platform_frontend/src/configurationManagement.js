// src/ConfigurationManagement.js
import React, { useEffect, useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

function ConfigurationManagement() {
  const [configurations, setConfigurations] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [editorContent, setEditorContent] = useState('');

  useEffect(() => {
    fetchConfigurations();
  }, []);

  const fetchConfigurations = async () => {
    try {
      const res = await fetch('http://10.255.255.211:5000/configurations');
      const data = await res.json();
      setConfigurations(data);
    } catch (error) {
      console.error('Error fetching configurations:', error);
    }
  };

  const openConfiguration = async (config) => {
    setSelectedConfig(config);
    setEditorContent(config.content); // Загрузить контент плейбука
  };

  const handleSave = async () => {
    try {
      const res = await fetch(`http://10.255.255.211:5000/configurations/${selectedConfig.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: editorContent }),
      });
      if (res.ok) {
        alert('Configuration saved successfully');
        fetchConfigurations(); // Обновляем список после сохранения
      } else {
        alert('Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving configuration:', error);
    }
  };

  return (
    <div className="config-management">
      <h2>Configuration Management</h2>
      <div className="config-list">
        <h3>Configurations</h3>
        <ul>
          {configurations.map((config) => (
            <li key={config.id}>
              <button onClick={() => openConfiguration(config)}>
                {config.name}
              </button>
              <p>{config.description}</p>
            </li>
          ))}
        </ul>
      </div>

      {selectedConfig && (
        <div className="editor">
          <h3>Editing: {selectedConfig.name}</h3>
          <ReactQuill
            theme="snow"
            value={editorContent}
            onChange={setEditorContent}
          />
          <button onClick={handleSave}>Save</button>
        </div>
      )}
    </div>
  );
}

export default ConfigurationManagement;
