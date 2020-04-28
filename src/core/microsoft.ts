import fetch from 'node-fetch';
import { Translator } from './translator';

export class MicrosoftTranslator implements Translator {
  name!:string;

  targetLang: string;
  apiKey: string;

  constructor(targetLang: string, apiKey: string) {
    this.targetLang = targetLang;
    this.apiKey = apiKey;
  }

  async translate(text: string): Promise<string> {
    let url = new URL('https://api.cognitive.microsofttranslator.com/translate');
    url.searchParams.append('api-version', '3.0');
    url.searchParams.append('to', this.targetLang.split('-')[0]);
    console.log(text);

    let response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify([{
        text,
      }]),
      headers: {
        'Ocp-Apim-Subscription-Key': this.apiKey,
        'Content-type': 'application/json; charset=UTF-8',
      }
    });
    let body = await response.json();
    if (!response.ok) {
      throw new Error(body.error.message);
    }
    return body[0].translations[0].text;
  }
}
MicrosoftTranslator.prototype.name = 'Microsoft';
