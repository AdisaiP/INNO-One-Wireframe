#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::{process::Command, thread};
use sysinfo::{Disks, System};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PerformanceTelemetry {
    cpu_percent: Option<u32>,
    memory_used_gb: Option<f64>,
    memory_total_gb: Option<f64>,
    disk_used_gb: Option<f64>,
    disk_total_gb: Option<f64>,
}

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct NetworkTelemetry {
    ip_address: Option<String>,
    mac_address: Option<String>,
    subnet_mask: Option<String>,
    gateway: Option<String>,
    #[serde(default)]
    dns_servers: Vec<String>,
    adapter_name: Option<String>,
}

fn bytes_to_gb(value: u64) -> f64 {
    ((value as f64 / 1024.0 / 1024.0 / 1024.0) * 100.0).round() / 100.0
}

#[tauri::command]
fn collect_performance_telemetry() -> PerformanceTelemetry {
    let mut system = System::new_all();
    thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL);
    system.refresh_cpu_usage();
    system.refresh_memory();

    let disks = Disks::new_with_refreshed_list();
    let disk_total = disks.iter().map(|disk| disk.total_space()).sum::<u64>();
    let disk_available = disks
        .iter()
        .map(|disk| disk.available_space())
        .sum::<u64>();

    PerformanceTelemetry {
        cpu_percent: Some(system.global_cpu_usage().round().clamp(0.0, 100.0) as u32),
        memory_used_gb: Some(bytes_to_gb(system.used_memory())),
        memory_total_gb: Some(bytes_to_gb(system.total_memory())),
        disk_used_gb: (disk_total > 0).then(|| bytes_to_gb(disk_total.saturating_sub(disk_available))),
        disk_total_gb: (disk_total > 0).then(|| bytes_to_gb(disk_total)),
    }
}

#[cfg(target_os = "windows")]
fn collect_windows_network() -> Result<NetworkTelemetry, String> {
    let script = r#"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$cfg = Get-NetIPConfiguration |
    Where-Object { $_.NetAdapter.Status -eq 'Up' -and $_.IPv4Address -ne $null } |
    Sort-Object InterfaceMetric |
    Select-Object -First 1
if ($null -eq $cfg) {
    [pscustomobject]@{
        ipAddress = $null
        macAddress = $null
        subnetMask = $null
        gateway = $null
        dnsServers = @()
        adapterName = $null
    } | ConvertTo-Json -Compress
    exit 0
}
$adapter = Get-NetAdapter -InterfaceIndex $cfg.InterfaceIndex -ErrorAction SilentlyContinue
$dns = @(Get-DnsClientServerAddress -InterfaceIndex $cfg.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue).ServerAddresses
$prefix = [int]$cfg.IPv4Address.PrefixLength
$bits = ('1' * $prefix).PadRight(32, '0')
$mask = (0..3 | ForEach-Object { [Convert]::ToInt32($bits.Substring($_ * 8, 8), 2) }) -join '.'
[pscustomobject]@{
    ipAddress = [string]$cfg.IPv4Address.IPAddress
    macAddress = if ($adapter) { [string]$adapter.MacAddress } else { $null }
    subnetMask = $mask
    gateway = if ($cfg.IPv4DefaultGateway) { [string]$cfg.IPv4DefaultGateway.NextHop } else { $null }
    dnsServers = @($dns)
    adapterName = if ($adapter) { [string]$adapter.InterfaceDescription } else { [string]$cfg.InterfaceAlias }
} | ConvertTo-Json -Compress
"#;

    let output = Command::new("powershell.exe")
        .args(["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script])
        .output()
        .map_err(|error| format!("NETWORK_COLLECTOR_START_FAILED: {error}"))?;

    if !output.status.success() {
        return Err(format!(
            "NETWORK_COLLECTOR_FAILED: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str::<NetworkTelemetry>(stdout.trim())
        .map_err(|error| format!("NETWORK_COLLECTOR_PARSE_FAILED: {error}"))
}

#[cfg(not(target_os = "windows"))]
fn collect_windows_network() -> Result<NetworkTelemetry, String> {
    Ok(NetworkTelemetry::default())
}

#[tauri::command]
fn collect_network_telemetry() -> Result<NetworkTelemetry, String> {
    collect_windows_network()
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            collect_performance_telemetry,
            collect_network_telemetry
        ])
        .run(tauri::generate_context!())
        .expect("error while running INNO.One Endpoint Agent");
}
