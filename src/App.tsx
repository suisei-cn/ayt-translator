import React, { useState, useEffect } from 'react';
import './App.css';

import { Fabric } from '@fluentui/react/lib/Fabric';
import { initializeIcons } from '@fluentui/react/lib/Icons';

import { TermList } from './ui/TermList';

initializeIcons();

function App() {
  let [items, setItems] = useState([]);

  useEffect(() => {
    (async () => {
      let response = await fetch('http://localhost:3001/terms');
      let terms = await response.json();
      setItems(terms);
    })();
  }, []);

  return (
    <Fabric>
      <TermList items={items} />
    </Fabric>
  );
}

export default App;
