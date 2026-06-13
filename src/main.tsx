import React from 'react'
import ReactDOM from 'react-dom/client'
import Router from './app/Router'
import './components/Layout.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>,
)
