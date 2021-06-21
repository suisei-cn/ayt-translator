import React from 'react';
import './App.css';

import { Pivot, PivotItem } from '@fluentui/react/lib/Pivot';

import { TermManager } from './ui/TermManager';
import { Tester } from './ui/Tester';
import { useTranslation } from 'react-i18next';

function App() {
  const { t } = useTranslation();
  return (
    <Pivot style={{ height: '100%' }} styles={{ itemContainer: { height: 'calc(100% - 44px)' } }}>
      <PivotItem style={{ height: '100%' }} headerText={t("tab-editor")}>
        <TermManager />
      </PivotItem>
      <PivotItem style={{ height: '100%' }} headerText={t("tab-test")}>
        <Tester />
      </PivotItem>
    </Pivot>
  );
}

export default App;
