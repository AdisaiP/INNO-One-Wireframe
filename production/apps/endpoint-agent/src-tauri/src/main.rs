#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::{env, fs, path::PathBuf, process::Command, thread};
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

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct HardwareTelemetry {
    manufacturer: Option<String>,
    model: Option<String>,
    serial_number: Option<String>,
    processor: Option<String>,
    bios_version: Option<String>,
    operating_system: Option<String>,
    memory_total_gb: Option<f64>,
    memory_slots_used: Option<u32>,
    memory_slots_total: Option<u32>,
}

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct SoftwarePackageTelemetry {
    product_key: Option<String>,
    display_name: String,
    version: Option<String>,
    publisher: Option<String>,
    architecture: Option<String>,
}


#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct StoredMachineCredential {
    device_id: String,
    device_secret: String,
}

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct EnrollmentIdentity {
    hostname: String,
    device_type: String,
    operating_system: Option<String>,
    windows_identity: Option<String>,
    windows_upn: Option<String>,
    agent_version: String,
}




fn credential_path() -> Result<PathBuf, String> {
    let program_data = env::var("PROGRAMDATA")
        .map_err(|error| format!("PROGRAMDATA_UNAVAILABLE: {error}"))?;
    Ok(PathBuf::from(program_data)
        .join("INNO.One")
        .join("agent-credential.bin"))
}

#[tauri::command]
fn save_machine_credential(credential: StoredMachineCredential) -> Result<(), String> {
    if credential.device_id.trim().is_empty() || credential.device_secret.trim().is_empty() {
        return Err("DEVICE_CREDENTIAL_INVALID".into());
    }

    let path = credential_path()?;
    let json = serde_json::to_string(&credential)
        .map_err(|error| format!("DEVICE_CREDENTIAL_SERIALIZE_FAILED: {error}"))?;
    let script = r#"
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$path = $env:INNO_ONE_CREDENTIAL_PATH
$dir = [IO.Path]::GetDirectoryName($path)
[IO.Directory]::CreateDirectory($dir) | Out-Null
$plain = [Text.Encoding]::UTF8.GetBytes($env:INNO_ONE_CREDENTIAL_JSON)
$protected = [Security.Cryptography.ProtectedData]::Protect(
    $plain,
    $null,
    [Security.Cryptography.DataProtectionScope]::LocalMachine)
[IO.File]::WriteAllBytes($path, $protected)
"#;

    let output = Command::new("powershell.exe")
        .args(["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script])
        .env("INNO_ONE_CREDENTIAL_PATH", path.as_os_str())
        .env("INNO_ONE_CREDENTIAL_JSON", json)
        .output()
        .map_err(|error| format!("DEVICE_CREDENTIAL_SAVE_START_FAILED: {error}"))?;

    if !output.status.success() {
        return Err(format!(
            "DEVICE_CREDENTIAL_SAVE_FAILED: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    Ok(())
}

#[tauri::command]
fn load_machine_credential() -> Result<Option<StoredMachineCredential>, String> {
    let path = credential_path()?;
    if !path.exists() {
        return Ok(None);
    }

    let script = r#"
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$protected = [IO.File]::ReadAllBytes($env:INNO_ONE_CREDENTIAL_PATH)
$plain = [Security.Cryptography.ProtectedData]::Unprotect(
    $protected,
    $null,
    [Security.Cryptography.DataProtectionScope]::LocalMachine)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::Write([Text.Encoding]::UTF8.GetString($plain))
"#;
    let output = Command::new("powershell.exe")
        .args(["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script])
        .env("INNO_ONE_CREDENTIAL_PATH", path.as_os_str())
        .output()
        .map_err(|error| format!("DEVICE_CREDENTIAL_LOAD_START_FAILED: {error}"))?;

    if !output.status.success() {
        return Err(format!(
            "DEVICE_CREDENTIAL_LOAD_FAILED: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    let json = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if json.is_empty() {
        return Ok(None);
    }

    serde_json::from_str::<StoredMachineCredential>(&json)
        .map(Some)
        .map_err(|error| format!("DEVICE_CREDENTIAL_PARSE_FAILED: {error}"))
}

#[tauri::command]
fn clear_machine_credential() -> Result<(), String> {
    let path = credential_path()?;
    if path.exists() {
        fs::remove_file(path)
            .map_err(|error| format!("DEVICE_CREDENTIAL_CLEAR_FAILED: {error}"))?;
    }
    Ok(())
}

#[cfg(target_os = "windows")]
#[tauri::command]
fn collect_enrollment_identity() -> Result<EnrollmentIdentity, String> {
    let script = r#"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$os = Get-CimInstance Win32_OperatingSystem | Select-Object -First 1
$enclosure = Get-CimInstance Win32_SystemEnclosure | Select-Object -First 1
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$upn = $null
try {
    $candidate = (& whoami /upn 2>$null | Select-Object -First 1)
    if ($candidate -and $candidate -match '@') { $upn = [string]$candidate.Trim() }
} catch {}
$chassis = @($enclosure.ChassisTypes)
$laptop = @(8,9,10,14,30,31,32) | Where-Object { $chassis -contains $_ }
[pscustomobject]@{
    hostname = [string]$env:COMPUTERNAME
    deviceType = if ($laptop.Count -gt 0) { 'notebook' } else { 'desktop' }
    operatingSystem = if ($os.Caption -and $os.Version) { "$($os.Caption) - $($os.Version)" } else { [string]$os.Caption }
    windowsIdentity = if ($identity) { [string]$identity } else { $null }
    windowsUpn = $upn
    agentVersion = '__AGENT_VERSION__'
} | ConvertTo-Json -Compress
"#.replace("__AGENT_VERSION__", env!("CARGO_PKG_VERSION"));

    let stdout = run_powershell_json(&script, "ENROLLMENT_IDENTITY")?;
    serde_json::from_str::<EnrollmentIdentity>(&stdout)
        .map_err(|error| format!("ENROLLMENT_IDENTITY_PARSE_FAILED: {error}"))
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn collect_enrollment_identity() -> Result<EnrollmentIdentity, String> {
    Ok(EnrollmentIdentity {
        hostname: env::var("HOSTNAME").unwrap_or_else(|_| "unknown".into()),
        device_type: "desktop".into(),
        operating_system: None,
        windows_identity: None,
        windows_upn: None,
        agent_version: env!("CARGO_PKG_VERSION").into(),
    })
}

fn bytes_to_gb(value: u64) -> f64 {
    ((value as f64 / 1024.0 / 1024.0 / 1024.0) * 100.0).round() / 100.0
}

fn run_powershell_json(script: &str, failure_code: &str) -> Result<String, String> {
    let output = Command::new("powershell.exe")
        .args(["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script])
        .output()
        .map_err(|error| format!("{failure_code}_START_FAILED: {error}"))?;

    if !output.status.success() {
        return Err(format!(
            "{failure_code}_FAILED: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
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

    let stdout = run_powershell_json(script, "NETWORK_COLLECTOR")?;
    serde_json::from_str::<NetworkTelemetry>(&stdout)
        .map_err(|error| format!("NETWORK_COLLECTOR_PARSE_FAILED: {error}"))
}

#[cfg(target_os = "windows")]
fn collect_windows_hardware() -> Result<HardwareTelemetry, String> {
    let script = r#"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$computer = Get-CimInstance Win32_ComputerSystem
$bios = Get-CimInstance Win32_BIOS | Select-Object -First 1
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$os = Get-CimInstance Win32_OperatingSystem | Select-Object -First 1
$memory = @(Get-CimInstance Win32_PhysicalMemory)
$arrays = @(Get-CimInstance Win32_PhysicalMemoryArray -ErrorAction SilentlyContinue)
$totalBytes = ($memory | Measure-Object -Property Capacity -Sum).Sum
$totalSlots = ($arrays | Measure-Object -Property MemoryDevices -Sum).Sum
[pscustomobject]@{
    manufacturer = [string]$computer.Manufacturer
    model = [string]$computer.Model
    serialNumber = [string]$bios.SerialNumber
    processor = [string]$cpu.Name
    biosVersion = if ($bios.SMBIOSBIOSVersion) { [string]$bios.SMBIOSBIOSVersion } else { [string]$bios.Version }
    operatingSystem = if ($os.Caption -and $os.Version) { "$($os.Caption) - $($os.Version)" } else { [string]$os.Caption }
    memoryTotalGb = if ($totalBytes) { [Math]::Round(([double]$totalBytes / 1GB), 2) } else { $null }
    memorySlotsUsed = @($memory).Count
    memorySlotsTotal = if ($totalSlots) { [int]$totalSlots } else { $null }
} | ConvertTo-Json -Compress
"#;

    let stdout = run_powershell_json(script, "HARDWARE_COLLECTOR")?;
    serde_json::from_str::<HardwareTelemetry>(&stdout)
        .map_err(|error| format!("HARDWARE_COLLECTOR_PARSE_FAILED: {error}"))
}

#[cfg(target_os = "windows")]
fn collect_windows_software() -> Result<Vec<SoftwarePackageTelemetry>, String> {
    let script = r#"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$roots = @(
    @{ Path = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'; Architecture = 'x64' },
    @{ Path = 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'; Architecture = 'x86' },
    @{ Path = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'; Architecture = 'unknown' }
)
$items = foreach ($root in $roots) {
    Get-ItemProperty -Path $root.Path -ErrorAction SilentlyContinue |
        Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_.DisplayName) } |
        ForEach-Object {
            [pscustomobject]@{
                productKey = ('registry:' + [string]$_.PSChildName + ':' + $root.Architecture)
                displayName = [string]$_.DisplayName
                version = if ($_.DisplayVersion) { [string]$_.DisplayVersion } else { $null }
                publisher = if ($_.Publisher) { [string]$_.Publisher } else { $null }
                architecture = $root.Architecture
            }
        }
}
$deduped = @($items |
    Sort-Object productKey, displayName, version -Unique |
    Select-Object -First 2000)
ConvertTo-Json -InputObject $deduped -Compress -Depth 4
"#;

    let stdout = run_powershell_json(script, "SOFTWARE_COLLECTOR")?;
    if stdout.is_empty() {
        return Ok(Vec::new());
    }

    serde_json::from_str::<Vec<SoftwarePackageTelemetry>>(&stdout)
        .map_err(|error| format!("SOFTWARE_COLLECTOR_PARSE_FAILED: {error}"))
}

#[cfg(not(target_os = "windows"))]
fn collect_windows_network() -> Result<NetworkTelemetry, String> {
    Ok(NetworkTelemetry::default())
}

#[cfg(not(target_os = "windows"))]
fn collect_windows_hardware() -> Result<HardwareTelemetry, String> {
    Ok(HardwareTelemetry::default())
}

#[cfg(not(target_os = "windows"))]
fn collect_windows_software() -> Result<Vec<SoftwarePackageTelemetry>, String> {
    Ok(Vec::new())
}

#[tauri::command]
fn collect_network_telemetry() -> Result<NetworkTelemetry, String> {
    collect_windows_network()
}

#[tauri::command]
fn collect_hardware_telemetry() -> Result<HardwareTelemetry, String> {
    collect_windows_hardware()
}

#[tauri::command]
fn collect_software_inventory() -> Result<Vec<SoftwarePackageTelemetry>, String> {
    collect_windows_software()
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            collect_performance_telemetry,
            collect_network_telemetry,
            collect_hardware_telemetry,
            collect_software_inventory,
            collect_enrollment_identity,
            save_machine_credential,
            load_machine_credential,
            clear_machine_credential
        ])
        .run(tauri::generate_context!())
        .expect("error while running INNO.One Endpoint Agent");
}
