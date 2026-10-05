using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace INNO.One.Modules.Platform.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Step45NBilingualNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "title",
                schema: "platform",
                table: "notifications",
                newName: "title_en");

            migrationBuilder.RenameColumn(
                name: "message",
                schema: "platform",
                table: "notifications",
                newName: "message_en");

            migrationBuilder.AddColumn<string>(
                name: "message_th",
                schema: "platform",
                table: "notifications",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "title_th",
                schema: "platform",
                table: "notifications",
                type: "character varying(240)",
                maxLength: 240,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "message_th",
                schema: "platform",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "title_th",
                schema: "platform",
                table: "notifications");

            migrationBuilder.RenameColumn(
                name: "title_en",
                schema: "platform",
                table: "notifications",
                newName: "title");

            migrationBuilder.RenameColumn(
                name: "message_en",
                schema: "platform",
                table: "notifications",
                newName: "message");
        }
    }
}
