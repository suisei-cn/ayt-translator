import { Dropdown, IDropdownOption, IDropdownStyles } from "@fluentui/react/lib/Dropdown";
import { FilterList, filterListToList, listToFilterList } from "../schema";
import { useTranslation } from "react-i18next";
import React, { useState, useEffect, useMemo } from "react";
import { IPickerItemProps, ITag, TagItem, ISuggestionItemProps, BasePicker, IBasePickerProps } from "@fluentui/react/lib/Pickers";
import { Stack, IStackStyles } from "@fluentui/react/lib/Stack";
import { mergeStyleSets } from "@fluentui/react/lib/Styling";

const classNames = mergeStyleSets({
  newItem: { color: '#f00', padding: '10px' },
  existingItem: { color: '#222', padding: '10px' },
});

export interface IFilterListPickerProps {
  filterList?: FilterList,

  label?: string,
  /**
   * Text tp show if filterList is unset.
   */
  placeholder: string,
  /**
   * Whether unknown values could be used
   */
  allowUnknown?: boolean,
  /**
   * The list of known options
   */
  options?: string[],
  /**
   * Callback when the list has been updated. Only invoked after losing focus.
   */
  onChange?: (list?: FilterList) => void,

  onRenderItem?: (item: IPickerItemProps<string>, unknown: boolean) => JSX.Element,
  onRenderSuggestionItem?: (item: string, unknown: boolean) => JSX.Element,
  onResolveSuggestions?: (search: string) => string[],

  styles?: Partial<IStackStyles>,
}

export const FilterListPicker: React.FunctionComponent<IFilterListPickerProps> = (props) => {
  const { t } = useTranslation();
  const propOptions = props.options || [];

  const options: IDropdownOption[] = [
    { key: '', text: props.placeholder },
    { key: 'false', text: t('filter-list-include') },
    { key: 'true', text: t('filter-list-exclude') },
  ];

  const [exclude, setExclude] = useState<boolean | undefined>(props.filterList && props.filterList.exclude);
  const [list, setList] = useState(() => props.filterList ? props.filterList.list.slice() : []);
  useEffect(() => {
    setExclude(props.filterList && props.filterList.exclude);
    setList(props.filterList ? props.filterList.list.slice() : []);
  }, [props.filterList]);

  function onBlur() {
    if (props.onChange) {
      props.onChange(exclude === undefined ? undefined : {
        exclude,
        list,
      });
    }
  }

  function onChangeExclude(_event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) {
    if (option!.key === '') return setExclude(undefined);
    return setExclude(option!.key === 'true');
  }

  function onRenderItem(tag: IPickerItemProps<string>): JSX.Element {
    if (props.onRenderItem) {
      let unknown = (props.options || []).indexOf(tag.item) === -1;
      return props.onRenderItem(tag, unknown);
    } else {
      let tagProps: IPickerItemProps<ITag> = { ...tag, item: { name: tag.item, key: tag.item }, onItemChange: undefined };
      return <TagItem  {...tagProps}>{tag.item}</TagItem>;
    }
  }

  function onRenderSuggestionsItem(opt: string, itemProps?: ISuggestionItemProps<string>): JSX.Element {
    let unknown = (props.options || []).indexOf(opt) === -1;
    if (props.onRenderSuggestionItem) {
      return props.onRenderSuggestionItem(opt, unknown);
    } else {
      return <div className={unknown ? classNames.newItem : classNames.existingItem} key={unknown ? '' : opt}>{opt}</div>;
    }
  }

  function onResolveSuggestions(filterText: string, tagList?: string[]): string[] {
    tagList = tagList || [];
    let list: string[];
    if (props.onResolveSuggestions) {
      list = props.onResolveSuggestions(filterText);
    } else {
      let searchLower = filterText.toLowerCase();
      list = propOptions
        .filter(tag => tag.toLowerCase().indexOf(searchLower) !== -1);
    }
    if (props.allowUnknown && propOptions.indexOf(filterText) === -1) {
      list.push(filterText);
    }
    return list.filter(tag => tagList!.indexOf(tag) === -1);
  }

  return <Stack onBlur={onBlur} styles={props.styles}>
    <Dropdown
      label={props.label}
      selectedKey={exclude === undefined ? '' : String(exclude)}
      options={options}
      onChange={onChangeExclude}
    />
    {exclude !== undefined ? <BasePicker<string, IBasePickerProps<string>>
      onRenderItem={onRenderItem}
      onResolveSuggestions={onResolveSuggestions}
      onRenderSuggestionsItem={onRenderSuggestionsItem}
      onChange={list => setList(list || [])}
      selectedItems={list}
    /> : undefined}
  </Stack>
}

export interface IFilterListDropdownProps {
  filterList: FilterList,

  label?: string,
  placeholder?: string,
  options: string[],

  onChange?: (list: FilterList) => void,
  onRenderItem?: (item: string) => string,
  onRenderTitle?: (list: string[]) => JSX.Element,

  styles?: Partial<IDropdownStyles>,
}

export const FilterListDropdown: React.FunctionComponent<IFilterListDropdownProps> = (props) => {
  const { options, filterList, onRenderItem } = props;

  const dropdownOptions: IDropdownOption[] = useMemo(() => {
    return options.map(x => {
      return { key: x, text: onRenderItem ? onRenderItem(x) : x };
    });
  }, [options, onRenderItem]);

  const selectedOptions = useMemo(() => {
    return filterList ? filterListToList(filterList, options) : options;
  }, [options, filterList]);

  function onRenderTitle(list?: IDropdownOption[]) {
    let array = list ? list.map(x => x.key as string) : [];
    return props.onRenderTitle!(array);
  }

  function onChange(_event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) {
    let key = option!.key as string;
    let index = selectedOptions.indexOf(key);
    if ((index !== -1) === option!.selected) return;
    let newArr;
    if (option!.selected) {
      newArr = selectedOptions.concat(key);
    } else {
      newArr = selectedOptions.slice();
      newArr.splice(index, 1);
    }
    if (props.onChange) {
      props.onChange(listToFilterList(newArr, options));
    }
  }

  return <Dropdown
    placeholder={props.placeholder}
    label={props.label}
    selectedKeys={selectedOptions}
    multiSelect
    options={dropdownOptions}
    onChange={onChange}
    styles={props.styles}
    onRenderTitle={props.onRenderTitle ? onRenderTitle : undefined}
  />;
}
