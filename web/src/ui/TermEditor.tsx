import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { TextField } from '@fluentui/react/lib/TextField';
import { SpinButton } from '@fluentui/react/lib/SpinButton';
import { Dropdown } from '@fluentui/react/lib/Dropdown';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';
import { useTranslation } from 'react-i18next';
import { ITerm, FilterList } from '../schema';
import { Stack } from '@fluentui/react/lib/Stack';

import { FilterListPicker, FilterListDropdown } from './FilterList';

import knownContexts from '../contexts.json';
import { PeoplePickerItem, ValidationState, IPickerItemProps, PeoplePickerItemSuggestion } from '@fluentui/react/lib/Pickers';
import { IPersonaProps } from '@fluentui/react/lib/Persona';

const classNames = mergeStyleSets({
  icon: {
    verticalAlign: 'middle',
    maxHeight: '16px',
    maxWidth: '16px',
  },
});

interface ITermEditorProps {
  item: ITerm;

  onChange?: (item: ITerm) => void,
}

const knownPersona: { [name: string]: IPersonaProps & { search: string } } = {};
knownContexts.forEach(x => knownPersona[x.text] = x);

const contextTags = Object.keys(knownPersona);
const allTranslators = ['Google', 'Microsoft', 'Baidu'];

function resolveContextSuggestions(search: string) {
  let searchLower = search.toLowerCase();
  return contextTags.filter(key => knownPersona[key].search.toLowerCase().indexOf(searchLower) !== -1);
}

function renderContextItem(item: IPickerItemProps<string>, unknown: boolean): JSX.Element {
  let persona: IPersonaProps = unknown ? {
    text: item.item,
    showUnknownPersonaCoin: true,
  } : knownPersona[item.item];
  return <PeoplePickerItem {...item} onItemChange={undefined} item={{ ...persona, ValidationState: ValidationState.valid }} />;
}

function renderContextSuggestionItem(item: string, unknown: boolean): JSX.Element {
  let persona: IPersonaProps = unknown ? {
    text: item,
    showUnknownPersonaCoin: true,
  } : knownPersona[item];
  return <PeoplePickerItemSuggestion personaProps={persona} compact />;
}

export const TermEditor: React.FunctionComponent<ITermEditorProps> = (props) => {
  const { t } = useTranslation();

  const { typeOptions, langOptions } = useMemo(() => {
    const typeOptions = [
      { key: 'preprocess', text: t('term-type-preprocess') },
      { key: 'transform', text: t('term-type-transform') },
      { key: 'postprocess', text: t('term-type-postprocess') },
    ];

    const langOptions = [
      { key: '', text: t('lang-any') },
      { key: 'zh', text: t('lang-zh') },
      { key: 'en', text: t('lang-en') },
    ];

    const translatorOptions = allTranslators.map(x => {
      return { key: x, text: t('translator-' + x.toLowerCase()) };
    });

    return { typeOptions, langOptions, allTranslators, translatorOptions };
  }, [t]);

  function validateInput(input: string) {
    let inputError: string | undefined = undefined;
    if (!input) {
      inputError = t('input-empty');
    } else {
      try {
        new RegExp(input);
      } catch {
        inputError = t('input-invalid');
      }
    }
    return inputError;
  }

  const [[term, inputError], setTermHook] = useState(() => ([{ ...props.item }, validateInput(props.item.input)]));
  useEffect(() => {
    setTermHook([{ ...props.item }, validateInput(props.item.input)]);
  }, [props.item]);

  const setTerm = (item: ITerm) => {
    let inputError = validateInput(item.input);
    setTermHook([item, inputError]);
    if (props.onChange && !inputError) {
      props.onChange(item);
    }
  };

  function renderTranslator(list: string[]) {
    let array = list.map(item => <img key={item} src={item.toLowerCase() + '.png'} className={classNames.icon} alt={item} />)
    return <div>{array}</div>;
  }

  function onChangeTranslator(value: FilterList) {
    let translator = value.exclude && value.list.length === 0 ? undefined : value;
    setTerm({ ...term, translator });
  }

  function onChangePriority(str: string, diff: number): string {
    let value = parseInt(str) + diff;
    value = Math.min(Math.max(value, -10), 10);
    setTerm({ ...term, priority: value === 0 ? undefined : value });
    return String(value);
  }

  return (
    <Stack tokens={{ childrenGap: '0.5em' }}>
      <TextField
        label={t('editor-input')}
        value={term.input}
        onChange={(_, value) => setTerm({ ...term, input: value || '' })}
        errorMessage={inputError}
      />
      <TextField
        label={t('editor-output')}
        value={term.output}
        onChange={(_, value) => setTerm({ ...term, output: value || '' })}
      />
      <Dropdown
        label={t('editor-targetLang')}
        selectedKey={term.targetLang || ''}
        options={langOptions}
        onChange={(_, value) => setTerm({ ...term, targetLang: value!.key === '' ? undefined : value!.key as string })}
      />
      <Dropdown
        label={t('editor-type')}
        selectedKey={term.type || 'transform'}
        options={typeOptions}
        onChange={(_, value) => setTerm({ ...term, type: value!.key === 'transform' ? undefined : value!.key as any })}
      />
      <FilterListDropdown
        placeholder={t('translator-placeholder')}
        label={t('editor-translator')}
        filterList={term.translator ? term.translator : { exclude: true, list: [] }}
        options={allTranslators}
        onChange={onChangeTranslator}
        onRenderItem={x => t('translator-' + x.toLowerCase())}
        onRenderTitle={renderTranslator}
      />
      <SpinButton
        label={t('editor-priority')}
        min={-10}
        max={10}
        step={1}
        incrementButtonAriaLabel={'Increase value by 1'}
        decrementButtonAriaLabel={'Decrease value by 1'}
        value={String(term.priority || 0)}
        onIncrement={x => onChangePriority(x, 1)}
        onDecrement={x => onChangePriority(x, -1)}
        onValidate={x => onChangePriority(x, 0)}
      />
      <FilterListPicker
        label={t('editor-context')}
        placeholder={t('filter-list-any')}
        filterList={term.context}
        onChange={context => setTerm({ ...term, context })}
        allowUnknown
        options={contextTags}
        onResolveSuggestions={resolveContextSuggestions}
        onRenderItem={renderContextItem}
        onRenderSuggestionItem={renderContextSuggestionItem}
      />
      <TextField
        label={t('editor-comment')}
        value={term.comment || ''}
        onChange={(_, value) => setTerm({ ...term, comment: value || undefined })}
        multiline autoAdjustHeight
      />
    </Stack>
  );
}
