import React, { useState, } from 'react';

import { PrimaryButton } from '@fluentui/react/lib/Button';
import { useTranslation } from 'react-i18next';
import { Stack, StackItem } from '@fluentui/react/lib/Stack';
import { Shimmer } from '@fluentui/react/lib/Shimmer';
import { TextField } from '@fluentui/react/lib/TextField';
import { Dropdown, IDropdownOption } from '@fluentui/react';

export function Tester() {
  const { t } = useTranslation();

  const [original, setOriginal] = useState('');
  const [translated, setTranslated] = useState('');
  const [lang, setLang] = useState('zh');

  let langOptions = [
    { key: 'zh', text: t('lang-zh') },
    { key: 'en', text: t('lang-en') },
  ];

  function onChangeLang(_event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void {
    setLang(option!.key as string);
  }

  async function translate(target: string) {
    setTranslated('');
    let resp = await fetch('/api/translate?to=' + target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ text: original }),
    });
    let json = await resp.json();
    setTranslated(json.translation);
  }

  return (
    <Stack style={{ height: '100%', padding: '1em' }}>
      <Dropdown
        label={t('tester-lang')}
        selectedKey={lang}
        options={langOptions}
        onChange={onChangeLang}
        styles={{ root: { width: '200px' } }}
      />
      <Stack.Item grow={1} className="ms-Grid" style={{ margin: '1em 0' }}>
        <div className="ms-Grid-row" style={{ height: '100%' }} dir="ltr">
          <TextField className="ms-Grid-col ms-sm6 ms-md6 ms-lg6" styles={{ root: { height: '100%', padding: '0 !important' }, wrapper: { height: '100%' }, fieldGroup: { height: '100%' } }}
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
      <PrimaryButton onClick={() => { translate(lang) }}>{t('translate')}</PrimaryButton>
    </Stack >
  );
}
