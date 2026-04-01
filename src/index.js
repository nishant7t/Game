import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Notice `../App` instead of `./App` — this tells it App.js is one folder up (at root level).

Then change the build command back to just:
```
