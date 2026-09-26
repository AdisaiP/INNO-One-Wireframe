namespace INNO.One.Integrations.MeshCentral;

public sealed class MeshCentralOptions
{
    public const string SectionName = "MeshCentral";

    public bool Enabled { get; set; }
    public string BaseUrl { get; set; } = "wss://localhost:8443";
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public bool AllowInvalidTls { get; set; }
    public int CommandTimeoutSeconds { get; set; } = 10;
    public int SyncIntervalSeconds { get; set; } = 15;
}
