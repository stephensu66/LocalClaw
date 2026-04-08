#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::{SocketAddr, TcpStream};
use std::process::{Command, Stdio};
use std::time::Duration;

fn service_port() -> u16 {
  std::env::var("LOCAL_SERVICE_PORT")
    .ok()
    .and_then(|value| value.parse::<u16>().ok())
    .unwrap_or(3980)
}

fn service_host() -> String {
  std::env::var("LOCAL_SERVICE_HOST").unwrap_or_else(|_| "127.0.0.1".to_string())
}

fn is_local_service_running(host: &str, port: u16) -> bool {
  let addr = format!("{host}:{port}");
  let parsed: Result<SocketAddr, _> = addr.parse();
  match parsed {
    Ok(socket_addr) => TcpStream::connect_timeout(&socket_addr, Duration::from_millis(300)).is_ok(),
    Err(_) => false,
  }
}

#[cfg(debug_assertions)]
fn default_local_service_cmd() -> Option<String> {
  let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
    .join("../../..")
    .to_string_lossy()
    .to_string();
  Some(format!("cd \"{root}\" && pnpm --filter @openclaw/local-service dev"))
}

#[cfg(not(debug_assertions))]
fn default_local_service_cmd() -> Option<String> {
  None
}

fn start_local_service_if_needed() {
  let host = service_host();
  let port = service_port();
  if is_local_service_running(&host, port) {
    println!("[desktop] local-service already running at {host}:{port}");
    return;
  }

  let command = std::env::var("LOCAL_SERVICE_START_CMD")
    .ok()
    .filter(|value| !value.trim().is_empty())
    .or_else(default_local_service_cmd);

  let Some(command) = command else {
    println!(
      "[desktop] local-service is not running and LOCAL_SERVICE_START_CMD is not configured"
    );
    return;
  };

  #[cfg(target_os = "windows")]
  let mut child = {
    let mut cmd = Command::new("cmd");
    cmd.args(["/C", &command]);
    cmd
  };

  #[cfg(not(target_os = "windows"))]
  let mut child = {
    let mut cmd = Command::new("sh");
    cmd.args(["-lc", &command]);
    cmd
  };

  let spawn_result = child
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .spawn();

  match spawn_result {
    Ok(process) => {
      println!("[desktop] local-service start command launched, pid={}", process.id());
    }
    Err(error) => {
      eprintln!("[desktop] failed to start local-service: {error}");
    }
  }
}

fn main() {
  tauri::Builder::default()
    .setup(|_app| {
      start_local_service_if_needed();
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
