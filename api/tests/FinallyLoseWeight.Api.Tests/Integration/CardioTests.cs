using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;
using FinallyLoseWeight.Api.Tests.Infrastructure;

namespace FinallyLoseWeight.Api.Tests.Integration;

/// <summary>docs/API.md, "Cardio": catalog, estimate, weight resolution, CRUD with server-side recalculation.</summary>
public class CardioTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    private const string October = "from=2026-10-01&to=2026-10-31";

    private static async Task<EstimateDto> EstimateAsync(HttpClient client, JsonObject body) =>
        (await (await client.PostJsonAsync("/api/cardio/estimate", body)).ReadJsonAsync()).As<EstimateDto>();

    private static async Task<CardioDto> CreateAsync(HttpClient client, JsonObject body) =>
        (await (await client.PostJsonAsync("/api/cardio", body)).ReadJsonAsync(HttpStatusCode.Created)).As<CardioDto>();

    private static async Task PutWeightAsync(HttpClient client, string date, decimal weightKg) =>
        await (await client.PutJsonAsync($"/api/weights/{date}", Bodies.Weight(weightKg))).ReadJsonAsync();

    [Fact]
    public async Task Machine_catalog_matches_the_contract()
    {
        var client = api.CreateClientFor(TestUser.Alice());

        var json = await client.GetOkAsync<JsonElement>("/api/cardio/machines");

        var machine = Assert.Single(json.EnumerateArray());
        machine.ShouldHaveExactly(ContractShapes.Machine);
        foreach (var field in machine.GetProperty("fields").EnumerateArray())
        {
            field.ShouldHaveExactly(ContractShapes.MachineField);
        }

        var dto = machine.As<MachineDto>();
        Assert.Equal(("incline-treadmill", "Cinta inclinada"), (dto.Id, dto.Name));
        Assert.Equal(
        [
            new MachineFieldDto("inclinePercent", "Pendiente", "%", 0m, 40m, 0.5m, true),
            new MachineFieldDto("durationMin", "Tiempo", "min", 1m, 600m, 1m, true),
            new MachineFieldDto("avgSpeedKmh", "Velocidad media", "km/h", 0.5m, 25m, 0.1m, true),
        ], dto.Fields);
    }

    [Fact]
    public async Task Estimate_with_a_provided_weight_returns_the_contract_example()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        var json = await (await client.PostJsonAsync("/api/cardio/estimate", Bodies.Cardio(weightKg: 70m))).ReadJsonAsync();

        json.ShouldHaveExactly(ContractShapes.Estimate);
        Assert.Equal(new EstimateDto(302, 265, 70m, "provided", "acsm-walking", "acsm-v1"), json.As<EstimateDto>());
    }

    [Fact]
    public async Task Estimate_does_not_store_anything()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        await EstimateAsync(client, Bodies.Cardio());

        Assert.Empty(await client.GetOkAsync<List<CardioDto>>($"/api/cardio?{October}"));
    }

    [Fact]
    public async Task Estimate_uses_the_weight_entry_when_none_is_provided()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        await PutWeightAsync(client, "2026-10-14", 70m);

        var estimate = await EstimateAsync(client, Bodies.Cardio(date: "2026-10-14", weightKg: null));

        Assert.Equal(new EstimateDto(302, 265, 70m, "entry", "acsm-walking", "acsm-v1"), estimate);
    }

    [Fact]
    public async Task Provided_weight_wins_over_the_entry()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        await PutWeightAsync(client, "2026-10-14", 90m);

        var estimate = await EstimateAsync(client, Bodies.Cardio(date: "2026-10-14", weightKg: 70m));

        Assert.Equal((302, 265, 70m, "provided"), (estimate.KcalGross, estimate.KcalNet, estimate.WeightKgUsed, estimate.WeightSource));
    }

    [Theory]
    [InlineData("2026-10-05", 80)] // an entry on the same date counts (≤)
    [InlineData("2026-10-10", 80)] // the latest one on or before the date...
    [InlineData("2026-10-14", 80)] // ...never the later one (60 kg on 2026-10-15)
    [InlineData("2026-10-15", 60)]
    [InlineData("2027-03-01", 60)]
    [InlineData("2026-10-03", 85)]
    [InlineData("2026-09-30", 90)]
    public async Task Weight_used_is_the_latest_entry_on_or_before_the_date(string date, int expectedKg)
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        await PutWeightAsync(client, "2026-10-15", 60m);
        await PutWeightAsync(client, "2026-09-20", 90m);
        await PutWeightAsync(client, "2026-10-05", 80m);
        await PutWeightAsync(client, "2026-10-01", 85m);

        var estimate = await EstimateAsync(client, Bodies.Cardio(date: date, weightKg: null));

        Assert.Equal((decimal)expectedKg, estimate.WeightKgUsed);
        Assert.Equal("entry", estimate.WeightSource);
    }

    [Fact]
    public async Task Only_later_weights_is_422_weight_required()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        await PutWeightAsync(client, "2026-10-15", 60m);

        var response = await client.PostJsonAsync("/api/cardio/estimate", Bodies.Cardio(date: "2026-10-14", weightKg: null));

        await response.ShouldBeProblemAsync(HttpStatusCode.UnprocessableEntity, "weight_required");
    }

    [Theory]
    [InlineData("/api/cardio/estimate")]
    [InlineData("/api/cardio")]
    public async Task No_weight_at_all_is_422_weight_required_and_stores_nothing(string url)
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        var response = await client.PostJsonAsync(url, Bodies.Cardio(weightKg: null).With("weightKg", null));

        await response.ShouldBeProblemAsync(HttpStatusCode.UnprocessableEntity, "weight_required");
        Assert.Empty(await client.GetOkAsync<List<CardioDto>>($"/api/cardio?{October}"));
    }

    [Theory]
    [InlineData("6.9", "0", "30", "70", 158, 121, "acsm-walking")]
    [InlineData("7", "0", "30", "70", 282, 245, "acsm-running")]
    [InlineData("10", "5", "20", "80", 355, 327, "acsm-running")]
    [InlineData("6", "0", "1", "50", 3, 3, "acsm-walking")] // net 2.5 rounds away from zero
    [InlineData("4.8", "12", "60", "70", 604, 531, "acsm-walking")]
    public async Task Estimate_applies_the_acsm_v1_formula(
        string speed, string incline, string minutes, string weightKg, int gross, int net, string formula)
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        var body = Bodies.Cardio()
            .With("avgSpeedKmh", speed)
            .With("inclinePercent", incline)
            .With("durationMin", minutes)
            .With("weightKg", weightKg);

        var estimate = await EstimateAsync(client, body);

        Assert.Equal((gross, net, formula, "acsm-v1"), (estimate.KcalGross, estimate.KcalNet, estimate.Formula, estimate.FormulaVersion));
    }

    public static TheoryData<string, string?> InvalidBodies => new()
    {
        { "machine", null },
        { "machine", "\"elliptical\"" },
        { "machine", "\"\"" },
        { "date", null },
        { "date", "\"2026-13-01\"" },
        { "durationMin", null },
        { "durationMin", "null" },
        { "durationMin", "0" },
        { "durationMin", "601" },
        { "avgSpeedKmh", null },
        { "avgSpeedKmh", "0.4" },
        { "avgSpeedKmh", "25.1" },
        { "inclinePercent", null },
        { "inclinePercent", "-0.5" },
        { "inclinePercent", "40.5" },
        { "weightKg", "19.9" },
        { "weightKg", "400.1" },
        { "note", Bodies.JsonString(201) },
    };

    [Theory]
    [MemberData(nameof(InvalidBodies))]
    public async Task Invalid_estimate_is_400_on_that_field(string field, string? value)
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        var response = await client.PostJsonAsync("/api/cardio/estimate", Bodies.Cardio().With(field, value));

        await response.ShouldBeValidationProblemAsync(field);
    }

    [Theory]
    [MemberData(nameof(InvalidBodies))]
    public async Task Invalid_session_is_400_on_that_field_and_stores_nothing(string field, string? value)
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        var response = await client.PostJsonAsync("/api/cardio", Bodies.Cardio().With(field, value));

        await response.ShouldBeValidationProblemAsync(field);
        Assert.Empty(await client.GetOkAsync<List<CardioDto>>("/api/cardio?from=2026-01-01&to=2026-12-31"));
    }

    [Theory]
    [InlineData("durationMin", "1")]
    [InlineData("durationMin", "600")]
    [InlineData("avgSpeedKmh", "0.5")]
    [InlineData("avgSpeedKmh", "25")]
    [InlineData("inclinePercent", "0")]
    [InlineData("inclinePercent", "40")]
    [InlineData("weightKg", "20")]
    [InlineData("weightKg", "400")]
    public async Task Boundary_values_are_accepted(string field, string value)
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        var response = await client.PostJsonAsync("/api/cardio/estimate", Bodies.Cardio().With(field, value));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Post_returns_201_with_location_and_the_documented_shape()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        await PutWeightAsync(client, "2026-10-13", 70m);

        var response = await client.PostJsonAsync("/api/cardio", Bodies.Cardio(date: "2026-10-14", weightKg: null, note: "cinta"));
        var json = await response.ReadJsonAsync(HttpStatusCode.Created);

        json.ShouldHaveExactly(ContractShapes.Cardio);
        json.GetProperty("createdAt").ShouldBeUtcInstant();
        var cardio = json.As<CardioDto>();
        Assert.Equal(7, cardio.Id.Version);
        Assert.Equal(
            new CardioDto(cardio.Id, "2026-10-14", "incline-treadmill", "Cinta inclinada", 30m, 4.8m, 12m, null,
                70m, 302, 265, "acsm-v1", "cinta", cardio.CreatedAt),
            cardio);
        Assert.NotNull(response.Headers.Location);
        Assert.EndsWith($"/api/cardio/{cardio.Id}", response.Headers.Location.ToString(), StringComparison.OrdinalIgnoreCase);
        Assert.Equal([cardio], await client.GetOkAsync<List<CardioDto>>($"/api/cardio?{October}"));
    }

    [Fact]
    public async Task Server_recalculates_and_ignores_kcal_sent_by_the_client()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        var body = Bodies.Cardio(weightKg: 70m);
        body["kcalGross"] = 9999;
        body["kcalNet"] = 9999;
        body["weightKgUsed"] = 1;
        body["formulaVersion"] = "evil";
        body["machineName"] = "Otra";

        var created = await CreateAsync(client, body);
        var estimate = await EstimateAsync(client, body);

        Assert.Equal((302, 265, 70m, "acsm-v1", "Cinta inclinada"),
            (created.KcalGross, created.KcalNet, created.WeightKgUsed, created.FormulaVersion, created.MachineName));
        Assert.Equal((302, 265), (estimate.KcalGross, estimate.KcalNet));
    }

    [Theory]
    [InlineData("8")]
    [InlineData("-5")] // not validated either: the machine does not use it
    public async Task Fields_the_machine_does_not_use_are_ignored_and_stored_as_null(string resistanceLevel)
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        var created = await CreateAsync(client, Bodies.Cardio().With("resistanceLevel", resistanceLevel));

        Assert.Null(created.ResistanceLevel);
        Assert.Equal((302, 265), (created.KcalGross, created.KcalNet));
    }

    [Fact]
    public async Task Put_recalculates_with_the_new_parameters_and_weight()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        await PutWeightAsync(client, "2026-10-01", 70m);
        await PutWeightAsync(client, "2026-10-20", 80m);
        var created = await CreateAsync(client, Bodies.Cardio(date: "2026-10-14", weightKg: null));
        Assert.Equal((70m, 302, 265), (created.WeightKgUsed, created.KcalGross, created.KcalNet));

        var body = Bodies.Cardio(date: "2026-10-21", weightKg: null, durationMin: 30m);
        body["kcalGross"] = 1;
        var updated = (await (await client.PutJsonAsync($"/api/cardio/{created.Id}", body)).ReadJsonAsync()).As<CardioDto>();

        // 80 kg, 4.8 km/h, 12 %, 30 min: VO2 28.78 → 345.36 / 303.36.
        Assert.Equal((created.Id, created.CreatedAt, "2026-10-21"), (updated.Id, updated.CreatedAt, updated.Date));
        Assert.Equal((80m, 345, 303), (updated.WeightKgUsed, updated.KcalGross, updated.KcalNet));

        var doubled = (await (await client.PutJsonAsync($"/api/cardio/{created.Id}", Bodies.Cardio(date: "2026-10-14", weightKg: 70m, durationMin: 60m)))
            .ReadJsonAsync()).As<CardioDto>();
        Assert.Equal((70m, 604, 531, 60m), (doubled.WeightKgUsed, doubled.KcalGross, doubled.KcalNet, doubled.DurationMin));
        Assert.Equal([doubled], await client.GetOkAsync<List<CardioDto>>($"/api/cardio?{October}"));
    }

    [Fact]
    public async Task Stored_sessions_keep_their_weight_when_weights_change_later()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        await PutWeightAsync(client, "2026-10-14", 70m);
        var created = await CreateAsync(client, Bodies.Cardio(date: "2026-10-14", weightKg: null));

        await PutWeightAsync(client, "2026-10-14", 90m);

        Assert.Equal([created], await client.GetOkAsync<List<CardioDto>>($"/api/cardio?{October}"));
    }

    [Fact]
    public async Task Put_that_needs_a_missing_weight_is_422_and_changes_nothing()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        await PutWeightAsync(client, "2026-10-14", 70m);
        var created = await CreateAsync(client, Bodies.Cardio(date: "2026-10-14", weightKg: null));

        var response = await client.PutJsonAsync($"/api/cardio/{created.Id}", Bodies.Cardio(date: "2026-10-01", weightKg: null));

        await response.ShouldBeProblemAsync(HttpStatusCode.UnprocessableEntity, "weight_required");
        Assert.Equal([created], await client.GetOkAsync<List<CardioDto>>($"/api/cardio?{October}"));
    }

    [Theory]
    [MemberData(nameof(InvalidBodies))]
    public async Task Invalid_update_is_400_on_that_field_and_changes_nothing(string field, string? value)
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        var created = await CreateAsync(client, Bodies.Cardio());

        var response = await client.PutJsonAsync($"/api/cardio/{created.Id}", Bodies.Cardio().With(field, value));

        await response.ShouldBeValidationProblemAsync(field);
        Assert.Equal([created], await client.GetOkAsync<List<CardioDto>>($"/api/cardio?{October}"));
    }

    [Fact]
    public async Task List_is_filtered_by_the_inclusive_range()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        var inRange = new List<Guid>();
        foreach (var date in new[] { "2026-10-09", "2026-10-10", "2026-10-12", "2026-10-14", "2026-10-15" })
        {
            var created = await CreateAsync(client, Bodies.Cardio(date: date));
            if (date is not ("2026-10-09" or "2026-10-15"))
            {
                inRange.Add(created.Id);
            }
        }

        var list = await client.GetOkAsync<List<CardioDto>>("/api/cardio?from=2026-10-10&to=2026-10-14");

        Assert.Equal(inRange.Order(), list.Select(c => c.Id).Order());
    }

    [Fact]
    public async Task Put_and_delete_of_an_unknown_id_are_404_not_found()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        var unknown = Guid.CreateVersion7();

        await (await client.PutJsonAsync($"/api/cardio/{unknown}", Bodies.Cardio())).ShouldBeNotFoundAsync();
        await (await client.DeleteAsync($"/api/cardio/{unknown}")).ShouldBeNotFoundAsync();
        Assert.Empty(await client.GetOkAsync<List<CardioDto>>($"/api/cardio?{October}"));
    }

    [Fact]
    public async Task Delete_returns_204_then_404_not_found()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        var created = await CreateAsync(client, Bodies.Cardio());
        var other = await CreateAsync(client, Bodies.Cardio());

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/cardio/{created.Id}")).StatusCode);

        Assert.Equal([other.Id], (await client.GetOkAsync<List<CardioDto>>($"/api/cardio?{October}")).Select(c => c.Id));
        await (await client.DeleteAsync($"/api/cardio/{created.Id}")).ShouldBeNotFoundAsync();
    }

    [Theory]
    [InlineData("PUT", "not-a-guid")]
    [InlineData("DELETE", "not-a-guid")]
    [InlineData("PUT", "123")]
    [InlineData("DELETE", "123")]
    public async Task Ids_that_are_not_uuids_are_404_not_found(string method, string id)
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        var response = await client.SendJsonAsync(new HttpMethod(method), $"/api/cardio/{id}", method == "PUT" ? Bodies.Cardio() : null);

        await response.ShouldBeNotFoundAsync();
    }

    [Fact]
    public async Task Maximum_values_are_calculated_and_stored_without_overflow()
    {
        // 25 km/h (running), 40 %, 600 min, 400 kg: VO2 = 83.33 + 150 + 3.5 = 236.83 → ×1200 = 284200 / 280000.
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        var body = Bodies.Cardio(weightKg: 400m, durationMin: 600m, avgSpeedKmh: 25m, inclinePercent: 40m);

        var created = await CreateAsync(client, body);

        Assert.Equal((284200, 280000, 400m), (created.KcalGross, created.KcalNet, created.WeightKgUsed));
        var day = await client.GetOkAsync<DayDto>("/api/days/2026-10-14");
        Assert.Equal((284200, 280000), (day.Totals.KcalCardioGross, day.Totals.KcalCardioNet));
    }
}
