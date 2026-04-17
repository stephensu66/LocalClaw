#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};
use tauri::{Emitter, Manager};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalServiceStartupErrorPayload {
  message: String,
  log_path: Option<String>,
}

#[allow(dead_code)]
enum LocalServiceCommand {
  Shell(String),
  Direct {
    program: PathBuf,
    args: Vec<String>,
    current_dir: PathBuf,
  },
}

fn service_port() -> u16 {
  std::env::var("LOCAL_SERVICE_PORT")
    .ok()
    .and_then(|value| value.parse::<u16>().ok())
    .unwrap_or(3980)
}

fn required_node_major() -> u32 {
  std::env::var("NODE_REQUIRED_MAJOR")
    .ok()
    .and_then(|value| value.parse::<u32>().ok())
    .unwrap_or(24)
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

fn wait_for_local_service(host: &str, port: u16, timeout: Duration) -> bool {
  let start = Instant::now();
  while start.elapsed() < timeout {
    if is_local_service_running(host, port) {
      return true;
    }
    std::thread::sleep(Duration::from_millis(250));
  }
  false
}

fn parse_node_major(version_text: &str) -> Option<u32> {
  let trimmed = version_text.trim();
  let without_prefix = trimmed.strip_prefix('v').unwrap_or(trimmed);
  without_prefix
    .split('.')
    .next()
    .and_then(|major| major.parse::<u32>().ok())
}

fn detect_node_major_with_program(program: &Path) -> Option<u32> {
  let output = Command::new(program).arg("-v").output().ok()?;
  if !output.status.success() {
    return None;
  }
  let text = String::from_utf8_lossy(&output.stdout).to_string();
  parse_node_major(&text)
}

fn detect_system_node_major() -> Option<u32> {
  detect_node_major_with_program(Path::new("node"))
}

fn command_exists(command: &str) -> bool {
  #[cfg(target_os = "windows")]
  let output = Command::new("cmd")
    .args(["/C", &format!("where {command}")])
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .status();

  #[cfg(not(target_os = "windows"))]
  let output = Command::new("sh")
    .args(["-lc", &format!("command -v {command} >/dev/null 2>&1")])
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .status();

  output.map(|status| status.success()).unwrap_or(false)
}

fn default_node_install_cmd(required_major: u32) -> Option<String> {
  if command_exists("brew") {
    return Some(format!("brew install node@{required_major}"));
  }
  None
}

fn detect_nvm_node_path(required_major: u32) -> Option<PathBuf> {
  let script = format!(
    "export NVM_DIR=\"${{NVM_DIR:-$HOME/.nvm}}\"; \
     [ -s \"$NVM_DIR/nvm.sh\" ] || exit 1; \
     . \"$NVM_DIR/nvm.sh\"; \
     v=$(nvm version {required_major}); \
     [ \"$v\" != \"N/A\" ] || exit 2; \
     nvm use {required_major} >/dev/null 2>&1 || exit 3; \
     command -v node"
  );

  let output = Command::new("sh").args(["-lc", &script]).output().ok()?;
  if !output.status.success() {
    return None;
  }
  let node_path = String::from_utf8_lossy(&output.stdout).trim().to_string();
  if node_path.is_empty() {
    return None;
  }
  Some(PathBuf::from(node_path))
}

#[cfg(target_os = "macos")]
fn request_node_install_permission(required_major: u32, current: Option<u32>) -> bool {
  let current_desc = match current {
    Some(major) => format!("当前检测到 Node.js 主版本: {major}"),
    None => "当前未检测到 Node.js".to_string(),
  };

  let script = format!(
    "display dialog \"LocalClaw 需要 Node.js {required_major}。{current_desc}。\\n\\n是否允许现在安装 Node.js {required_major}？\\n选择“不允许”将退出应用。\" buttons {{\"不允许\", \"允许安装\"}} default button \"允许安装\" with icon caution"
  );
  let output = Command::new("osascript").arg("-e").arg(script).output();
  match output {
    Ok(result) => result.status.success(),
    Err(_) => false,
  }
}

#[cfg(not(target_os = "macos"))]
fn request_node_install_permission(_required_major: u32, _current: Option<u32>) -> bool {
  false
}

fn user_home_dir() -> PathBuf {
  std::env::var("HOME")
    .map(PathBuf::from)
    .unwrap_or_else(|_| std::env::temp_dir())
}

fn log_dir(app: &tauri::AppHandle) -> PathBuf {
  match app.path().app_log_dir() {
    Ok(path) => path,
    Err(_) => user_home_dir().join(".localclaw/logs"),
  }
}

fn app_data_dir(app: &tauri::AppHandle) -> PathBuf {
  match app.path().app_local_data_dir() {
    Ok(path) => path,
    Err(_) => user_home_dir().join(".openclaw"),
  }
}

fn ensure_parent_dir(path: &Path) {
  if let Some(parent) = path.parent() {
    let _ = std::fs::create_dir_all(parent);
  }
}

fn append_log(path: &Path, message: &str) {
  ensure_parent_dir(path);
  if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
    let _ = std::io::Write::write_all(&mut file, message.as_bytes());
    let _ = std::io::Write::write_all(&mut file, b"\n");
  }
}

fn open_log_outputs(path: &Path) -> (Stdio, Stdio) {
  ensure_parent_dir(path);
  match std::fs::OpenOptions::new().create(true).append(true).open(path) {
    Ok(file) => match file.try_clone() {
      Ok(stderr_file) => (Stdio::from(file), Stdio::from(stderr_file)),
      Err(_) => (Stdio::from(file), Stdio::null()),
    },
    Err(_) => (Stdio::null(), Stdio::null()),
  }
}

#[cfg(debug_assertions)]
fn default_local_service_cmd(_app: &tauri::AppHandle) -> Option<LocalServiceCommand> {
  let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
    .join("../../..")
    .to_string_lossy()
    .to_string();
  Some(LocalServiceCommand::Shell(format!(
    "cd \"{root}\" && pnpm --filter @openclaw/local-service dev"
  )))
}

#[cfg(not(debug_assertions))]
fn default_local_service_cmd(app: &tauri::AppHandle) -> Option<LocalServiceCommand> {
  let resource_dir = match app.path().resource_dir() {
    Ok(path) => path,
    Err(_) => return None,
  };

  let direct_dir = resource_dir.join("local-service");
  let nested_dir = resource_dir.join("resources").join("local-service");
  let service_dir = if direct_dir.exists() {
    direct_dir
  } else if nested_dir.exists() {
    nested_dir
  } else {
    return None;
  };
  let entry = service_dir.join("dist").join("index.cjs");
  if !entry.exists() {
    return None;
  }

  let node_program = std::env::var("LOCAL_SERVICE_NODE_PATH")
    .ok()
    .filter(|value| !value.trim().is_empty())
    .map(PathBuf::from)
    .unwrap_or_else(|| PathBuf::from("node"));

  Some(LocalServiceCommand::Direct {
    program: node_program,
    args: vec![entry.to_string_lossy().to_string()],
    current_dir: service_dir,
  })
}

fn ensure_node_runtime_ready(app: &tauri::AppHandle) -> Result<(), LocalServiceStartupErrorPayload> {
  let required_major = required_node_major();
  let log_path = log_dir(app).join("local-service.log");

  std::env::remove_var("LOCAL_SERVICE_NODE_PATH");
  let initial_major = detect_system_node_major();
  if initial_major == Some(required_major) {
    append_log(
      &log_path,
      &format!("[desktop] Node.js runtime check passed: major={required_major}"),
    );
    return Ok(());
  }

  if let Some(nvm_node_path) = detect_nvm_node_path(required_major) {
    let nvm_major = detect_node_major_with_program(&nvm_node_path);
    if nvm_major == Some(required_major) {
      std::env::set_var(
        "LOCAL_SERVICE_NODE_PATH",
        nvm_node_path.to_string_lossy().to_string(),
      );
      append_log(
        &log_path,
        &format!(
          "[desktop] Node.js runtime resolved via nvm: major={required_major}, path={}",
          nvm_node_path.display()
        ),
      );
      return Ok(());
    }
  }

  let permitted = request_node_install_permission(required_major, initial_major);
  if !permitted {
    let message = format!(
      "Node.js {required_major} is required to start LocalClaw. User denied installation."
    );
    append_log(&log_path, &format!("[desktop] {message}"));
    return Err(LocalServiceStartupErrorPayload {
      message,
      log_path: Some(log_path.display().to_string()),
    });
  }

  let install_cmd = std::env::var("NODE_INSTALL_CMD")
    .ok()
    .filter(|value| !value.trim().is_empty())
    .or_else(|| default_node_install_cmd(required_major));

  let Some(install_cmd) = install_cmd else {
    let message = format!(
      "Node.js {required_major} missing and installation command is not configured. Set NODE_INSTALL_CMD."
    );
    append_log(&log_path, &format!("[desktop] {message}"));
    return Err(LocalServiceStartupErrorPayload {
      message,
      log_path: Some(log_path.display().to_string()),
    });
  };

  append_log(
    &log_path,
    &format!("[desktop] attempting Node.js install: {install_cmd}"),
  );

  #[cfg(target_os = "windows")]
  let status = Command::new("cmd").args(["/C", &install_cmd]).status();
  #[cfg(not(target_os = "windows"))]
  let status = Command::new("sh").args(["-lc", &install_cmd]).status();

  match status {
    Ok(exit) if exit.success() => {
      let installed_major = detect_system_node_major();
      if installed_major == Some(required_major) {
        append_log(
          &log_path,
          &format!("[desktop] Node.js installation succeeded: major={required_major}"),
        );
        Ok(())
      } else if let Some(nvm_node_path) = detect_nvm_node_path(required_major) {
        let nvm_major = detect_node_major_with_program(&nvm_node_path);
        if nvm_major == Some(required_major) {
          std::env::set_var(
            "LOCAL_SERVICE_NODE_PATH",
            nvm_node_path.to_string_lossy().to_string(),
          );
          append_log(
            &log_path,
            &format!(
              "[desktop] Node.js runtime resolved via nvm after install: major={required_major}, path={}",
              nvm_node_path.display()
            ),
          );
          Ok(())
        } else {
          let message = format!(
            "Node.js installation completed but required major {required_major} is still unavailable."
          );
          append_log(&log_path, &format!("[desktop] {message}"));
          Err(LocalServiceStartupErrorPayload {
            message,
            log_path: Some(log_path.display().to_string()),
          })
        }
      } else {
        let message = format!(
          "Node.js installation completed but required major {required_major} is still unavailable."
        );
        append_log(&log_path, &format!("[desktop] {message}"));
        Err(LocalServiceStartupErrorPayload {
          message,
          log_path: Some(log_path.display().to_string()),
        })
      }
    }
    Ok(exit) => {
      let message = format!(
        "Node.js installation command failed with status {:?}.",
        exit.code()
      );
      append_log(&log_path, &format!("[desktop] {message}"));
      Err(LocalServiceStartupErrorPayload {
        message,
        log_path: Some(log_path.display().to_string()),
      })
    }
    Err(error) => {
      let message = format!("Failed to run Node.js installation command: {error}");
      append_log(&log_path, &format!("[desktop] {message}"));
      Err(LocalServiceStartupErrorPayload {
        message,
        log_path: Some(log_path.display().to_string()),
      })
    }
  }
}

fn start_local_service_if_needed(
  app: &tauri::AppHandle,
) -> Result<(), LocalServiceStartupErrorPayload> {
  let host = service_host();
  let port = service_port();
  let log_path = log_dir(app).join("local-service.log");
  if is_local_service_running(&host, port) {
    println!("[desktop] local-service already running at {host}:{port}");
    return Ok(());
  }

  let command = std::env::var("LOCAL_SERVICE_START_CMD")
    .ok()
    .filter(|value| !value.trim().is_empty())
    .map(LocalServiceCommand::Shell)
    .or_else(|| default_local_service_cmd(app));

  let Some(command) = command else {
    let message =
      "[desktop] local-service is not running and no startup command is configured".to_string();
    append_log(&log_path, &message);
    return Err(LocalServiceStartupErrorPayload {
      message,
      log_path: Some(log_path.display().to_string()),
    });
  };

  let (stdout, stderr) = open_log_outputs(&log_path);
  let app_data_dir = app_data_dir(app);
  let mut child = match command {
    LocalServiceCommand::Shell(shell_command) => {
      append_log(
        &log_path,
        &format!("[desktop] launching local-service via shell: {shell_command}"),
      );
      #[cfg(target_os = "windows")]
      let mut cmd = {
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", &shell_command]);
        cmd
      };

      #[cfg(not(target_os = "windows"))]
      let cmd = {
        let mut cmd = Command::new("sh");
        cmd.args(["-lc", &shell_command]);
        cmd
      };
      cmd
    }
    LocalServiceCommand::Direct {
      program,
      args,
      current_dir,
    } => {
      append_log(
        &log_path,
        &format!(
          "[desktop] launching local-service: {} {}",
          program.display(),
          args.join(" ")
        ),
      );
      let mut cmd = Command::new(program);
      cmd.current_dir(current_dir).args(args);
      cmd
    }
  };

  let spawn_result = child
    .env("PORT", port.to_string())
    .env("APP_DATA_DIR", app_data_dir.to_string_lossy().to_string())
    .stdin(Stdio::null())
    .stdout(stdout)
    .stderr(stderr)
    .spawn();

  match spawn_result {
    Ok(process) => {
      println!("[desktop] local-service start command launched, pid={}", process.id());
      append_log(
        &log_path,
        &format!("[desktop] local-service start command launched, pid={}", process.id()),
      );
    }
    Err(error) => {
      let message = format!("[desktop] failed to start local-service: {error}");
      eprintln!("{message}");
      append_log(&log_path, &message);
      return Err(LocalServiceStartupErrorPayload {
        message,
        log_path: Some(log_path.display().to_string()),
      });
    }
  }

  let ready = wait_for_local_service(&host, port, Duration::from_secs(20));
  if !ready {
    let message = format!(
      "Local service did not become ready at {host}:{port} within 20s. See log for details."
    );
    append_log(&log_path, &format!("[desktop] {message}"));
    return Err(LocalServiceStartupErrorPayload {
      message,
      log_path: Some(log_path.display().to_string()),
    });
  }

  Ok(())
}

fn main() {
  tauri::Builder::default()
    .setup(|app| {
      let app_handle = app.handle().clone();
      if let Err(payload) = ensure_node_runtime_ready(&app_handle) {
        let _ = app.emit("local-service-startup-error", payload);
        std::process::exit(1);
      }

      if let Err(payload) = start_local_service_if_needed(&app_handle) {
        let _ = app.emit("local-service-startup-error", payload);
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
