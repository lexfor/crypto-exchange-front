import React, { JSX } from 'react';
import logo from './logo.svg';
import './App.css';

function App(): JSX.Element {
  const appTitle = 'Market Platform';

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <h1>{appTitle}</h1>
        <p>Welcome to our market platform.</p>
        <div className="nav-links">
          <a className="App-link" href="/markets" rel="noopener noreferrer">
            Markets
          </a>
          <a className="App-link" href="/trade" rel="noopener noreferrer">
            Trade
          </a>
          <a className="App-link" href="/wallet" rel="noopener noreferrer">
            Wallet
          </a>
        </div>
      </header>
    </div>
  );
}

export default App;
