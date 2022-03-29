mod dictionary;
mod google;

pub use dictionary::DictionaryTranslator;
pub use google::GoogleTranslator;

#[cfg(feature = "baidu")]
mod baidu;
#[cfg(feature = "baidu")]
pub use baidu::BaiduTranslator;

use async_trait::async_trait;

#[async_trait]
pub trait Translator: Send + Sync {
    fn name(&self) -> &'static str;

    async fn translate(&self, text: &str) -> anyhow::Result<String>;
}

struct NopTranslator;

#[async_trait]
impl Translator for NopTranslator {
    fn name(&self) -> &'static str {
        "Nop"
    }

    async fn translate(&self, text: &str) -> anyhow::Result<String> {
        Ok(text.to_owned())
    }
}
