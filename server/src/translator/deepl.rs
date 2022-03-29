use super::Translator;
use async_trait::async_trait;

pub struct DeepLTranslator {
    auth_key: String,
    target_lang: String,
}

impl DeepLTranslator {
    pub fn new(auth_key: String, target_lang: String) -> Self {
        Self {
            auth_key,
            target_lang: match target_lang.as_str() {
                "en" => "EN-US".to_owned(),
                _ => target_lang.to_uppercase(),
            },
        }
    }
}

#[async_trait]
impl Translator for DeepLTranslator {
    fn name(&self) -> &'static str {
        "DeepL"
    }

    async fn translate(&self, text: &str) -> anyhow::Result<String> {
        const API_URL: &str = "https://api-free.deepl.com/v2/translate";

        #[derive(serde::Deserialize)]
        struct TransResult {
            text: String,
        }

        #[derive(serde::Deserialize)]
        #[allow(dead_code)]
        struct Response {
            translations: Vec<TransResult>,
        }

        let client = reqwest::Client::new();
        let mut body: Response = client
            .post(API_URL)
            .form(&[
                ("text", text),
                ("target_lang", &*self.target_lang),
                ("auth_key", &*self.auth_key),
            ])
            .send()
            .await?
            .json()
            .await?;

        if body.translations.is_empty() {
            return Err(anyhow::anyhow!("DeepL returns no translations"));
        }

        if body.translations.len() > 1 {
            log::warn!("DeepL returns multiple translations");
        }

        Ok(body.translations.swap_remove(0).text)
    }
}
