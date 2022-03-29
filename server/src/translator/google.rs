use super::Translator;
use async_trait::async_trait;

pub struct GoogleTranslator {
    target_lang: String,
}

impl GoogleTranslator {
    pub fn new(target_lang: String) -> Self {
        Self { target_lang }
    }
}

#[async_trait]
impl Translator for GoogleTranslator {
    fn name(&self) -> &'static str {
        "Google"
    }

    async fn translate(&self, text: &str) -> anyhow::Result<String> {
        const API_URL: &str = "https://translate.googleapis.com/translate_a/single";

        let client = reqwest::Client::new();
        let body: serde_json::Value = client
            .post(API_URL)
            .form(&[
                ("client", "gtx"),
                ("sl", "ja"),
                ("tl", &*self.target_lang),
                ("dt", "t"),
                ("q", text),
            ])
            .send()
            .await?
            .json()
            .await?;

        let out = || -> Option<_> {
            let arr = body.as_array()?.get(0)?.as_array()?;

            let mut out = Vec::with_capacity(arr.len());
            for line in arr {
                let translated = line.as_array()?.get(0)?.as_str()?;
                out.push(translated);
            }
            Some(out)
        }()
        .ok_or_else(|| anyhow::anyhow!("Cannot parse Google translate response"))?;

        Ok(out.join(""))
    }
}
