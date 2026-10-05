using System.Security.Claims;
using System.Text.Json;
using INNO.One.Contracts.Assets;
using INNO.One.Contracts.Automation;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Helpdesk;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Assets.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Assets.Infrastructure;

public sealed class AssetsAutomationNodeExecutor(
    AssetsDbContext db,
    IAccessEvaluator accessEvaluator,
    IAssetsAutomationContextReader contextReader,
    IHelpdeskAutomationTicketCreator ticketCreator,
    AssetsLedgerWriter ledger) : IAutomationNodeExecutor
{
    private const string SetLifecycleCatalog = "assets.asset.set_lifecycle_status";
    private const string CreateTicketCatalog = "helpdesk.ticket.create";
    private static readonly HashSet<string> LifecycleStatuses =
    [
        "in_use",
        "stock",
        "repair",
        "retired"
    ];

    public string OwnerModule => "assets";

    public bool Supports(string catalogKey) =>
        catalogKey is SetLifecycleCatalog or CreateTicketCatalog;

    public AutomationNodeValidationResult Validate(
        string catalogKey,
        JsonElement configuration)
    {
        if (catalogKey == SetLifecycleCatalog)
        {
            if (!TryString(configuration, "status", out var status)
                || !LifecycleStatuses.Contains(status))
            {
                return AutomationNodeValidationResult.Failure(
                    "ASSETS_LIFECYCLE_STATUS_REQUIRED",
                    "Update Lifecycle requires in_use, stock, repair or retired.");
            }

            return AutomationNodeValidationResult.Success();
        }

        if (catalogKey == CreateTicketCatalog)
        {
            if (!TryString(configuration, "subject", out var subject)
                || subject.Length > 240)
            {
                return AutomationNodeValidationResult.Failure(
                    "ASSETS_HELPDESK_SUBJECT_REQUIRED",
                    "Create Helpdesk Ticket requires a subject up to 240 characters.");
            }

            if (!TryString(configuration, "description", out var description)
                || description.Length > 12000)
            {
                return AutomationNodeValidationResult.Failure(
                    "ASSETS_HELPDESK_DESCRIPTION_REQUIRED",
                    "Create Helpdesk Ticket requires a description up to 12000 characters.");
            }

            if (!TryString(configuration, "priority", out var priority)
                || priority.ToUpperInvariant() is not ("P1" or "P2" or "P3" or "P4"))
            {
                return AutomationNodeValidationResult.Failure(
                    "ASSETS_HELPDESK_PRIORITY_REQUIRED",
                    "Create Helpdesk Ticket requires priority P1, P2, P3 or P4.");
            }

            return AutomationNodeValidationResult.Success();
        }

        return AutomationNodeValidationResult.Failure(
            "ASSETS_ACTION_NOT_SUPPORTED",
            "This Assets automation action is not supported.");
    }

    public async Task<AutomationNodeExecutionResult> ExecuteAsync(
        AutomationNodeExecutionContext context,
        CancellationToken cancellationToken = default)
    {
        return context.CatalogKey switch
        {
            SetLifecycleCatalog => await SetLifecycleAsync(context, cancellationToken),
            CreateTicketCatalog => await CreateTicketAsync(context, cancellationToken),
            _ => AutomationNodeExecutionResult.Failure(
                "ASSETS_ACTION_NOT_SUPPORTED",
                "The requested Assets automation action is not supported.")
        };
    }

    private async Task<AutomationNodeExecutionResult> SetLifecycleAsync(
        AutomationNodeExecutionContext context,
        CancellationToken cancellationToken)
    {
        if (!TryInputId(context.Input, "assetId", "asset", out var assetPublicId, out var assetId))
        {
            return AutomationNodeExecutionResult.Failure(
                "ASSETS_ASSET_CONTEXT_REQUIRED",
                "Update Lifecycle requires an Asset context.");
        }

        if (!TryString(context.Configuration, "status", out var targetStatus)
            || !LifecycleStatuses.Contains(targetStatus))
        {
            return AutomationNodeExecutionResult.Failure(
                "ASSETS_LIFECYCLE_STATUS_REQUIRED",
                "A supported target lifecycle status is required.");
        }

        var access = await EvaluateAsync(
            context,
            "assets.manage",
            cancellationToken);
        if (!access.Allowed)
        {
            return AutomationNodeExecutionResult.Failure(
                "ASSETS_MANAGE_PERMISSION_DENIED",
                "The automation actor does not currently have Assets management permission.");
        }

        if (!await contextReader.CanAccessAssetAsync(
                assetId,
                access,
                cancellationToken))
        {
            return AutomationNodeExecutionResult.Failure(
                "ASSETS_OUTSIDE_ASSIGNED_SCOPE",
                "The Asset is outside the automation actor's current scope.");
        }

        var asset = await db.Assets.SingleOrDefaultAsync(
            x => x.Id == assetId,
            cancellationToken);
        if (asset is null)
        {
            return AutomationNodeExecutionResult.Failure(
                "ASSETS_ASSET_NOT_FOUND",
                "The Asset no longer exists.");
        }

        if (string.Equals(
                asset.LifecycleStatus,
                targetStatus,
                StringComparison.OrdinalIgnoreCase))
        {
            return AutomationNodeExecutionResult.Success(Output(new
            {
                assetId = assetPublicId,
                lifecycleStatus = asset.LifecycleStatus,
                idempotentReplay = true
            }));
        }

        var previousStatus = asset.LifecycleStatus;
        var now = DateTimeOffset.UtcNow;

        await using var transaction = await db.Database.BeginTransactionAsync(
            cancellationToken);
        asset.LifecycleStatus = targetStatus;
        asset.Version++;
        asset.UpdatedAt = now;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            await transaction.RollbackAsync(cancellationToken);
            return AutomationNodeExecutionResult.Failure(
                "ASSETS_LIFECYCLE_WRITE_FAILED",
                "The Asset lifecycle state could not be persisted.",
                retryable: true);
        }

        var actorId = OpaqueId.Format("user", context.ActorUserId);
        var runId = OpaqueId.Format("run", context.RunId);

        await ledger.AppendAuditAsync(
            "assets.automation.lifecycle_updated",
            "asset",
            assetPublicId,
            actorId,
            context.CorrelationId,
            context.TraceId,
            new
            {
                automationRunId = runId,
                workflowId = OpaqueId.Format("wf", context.WorkflowId),
                context.WorkflowVersion,
                context.NodeId,
                previousStatus,
                lifecycleStatus = targetStatus
            },
            cancellationToken,
            classification: "internal");

        await ledger.AppendOutboxAsync(
            "asset.changed",
            "asset",
            assetPublicId,
            new
            {
                assetId = assetPublicId,
                changeType = "lifecycle_automation",
                previousStatus,
                lifecycleStatus = targetStatus,
                automationRunId = runId,
                occurredAt = now
            },
            context.CorrelationId,
            runId,
            context.TraceId,
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);
        return AutomationNodeExecutionResult.Success(Output(new
        {
            assetId = assetPublicId,
            previousStatus,
            lifecycleStatus = targetStatus,
            idempotentReplay = false
        }));
    }

    private async Task<AutomationNodeExecutionResult> CreateTicketAsync(
        AutomationNodeExecutionContext context,
        CancellationToken cancellationToken)
    {
        if (!TryString(context.Configuration, "subject", out var subjectTemplate)
            || !TryString(context.Configuration, "description", out var descriptionTemplate)
            || !TryString(context.Configuration, "priority", out var priority))
        {
            return AutomationNodeExecutionResult.Failure(
                "ASSETS_HELPDESK_CONFIGURATION_REQUIRED",
                "Create Helpdesk Ticket requires subject, description and priority.");
        }

        string subject;
        string description;
        Guid? relatedAssetId = null;

        if (TryInputId(
                context.Input,
                "assetId",
                "asset",
                out var assetPublicId,
                out var assetId))
        {
            var access = await EvaluateAsync(
                context,
                "assets.view",
                cancellationToken);
            if (!access.Allowed
                || !await contextReader.CanAccessAssetAsync(
                    assetId,
                    access,
                    cancellationToken))
            {
                return AutomationNodeExecutionResult.Failure(
                    "ASSETS_OUTSIDE_ASSIGNED_SCOPE",
                    "The Asset is outside the automation actor's current scope.");
            }

            var asset = await contextReader.ReadAssetAsync(
                assetId,
                cancellationToken);
            if (asset is null)
            {
                return AutomationNodeExecutionResult.Failure(
                    "ASSETS_ASSET_NOT_FOUND",
                    "The Asset no longer exists.");
            }

            relatedAssetId = assetId;
            subject = ExpandAssetTemplate(subjectTemplate, asset);
            description = ExpandAssetTemplate(descriptionTemplate, asset);
        }
        else if (TryInputId(
                     context.Input,
                     "licenseId",
                     "license",
                     out var licensePublicId,
                     out var licenseId))
        {
            var access = await EvaluateAsync(
                context,
                "assets.license.manage",
                cancellationToken);
            if (!access.Allowed)
            {
                return AutomationNodeExecutionResult.Failure(
                    "ASSETS_LICENSE_PERMISSION_DENIED",
                    "The automation actor does not currently have software license management permission.");
            }

            var license = await contextReader.ReadLicenseAsync(
                licenseId,
                cancellationToken);
            if (license is null)
            {
                return AutomationNodeExecutionResult.Failure(
                    "ASSETS_LICENSE_NOT_FOUND",
                    "The software license no longer exists.");
            }

            subject = ExpandLicenseTemplate(subjectTemplate, license);
            description = ExpandLicenseTemplate(descriptionTemplate, license);
        }
        else
        {
            return AutomationNodeExecutionResult.Failure(
                "ASSETS_RESOURCE_CONTEXT_REQUIRED",
                "Create Helpdesk Ticket requires an Asset or Software License context.");
        }

        var idempotencyKey =
            OpaqueId.Format("run", context.RunId) + ":node:" + context.NodeId;
        var result = await ticketCreator.CreateAsync(
            new HelpdeskAutomationTicketRequest(
                context.ActorUserId,
                context.ActorSubject,
                relatedAssetId,
                subject,
                description,
                priority.ToUpperInvariant(),
                idempotencyKey,
                context.CorrelationId,
                context.TraceId),
            cancellationToken);

        return result.Succeeded
            ? AutomationNodeExecutionResult.Success(Output(new
            {
                result.TicketId,
                result.TicketNumber,
                result.IdempotentReplay
            }))
            : AutomationNodeExecutionResult.Failure(
                result.ErrorCode ?? "HELPDESK_AUTOMATION_CREATE_FAILED",
                result.ErrorDetail,
                result.Retryable);
    }

    private async Task<EffectiveAccess> EvaluateAsync(
        AutomationNodeExecutionContext context,
        string permission,
        CancellationToken cancellationToken)
    {
        var principal = new ClaimsPrincipal(
            new ClaimsIdentity(
                [new Claim("sub", context.ActorSubject)],
                "automation-worker"));
        var access = await accessEvaluator.EvaluateAsync(
            principal,
            permission,
            cancellationToken);

        return access.UserId == context.ActorUserId
            ? access
            : access with { Allowed = false };
    }

    private static string ExpandAssetTemplate(
        string template,
        AssetAutomationAssetContext asset) =>
        template
            .Replace("{assetId}", OpaqueId.Format("asset", asset.Id), StringComparison.Ordinal)
            .Replace("{assetTag}", asset.AssetTag, StringComparison.Ordinal)
            .Replace("{assetName}", asset.Name, StringComparison.Ordinal)
            .Replace("{category}", asset.Category, StringComparison.Ordinal)
            .Replace("{lifecycleStatus}", asset.LifecycleStatus, StringComparison.Ordinal);

    private static string ExpandLicenseTemplate(
        string template,
        AssetAutomationLicenseContext license) =>
        template
            .Replace("{licenseId}", OpaqueId.Format("license", license.Id), StringComparison.Ordinal)
            .Replace("{licenseProduct}", license.ProductName, StringComparison.Ordinal)
            .Replace("{vendor}", license.Vendor, StringComparison.Ordinal)
            .Replace("{usedSeats}", license.UsedSeats.ToString(), StringComparison.Ordinal)
            .Replace("{entitledSeats}", license.EntitledSeats.ToString(), StringComparison.Ordinal);

    private static bool TryInputId(
        JsonElement input,
        string property,
        string prefix,
        out string publicId,
        out Guid id)
    {
        publicId = "";
        id = Guid.Empty;
        return TryString(input, property, out publicId)
            && OpaqueId.TryParse(publicId, prefix, out id);
    }

    private static bool TryString(
        JsonElement element,
        string property,
        out string value)
    {
        value = "";
        if (element.ValueKind != JsonValueKind.Object
            || !element.TryGetProperty(property, out var candidate)
            || candidate.ValueKind != JsonValueKind.String)
        {
            return false;
        }

        value = candidate.GetString()?.Trim() ?? "";
        return value.Length > 0;
    }

    private static JsonElement Output(object value) =>
        JsonSerializer.SerializeToElement(value);
}
