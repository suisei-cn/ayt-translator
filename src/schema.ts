export interface IncludeList {
  exclude: false;
  list: string[];
}

export interface ExcludeList {
  exclude: true;
  list: string[];
}

export type FilterList = IncludeList | ExcludeList;

export function filterListToList(filterList: FilterList, allOptions: string[]): string[] {
  if (!filterList.exclude) {
    return filterList.list;
  } else {
    return allOptions.filter(x => filterList.list.indexOf(x) === -1);
  }
}

export function listToFilterList(list: string[], allOptions: string[]): FilterList {
  if (list.length === allOptions.length) {
    return {
      exclude: true,
      list: [],
    };
  }
  if (list.length * 2 > allOptions.length) {
    return {
      exclude: true,
      list: allOptions.filter(x => list.indexOf(x) === -1),
    };
  } else {
    return {
      exclude: false,
      list: list,
    };
  }
}

export interface ITerm {
  _id?: string;
  input: string;
  output: string;
  targetLang?: string;
  translator?: FilterList;
  priority?: number;
  context?: FilterList;
  type?: 'preprocess' | 'transform' | 'postprocess';
  comment?: string;
}

function validateFilterList(json: any): asserts json is FilterList {
  if (!json || typeof json !== 'object') throw new RangeError('Invalid FilterList: must be object');
  if (typeof json.exclude !== 'boolean') throw new RangeError('Invalid FilterList: must be have an exclude property');
  if (!Array.isArray(json.list)) throw new RangeError('Invalid FilterList: list must be an array');
  if (json.list.findIndex((x: any) => typeof x !== 'string') !== -1) throw new RangeError('Invalid FilterList: list items must be strings');
  for (let key of Object.keys(json)) {
    if (json[key] === undefined) continue;
    switch (key) {
      case 'exclude': case 'list': break;
      default: throw new RangeError(`Invalid FilterList: extra property ${key}`);
    }
  }
}

export function validate(json: any): asserts json is ITerm  {
  if (typeof json.input !== 'string') throw new RangeError('Invalid Term: input must be string');
  try {
    new RegExp(json.input);
  } catch (ex) {
    throw new RangeError('Invalid Term: input must be valid RegExp');
  }
  if (typeof json.output !== 'string') throw new RangeError('Invalid Term: output must be string');
  for (let key of Object.keys(json)) {
    if (json[key] === undefined) continue;
    switch (key) {
      case 'input': case 'output': break;
      case '_id':
        if (typeof json._id !== 'string') throw new RangeError('Invalid Term: _id must be string'); break;
      case 'targetLang':
        if (typeof json.targetLang !== 'string') throw new RangeError('Invalid Term: targetLang must be string'); break;
      case 'translator': validateFilterList(json.translator); break;
      case 'priority': if (!Number.isSafeInteger(json.priority)) throw new RangeError('Invalid Term: priority must be number'); break;
      case 'context': validateFilterList(json.context); break;
      case 'type': {
        switch (json.type) {
          case 'preprocess': case 'transform': case 'postprocess': break;
          default: throw new RangeError('Invalid Term: type must be "process", "transform" or "postprocess"');
        }
        break;
      }
      case 'comment': if (typeof json.comment !== 'string') throw new RangeError('Invalid Term: comment must be string'); break;
      default: throw new RangeError(`Invalid Term: extra property ${key}`);
    }
  }
}

export function comparePriority(a: ITerm, b: ITerm) {
  let aPrio = a.priority || 0;
  let bPrio = b.priority || 0;
  if (aPrio !== bPrio) return aPrio - bPrio;
  if (a.type === 'postprocess' && b.type !== 'postprocess') return 1;
  if (b.type === 'postprocess') return -1;
  return a.input.length - b.input.length;
}
