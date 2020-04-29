import React, { useState, useEffect, useMemo } from 'react';

import { Modal } from '@fluentui/react/lib/Modal';

import { TermList } from './TermList';
import { TermEditor } from './TermEditor';
import { ITerm } from '../schema';
import { DefaultButton, PrimaryButton } from '@fluentui/react/lib/Button';
import { CommandBar, ICommandBarItemProps } from '@fluentui/react/lib/CommandBar';
import { mergeStyleSets, getTheme, FontWeights } from '@fluentui/react/lib/Styling';
import { useTranslation } from 'react-i18next';
import { Stack } from '@fluentui/react/lib/Stack';
import { SelectionMode } from '@uifabric/utilities';

const theme = getTheme();
const contentStyles = mergeStyleSets({
  fitAll: {
    height: '100%',
  },
  fixPosition: {
    position: 'relative',
  },
  modal: {
    borderTop: `4px solid ${theme.palette.themePrimary}`,
    flex: '4 4 auto',
    padding: '0 24px 24px 24px',
    overflowY: 'hidden',
    width: '400px',
  },
  title: [
    theme.fonts.xxLarge,
    {
      fontWeight: FontWeights.semibold,
      padding: '12px 0 0 0',
    },
  ]
});

export function TermManager() {
  const { t } = useTranslation();
  let [items, setItems] = useState<ITerm[]>([]);

  function reload() {
    (async () => {
      let response = await fetch('http://localhost:3001/terms');
      let terms = await response.json();
      setItems(terms);
    })();
  }

  useEffect(reload, []);

  let [index, setIndex] = useState(-1);
  let [select, setSelect] = useState<ITerm | null>(null);
  let [term, setTerm] = useState<ITerm | null>(null);
  let [dirty, setDirty] = useState(false);

  function beginEdit(term: ITerm) {
    setIndex(items.indexOf(term));
    setDirty(false);
    setTerm(term);
  }

  function saveEdit() {
    setItems(items => {
      let newItems = items.slice();
      let [old] = newItems.splice(index, 1, term!);
      if (select === old) {
        setSelect(term!);
      }
      return newItems;
    });
    setSelect(null);
    setTerm(null);
  }

  function cancelEdit() {
    setTerm(null);
  }

  const commandButtons: ICommandBarItemProps[] = (() => {
    return [
      {
        key: 'new',
        text: t('cmd-new'),
        iconProps: { iconName: 'Add' },
        onClick: () => {
          beginEdit({
            input: '',
            output: '',
          });
        }
      },
      {
        key: 'edit',
        text: t('cmd-edit'),
        disabled: !select,
        iconProps: { iconName: 'Edit' },
        onClick: () => {
          if (select) beginEdit(select);
        }
      },
      {
        key: 'reload',
        text: t('cmd-reload'),
        iconProps: { iconName: 'Refresh' },
        onClick: reload,
      },
    ];
  })();

  return (
    <Stack className={contentStyles.fitAll}>
      <CommandBar
        items={commandButtons}
      />
      <Stack.Item grow className={contentStyles.fixPosition}>
        <TermList
          items={items}
          selectionMode={SelectionMode.single}
          onSelectionChanged={(list) => {
            setSelect(list[0] || null)
          }}
          onItemInvoked={beginEdit}
        />
      </Stack.Item>
      {term ? (
        <Modal
          isOpen
          isBlocking={dirty}
          onDismiss={cancelEdit}
        >
          <Stack className={contentStyles.modal} tokens={{ childrenGap: '1em' }}>
            <div className={contentStyles.title}>{t('editor-title')}</div>
            <TermEditor item={term} onChange={term => {
              setTerm(term);
              setDirty(true)
            }} />
            <Stack horizontal tokens={{ childrenGap: '1em' }}>
              <PrimaryButton disabled={!dirty} onClick={saveEdit}>{t('editor-save')}</PrimaryButton>
              <DefaultButton onClick={cancelEdit}>{t('editor-cancel')}</DefaultButton>
            </Stack>
          </Stack>
        </Modal>
      ) : undefined}
    </Stack>
  );
}
