import express from 'express';
import bodyParser from 'body-parser';
import { getCollection } from './db';

import { Term, TermConfig, DictionaryTranslator } from './core/dictionary';
import { Translator } from './core/translator';
import { GoogleHtmlTranslator } from './core/google';
import { MicrosoftTranslator } from './core/microsoft';

import { ITerm, comparePriority } from './schema';

const db = getCollection('dictionary');

class RegexTerm extends Term<void> {
  private input: RegExp;
  private output: string;

  constructor(input: RegExp, output: string, config: TermConfig) {
    super(config);
    this.input = input;
    this.output = output;
  }

  scan(_ctx: DictionaryTranslator, text: string): [number, number, void] | null {
    let result = this.input.exec(text);
    if (!result) return null;
    return [result.index, result.index + result[0].length, undefined];
  }

  async process(_ctx: DictionaryTranslator, _marker: void): Promise<string> {
    return this.output;
  }
}

let allTerms: Term<any>[] = [];

async function loadTerms() {
  let terms: ITerm[] = await db.find({});
  terms.sort(comparePriority);
  allTerms = terms.map(x => new RegexTerm(new RegExp(x.input), x.output, x as any));
}

loadTerms();

let translatorEn: Translator;
let translatorZh: Translator;
if (process.env['MICROSOFT_API_KEY']) {
  translatorEn = new MicrosoftTranslator('en', process.env['MICROSOFT_API_KEY']);
  translatorZh = new MicrosoftTranslator('zh', process.env['MICROSOFT_API_KEY']);
} else {
  translatorEn = new GoogleHtmlTranslator('en');
  translatorZh = new GoogleHtmlTranslator('zh');
}

const app = express();
const port = 3001;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  next();
})

app.get('/terms', (req, res) => {
  (async () => {
    try {
      res.json(await db.find({}));
    } catch (error) {
      res.status(500);
      res.json(error.message);
    }
  })();
})

app.post('/translate', (req, res) => {
    let targetLang = req.query.to;
    if (targetLang != 'en' && targetLang != 'zh') {
        res.status(403);
        res.json({error: 'Invalid query'});
        return;
    }

    let body = req.body && req.body.text;
    if (typeof body !== 'string') {
        res.status(403);
        res.json({error: 'Invalid body'});
        return;
    }

    let translator = targetLang == 'zh' ? translatorZh : translatorEn;
    let dictTranslator = new DictionaryTranslator(targetLang, translator, allTerms);

    dictTranslator.translate(body).then(text => {
        res.json({translation: text});
    }, error => {
        res.status(500);
        res.json(error.message);
    });
});

app.listen(port, () => console.log(`API server listening at http://localhost:${port}`));
