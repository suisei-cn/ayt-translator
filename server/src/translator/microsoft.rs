use super::Translator;
use async_trait::async_trait;

pub struct MicrosoftTranslator {
    api_key: String,
    target_lang: String,
}

impl MicrosoftTranslator {
    pub fn new(api_key: String, target_lang: String) -> Self {
        Self {
            api_key,
            target_lang,
        }
    }
}

#[async_trait]
impl Translator for MicrosoftTranslator {
    fn name(&self) -> &'static str {
        "Microsoft"
    }

    async fn translate(&self, text: &str) -> anyhow::Result<String> {
        const API_URL: &str = "https://api.cognitive.microsofttranslator.com/translate";

        #[derive(serde::Serialize)]
        struct Request<'a> {
            text: &'a str,
        }

        #[derive(serde::Deserialize)]
        struct TransResult {
            text: String,
        }

        #[derive(serde::Deserialize)]
        #[allow(dead_code)]
        struct Response {
            translations: Vec<TransResult>,
        }

        #[derive(serde::Deserialize)]
        #[allow(dead_code)]
        struct ApiError {
            code: u32,
            message: String,
        }

        #[derive(serde::Deserialize)]
        #[allow(dead_code)]
        #[serde(untagged)]
        enum ApiResponse {
            Error { error: ApiError },
            Success(Vec<Response>),
        }

        let api_url = reqwest::Url::parse_with_params(
            API_URL,
            &[("api-version", "3.0"), ("to", &*self.target_lang)],
        )
        .unwrap();
        let client = reqwest::Client::new();
        let body: ApiResponse = client
            .post(api_url)
            .header("Ocp-Apim-Subscription-Key", &*self.api_key)
            .json(&vec![Request { text }])
            .send()
            .await?
            .json()
            .await?;

        match body {
            ApiResponse::Success(mut response) => Ok(response
                .pop()
                .ok_or_else(|| anyhow::anyhow!("Unexpected API result"))?
                .translations
                .pop()
                .ok_or_else(|| anyhow::anyhow!("Unexpected API result"))?
                .text),
            ApiResponse::Error { error } => {
                anyhow::bail!("Error {}: {}", error.code, error.message)
            }
        }
    }
}
