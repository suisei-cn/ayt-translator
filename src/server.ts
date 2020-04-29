import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import { getCollection } from './db';

import { Term, TermConfig, DictionaryTranslator } from './core/dictionary';
import { Translator } from './core/translator';
import { GoogleHtmlTranslator } from './core/google';
import { MicrosoftTranslator } from './core/microsoft';

import { ITerm, comparePriority, validate } from './schema';

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
  translatorEn = new MicrosoftTranslator('en', process.env['MICROSOFT_API_KEY']!);
  translatorZh = new MicrosoftTranslator('zh', process.env['MICROSOFT_API_KEY']!);
} else {
  translatorEn = new GoogleHtmlTranslator('en');
  translatorZh = new GoogleHtmlTranslator('zh');
}

const app = express();
const port = 3001;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use((_req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Content-Length');
  next();
})

function wrapAsync(f: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    f(req, res).catch(ex => next(ex));
  };
}

app.get('/terms', wrapAsync(async (_req, res) => {
  res.json(await db.find({}));
}));

app.get('/term/:id', wrapAsync(async (req, res) => {
  let result = await db.find<ITerm>({ _id: req.params.id });
  if (result.length === 0) {
    throw new RangeError('Term ID does not exist');
  }
  res.json(result[0]);
}));

app.post('/term', wrapAsync(async (req, res) => {
  let term = req.body;
  validate(term);
  delete term._id;
  let newDoc = await db.insert<ITerm>(term);
  res.json(newDoc);
}));

app.put('/term/:id', wrapAsync(async (req, res) => {
  let term = req.body;
  validate(term);
  delete term._id;
  let result = await db.update<ITerm>({ _id: req.params.id }, term, { returnUpdatedDocs: true });
  if (result.numberOfUpdate === 0) {
    throw new RangeError('Term ID does not exist');
  }
  res.json(result.affectedDocuments);
}));

app.delete('/term/:id', wrapAsync(async (req, res) => {
  let number = await db.remove({_id: req.params.id}, {});
  if (number === 0) {
    throw new RangeError('Term ID does not exist');
  }
  res.json({});
}));

app.post('/translate', wrapAsync(async (req, res) => {
  let targetLang = req.query.to;
  if (targetLang != 'en' && targetLang != 'zh') {
    res.status(403);
    res.json({ error: 'Invalid query' });
    return;
  }

  let body = req.body && req.body.text;
  if (typeof body !== 'string') {
    res.status(403);
    res.json({ error: 'Invalid body' });
    return;
  }

  let translator = targetLang == 'zh' ? translatorZh : translatorEn;
  let dictTranslator = new DictionaryTranslator(targetLang, translator, allTerms);

  res.json({ translation: await dictTranslator.translate(body) });
}));

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (!(err instanceof Error)) {
    return next();
  }
  if (err instanceof RangeError) {
    res.status(403);
  } else {
    res.status(500);
    console.error(err.stack);
  }
  res.json({ error: err.message });
});

app.listen(port, () => console.log(`API server listening at http://localhost:${port}`));
