import * as React from 'react';
import { Fabric } from '@fluentui/react/lib/Fabric';
import { TextField } from '@fluentui/react/lib/TextField';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import {
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
  IColumn,
} from '@fluentui/react/lib/DetailsList';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';
import { useTranslation } from 'react-i18next';
import { ITerm, comparePriority } from '../schema';
import { useState, useMemo } from 'react';


const classNames = mergeStyleSets({
  icon: {
    verticalAlign: 'middle',
    maxHeight: '16px',
    maxWidth: '16px',
  },
  controlWrapper: {
    display: 'flex',
    flexWrap: 'wrap',
  },
});

const dropdownStyles = {
  dropdown: {
    margin: '0 30px 1em 0',
    width: '200px',
  }
}

const controlStyles = {
  root: {
    margin: '0 30px 1em 1em',
    minWidth: '200px',
    maxWidth: '300px',
  },
};


function compareString(a: string, b: string) {
  return a === b ? 0 : (a < b ? -1 : 1);
}

function typeToNumber(type?: string): number {
  switch (type) {
    case 'preprocess': return -1;
    case 'postprocess': return 1;
    default: return 0;
  }
}

function compareTerm(a: ITerm, b: ITerm, key: string) {
  switch (key) {
    case 'input': return compareString(a.input, b.input);
    case 'output': return compareString(a.output, b.output);
    case 'targetLang': return compareString(a.targetLang || '', b.targetLang || '');
    case 'type': return typeToNumber(a.type) - typeToNumber(b.type);
    case 'priority': return comparePriority(a, b);
    default: return 0;
  }
}

interface ITermListProps {
  items: ITerm[];

  compact?: boolean;
  onItemInvoked?: (item: ITerm) => void,
}

export const TermList: React.FunctionComponent<ITermListProps> = (props) => {
  let { t, i18n } = useTranslation();

  let typeOptions = [
    { key: 'preprocess', text: t('term-type-preprocess') },
    { key: 'transform', text: t('term-type-transform') },
    { key: 'postprocess', text: t('term-type-postprocess') },
  ];

  let langOptions = [
    { key: 'zh', text: t('lang-zh') },
    { key: 'en', text: t('lang-en') },
  ];

  interface SortFilterState {
    sortKey: string,
    sortedDescending: boolean,
    sortKeySecondary: string | null,
    sortedDescendingSecondary: boolean,
    filterSearch: RegExp | null,
    filterLang: string[],
    filterType: string[],
  }
  let [sortFilter, setSortFilter] = useState<SortFilterState>({
    sortKey: 'priority',
    sortedDescending: true,
    sortKeySecondary: null,
    sortedDescendingSecondary: false,
    filterSearch: null,
    filterLang: ['en', 'zh'],
    filterType: ['preprocess', 'transform', 'postprocess'],
  });

  let [invalidSearch, setInvalidSearch] = useState(false);

  let columns = useMemo(() => {
    function isSorted(key: string) {
      if (sortFilter.sortKey === key) {
        return {
          isSorted: true,
          isSortedDescending: sortFilter.sortedDescending,
        }
      } else {
        return {
          isSorted: sortFilter.sortKeySecondary === key,
          isSortedDescending: sortFilter.sortedDescendingSecondary,
        }
      }
    };

    function renderTranslator(term: ITerm) {
      let def = term.translator ? term.translator.exclude : true;
      let allowed: { [index: string]: boolean } = {
        'Google': def,
        'Microsoft': def,
      };
      if (term.translator) {
        for (let item of term.translator.list) {
          allowed[item] = !def;
        }
      }
      let array = [];
      for (let item of ['Google', 'Microsoft']) {
        if (item) {
          array.push(<img key={item} src={item.toLowerCase() + '.png'} className={classNames.icon} alt={item} />);
        }
      }

      return <div>{array}</div>;
    }

    function renderContext(term: ITerm) {
      if (!term.context) return t('context-any');
      let list = term.context.list.join(', ');
      return t(term.context.exclude ? 'context-exclude' : 'context-include', { list });
    }

    function renderLanguage(term: ITerm) {
      if (!term.targetLang) return t('lang-any');
      return i18n.exists(`lang-${term.targetLang}`) ? t(`lang-${term.targetLang}`) : term.targetLang;
    }

    function onColumnClick(ev: React.MouseEvent<HTMLElement>, column: IColumn): void {
      let state: SortFilterState = { ...sortFilter };

      // Non-sortable item
      if (!('isSorted' in column)) return;

      if (!ev.ctrlKey || column.key === state.sortKey) {
        if (column.key === state.sortKey) {
          state.sortedDescending = !state.sortedDescending;
        } else {
          state.sortKey = column.key;
          state.sortedDescending = false;
        }
        state.sortKeySecondary = null;
        state.sortedDescendingSecondary = false;
      } else {
        if (column.key === state.sortKeySecondary) {
          state.sortedDescendingSecondary = !state.sortedDescendingSecondary;
        } else {
          state.sortKeySecondary = column.key;
          state.sortedDescendingSecondary = false;
        }
      }

      setSortFilter(state);
    }

    return [
      {
        key: 'input',
        name: t('header-input'),
        fieldName: 'input',
        minWidth: 200,
        maxWidth: 300,
        isResizable: true,
        onColumnClick,
        isPadded: true,
        ...isSorted('input'),
      },
      {
        key: 'output',
        name: t('header-output'),
        fieldName: 'output',
        minWidth: 200,
        maxWidth: 300,
        isResizable: true,
        onColumnClick,
        isPadded: true,
        ...isSorted('output'),
      },
      {
        key: 'targetLang',
        name: t('header-targetLang'),
        minWidth: 130,
        maxWidth: 130,
        isResizable: true,
        onColumnClick,
        onRender: renderLanguage,
        isFiltered: sortFilter.filterLang.length !== 2,
        ...isSorted('targetLang'),
      },
      {
        key: 'type',
        name: t('header-type'),
        minWidth: 100,
        maxWidth: 100,
        isResizable: true,
        onColumnClick,
        onRender: (item: ITerm) => t('term-type-' + (item.type || 'transform')),
        isFiltered: sortFilter.filterType.length !== 3,
        ...isSorted('type'),
      },
      {
        key: 'priority',
        name: t('header-priority'),
        minWidth: 70,
        maxWidth: 70,
        isResizable: true,
        isSorted: sortFilter.sortKey === 'priority',
        isSortedDescending: sortFilter.sortedDescending,
        onColumnClick,
        onRender: (item: ITerm) => item.priority || 0,
        ...isSorted('priority'),
      },
      {
        key: 'context',
        name: t('header-context'),
        minWidth: 70,
        maxWidth: 70,
        isResizable: true,
        isCollapsible: true,
        onColumnClick,
        onRender: renderContext,
      },
      {
        key: 'translator',
        name: t('header-translator'),
        minWidth: 140,
        maxWidth: 140,
        isResizable: true,
        isCollapsible: true,
        onColumnClick,
        onRender: renderTranslator,
      },
      {
        key: 'comment',
        name: t('header-comment'),
        fieldName: 'comment',
        minWidth: 100,
        maxWidth: 100,
        isResizable: true,
        isCollapsible: true,
        onColumnClick,
      },
    ];
  }, [sortFilter, t, i18n]);

  let visibleItems = useMemo(() => {
    let items = props.items.slice();

    if (sortFilter.filterLang.length !== 2) {
      items = items.filter(x => !x.targetLang || sortFilter.filterLang.indexOf(x.targetLang) !== -1);
    }

    if (sortFilter.filterType.length !== 3) {
      items = items.filter(x => sortFilter.filterType.indexOf(x.type || 'transform') !== -1);
    }

    if (sortFilter.filterSearch) {
      items = items.filter(x => {
        if (sortFilter.filterSearch!.test(x.input) || sortFilter.filterSearch!.test(x.output)) return true;
        if (x.comment && sortFilter.filterSearch!.test(x.comment)) return true;
        return false;
      });
    }

    items.sort((a, b) => {
      let result = compareTerm(a, b, sortFilter.sortKey);
      if (sortFilter.sortedDescending) result = -result;
      if (result !== 0 || sortFilter.sortKeySecondary === null) return result;
      result = compareTerm(a, b, sortFilter.sortKeySecondary);
      if (sortFilter.sortedDescendingSecondary) result = -result
      return result;
    });

    return items;
  }, [sortFilter, props.items]);

  function onChangeFilterSearch(_event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, text?: string): void {
    if (!text) {
      setInvalidSearch(false);
      setSortFilter({
        ...sortFilter,
        filterSearch: null
      });
      return;
    }

    try {
      let regex = new RegExp(text!, 'i');
      setInvalidSearch(false);
      setSortFilter({
        ...sortFilter,
        filterSearch: regex
      });
    } catch (ex) {
      setInvalidSearch(true);
    }
  }

  function onChangeFilterLang(_event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void {
    let state = sortFilter.filterLang.slice();
    let arrIndex = state.indexOf(option!.key as string);
    if ((arrIndex !== -1) !== option!.selected) {
      if (option!.selected) {
        state.push(option!.key as string);
      } else {
        state.splice(arrIndex, 1);
      }
      setSortFilter({
        ...sortFilter,
        filterLang: state
      });
    }
  }

  function onChangeFilterType(_event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void {
    let state = sortFilter.filterType.slice();
    let arrIndex = state.indexOf(option!.key as string);
    if ((arrIndex !== -1) !== option!.selected) {
      if (option!.selected) {
        state.push(option!.key as string);
      } else {
        state.splice(arrIndex, 1);
      }
      setSortFilter({
        ...sortFilter,
        filterType: state
      });
    }
  }

  return (
    <Fabric>
      <div className={classNames.controlWrapper}>
        <TextField
          label={t('filter-search')}
          onChange={onChangeFilterSearch}
          styles={controlStyles}
          errorMessage={invalidSearch ? t('filter-search-invalid') : undefined}
        />
        <Dropdown
          placeholder={t('lang-any')}
          label={t('filter-lang')}
          selectedKeys={sortFilter.filterLang}
          multiSelect
          options={langOptions}
          onRenderTitle={x => <span>{x!.length === 2 ? t('lang-all') : x!.map(x => x.text).join(', ')}</span>}
          onChange={onChangeFilterLang}
          styles={dropdownStyles}
        />
        <Dropdown
          placeholder={t('term-type-none')}
          label={t('filter-type')}
          selectedKeys={sortFilter.filterType}
          multiSelect
          options={typeOptions}
          onRenderTitle={x => <span>{x!.length === 3 ? t('term-type-all') : x!.map(x => x.text).join(', ')}</span>}
          onChange={onChangeFilterType}
          styles={dropdownStyles}
        />
      </div>
      <DetailsList
        items={visibleItems}
        compact={props.compact}
        columns={columns}
        selectionMode={SelectionMode.none}
        getKey={item => {
          return item._id;
        }}
        setKey="none"
        layoutMode={DetailsListLayoutMode.justified}
        isHeaderVisible={true}
        onItemInvoked={props.onItemInvoked}
      />
    </Fabric>
  );
};
