import fetch from 'node-fetch';
import { Translator } from './translator';

export class JBeijingTranslator implements Translator {
  name!:string;

  async translate(text: string): Promise<string> {
    let response = await fetch('http://localhost:3002/translate', {
      method: 'POST',
      body: JSON.stringify({
        text,
      }),
      headers: {
        'Content-type': 'application/json; charset=UTF-8',
      }
    });
    let body = await response.json();
    return body.translation;
  }
}
JBeijingTranslator.prototype.name = 'JBeijing';
