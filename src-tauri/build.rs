fn main() {
  if let Ok(path) = dotenvy::from_path_iter("../.env") {
      for item in path {
          if let Ok((key, value)) = item {
              println!("cargo:rustc-env={}={}", key, value);
          }
      }
  }
  
  // Also tell cargo to re-run if .env changes
  println!("cargo:rerun-if-changed=../.env");
  
  tauri_build::build()
}
