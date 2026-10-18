// Altaris - núcleo nativo (Tauri v2).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod server;

use serde::Serialize;
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};

#[derive(Serialize, Clone, Debug)]
struct DisplayInfo {
    id: String,
    name: String,
    width: u32,
    height: u32,
    is_primary: bool,
}

#[tauri::command]
fn get_displays(app: AppHandle) -> Vec<DisplayInfo> {
    let mut out = Vec::new();
    if let Ok(monitors) = app.available_monitors() {
        for (i, m) in monitors.iter().enumerate() {
            let size = m.size();
            out.push(DisplayInfo {
                id: format!("display_{i}"),
                name: m.name().cloned().unwrap_or_else(|| format!("Monitor {}", i + 1)),
                width: size.width,
                height: size.height,
                is_primary: i == 0,
            });
        }
    }
    out
}

#[tauri::command]
fn server_info(info: State<server::ServerInfo>) -> server::ServerInfo {
    info.inner().clone()
}

fn toggle_window(
    app: &AppHandle,
    label: &str,
    url: &str,
    title: &str,
    monitor_index: Option<usize>,
) -> Result<bool, String> {
    if let Some(win) = app.get_webview_window(label) {
        win.close().map_err(|e| e.to_string())?;
        return Ok(false);
    }

    let has_second_monitor = monitor_index.is_some();
    let win = WebviewWindowBuilder::new(app, label, WebviewUrl::App(url.into()))
        .title(title)
        .inner_size(960.0, 540.0)
        .decorations(!has_second_monitor)
        .build()
        .map_err(|e| e.to_string())?;

    if let Some(idx) = monitor_index {
        if let Ok(monitors) = app.available_monitors() {
            if let Some(m) = monitors.get(idx) {
                let _ = win.set_position(*m.position());
                let _ = win.set_fullscreen(true);
            }
        }
    }
    Ok(true)
}

#[tauri::command]
async fn toggle_audience_window(app: AppHandle, monitor_index: Option<usize>) -> Result<bool, String> {
    toggle_window(&app, "audience", "audience.html", "Altaris - Projeção", monitor_index)
}

#[tauri::command]
async fn toggle_stage_window(app: AppHandle, monitor_index: Option<usize>) -> Result<bool, String> {
    toggle_window(&app, "stage", "stage.html", "Altaris - Retorno de Palco", monitor_index)
}

#[tauri::command]
async fn search_online_lyrics(query: String) -> Result<Vec<server::OnlineLyricItem>, String> {
    Ok(server::fetch_online_lyrics(&query).await)
}

#[tauri::command]
async fn convert_presentation_to_pdf(filename: String, data: Vec<u8>) -> Result<Vec<u8>, String> {
    let temp_dir = std::env::temp_dir();
    let unique_id = format!("altaris_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());
    let ext = std::path::Path::new(&filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("pptx");
    let in_filename = format!("{}.{}", unique_id, ext);
    let out_pdf_filename = format!("{}.pdf", unique_id);
    let in_path = temp_dir.join(&in_filename);
    let out_pdf_path = temp_dir.join(&out_pdf_filename);

    std::fs::write(&in_path, &data).map_err(|e| e.to_string())?;

    let output = std::process::Command::new("soffice")
        .arg("--headless")
        .arg("--convert-to")
        .arg("pdf")
        .arg(&in_path)
        .arg("--outdir")
        .arg(&temp_dir)
        .output()
        .map_err(|e| format!("Falha ao invocar LibreOffice: {}", e))?;

    let _ = std::fs::remove_file(&in_path);

    if !output.status.success() || !out_pdf_path.exists() {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("Erro na conversão: {}", err));
    }

    let pdf_bytes = std::fs::read(&out_pdf_path).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&out_pdf_path);
    Ok(pdf_bytes)
}

#[tauri::command]
fn open_browser_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Falha ao abrir URL no Linux: {}", e))?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| format!("Falha ao abrir URL no Windows: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Falha ao abrir URL no macOS: {}", e))?;
    }
    Ok(())
}

fn main() {
    // Evita bug de tela preta em vídeos no WebKitGTK com VA-API DMA-BUF (Intel iHD),
    // forçando decodificação GStreamer compatível com Canvas 2D e DOM <video>.
    std::env::set_var("LIBVA_DRIVER_NAME", "none");

    tauri::Builder::default()
        .setup(|app| {
            let info = server::start(app.handle().clone())?;
            println!(
                "[Altaris] celular: {}  |  OBS: {}",
                info.remote_url, info.obs_url
            );
            app.manage(info);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_displays,
            server_info,
            toggle_audience_window,
            toggle_stage_window,
            search_online_lyrics,
            convert_presentation_to_pdf,
            open_browser_url
        ])
        .run(tauri::generate_context!())
        .expect("erro ao executar o Altaris");
}
