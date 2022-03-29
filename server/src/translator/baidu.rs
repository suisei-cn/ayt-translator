use super::Translator;
use async_trait::async_trait;

pub struct BaiduTranslator {
    appid: String,
    secret: String,
    target_lang: String,
}

impl BaiduTranslator {
    pub fn new(appid: String, secret: String, target_lang: String) -> Self {
        Self {
            appid,
            secret,
            target_lang,
        }
    }
}

#[async_trait]
impl Translator for BaiduTranslator {
    fn name(&self) -> &'static str {
        "Baidu"
    }

    async fn translate(&self, text: &str) -> anyhow::Result<String> {
        const API_URL: &str = "https://fanyi-api.baidu.com/api/trans/vip/translate";

        let salt = format!("{:x}", rand::random::<u32>());
        let sign = format!(
            "{:x}",
            md5::compute(&format!("{}{}{}{}", self.appid, text, salt, self.secret))
        );

        #[derive(serde::Deserialize)]
        struct TransResult {
            dst: String,
        }

        #[derive(serde::Deserialize)]
        #[allow(dead_code)]
        struct Response {
            trans_result: Vec<TransResult>,
        }

        let client = reqwest::Client::new();
        let body: Response = client
            .post(API_URL)
            .form(&[
                ("q", text),
                ("from", "jp"),
                ("to", &*self.target_lang),
                ("appid", &*self.appid),
                ("salt", &*salt),
                ("sign", &*sign),
            ])
            .send()
            .await?
            .json()
            .await?;

        Ok(body
            .trans_result
            .into_iter()
            .map(|v| v.dst)
            .collect::<Vec<_>>()
            .join(""))
    }
}
