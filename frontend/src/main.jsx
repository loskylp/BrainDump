/**
 * React application entry point.
 *
 * Mounts the root React component into the #root DOM node defined in
 * index.html. Imports global Tailwind CSS directives.
 *
 * The BrowserRouter is provided here so all child components (including App)
 * can use React Router hooks without an extra provider wrapper.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
