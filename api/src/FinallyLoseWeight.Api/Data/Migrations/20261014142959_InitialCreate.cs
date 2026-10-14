using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinallyLoseWeight.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "user_profiles",
                columns: table => new
                {
                    uid = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    display_name = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    height_cm = table.Column<int>(type: "integer", nullable: true),
                    target_weight_kg = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true),
                    daily_kcal_target = table.Column<int>(type: "integer", nullable: true),
                    consent_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    privacy_version = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_user_profiles", x => x.uid);
                });

            migrationBuilder.CreateTable(
                name: "cardio_sessions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    machine = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    duration_min = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: false),
                    avg_speed_kmh = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true),
                    incline_percent = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true),
                    resistance_level = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true),
                    weight_kg_used = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    kcal_gross = table.Column<int>(type: "integer", nullable: false),
                    kcal_net = table.Column<int>(type: "integer", nullable: false),
                    formula_version = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_cardio_sessions", x => x.id);
                    table.ForeignKey(
                        name: "fk_cardio_sessions_user_profiles_user_id",
                        column: x => x.user_id,
                        principalTable: "user_profiles",
                        principalColumn: "uid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "daily_steps",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    steps = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_daily_steps", x => x.id);
                    table.ForeignKey(
                        name: "fk_daily_steps_user_profiles_user_id",
                        column: x => x.user_id,
                        principalTable: "user_profiles",
                        principalColumn: "uid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "meal_entries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    meal_type = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    description = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    kcal = table.Column<int>(type: "integer", nullable: false),
                    protein_g = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: true),
                    carbs_g = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: true),
                    fat_g = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_meal_entries", x => x.id);
                    table.ForeignKey(
                        name: "fk_meal_entries_user_profiles_user_id",
                        column: x => x.user_id,
                        principalTable: "user_profiles",
                        principalColumn: "uid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "weight_entries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    weight_kg = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_weight_entries", x => x.id);
                    table.ForeignKey(
                        name: "fk_weight_entries_user_profiles_user_id",
                        column: x => x.user_id,
                        principalTable: "user_profiles",
                        principalColumn: "uid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_cardio_sessions_user_id_date",
                table: "cardio_sessions",
                columns: new[] { "user_id", "date" });

            migrationBuilder.CreateIndex(
                name: "ix_daily_steps_user_id_date",
                table: "daily_steps",
                columns: new[] { "user_id", "date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_meal_entries_user_id_date",
                table: "meal_entries",
                columns: new[] { "user_id", "date" });

            migrationBuilder.CreateIndex(
                name: "ix_weight_entries_user_id_date",
                table: "weight_entries",
                columns: new[] { "user_id", "date" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "cardio_sessions");

            migrationBuilder.DropTable(
                name: "daily_steps");

            migrationBuilder.DropTable(
                name: "meal_entries");

            migrationBuilder.DropTable(
                name: "weight_entries");

            migrationBuilder.DropTable(
                name: "user_profiles");
        }
    }
}
