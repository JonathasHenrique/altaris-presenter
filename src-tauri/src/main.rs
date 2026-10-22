// Altaris - núcleo nativo (Tauri v2).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod server;

fn apply_autoplay_settings(win: &tauri::WebviewWindow) {
    #[cfg(target_os = "linux")]
    {
        use webkit2gtk::{SettingsExt, WebViewExt};
        let _ = win.with_webview(|webview| {
            let wv = webview.inner();
            if let Some(settings) = wv.settings() {
                settings.set_media_playback_requires_user_gesture(false);
                settings.set_media_playback_allows_inline(true);
            }
        });
    }
}


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

    apply_autoplay_settings(&win);

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
    let unique_id = format!("altaris_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
    let ext = std::path::Path::new(&filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("pptx");
    let in_filename = format!("{}.{}", unique_id, ext);
    let out_pdf_filename = format!("{}.pdf", unique_id);
    let in_path = temp_dir.join(&in_filename);
    let out_pdf_path = temp_dir.join(&out_pdf_filename);

    std::fs::write(&in_path, &data).map_err(|e| e.to_string())?;

    let profile_dir = temp_dir.join(format!("altaris-lo-profile-{unique_id}"));
    std::fs::create_dir_all(&profile_dir).map_err(|e| e.to_string())?;
    let profile_path = profile_dir.to_string_lossy().replace('\\', "/");
    let profile_url = if cfg!(target_os = "windows") {
        format!("file:///{}", profile_path)
    } else {
        format!("file://{}", profile_path)
    };

    let output = std::process::Command::new("soffice")
        .arg(format!("-env:UserInstallation={profile_url}"))
        .arg("--headless")
        .arg("--invisible")
        .arg("--nologo")
        .arg("--nofirststartwizard")
        .arg("--convert-to")
        .arg("pdf")
        .arg(&in_path)
        .arg("--outdir")
        .arg(&temp_dir)
        .env("SAL_DISABLE_OPENCL", "1")
        .env("P11_KIT_DEBUG", "none")
        .output();

    let _ = std::fs::remove_file(&in_path);
    let _ = std::fs::remove_dir_all(&profile_dir);

    let output = output.map_err(|e| format!("Falha ao invocar LibreOffice: {}", e))?;

    if !out_pdf_path.exists() {
        let err = format!("{} {}", String::from_utf8_lossy(&output.stderr), String::from_utf8_lossy(&output.stdout));
        return Err(format!("LibreOffice não criou o PDF: {}", err));
    }

    let pdf_bytes = std::fs::read(&out_pdf_path).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&out_pdf_path);
    if !pdf_bytes.starts_with(b"%PDF-") {
        let err = format!("{} {}", String::from_utf8_lossy(&output.stderr), String::from_utf8_lossy(&output.stdout));
        return Err(format!("O LibreOffice não gerou um arquivo PDF válido: {}", err));
    }
    if !output.status.success() {
        eprintln!("LibreOffice encerrou com {} após gravar um PDF válido; usando o arquivo gerado.", output.status);
    }
    Ok(pdf_bytes)
}



#[tauri::command]
fn launch_libreoffice_presentation(file_path: String, slide_index: Option<usize>) -> Result<(), String> {
    let source_path = std::path::PathBuf::from(&file_path);
    if !source_path.exists() {
        return Err(format!("Arquivo de apresentação não encontrado: {}", file_path));
    }

    // 1. Cria perfil temporário limpo e isolado para a sessão de apresentação.
    // Isso garante que NUNCA apareçam diálogos de "Recuperação de Documentos",
    // avisos de falhas anteriores ou locks de outros processos do LibreOffice.
    let unique_id = format!("show_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
    let temp_dir = std::env::temp_dir();
    let profile_dir = temp_dir.join(format!("altaris-present-prof-{unique_id}"));
    let _ = std::fs::create_dir_all(&profile_dir);
    let profile_path = profile_dir.to_string_lossy().replace('\\', "/");
    let profile_url = if cfg!(target_os = "windows") {
        format!("file:///{}", profile_path)
    } else {
        format!("file://{}", profile_path)
    };

    // 2. Cria um symlink temporário com extensão .ppsx (PowerPoint Slide Show).
    // Arquivos .ppsx forçam o LibreOffice a abrir diretamente como projeção/slideshow,
    // sem carregar menus ou barras de ferramentas de edição.
    let ext = source_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    let target_path = if ext == "pptx" || ext == "ppt" {
        let shows_dir = temp_dir.join("altaris-shows");
        let _ = std::fs::create_dir_all(&shows_dir);
        let stem = source_path.file_stem().and_then(|s| s.to_str()).unwrap_or("apresentacao");
        let ppsx_path = shows_dir.join(format!("{}_{}.ppsx", stem, unique_id));
        let _ = std::fs::remove_file(&ppsx_path);
        #[cfg(unix)]
        {
            let _ = std::os::unix::fs::symlink(&source_path, &ppsx_path);
        }
        #[cfg(windows)]
        {
            let _ = std::fs::copy(&source_path, &ppsx_path);
        }
        if ppsx_path.exists() {
            ppsx_path
        } else {
            source_path.clone()
        }
    } else {
        source_path.clone()
    };

    let mut cmd = std::process::Command::new("soffice");
    cmd.arg(format!("-env:UserInstallation={profile_url}"))
       .arg("--nologo")
       .arg("--norestore");

    if let Some(idx) = slide_index {
        if idx > 0 {
            cmd.arg(format!("--show={}", idx));
        } else {
            cmd.arg("--show");
        }
    } else {
        cmd.arg("--show");
    }

    cmd.arg(&target_path);

    // No Linux/Fedora com KDE 6: usa GTK3 em vez do backend experimental Qt6 (libvclplug_qt6lo.so),
    // que causa SIGABRT na destruição de janelas do Impress.
    #[cfg(target_os = "linux")]
    {
        cmd.env("SAL_USE_VCLPLUGIN", "gtk3");
    }
    cmd.env("SAL_DISABLE_OPENCL", "1");
    cmd.env("P11_KIT_DEBUG", "none");

    cmd.spawn().map_err(|e| format!("Não foi possível iniciar o LibreOffice Impress: {}. Verifique se o LibreOffice está instalado.", e))?;
    Ok(())
}

#[tauri::command]
fn cache_presentation_file(filename: String, data: Vec<u8>) -> Result<String, String> {
    let temp_dir = std::env::temp_dir().join("altaris-presentations");
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    let path = temp_dir.join(&filename);
    std::fs::write(&path, &data).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
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


#[tauri::command]
fn ensure_system_fonts() -> Result<String, String> {
    #[cfg(target_os = "linux")]
    {
        if let Some(home) = std::env::var_os("HOME") {
            let fonts_dir = std::path::PathBuf::from(home).join(".local/share/fonts");
            let _ = std::fs::create_dir_all(&fonts_dir);
            let candidates = [
                std::path::PathBuf::from("resources/fonts"),
                std::path::PathBuf::from("../resources/fonts"),
                std::path::PathBuf::from("public/fonts/core"),
            ];
            let mut copied = 0;
            for src_dir in candidates {
                if src_dir.exists() {
                    if let Ok(entries) = std::fs::read_dir(src_dir) {
                        for entry in entries.flatten() {
                            let path = entry.path();
                            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                                if ext.eq_ignore_ascii_case("ttf") || ext.eq_ignore_ascii_case("otf") {
                                    if let Some(name) = path.file_name() {
                                        let dest = fonts_dir.join(name);
                                        if !dest.exists() {
                                            if std::fs::copy(&path, &dest).is_ok() {
                                                copied += 1;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    break;
                }
            }
            if copied > 0 {
                let _ = std::process::Command::new("fc-cache")
                    .arg("-f")
                    .arg(&fonts_dir)
                    .output();
            }
            return Ok(format!("Fontes verificadas ({} novas instaladas)", copied));
        }
    }
    #[cfg(target_os = "windows")]
    {
        if let Some(appdata) = std::env::var_os("LOCALAPPDATA") {
            let fonts_dir = std::path::PathBuf::from(appdata).join(r"Microsoft/Windows/Fonts");
            let _ = std::fs::create_dir_all(&fonts_dir);
            let candidates = [
                std::path::PathBuf::from(r"resources/fonts"),
                std::path::PathBuf::from(r"../resources/fonts"),
            ];
            let mut copied = 0;
            for src_dir in candidates {
                if src_dir.exists() {
                    if let Ok(entries) = std::fs::read_dir(src_dir) {
                        for entry in entries.flatten() {
                            let path = entry.path();
                            if let Some(name) = path.file_name() {
                                let dest = fonts_dir.join(name);
                                if !dest.exists() {
                                    if std::fs::copy(&path, &dest).is_ok() {
                                        copied += 1;
                                    }
                                }
                            }
                        }
                    }
                    break;
                }
            }
            return Ok(format!("Fontes sincronizadas no Windows ({} instaladas)", copied));
        }
    }
    Ok("Fontes verificadas.".into())
}


#[tauri::command]
fn get_presentation_bytes(file_path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&file_path).map_err(|e| format!("Falha ao ler arquivo: {}", e))
}

fn main() {
    // Corrige crash do WebKitWebProcess no Fedora / Wayland / Ubuntu recente com drivers Mesa/Intel/AMD
    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
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
            if let Some(main_win) = app.get_webview_window("main") {
                apply_autoplay_settings(&main_win);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_displays,
            server_info,
            toggle_audience_window,
            toggle_stage_window,
            search_online_lyrics,
            convert_presentation_to_pdf,
            launch_libreoffice_presentation,
            cache_presentation_file,
            open_browser_url,
            ensure_system_fonts,
            get_presentation_bytes
        ])
        .run(tauri::generate_context!())
        .expect("erro ao executar o Altaris");
}
