use std::cmp::Ordering;

use fancy_regex::Regex;
use serde::{Serialize, Deserialize, Serializer, Deserializer};

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TermType {
    Preprocess,
    Transform,
    Postprocess,
}

impl Default for TermType {
    fn default() -> Self {
        TermType::Transform
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FilterList {
    exclude: bool,
    list: Vec<String>,
}

impl FilterList {
    pub fn contains(&self, value: &str) -> bool {
        self.list.iter().any(|x| x == value) ^ self.exclude
    }
}

fn is_default<T: Default + Eq>(value: &T) -> bool {
    value == &T::default()
}

mod serde_regex {
    use super::*;

    pub fn serialize<S>(regex: &Regex, ser: S) -> Result<S::Ok, S::Error> where S: Serializer {
        regex.as_str().serialize(ser)
    }

    pub fn deserialize<'de, D>(der: D) -> Result<Regex, D::Error> where D: Deserializer<'de> {
        let str = String::deserialize(der)?;
        Regex::new(&str).map_err(serde::de::Error::custom)
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RegexTerm {
    #[serde(with = "serde_regex")]
    pub input: Regex,
    pub output: String,
    /// Language code specifying the target language.
    /// 
    /// `None` matches all languages, useful for preprocessing.
    #[serde(rename = "targetLang", skip_serializing_if = "Option::is_none")]
    pub target_lang: Option<String>,
    /// Indicates whether should this term be used for a given machine translator.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub translator: Option<FilterList>,
    #[serde(default, skip_serializing_if = "is_default")]
    pub priority: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<FilterList>,
    /// Indicate at what stage should this term be applied.
    #[serde(rename = "type", default, skip_serializing_if = "is_default")]
    pub ty: TermType,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub comment: String,
}

impl RegexTerm {
    pub fn compare_priority(&self, other: &Self) -> Ordering {
        if self.priority != other.priority {
            return self.priority.cmp(&other.priority);
        }

        if self.ty == TermType::Postprocess && other.ty != TermType::Postprocess {
            return Ordering::Greater;
        }

        if self.ty == TermType::Preprocess && other.ty != TermType::Preprocess {
            return Ordering::Less;
        }

        self.input.as_str().len().cmp(&other.input.as_str().len())
    }
}
