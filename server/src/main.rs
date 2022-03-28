use serde::{ser::SerializeSeq, Serializer};
use std::net::SocketAddr;
use std::sync::Arc;
use warp::Filter;

mod api;
mod db;
mod regex;
mod schema;
mod translator;

use schema::RegexTerm;

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

    println!("{:?}", err);

    let json = warp::reply::json(&ErrorMessage {
        error: message.into(),
    });

    Ok(warp::reply::with_status(json, code))
}

#[tokio::main]
async fn main() {
    let db = Arc::new(db::Database::<String, RegexTerm>::open("dictionary.db").unwrap());

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

    let addr: SocketAddr = "127.0.0.1:3001".parse().unwrap();
    warp::serve(routes).run(addr).await;
}
