using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace INNO.One.Modules.Assets.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Step21AssetQr : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "qr_labels",
                schema: "assets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    asset_id = table.Column<Guid>(type: "uuid", nullable: false),
                    token_fingerprint = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    status = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    revoked_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    last_printed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_qr_labels", x => x.id);
                    table.ForeignKey(
                        name: "fk_qr_labels_assets_asset_id",
                        column: x => x.asset_id,
                        principalSchema: "assets",
                        principalTable: "assets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "qr_scans",
                schema: "assets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    asset_id = table.Column<Guid>(type: "uuid", nullable: false),
                    label_id = table.Column<Guid>(type: "uuid", nullable: false),
                    scanner_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    scanned_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    outcome = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_qr_scans", x => x.id);
                    table.ForeignKey(
                        name: "fk_qr_scans_assets_asset_id",
                        column: x => x.asset_id,
                        principalSchema: "assets",
                        principalTable: "assets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_qr_scans_qr_labels_label_id",
                        column: x => x.label_id,
                        principalSchema: "assets",
                        principalTable: "qr_labels",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_qr_labels_asset_id_status",
                schema: "assets",
                table: "qr_labels",
                columns: new[] { "asset_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_qr_labels_token_fingerprint",
                schema: "assets",
                table: "qr_labels",
                column: "token_fingerprint",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_qr_scans_asset_id_scanned_at",
                schema: "assets",
                table: "qr_scans",
                columns: new[] { "asset_id", "scanned_at" });

            migrationBuilder.CreateIndex(
                name: "ix_qr_scans_label_id",
                schema: "assets",
                table: "qr_scans",
                column: "label_id");

            migrationBuilder.CreateIndex(
                name: "ix_qr_scans_scanner_user_id_scanned_at",
                schema: "assets",
                table: "qr_scans",
                columns: new[] { "scanner_user_id", "scanned_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "qr_scans",
                schema: "assets");

            migrationBuilder.DropTable(
                name: "qr_labels",
                schema: "assets");
        }
    }
}
