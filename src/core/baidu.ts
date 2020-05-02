import fetch from 'node-fetch';
import { Translator } from './translator';
import crypto from 'crypto';

export class BaiduFanyi implements Translator {
  name!:string;

  targetLang: string;
  appid: string;
  secret: string;

  constructor(targetLang: string, appid: string, secret: string) {
    this.targetLang = targetLang;
    this.appid = appid;
    this.secret = secret;
  }

  async translate(text: string): Promise<string> {
    let url = new URL('https://fanyi-api.baidu.com/api/trans/vip/translate');

    let salt = String(Math.random());
    let sign = crypto.createHash('md5').update(this.appid + text + salt + this.secret).digest("hex");

    const params = new URLSearchParams();
    params.append('q', text);
    params.append('from', 'ja');
    params.append('to', this.targetLang.split('-')[0]);
    params.append('appid', this.appid);
    params.append('salt', salt);
    params.append('sign', sign);

    console.log(text);

    let response = await fetch(url, {
      method: 'POST',
      body: params,
      headers: {
      }
    });
    let body = await response.json();
    if (!response.ok) {
      throw new Error(body.error.message);
    }
    return body.trans_result[0].dst;
  }
}
BaiduFanyi.prototype.name = 'Baidu';
