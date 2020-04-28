import { Translator } from './translator';

export interface TermConfig {
  /**
   * Indicates whether should this term be used for a given machine translator.
   */
  translator: {
    exclude: boolean,
    list: string[],
  } | null,
  /** Language code specifying the target language. Null matches all languages, useful for preprocessing */
  targetLang: string | null,
  /**
   * Indicate at what stage should this term be applied
   */
  type: 'preprocess' | 'transform' | 'postprocess',
}

function match_language(filter: string | null, lang: string): boolean {
  if (!filter) return true;
  let [filter_main, filter_sub] = filter.split('-');
  let [lang_main, lang_sub] = lang.split('-');
  if (filter_main !== lang_main) return false;
  if (filter_sub && lang_sub && filter_sub !== lang_sub) return false;
  return true;
}

export abstract class Term<T> {
  config: TermConfig;

  constructor(config: TermConfig) {
    this.config = config;
  }

  /**
   * Determine if the term should be applied in the specified context.
   */
  shouldApply(ctx: DictionaryTranslator): boolean {
    if (!match_language(this.config.targetLang, ctx.targetLang)) return false;
    if (!this.config.translator) return true;
    let inList = this.config.translator.list.indexOf(ctx.translator.name) !== -1;
    return this.config.translator.exclude !== inList;
  }

  /**
   * Scan for the term.
   * Return the position of first occurance with range and associated data.
   * The range will be removed from the text and replaced with a marker.
   */
  abstract scan(ctx: DictionaryTranslator, text: string): [number, number, T] | null;

  /**
   * Process the term.
   * This is the inverse process of scan, replacing the marker with actual text.
   */
  abstract process(ctx: DictionaryTranslator, marker: T): Promise<string>;
}

const USABLE_CHAR = "BCDFGHJKLMNPQRSTVWXY";
const REPLACEMENT_MATCHER = /(ZM[BCDFGHJKLMNPQRSTVWXY]+Z)/i;

function encodeReplacementString(index: number): string {
  let builder = "";
  while (index > 0 || builder.length == 0) {
    builder = USABLE_CHAR[index % USABLE_CHAR.length] + builder;
    index = (index / USABLE_CHAR.length) | 0;
  }
  return 'ZM' + builder + 'Z';
}

function decodeReplacementString(string: string): number {
  let index = 0;
  for (let i = 2; i < string.length - 1; i++) {
    index = index * USABLE_CHAR.length + USABLE_CHAR.indexOf(string[i]);
  }
  return index;
}

export class DictionaryTranslator implements Translator {
  name!:string;

  targetLang: string;
  translator: Translator;

  preprocessTerms: Term<any>[];
  postprocessTerms: Term<any>[];

  constructor(targetLang: string, translator: Translator, terms: Term<any>[]) {
    this.targetLang = targetLang;
    this.translator = translator;
    this.preprocessTerms = terms.filter(x => x.config.type !== 'postprocess');
    this.postprocessTerms = terms.filter(x => x.config.type === 'postprocess');
  }

  transform(text: (string | [Term<any>, any])[], termList: Term<any>[]): (string | [Term<any>, any])[] {
    let transformedText = [];

    let step = (text: string, termStart: number) => {
      for (; text && termStart < termList.length; termStart++) {
        let term = termList[termStart];
        if (!term.shouldApply(this)) continue;

        // Scan through the entire text
        while (text) {
          let out = term.scan(this, text);
          if (!out) break;
          let [start, end, data] = out;
          // Delegate this part to lower-priority terms
          step(text.substring(0, start), termStart + 1);
          transformedText.push([term, data]);
          text = text.substring(end);
        }

        // Delegate the rest to lower priority terms, which is basically the next iteration
      }

      if (text) transformedText.push(text);
    };

    for (let item of text) {
      if (typeof item === 'string') {
        step(item, 0);
      } else {
        transformedText.push(item);
      }
    }

    return transformedText;
  }

  async inverse_transform(transformed: (string | [Term<any>, any])[], filter: (term: Term<any>)=>boolean): Promise<(string | [Term<any>, any])[]> {
    let output = [];
    for (let item of transformed) {
      if (typeof item === 'string') {
        if (typeof output[output.length - 1] === 'string') {
          output[output.length - 1] += item;
        } else {
          output.push(item);
        }
      } else {
        if (filter(item[0])) {
          let text = await item[0].process(this, item[1]);
          if (typeof output[output.length - 1] === 'string') {
            output[output.length - 1] += text;
          } else {
            output.push(text);
          }
        } else {
          output.push(item);
        }
      }
    }
    return output;
  }

  encode(transformed: (string | [Term<any>, any])[]): [string, [Term<any>, any][]] {
    let builder = '';
    let termList = [];
    for (let item of transformed) {
      if (typeof item === 'string') {
        builder += item;
      } else {
        builder += encodeReplacementString(termList.length);
        termList.push(item);
      }
    }
    return [builder, termList];
  }

  decode(encoded: string, termList: [Term<any>, any][]): (string | [Term<any>, any])[] {
    let decoded = [];
    let split = encoded.split(REPLACEMENT_MATCHER);
    for (let i = 0; i < split.length; i += 2) {
      if (split[i]) decoded.push(split[i]);
      if (i + 1 < split.length) {
        decoded.push(termList[decodeReplacementString(split[i + 1])]);
      }
    }
    return decoded;
  }

  async translate(text: string): Promise<string> {
    let transformed = this.transform([text], this.preprocessTerms);
    let preprocessed = await this.inverse_transform(transformed, term => term.config.type == 'preprocess');
    let [encoded, termList] = this.encode(preprocessed);
    let translated = await this.translator.translate(encoded);
    let decoded = this.decode(translated, termList);
    let postprocessed = this.transform(decoded, this.postprocessTerms);
    let processed = await this.inverse_transform(postprocessed, _=>true);
    return (processed[0] || '') as string;
  }
}
DictionaryTranslator.prototype.name = 'Term';
