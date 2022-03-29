use std::{net::SocketAddr, path::PathBuf};

use serde::Deserialize;

#[cfg(feature = "baidu")]
#[derive(Deserialize)]
pub struct BaiduConfig {
    pub appid: String,
    pub secret: String,
}

#[cfg(feature = "microsoft")]
#[derive(Deserialize)]

pub struct MicrosoftConfig {
    pub api_key: String,
}

#[cfg(feature = "deepl")]
#[derive(Deserialize)]
pub struct DeepLConfig {
    pub auth_key: String,
}

#[derive(Deserialize, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum Translator {
    Nop,
    #[cfg(feature = "google")]
    Google,
    #[cfg(feature = "baidu")]
    Baidu,
    #[cfg(feature = "microsoft")]
    Microsoft,
    #[cfg(feature = "deepl")]
    DeepL,
}

impl Default for Translator {
    fn default() -> Self {
        Translator::Nop
    }
}

fn default_database_path() -> PathBuf {
    PathBuf::from("dictionary.db")
}

fn default_listen_addr() -> SocketAddr {
    "127.0.0.1:3001".parse().unwrap()
}

#[derive(Deserialize)]
pub struct Config {
    #[cfg(feature = "baidu")]
    pub baidu: Option<BaiduConfig>,
    #[cfg(feature = "microsoft")]
    pub microsoft: Option<MicrosoftConfig>,
    #[cfg(feature = "deepl")]
    pub deepl: Option<DeepLConfig>,

    #[serde(default)]
    pub zh: Translator,
    #[serde(default)]
    pub en: Translator,

    #[serde(default = "default_database_path")]
    pub database: PathBuf,
    #[serde(default = "default_listen_addr")]
    pub listen: SocketAddr,
}
