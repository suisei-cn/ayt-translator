import React, { useState, useEffect } from 'react';

import { Modal } from '@fluentui/react/lib/Modal';

import { TermList } from './TermList';
import { TermEditor } from './TermEditor';
import { ITerm } from '../schema';
import { DefaultButton, PrimaryButton } from '@fluentui/react/lib/Button';
import { CommandBar, ICommandBarItemProps } from '@fluentui/react/lib/CommandBar';
import { mergeStyleSets, getTheme, FontWeights } from '@fluentui/react/lib/Styling';
import { useTranslation } from 'react-i18next';
import { Stack } from '@fluentui/react/lib/Stack';
import { SelectionMode } from '@fluentui/react/lib/Utilities';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { Overlay } from 'office-ui-fabric-react/lib/Overlay';

const theme = getTheme();
const contentStyles = mergeStyleSets({
  fitAll: {
    height: '100%',
    // Fix the position of overlay
    position: 'relative',
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
  ],
  spinner: {
    height: '100%',
    margin: 'auto',
  }
});

export function TermManager() {
  const { t } = useTranslation();
  let [items, setItems] = useState<ITerm[]>([]);

  function reload() {
    setLoading(true);
    (async () => {
      let response = await fetch('/api/terms');
      let terms = await response.json();
      setItems(terms);
      setLoading(false);
    })();
  }

  useEffect(reload, []);

  let [edit, setEdit] = useState<ITerm | null>(null);
  let [select, setSelect] = useState<ITerm | null>(null);
  let [term, setTerm] = useState<ITerm | null>(null);
  let [dirty, setDirty] = useState(false);
  let [loading, setLoading] = useState(true);

  function beginEdit(term: ITerm | null) {
    setEdit(term);
    setDirty(false);
    setTerm(term ? term : {
      input: '',
      output: '',
    });
  }

  function deleteItem(term: ITerm) {
    setLoading(true);
    (async () => {
      let response = await fetch('/api/term/' + term!._id, {
        method: 'DELETE'
      });
      let resp = await response.json();
      if (resp.error) return alert(resp.error);
      setItems(items => items.filter(x => x !== term));
      setSelect(null);
      setTerm(null);
      setLoading(false);
    })();
  }

  function saveEdit() {
    setLoading(true);
    (async () => {
      let response;
      if (!edit) {
        response = await fetch('/api/term/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify(term!),
        });
      } else {
        response = await fetch('/api/term/' + term!._id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify(term!),
        });
      }
      let resp = await response.json();
      if (resp.error) return alert(resp.error);
      setItems(items => {
        if (!edit) {
          return items.concat(resp);
        } else {
          return items.map(x => x === edit ? resp : x);
        }
      });
      setSelect(null);
      setTerm(null);
      setLoading(false);
    })();
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
        onClick: () => beginEdit(null),
      },
      {
        key: 'edit',
        text: t('cmd-edit'),
        disabled: !select,
        iconProps: { iconName: 'Edit' },
        onClick: () => {
          if (select) beginEdit(select);
        }
      }, {
        key: 'ddelete',
        text: t('cmd-delete'),
        disabled: !select,
        iconProps: { iconName: 'delete' },
        onClick: () => {
          if (select) deleteItem(select);
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
      {loading ? (
        <Overlay>
          <Spinner
            label={t('loading')}
            size={SpinnerSize.large}
            className={contentStyles.spinner}
          ></Spinner>
        </Overlay>
      ) : undefined}
    </Stack>
  );
}
