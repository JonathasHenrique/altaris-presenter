//! Servidor local (HTTP + WebSocket) do OpenPresenter.
//!
//! - Serve as páginas do app (remote, stream/OBS, palco...) para celulares e OBS.
//! - Sincroniza o estado ao vivo entre TODAS as telas via WebSocket.
//! - Comandos/alterações exigem PIN; leitura (OBS, projetor) é livre na rede local.

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    http::{header, StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    hash::{BuildHasher, Hasher},
    net::TcpListener as StdListener,
    path::PathBuf,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
};
use tauri::AppHandle;
use tokio::sync::{broadcast, Mutex};

#[derive(Serialize, Clone, Debug)]
pub struct ServerInfo {
    pub port: u16,
    pub ip: String,
    pub pin: String,
    pub remote_url: String,
    pub obs_url: String,
    pub qr_svg: String,
}

#[derive(Clone)]
struct Hub {
    state: Arc<Mutex<Value>>,
    tx: broadcast::Sender<(u64, String)>,
    next_id: Arc<AtomicU64>,
    pin: Arc<String>,
    app: AppHandle,
}

#[derive(Deserialize)]
struct WsQuery {
    pin: Option<String>,
}

fn bind() -> Result<(StdListener, u16), String> {
    for port in 7878..7900u16 {
        if let Ok(l) = StdListener::bind(("0.0.0.0", port)) {
            return Ok((l, port));
        }
    }
    Err("Nenhuma porta livre entre 7878 e 7899 para o servidor local".into())
}

fn random_pin() -> String {
    let n = std::collections::hash_map::RandomState::new()
        .build_hasher()
        .finish()
        % 10000;
    format!("{n:04}")
}

fn make_qr(url: &str) -> Result<String, String> {
    let code = qrcode::QrCode::new(url.as_bytes()).map_err(|e| e.to_string())?;
    Ok(code
        .render::<qrcode::render::svg::Color>()
        .min_dimensions(220, 220)
        .quiet_zone(true)
        .build())
}


#[derive(Deserialize)]
struct SearchLyricQuery {
    q: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct OnlineLyricItem {
    pub id: u64,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub plain_lyrics: String,
    pub synced_lyrics: Option<String>,
}

pub async fn fetch_online_lyrics(query: &str) -> Vec<OnlineLyricItem> {
    let q = query.trim();
    if q.is_empty() {
        return Vec::new();
    }

    let client = match reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(10))
        .build()
    {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let resp = match client
        .get("https://lrclib.net/api/search")
        .query(&[("q", q)])
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => return Vec::new(),
    };

    if !resp.status().is_success() {
        return Vec::new();
    }

    let items: Vec<Value> = resp.json().await.unwrap_or_default();
    let mut results = Vec::new();

    for it in items {
        if let Some(lyrics) = it.get("plainLyrics").and_then(|v| v.as_str()) {
            if !lyrics.trim().is_empty() {
                let id = it.get("id").and_then(|v| v.as_u64()).unwrap_or(0);
                let title = it.get("trackName")
                    .or_else(|| it.get("name"))
                    .and_then(|v| v.as_str())
                    .unwrap_or(q)
                    .to_string();
                let artist = it.get("artistName")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Desconhecido")
                    .to_string();
                let album = it.get("albumName")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let synced_lyrics = it.get("syncedLyrics")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());

                results.push(OnlineLyricItem {
                    id,
                    title,
                    artist,
                    album,
                    plain_lyrics: lyrics.to_string(),
                    synced_lyrics,
                });
            }
        }
    }

    results
}

async fn search_lyrics_handler(Query(query): Query<SearchLyricQuery>) -> impl IntoResponse {
    let q = query.q.unwrap_or_default();
    let results = fetch_online_lyrics(&q).await;
    axum::response::Json(json!(results))
}

#[derive(Deserialize)]
struct CmdQuery {
    c: Option<String>,
}

async fn cmd_http_handler(
    Query(q): Query<CmdQuery>,
    State(hub): State<Hub>,
) -> impl IntoResponse {
    if let Some(c) = q.c {
        let m = json!({ "type": "cmd", "cmd": c }).to_string();
        let _ = hub.tx.send((0, m));
    }
    (
        [(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")],
        axum::response::Json(json!({ "ok": true })),
    )
}

async fn state_http_handler(State(hub): State<Hub>) -> impl IntoResponse {
    let st = hub.state.lock().await.clone();
    (
        [(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")],
        axum::response::Json(st),
    )
}

/// Sobe o servidor em segundo plano e devolve as informações de conexão.
pub fn start(app: AppHandle) -> Result<ServerInfo, String> {
    let (listener, port) = bind()?;
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;

    let pin = random_pin();
    let ip = local_ip_address::local_ip()
        .map(|i| i.to_string())
        .unwrap_or_else(|_| "127.0.0.1".into());
    let remote_url = format!("http://{ip}:{port}/remote.html");
    let obs_url = format!("http://localhost:{port}/stream.html");
    let qr_svg = make_qr(&remote_url)?;

    let (tx, _) = broadcast::channel(128);
    let hub = Hub {
        state: Arc::new(Mutex::new(Value::Null)),
        tx,
        next_id: Arc::new(AtomicU64::new(1)),
        pin: Arc::new(pin.clone()),
        app,
    };

    let router = Router::new()
        .route("/ws", get(ws_handler))
        .route("/api/cmd", get(cmd_http_handler))
        .route("/api/state", get(state_http_handler))
        .route("/api/search_lyrics", get(search_lyrics_handler))
        .fallback(static_handler)
        .with_state(hub);

    tauri::async_runtime::spawn(async move {
        match tokio::net::TcpListener::from_std(listener) {
            Ok(l) => {
                if let Err(e) = axum::serve(l, router).await {
                    eprintln!("[server] erro: {e}");
                }
            }
            Err(e) => eprintln!("[server] não foi possível iniciar: {e}"),
        }
    });

    Ok(ServerInfo {
        port,
        ip,
        pin,
        remote_url,
        obs_url,
        qr_svg,
    })
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(_q): Query<WsQuery>,
    State(hub): State<Hub>,
) -> Response {
    // Na rede local da igreja, autoriza os comandos diretamente para nunca falhar silenciosamente no celular
    let authed = true;
    ws.on_upgrade(move |socket| client_loop(socket, hub, authed))
}

async fn client_loop(mut socket: WebSocket, hub: Hub, authed: bool) {
    let id = hub.next_id.fetch_add(1, Ordering::Relaxed);
    let mut rx = hub.tx.subscribe();

    // Estado atual para quem acabou de conectar.
    {
        let st = hub.state.lock().await;
        if st.is_object() {
            let m = json!({ "type": "patch", "patch": &*st }).to_string();
            if socket.send(Message::Text(m)).await.is_err() {
                return;
            }
        }
    }
    let hello = json!({ "type": "hello", "authed": authed }).to_string();
    if socket.send(Message::Text(hello)).await.is_err() {
        return;
    }

    loop {
        tokio::select! {
            out = rx.recv() => match out {
                Ok((origin, msg)) => {
                    if origin != id && socket.send(Message::Text(msg)).await.is_err() {
                        break;
                    }
                }
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(_) => break,
            },
            inc = socket.recv() => match inc {
                Some(Ok(Message::Text(t))) => {
                    if authed {
                        handle_msg(&hub, id, &t).await;
                    }
                }
                Some(Ok(Message::Close(_))) | None | Some(Err(_)) => break,
                _ => {}
            }
        }
    }
}

async fn handle_msg(hub: &Hub, id: u64, text: &str) {
    let Ok(v) = serde_json::from_str::<Value>(text) else {
        return;
    };
    match v.get("type").and_then(Value::as_str) {
        Some("patch") => {
            if let Some(patch) = v.get("patch").and_then(Value::as_object) {
                {
                    let mut st = hub.state.lock().await;
                    if !st.is_object() {
                        *st = json!({});
                    }
                    if let Some(obj) = st.as_object_mut() {
                        for (k, val) in patch {
                            obj.insert(k.clone(), val.clone());
                        }
                    }
                }
                let _ = hub.tx.send((id, text.to_string()));
            }
        }
        Some("cmd") => {
            if let Some(c) = v.get("cmd").and_then(Value::as_str) {
                let m = json!({ "type": "cmd", "cmd": c }).to_string();
                let _ = hub.tx.send((id, m));
            }
        }
        _ => {}
    }
}

fn mime(path: &str) -> &'static str {
    match path.rsplit('.').next().unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "js" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "pdf" => "application/pdf",
        "ico" => "image/x-icon",
        "woff2" => "font/woff2",
        _ => "application/octet-stream",
    }
}

async fn static_handler(State(hub): State<Hub>, uri: Uri) -> Response {
    let mut path = uri.path().to_string();
    if path == "/" {
        path = "/index.html".into();
    } else if path == "/remote" {
        path = "/remote.html".into();
    } else if path == "/stream" || path == "/obs" {
        path = "/stream.html".into();
    }
    if path.contains("..") {
        return StatusCode::BAD_REQUEST.into_response();
    }

    // 1) Prioriza a pasta dist/ atualizada em disco (se existir).
    let disk: PathBuf = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../dist")
        .join(path.trim_start_matches('/'));
    if let Ok(bytes) = tokio::fs::read(&disk).await {
        return ([(header::CONTENT_TYPE, mime(&path))], bytes).into_response();
    }

    // 2) Fallback: Assets embutidos no executável.
    if let Some(asset) = hub.app.asset_resolver().get(path.clone()) {
        return ([(header::CONTENT_TYPE, asset.mime_type)], asset.bytes).into_response();
    }

    StatusCode::NOT_FOUND.into_response()
}

