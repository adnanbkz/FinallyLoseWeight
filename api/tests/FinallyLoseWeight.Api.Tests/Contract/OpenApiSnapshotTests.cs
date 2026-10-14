using System.Reflection;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using FinallyLoseWeight.Api.Auth;
using FinallyLoseWeight.Api.Common;
using FinallyLoseWeight.Api.Tests.Infrastructure;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.OpenApi;
using Xunit.Sdk;

namespace FinallyLoseWeight.Api.Tests.Contract;

/// <summary>
/// docs/openapi.json is the machine-readable twin of docs/API.md: generated from the API, committed, and read by
/// the web tests (web/src/api/contract.test.ts) to check web/src/api/types.ts. This test fails whenever the API
/// shapes change without regenerating it, so a change on one side only cannot leave CI green.
/// <para>Regenerate after an intended change: <c>FLW_UPDATE_OPENAPI=1 dotnet test api/FinallyLoseWeight.slnx --filter OpenApiSnapshotTests</c>
/// (then update web/src/api/types.ts and docs/API.md).</para>
/// </summary>
public class OpenApiSnapshotTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    public const string UpdateVariable = "FLW_UPDATE_OPENAPI";
    private const string SnapshotPath = "docs/openapi.json";

    private static readonly JsonSerializerOptions SnapshotFormat = new()
    {
        WriteIndented = true,
        NewLine = "\n",
        // Keep "Resúmenes", "`code`"… readable in the committed file.
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    [Fact]
    public async Task Committed_openapi_snapshot_matches_the_api()
    {
        var generated = await GenerateSnapshotAsync();
        var path = Path.Combine(FindRepositoryRoot(), SnapshotPath);

        if (Environment.GetEnvironmentVariable(UpdateVariable) == "1")
        {
            await File.WriteAllTextAsync(path, generated);
            return;
        }

        Assert.True(File.Exists(path), $"{SnapshotPath} is missing. {HowToUpdate}");
        var committed = (await File.ReadAllTextAsync(path)).ReplaceLineEndings("\n");
        if (committed != generated)
        {
            throw new XunitException(
                $"{SnapshotPath} does not match the API ({FirstDifference(committed, generated)}). {HowToUpdate}");
        }
    }

    [Fact]
    public async Task Snapshot_publishes_every_problem_code()
    {
        var document = JsonNode.Parse(await GenerateSnapshotAsync())!;
        var published = document["components"]!["schemas"]![OpenApiSetup.ProblemCodeSchema]!["enum"]!
            .AsArray().Select(code => code!.GetValue<string>());

        Assert.Equal(ProblemCodes.All, published);
    }

    [Fact]
    public void ProblemCodes_All_lists_every_code_constant()
    {
        var constants = typeof(ProblemCodes)
            .GetFields(BindingFlags.Public | BindingFlags.Static)
            .Where(field => field.IsLiteral && field.Name != nameof(ProblemCodes.ExtensionName))
            .Select(field => (string)field.GetRawConstantValue()!);

        Assert.Equal(constants.Order(), ProblemCodes.All.Order());
        Assert.Equal(ProblemCodes.All.Count, ProblemCodes.All.Distinct().Count());
    }

    private static string HowToUpdate =>
        $"If the change is intended, run '{UpdateVariable}=1 dotnet test api/FinallyLoseWeight.slnx --filter OpenApiSnapshotTests', " +
        "commit docs/openapi.json and update web/src/api/types.ts and docs/API.md.";

    /// <summary>The OpenAPI document as committed: without <c>servers</c> (it depends on the host), indented, LF.</summary>
    private async Task<string> GenerateSnapshotAsync()
    {
        var provider = api.Services.GetRequiredKeyedService<IOpenApiDocumentProvider>(OpenApiSetup.DocumentName);
        var document = await provider.GetOpenApiDocumentAsync();
        var json = JsonNode.Parse(await document.SerializeAsJsonAsync(OpenApiSpecVersion.OpenApi3_1))!.AsObject();
        json.Remove("servers");
        return json.ToJsonString(SnapshotFormat) + "\n";
    }

    private static string FirstDifference(string committed, string generated)
    {
        var expected = committed.Split('\n');
        var actual = generated.Split('\n');
        for (var i = 0; i < Math.Max(expected.Length, actual.Length); i++)
        {
            var left = i < expected.Length ? expected[i] : "<end of file>";
            var right = i < actual.Length ? actual[i] : "<end of file>";
            if (left != right)
            {
                return $"first difference at line {i + 1}: committed '{left.Trim()}', generated '{right.Trim()}'";
            }
        }

        return "same lines, different content";
    }

    private static string FindRepositoryRoot()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            if (File.Exists(Path.Combine(directory.FullName, "docs", "API.md")) &&
                Directory.Exists(Path.Combine(directory.FullName, "api")))
            {
                return directory.FullName;
            }
        }

        throw new InvalidOperationException($"Repository root (with docs/API.md) not found above {AppContext.BaseDirectory}.");
    }
}
