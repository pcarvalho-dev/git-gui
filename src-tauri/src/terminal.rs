use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ShellType {
    #[serde(rename = "powershell")]
    PowerShell,
    #[serde(rename = "cmd")]
    Cmd,
    #[serde(rename = "wsl")]
    Wsl,
    #[serde(rename = "gitbash")]
    GitBash,
}

impl Default for ShellType {
    fn default() -> Self {
        ShellType::PowerShell
    }
}

pub struct TerminalState {
    working_dir: Option<PathBuf>,
    shell_type: ShellType,
}

impl TerminalState {
    pub fn new() -> Self {
        Self {
            working_dir: None,
            shell_type: ShellType::default(),
        }
    }

    pub fn set_working_dir(&mut self, dir: PathBuf) {
        self.working_dir = Some(dir);
    }

    pub fn get_working_dir(&self) -> Option<&PathBuf> {
        self.working_dir.as_ref()
    }

    pub fn set_shell_type(&mut self, shell_type: ShellType) {
        self.shell_type = shell_type;
    }

    pub fn get_shell_type(&self) -> &ShellType {
        &self.shell_type
    }

    pub fn execute_command(&self, command: &str) -> Result<String, String> {
        let (shell, args) = self.get_shell_command(command);

        let mut cmd = Command::new(&shell);
        cmd.args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        if let Some(ref dir) = self.working_dir {
            // For WSL, convert Windows path to WSL path
            if self.shell_type == ShellType::Wsl {
                let wsl_path = self.convert_to_wsl_path(dir);
                cmd.args(["-e", "cd", &wsl_path, "&&"]);
                cmd.args(&args);
                // Reset and rebuild command for WSL
                cmd = Command::new(&shell);
                let full_command = format!("cd '{}' && {}", wsl_path, command);
                cmd.args(["-e", "bash", "-c", &full_command])
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped());
            } else {
                cmd.current_dir(dir);
            }
        }

        // On Windows, hide console window
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let output = cmd.output().map_err(|e| e.to_string())?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        if !stderr.is_empty() && stdout.is_empty() {
            Ok(stderr)
        } else if !stderr.is_empty() {
            Ok(format!("{}\n{}", stdout, stderr))
        } else {
            Ok(stdout)
        }
    }

    fn get_shell_command(&self, command: &str) -> (String, Vec<String>) {
        match self.shell_type {
            ShellType::PowerShell => {
                ("powershell".to_string(), vec![
                    "-NoProfile".to_string(),
                    "-NonInteractive".to_string(),
                    "-Command".to_string(),
                    command.to_string(),
                ])
            }
            ShellType::Cmd => {
                ("cmd".to_string(), vec!["/C".to_string(), command.to_string()])
            }
            ShellType::Wsl => {
                ("wsl".to_string(), vec![
                    "-e".to_string(),
                    "bash".to_string(),
                    "-c".to_string(),
                    command.to_string(),
                ])
            }
            ShellType::GitBash => {
                // Try common Git Bash locations
                let git_bash_paths = [
                    r"C:\Program Files\Git\bin\bash.exe",
                    r"C:\Program Files (x86)\Git\bin\bash.exe",
                ];
                let bash_path = git_bash_paths
                    .iter()
                    .find(|p| std::path::Path::new(p).exists())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| "bash".to_string());

                (bash_path, vec!["-c".to_string(), command.to_string()])
            }
        }
    }

    fn convert_to_wsl_path(&self, path: &PathBuf) -> String {
        let path_str = path.to_string_lossy();
        // Convert C:\path\to\dir to /mnt/c/path/to/dir
        if path_str.len() >= 2 && path_str.chars().nth(1) == Some(':') {
            let drive = path_str.chars().next().unwrap().to_lowercase().next().unwrap();
            let rest = &path_str[2..].replace('\\', "/");
            format!("/mnt/{}{}", drive, rest)
        } else {
            path_str.to_string()
        }
    }
}

impl Default for TerminalState {
    fn default() -> Self {
        Self::new()
    }
}

pub type SharedTerminalState = Arc<Mutex<TerminalState>>;

pub fn create_terminal_state() -> SharedTerminalState {
    Arc::new(Mutex::new(TerminalState::new()))
}
