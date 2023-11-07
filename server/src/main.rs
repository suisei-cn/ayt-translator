use anyhow::Context;
use once_cell::sync::Lazy;
use std::sync::Arc;
use translator::Translator;
use warp::Filter;

mod api;
mod config;
mod db;
mod regex;
mod schema;
mod translator;

use schema::RegexTerm;

static CONFIG: Lazy<config::Config> = Lazy::new(|| {
    fn load_config() -> anyhow::Result<config::Config> {
        Ok(toml::from_str(
            &std::fs::read_to_string("config.toml").with_context(|| "Cannot load config.toml")?,
        )
        .with_context(|| "Cannot parse config.toml")?)
    }

    match load_config() {
        Ok(v) => v,
        Err(err) => {
            eprintln!("{:?}", err);
            std::process::exit(1);
        }
    }
});

fn load_translator(
    target_lang: &str,
    translator: config::Translator,
) -> anyhow::Result<Box<dyn Translator>> {
    Ok(match translator {
        config::Translator::Nop => Box::new(translator::NopTranslator),
        #[cfg(feature = "google")]
        config::Translator::Google => {
            Box::new(translator::GoogleTranslator::new(target_lang.to_owned()))
        }
        #[cfg(feature = "baidu")]
        config::Translator::Baidu => {
            let config = CONFIG
                .baidu
                .as_ref()
                .ok_or_else(|| anyhow::anyhow!("Baidu config not found"))?;
            Box::new(translator::BaiduTranslator::new(
                config.appid.clone(),
                config.secret.clone(),
                target_lang.to_owned(),
            ))
        }
        #[cfg(feature = "microsoft")]
        config::Translator::Microsoft => {
            let config = CONFIG
                .microsoft
                .as_ref()
                .ok_or_else(|| anyhow::anyhow!("Microsoft config not found"))?;
            Box::new(translator::MicrosoftTranslator::new(
                config.api_key.clone(),
                target_lang.to_owned(),
            ))
        }
        #[cfg(feature = "deepl")]
        config::Translator::DeepL => {
            let config = CONFIG
                .deepl
                .as_ref()
                .ok_or_else(|| anyhow::anyhow!("DeepL config not found"))?;
            Box::new(translator::DeepLTranslator::new(
                config.auth_key.clone(),
                target_lang.to_owned(),
            ))
        }
    })
}

static TRANSLATOR_EN: Lazy<Box<dyn Translator>> =
    Lazy::new(|| match load_translator("en", CONFIG.en) {
        Ok(v) => v,
        Err(err) => {
            eprintln!("{:?}", err);
            std::process::exit(1);
        }
    });

static TRANSLATOR_ZH: Lazy<Box<dyn Translator>> =
    Lazy::new(|| match load_translator("zh", CONFIG.zh) {
        Ok(v) => v,
        Err(err) => {
            eprintln!("{:?}", err);
            std::process::exit(1);
        }
    });

#[derive(Debug)]
pub struct WarpError(pub anyhow::Error);

impl warp::reject::Reject for WarpError {}

impl<T> From<T> for WarpError
where
    anyhow::Error: From<T>,
{
    fn from(err: T) -> Self {
        WarpError(err.into())
    }
}

#[derive(serde::Serialize)]
pub struct ErrorMessage {
    pub error: String,
}

pub async fn handle_rejection(
    err: warp::Rejection,
) -> Result<impl warp::Reply, std::convert::Infallible> {
    use warp::http::StatusCode;

    let code;
    let message;

    if err.is_not_found() {
        code = StatusCode::NOT_FOUND;
        message = "NOT_FOUND";
    } else if let Some(WarpError(_err)) = err.find::<WarpError>() {
        code = StatusCode::INTERNAL_SERVER_ERROR;
        message = "INTERNAL_SERVER_ERROR";
    } else if err.find::<warp::reject::InvalidQuery>().is_some() {
        code = StatusCode::UNPROCESSABLE_ENTITY;
        message = "INVALID_QUERY";
    } else if err.find::<warp::reject::MethodNotAllowed>().is_some() {
        code = StatusCode::METHOD_NOT_ALLOWED;
        message = "METHOD_NOT_ALLOWED";
    } else {
        code = StatusCode::INTERNAL_SERVER_ERROR;
        message = "UNHANDLED_REJECTION";
    }

    log::info!("{:?}", err);

    let json = warp::reply::json(&ErrorMessage {
        error: message.into(),
    });

    Ok(warp::reply::with_status(json, code))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    pretty_env_logger::init();

    Lazy::force(&TRANSLATOR_EN);
    Lazy::force(&TRANSLATOR_ZH);

    let db = Arc::new(db::Database::<String, RegexTerm>::open(&CONFIG.database).unwrap());

    // Dispatch api with the rest served by static files.
    let routes = warp::path("api")
        .and(
            api::api_get_terms(db.clone())
                .or(api::api_get_term(db.clone()))
                .or(api::api_post_term(db.clone()))
                .or(api::api_put_term(db.clone()))
                .or(api::api_delete_term(db.clone()))
                .or(api::api_post_translate(db.clone()))
                .map(|reply| warp::reply::with_header(reply, "content-type", "application/json"))
                .recover(handle_rejection),
        )
        .or(warp::fs::dir("../web/build"));

    warp::serve(routes).run(CONFIG.listen).await;
    Ok(())
}
