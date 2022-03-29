mod dictionary;
pub use dictionary::DictionaryTranslator;

#[cfg(feature = "google")]
mod google;
#[cfg(feature = "google")]
pub use google::GoogleTranslator;

#[cfg(feature = "baidu")]
mod baidu;
#[cfg(feature = "baidu")]
pub use baidu::BaiduTranslator;

#[cfg(feature = "microsoft")]
mod microsoft;
#[cfg(feature = "microsoft")]
pub use microsoft::MicrosoftTranslator;

#[cfg(feature = "deepl")]
mod deepl;
#[cfg(feature = "deepl")]
pub use deepl::DeepLTranslator;

use async_trait::async_trait;

#[async_trait]
pub trait Translator: Send + Sync {
    fn name(&self) -> &'static str;

    async fn translate(&self, text: &str) -> anyhow::Result<String>;
}

pub struct NopTranslator;

#[async_trait]
impl Translator for NopTranslator {
    fn name(&self) -> &'static str {
        "Nop"
    }

    async fn translate(&self, text: &str) -> anyhow::Result<String> {
        Ok(text.to_owned())
    }
}
