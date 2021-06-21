import fetch from 'node-fetch';
import { AllHtmlEntities as Entities } from 'html-entities';
import { Translator } from './translator';

const START_MARKER = 'class="t0">';
const END_MARKER = '<';
const API_URL = 'https://translate.google.com/m';
const USER_AGENT = 'Mozilla/5.0 (compatible; MSIE 10.0; Windows Phone 8.0; Trident/6.0; IEMobile/10.0; ARM; Touch; NOKIA; Lumia 920)';
const URL_REGEX = /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/;

export class GoogleHtmlTranslator implements Translator {
  name!: string;

  targetLang: string;

  constructor(targetLang: string) {
    this.targetLang = targetLang;
  }

  async translate(text: string): Promise<string> {
    let lines = text.split('\n');
    let out = [];
    for (let line of lines) {
      if (!line.trim() || URL_REGEX.test(line)) {
        out.push(line);
        continue;
      }

      const params = new URLSearchParams();
      params.append('hl', this.targetLang);
      params.append('sl', 'ja');
      params.append('q', line);
      console.log('>>>' + line);

      let response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
        },
        body: params,
      });
      let body = await response.text();

      let start = body.indexOf(START_MARKER);
      if (start == -1) {
        console.log(body);
        throw new Error("Failed to parse Google translate result");
      }
      start += START_MARKER.length;
      let stop = body.indexOf(END_MARKER, start);
      if (stop == -1) {
        throw new Error("Failed to parse Google translate result");
      }
      body = body.substring(start, stop);
      body = new Entities().decode(body);
      out.push(body);
    }

    return out.join('\n');
  }
}
GoogleHtmlTranslator.prototype.name = 'Google';
