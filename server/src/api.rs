use crate::db::Database;
use crate::RegexTerm;
use serde::Serializer;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use warp::Filter;

async fn handle_api_get_terms(db: Arc<Database<String, RegexTerm>>) -> anyhow::Result<Vec<u8>> {
    let mut vec = Vec::new();
    let mut ser = serde_json::Serializer::new(&mut vec);
    ser.collect_seq(db.iter()?)?;
    Ok(vec)
}

async fn handle_api_get_term(
    db: Arc<Database<String, RegexTerm>>,
    id: String,
) -> anyhow::Result<Vec<u8>> {
    let vec = match db.get(&id)? {
        Some(v) => serde_json::to_vec(&*v)?,
        None => {
            anyhow::bail!("Term ID does not exist");
        }
    };
    Ok(vec)
}

async fn handle_api_post_term(
    db: Arc<Database<String, RegexTerm>>,
    body: RegexTerm,
) -> anyhow::Result<Vec<u8>> {
    let key = db.db.write(|map| {
        for i in 0.. {
            let key = i.to_string();
            if !map.contains_key(&key) {
                map.insert(key.to_string(), body);
                return key;
            }
        }
        unreachable!()
    })?;
    db.db.save()?;

    let term = db.get(&key)?.unwrap();
    let vec = serde_json::to_vec(&*term)?;
    Ok(vec)
}

async fn handle_api_put_term(
    db: Arc<Database<String, RegexTerm>>,
    id: String,
    body: RegexTerm,
) -> anyhow::Result<Vec<u8>> {
    db.db.write(|map| {
        match map.get_mut(&id) {
            Some(v) => {
                *v = body;
            }
            None => {
                anyhow::bail!("Term ID does not exist");
            }
        }
        Ok(())
    })??;
    db.db.save()?;

    let term = db.get(&id)?.unwrap();
    let vec = serde_json::to_vec(&*term)?;
    Ok(vec)
}

async fn handle_api_delete_term(
    db: Arc<Database<String, RegexTerm>>,
    id: String,
) -> anyhow::Result<Vec<u8>> {
    db.db.write(|map| {
        if map.remove(&id).is_none() {
            anyhow::bail!("Term ID does not exist");
        }
        Ok(())
    })??;
    db.db.save()?;

    Ok("{}".into())
}

#[derive(Deserialize)]
struct TranslateQuery {
    #[serde(rename = "to")]
    target_lang: String,
}

#[derive(Deserialize)]
struct TranslateBody {
    text: String,
}

#[derive(Serialize)]
struct TranslateResponse {
    translation: String,
}

async fn handle_api_post_translate(
    db: Arc<Database<String, RegexTerm>>,
    query: TranslateQuery,
    body: TranslateBody,
) -> anyhow::Result<Vec<u8>> {
    // Verify that the target language is supported.
    match query.target_lang.as_str() {
        "en" | "zh" => (),
        _ => anyhow::bail!("Invalid query"),
    }

    use crate::translator::Translator;

    let translator = crate::translator::GoogleTranslator::new(query.target_lang.clone());

    // Filtering out terms that shouldn't be applied in the specified context.
    let mut eligible_terms: Vec<_> = db
        .iter()?
        .map(|v| v.value)
        .filter(|t| {
            t.target_lang
                .as_ref()
                .map(|x| x == &query.target_lang)
                .unwrap_or(true)
        })
        .filter(|t| {
            t.translator
                .as_ref()
                .map(|x| x.contains(translator.name()))
                .unwrap_or(true)
        })
        .cloned()
        .collect();
    eligible_terms.sort_unstable_by(RegexTerm::compare_priority);

    let dict_translator =
        crate::translator::DictionaryTranslator::new(&translator, &eligible_terms);
    let translation = dict_translator.translate(&body.text).await?;
    Ok(serde_json::to_vec(&TranslateResponse { translation })?)
}

pub fn api_get_terms(
    db: Arc<Database<String, RegexTerm>>,
) -> impl Filter<Extract = impl warp::Reply, Error = warp::Rejection> + Clone {
    warp::path("terms")
        .and(warp::get())
        .and(warp::any().map(move || db.clone()))
        .and_then(move |db| async move {
            handle_api_get_terms(db)
                .await
                .map_err(|err| warp::Rejection::from(crate::WarpError::from(err)))
        })
}

pub fn api_get_term(
    db: Arc<Database<String, RegexTerm>>,
) -> impl Filter<Extract = impl warp::Reply, Error = warp::Rejection> + Clone {
    warp::path!("term" / String)
        .and(warp::get())
        .and(warp::any().map(move || db.clone()))
        .and_then(move |id, db| async move {
            handle_api_get_term(db, id)
                .await
                .map_err(|err| warp::Rejection::from(crate::WarpError::from(err)))
        })
}

pub fn api_post_term(
    db: Arc<Database<String, RegexTerm>>,
) -> impl Filter<Extract = impl warp::Reply, Error = warp::Rejection> + Clone {
    warp::path!("term")
        .and(warp::post())
        .and(warp::body::json())
        .and(warp::any().map(move || db.clone()))
        .and_then(move |body, db| async move {
            handle_api_post_term(db, body)
                .await
                .map_err(|err| warp::Rejection::from(crate::WarpError::from(err)))
        })
}

pub fn api_put_term(
    db: Arc<Database<String, RegexTerm>>,
) -> impl Filter<Extract = impl warp::Reply, Error = warp::Rejection> + Clone {
    warp::path!("term" / String)
        .and(warp::put())
        .and(warp::body::json())
        .and(warp::any().map(move || db.clone()))
        .and_then(move |id, body, db| async move {
            handle_api_put_term(db, id, body)
                .await
                .map_err(|err| warp::Rejection::from(crate::WarpError::from(err)))
        })
}

pub fn api_delete_term(
    db: Arc<Database<String, RegexTerm>>,
) -> impl Filter<Extract = impl warp::Reply, Error = warp::Rejection> + Clone {
    warp::path!("term" / String)
        .and(warp::delete())
        .and(warp::any().map(move || db.clone()))
        .and_then(move |id, db| async move {
            handle_api_delete_term(db, id)
                .await
                .map_err(|err| warp::Rejection::from(crate::WarpError::from(err)))
        })
}

pub fn api_post_translate(
    db: Arc<Database<String, RegexTerm>>,
) -> impl Filter<Extract = impl warp::Reply, Error = warp::Rejection> + Clone {
    warp::path!("translate")
        .and(warp::post())
        .and(warp::query())
        .and(warp::body::json())
        .and(warp::any().map(move || db.clone()))
        .and_then(move |query, body, db| async move {
            handle_api_post_translate(db, query, body)
                .await
                .map_err(|err| warp::Rejection::from(crate::WarpError::from(err)))
        })
}
