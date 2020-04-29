import React, { useState, } from 'react';

import { PrimaryButton } from '@fluentui/react/lib/Button';
import { useTranslation } from 'react-i18next';
import { Stack, StackItem } from '@fluentui/react/lib/Stack';
import { Grid } from '@fluentui/react/lib/Grid';
import { Shimmer } from '@fluentui/react/lib/Shimmer';
import { TextField } from '@fluentui/react/lib/TextField';

export function Tester() {
  const { t } = useTranslation();

  const [original, setOriginal] = useState('');
  const [translated, setTranslated] = useState('');

  async function translate(target: string) {
    setTranslated('');
    let resp = await fetch('http://localhost:3001/translate?to=' + target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ text: original }),
    });
    let json = await resp.json();
    setTranslated(json.translation);
  }

  return (
    <Stack style={{ height: '100%' }}>
      <Stack.Item grow={1} className="ms-Grid">
        <div className="ms-Grid-row" style={{ height: '100%' }} dir="ltr">
          <TextField className="ms-Grid-col ms-sm6 ms-md6 ms-lg6" styles={{ root: { height: '100%' }, wrapper: { height: '100%' }, fieldGroup: { height: '100%' } }}
            value={original}
            onChange={(_, newValue) => setOriginal(newValue || '')}
            multiline
            resizable={false}
          />
          <Stack className="ms-Grid-col ms-sm6 ms-md6 ms-lg6" tokens={{ childrenGap: '0.5em' }} style={{ padding: '1em', whiteSpace: 'pre-wrap' }}>
            {translated ? translated : undefined}
            {translated ? undefined : <Shimmer />}
            {translated ? undefined : <Shimmer width="75%" />}
            {translated ? undefined : <Shimmer width="50%" />}
          </Stack>
        </div>
      </Stack.Item>
      <PrimaryButton onClick={() => { translate('zh') }}>{t('translate')}</PrimaryButton>
    </Stack >
  );
}
