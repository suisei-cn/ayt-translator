export interface Translator {
  readonly name: string;
  translate(text: string): Promise<string>;
}
