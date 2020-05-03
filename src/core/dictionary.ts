import { Translator } from './translator';
import { EMOJI_REGEX } from './regex';

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

export class UrlTerm extends Term<string> {
  static URL_REGEX = /(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?/;

  constructor() {
    super({
      translator: null,
      type: 'transform',
      targetLang: null,
    });
  }

  scan(_ctx: DictionaryTranslator, text: string): [number, number, string] | null {
    let result = UrlTerm.URL_REGEX.exec(text);
    if (!result) return null;
    return [result.index, result.index + result[0].length, result[0]];
  }

  async process(_ctx: DictionaryTranslator, marker: string): Promise<string> {
    return marker;
  }
}

/**
 * Identify hashtags in the text, and avoid feeding them through machine translation. Any terms
 * that exist already will still be handled.
 */
export class HashtagTerm extends Term<string> {
  static REGEX = /(?:#|＃)([a-z0-9_\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ff\u0100-\u024f\u0253-\u0254\u0256-\u0257\u0300-\u036f\u1e00-\u1eff\u0400-\u04ff\u0500-\u0527\u2de0-\u2dff\ua640-\ua69f\u0591-\u05bf\u05c1-\u05c2\u05c4-\u05c5\u05d0-\u05ea\u05f0-\u05f4\ufb12-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb40-\ufb41\ufb43-\ufb44\ufb46-\ufb4f\u0610-\u061a\u0620-\u065f\u066e-\u06d3\u06d5-\u06dc\u06de-\u06e8\u06ea-\u06ef\u06fa-\u06fc\u0750-\u077f\u08a2-\u08ac\u08e4-\u08fe\ufb50-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\u200c-\u200c\u0e01-\u0e3a\u0e40-\u0e4e\u1100-\u11ff\u3130-\u3185\ua960-\ua97f\uac00-\ud7af\ud7b0-\ud7ff\uffa1-\uffdc\u30a1-\u30fa\u30fc-\u30fe\uff66-\uff9f\uff10-\uff19\uff21-\uff3a\uff41-\uff5a\u3041-\u3096\u3099-\u309e\u3400-\u4dbf\u4e00-\u9fff\u20000-\u2a6df\u2a700-\u2b73f\u2b740-\u2b81f\u2f800-\u2fa1f]*[a-z_\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ff\u0100-\u024f\u0253-\u0254\u0256-\u0257\u0300-\u036f\u1e00-\u1eff\u0400-\u04ff\u0500-\u0527\u2de0-\u2dff\ua640-\ua69f\u0591-\u05bf\u05c1-\u05c2\u05c4-\u05c5\u05d0-\u05ea\u05f0-\u05f4\ufb12-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb40-\ufb41\ufb43-\ufb44\ufb46-\ufb4f\u0610-\u061a\u0620-\u065f\u066e-\u06d3\u06d5-\u06dc\u06de-\u06e8\u06ea-\u06ef\u06fa-\u06fc\u0750-\u077f\u08a2-\u08ac\u08e4-\u08fe\ufb50-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\u200c-\u200c\u0e01-\u0e3a\u0e40-\u0e4e\u1100-\u11ff\u3130-\u3185\ua960-\ua97f\uac00-\ud7af\ud7b0-\ud7ff\uffa1-\uffdc\u30a1-\u30fa\u30fc-\u30fe\uff66-\uff9f\uff10-\uff19\uff21-\uff3a\uff41-\uff5a\u3041-\u3096\u3099-\u309e\u3400-\u4dbf\u4e00-\u9fff\u20000-\u2a6df\u2a700-\u2b73f\u2b740-\u2b81f\u2f800-\u2fa1f][a-z0-9_\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ff\u0100-\u024f\u0253-\u0254\u0256-\u0257\u0300-\u036f\u1e00-\u1eff\u0400-\u04ff\u0500-\u0527\u2de0-\u2dff\ua640-\ua69f\u0591-\u05bf\u05c1-\u05c2\u05c4-\u05c5\u05d0-\u05ea\u05f0-\u05f4\ufb12-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb40-\ufb41\ufb43-\ufb44\ufb46-\ufb4f\u0610-\u061a\u0620-\u065f\u066e-\u06d3\u06d5-\u06dc\u06de-\u06e8\u06ea-\u06ef\u06fa-\u06fc\u0750-\u077f\u08a2-\u08ac\u08e4-\u08fe\ufb50-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\u200c-\u200c\u0e01-\u0e3a\u0e40-\u0e4e\u1100-\u11ff\u3130-\u3185\ua960-\ua97f\uac00-\ud7af\ud7b0-\ud7ff\uffa1-\uffdc\u30a1-\u30fa\u30fc-\u30fe\uff66-\uff9f\uff10-\uff19\uff21-\uff3a\uff41-\uff5a\u3041-\u3096\u3099-\u309e\u3400-\u4dbf\u4e00-\u9fff\u20000-\u2a6df\u2a700-\u2b73f\u2b740-\u2b81f\u2f800-\u2fa1f]*)/i;

  constructor() {
    super({
      translator: null,
      type: 'transform',
      targetLang: null,
    });
  }

  scan(_ctx: DictionaryTranslator, text: string): [number, number, string] | null {
    let result = HashtagTerm.REGEX.exec(text);
    if (!result) return null;
    return [result.index, result.index + result[0].length, result[1]];
  }

  async process(ctx: DictionaryTranslator, marker: string): Promise<string> {
    // TODO: Avoid this hack
    let bak = ctx.translator;
    // Change the translator to an identity translator
    ctx.translator = new class implements Translator {
      get name() {
        return bak.name;
      }

      async translate(text: string): Promise<string> {
        return text;
      }
    };
    let translatedHashtag = await ctx.translate(marker);
    ctx.translator = bak;
    return '#' + translatedHashtag;
  }
}

/**
 * Identify emojis in the text, and avoid feeding them through machine translation.
 */
export class EmojiTerm extends Term<string> {
  constructor() {
    super({
      translator: null,
      type: 'transform',
      targetLang: null,
    });
  }

  scan(_ctx: DictionaryTranslator, text: string): [number, number, string] | null {
    let result = EMOJI_REGEX.exec(text);
    if (!result) return null;
    return [result.index, result.index + result[0].length, result[0]];
  }

  async process(_ctx: DictionaryTranslator, marker: string): Promise<string> {
    return marker;
  }
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
  string = string.toUpperCase();
  let index = 0;
  for (let i = 2; i < string.length - 1; i++) {
    index = index * USABLE_CHAR.length + USABLE_CHAR.indexOf(string[i]);
  }
  return index;
}

export class DictionaryTranslator implements Translator {
  name!: string;

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

  async inverse_transform(transformed: (string | [Term<any>, any])[], filter: (term: Term<any>) => boolean): Promise<(string | [Term<any>, any])[]> {
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
    console.log(translated);
    let decoded = this.decode(translated, termList);
    let postprocessed = this.transform(decoded, this.postprocessTerms);
    let processed = await this.inverse_transform(postprocessed, _ => true);
    return (processed[0] || '') as string;
  }
}
DictionaryTranslator.prototype.name = 'Term';
