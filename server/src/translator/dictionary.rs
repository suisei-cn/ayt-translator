use arcstr::Substr;
use async_trait::async_trait;
use once_cell::sync::Lazy;
use regex::Regex;
use std::future::Future;
use std::ops::Range;
use std::pin::Pin;

use super::{NopTranslator, Translator};
use crate::schema::{RegexTerm, TermType};

#[async_trait]
trait Term: Send + Sync {
    /// Scan for the term.
    ///
    /// Return the position of first occurance with range and associated data.
    /// The range will be removed from the text and replaced with the supplied text.
    async fn scan(
        &self,
        ctx: &DictionaryTranslator,
        text: &str,
    ) -> anyhow::Result<Option<(Range<usize>, Substr)>>;
}

#[async_trait]
impl<T: Term + ?Sized> Term for &T {
    async fn scan(
        &self,
        ctx: &DictionaryTranslator,
        text: &str,
    ) -> anyhow::Result<Option<(Range<usize>, Substr)>> {
        (**self).scan(ctx, text).await
    }
}

#[async_trait]
impl Term for RegexTerm {
    async fn scan(
        &self,
        _ctx: &DictionaryTranslator,
        text: &str,
    ) -> anyhow::Result<Option<(Range<usize>, Substr)>> {
        Ok(self
            .input
            .find(text)?
            .map(|result| (result.range(), (&self.output).into())))
    }
}

/// Identify URLs in the text, and avoid feeding them through machine translation.
struct UrlTerm;

#[async_trait]
impl Term for UrlTerm {
    async fn scan(
        &self,
        _ctx: &DictionaryTranslator,
        text: &str,
    ) -> anyhow::Result<Option<(Range<usize>, Substr)>> {
        Ok(crate::regex::URL_REGEX
            .find(text)
            .map(|result| (result.range(), result.as_str().into())))
    }
}

/// Identify hashtags in the text, and avoid feeding them through machine translation. Any terms
/// that exist already will still be handled.
struct HashtagTerm;

#[async_trait]
impl Term for HashtagTerm {
    async fn scan(
        &self,
        ctx: &DictionaryTranslator,
        text: &str,
    ) -> anyhow::Result<Option<(Range<usize>, Substr)>> {
        let result = match crate::regex::HASHTAG_REGEX.captures(text) {
            None => return Ok(None),
            Some(v) => v,
        };
        let dict_translator = DictionaryTranslator::new(&NopTranslator, ctx.terms);
        let translation = dict_translator.translate(&result[1]).await?;
        Ok(Some((
            result.get(0).unwrap().range(),
            arcstr::format!("#{}", translation).into(),
        )))
    }
}

/// Identify emojis in the text, and avoid feeding them through machine translation.
struct EmojiTerm;

#[async_trait]
impl Term for EmojiTerm {
    async fn scan(
        &self,
        _ctx: &DictionaryTranslator,
        text: &str,
    ) -> anyhow::Result<Option<(Range<usize>, Substr)>> {
        Ok(crate::regex::EMOJI_REGEX
            .find(text)
            .map(|result| (result.range(), result.as_str().into())))
    }
}

pub struct DictionaryTranslator<'a> {
    translator: &'a dyn Translator,
    terms: &'a [RegexTerm],
}

#[derive(Debug, Clone)]
enum Part {
    Text(Substr),
    Term(TermType, Substr),
}

const USABLE_CHAR: &'static str = "BCDFGHJKLMNPQRSTVWXY";
static REPLACEMENT_MATCHER: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)(ZM[BCDFGHJKLMNPQRSTVWXY]+Z)").unwrap());

impl DictionaryTranslator<'_> {
    fn encode_replacement_string(mut index: usize) -> String {
        let mut builder = String::with_capacity(4);
        builder.push_str("ZM");

        while index > 0 || builder.len() == 2 {
            builder.push_str(&USABLE_CHAR[index % USABLE_CHAR.len()..][..1]);
            index /= USABLE_CHAR.len();
        }

        builder.push('Z');
        builder
    }

    fn decode_replace_string(str: &str) -> usize {
        let mut index = 0;
        for c in str[2..str.len() - 1].chars() {
            let c = c.to_ascii_uppercase();
            let digit = USABLE_CHAR.chars().position(|x| x == c).unwrap();
            index = index * USABLE_CHAR.len() + digit;
        }
        index
    }

    async fn transform<T: Term>(
        &self,
        text: Vec<Part>,
        terms: &[T],
        filter: impl Fn(&T) -> Option<TermType> + Send + Sync,
    ) -> anyhow::Result<Vec<Part>> {
        fn helper<'a, T: Term>(
            ctx: &'a DictionaryTranslator<'a>,
            mut text: Substr,
            mut terms: &'a [T],
            out: &'a mut Vec<Part>,
            filter: &'a (impl Fn(&T) -> Option<TermType> + Send + Sync),
        ) -> Pin<Box<dyn Future<Output = anyhow::Result<()>> + Send + 'a>> {
            Box::pin(async move {
                while !text.is_empty() && !terms.is_empty() {
                    let term = &terms[0];

                    if let Some(ty) = filter(term) {
                        while !text.is_empty() {
                            let (range, replacement) = match term.scan(ctx, &text).await? {
                                None => break,
                                Some(v) => v,
                            };
                            helper(ctx, text.substr(..range.start), &terms[1..], out, filter)
                                .await?;
                            out.push(Part::Term(ty, replacement));
                            text = text.substr(range.end..);
                        }
                    }

                    terms = &terms[1..];
                }

                if !text.is_empty() {
                    out.push(Part::Text(text));
                }

                Ok(())
            })
        }

        let mut ret = Vec::with_capacity(text.len());
        for part in text {
            match part {
                Part::Text(text) => helper(self, text, terms, &mut ret, &filter).await?,
                p => ret.push(p),
            }
        }
        Ok(ret)
    }

    fn inverse_transform(transformed: Vec<Part>, filter: impl Fn(TermType) -> bool) -> Vec<Part> {
        let mut ret = Vec::with_capacity(transformed.len());
        for item in transformed {
            match item {
                Part::Text(text) => ret.push(Part::Text(text)),
                Part::Term(ty, replacement) if filter(ty) => {
                    if !replacement.is_empty() {
                        ret.push(Part::Text(replacement));
                    }
                }
                part => {
                    ret.push(part);
                }
            }
        }
        ret
    }

    fn concat(parts: Vec<Part>) -> Vec<Part> {
        let mut ret = Vec::with_capacity(parts.len());
        let mut last = None;
        for part in parts {
            match part {
                Part::Text(text) => match last {
                    None => last = Some(Ok(text)),
                    Some(Ok(v)) => {
                        let mut str = String::with_capacity(v.len() + text.len());
                        str.push_str(&v);
                        str.push_str(&text);
                        last = Some(Err(str));
                    }
                    Some(Err(ref mut v)) => {
                        v.push_str(&text);
                    }
                },
                part => {
                    match last.take() {
                        None => (),
                        Some(Ok(v)) => {
                            ret.push(Part::Text(v));
                        }
                        Some(Err(v)) => {
                            ret.push(Part::Text(v.into()));
                        }
                    }
                    ret.push(part);
                }
            }
        }
        match last {
            None => (),
            Some(Ok(v)) => {
                ret.push(Part::Text(v));
            }
            Some(Err(v)) => {
                ret.push(Part::Text(v.into()));
            }
        }
        ret
    }

    fn encode(transformed: Vec<Part>) -> (String, Vec<Vec<(TermType, Substr)>>) {
        let mut builder = String::with_capacity(transformed.len());
        let mut term_list: Vec<Vec<_>> = Vec::with_capacity(transformed.len());
        let mut prev_term = false;
        for item in transformed {
            match item {
                Part::Text(text) => {
                    prev_term = false;
                    builder.push_str(&text);
                }
                Part::Term(term, state) => {
                    if prev_term {
                        // Combine multiple terms into a single one, to avoid translator being confused by a long string.
                        term_list.last_mut().unwrap().push((term, state));
                    } else {
                        builder.push_str(&Self::encode_replacement_string(term_list.len()));

                        term_list.push(vec![(term, state)]);
                        prev_term = true;
                    }
                }
            }
        }
        (builder, term_list)
    }

    fn decode(encoded: &str, term_list: Vec<Vec<(TermType, Substr)>>) -> Vec<Part> {
        let mut encoded: Substr = encoded.into();
        let mut decoded = Vec::new();

        while let Some(x) = REPLACEMENT_MATCHER.find(&encoded) {
            if x.start() != 0 {
                decoded.push(Part::Text(encoded.substr(..x.start())));
            }
            let index = Self::decode_replace_string(x.as_str());
            if index >= term_list.len() {
                log::error!(
                    "Invalid replacement string: {} ({}) out of {}",
                    index,
                    x.as_str(),
                    term_list.len()
                );
            } else {
                for (term, replacement) in term_list[index].iter().cloned() {
                    decoded.push(Part::Term(term, replacement));
                }
            }
            encoded = encoded.substr(x.end()..);
        }

        if !encoded.is_empty() {
            decoded.push(Part::Text(encoded));
        }

        decoded
    }
}

impl<'a> DictionaryTranslator<'a> {
    pub fn new(translator: &'a dyn Translator, terms: &'a [RegexTerm]) -> Self {
        Self { translator, terms }
    }
}

#[async_trait]
impl Translator for DictionaryTranslator<'_> {
    fn name(&self) -> &'static str {
        "Term"
    }

    async fn translate(&self, text: &str) -> anyhow::Result<String> {
        let transformed = self
            .transform(
                vec![Part::Text(text.into())],
                &[&UrlTerm as &dyn Term, &HashtagTerm, &EmojiTerm],
                |_| Some(TermType::Transform),
            )
            .await?;
        let transformed = self
            .transform(transformed, &self.terms, |x| {
                (x.ty != TermType::Postprocess).then(|| x.ty)
            })
            .await?;
        let preprocessed = Self::inverse_transform(transformed, |ty| ty == TermType::Preprocess);
        let (encoded, list) = Self::encode(preprocessed);
        if self.translator.name() != "Nop" {
            log::info!("Translating: {}", encoded);
        }
        let translated = self.translator.translate(&encoded).await?;
        if self.translator.name() != "Nop" {
            log::info!("Translated: {}", translated);
        }
        let decoded = Self::decode(&translated, list);
        let postprocessed = self
            .transform(decoded, &self.terms, |x| {
                (x.ty == TermType::Postprocess).then(|| x.ty)
            })
            .await?;
        let processed = Self::inverse_transform(postprocessed, |_| true);
        let mut processed = Self::concat(processed);
        Ok(match processed.pop() {
            Some(Part::Text(text)) => text.to_string(),
            _ => String::new(),
        })
    }
}
