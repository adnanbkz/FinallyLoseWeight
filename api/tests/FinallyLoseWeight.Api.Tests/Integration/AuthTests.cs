using System.Net;
using FinallyLoseWeight.Api.Tests.Infrastructure;

namespace FinallyLoseWeight.Api.Tests.Integration;

/// <summary>
/// docs/API.md, "Orden de comprobaciones de acceso": 401 for a missing/invalid token, then
/// email_not_verified → not_invited → profile_required, with GDPR endpoints only needing a valid token.
/// </summary>
public class AuthTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    public static TheoryData<string> AllOperations => EndpointCatalog.Names(EndpointCatalog.All);

    public static TheoryData<string> InvitationOperations => EndpointCatalog.Names(EndpointCatalog.InvitationRequired);

    public static TheoryData<string> DataOperations => EndpointCatalog.Names(EndpointCatalog.Data);

    public static TheoryData<string, string> AllOperationsWithInvalidTokens
    {
        get
        {
            var data = new TheoryData<string, string>();
            foreach (var operation in EndpointCatalog.All.Keys)
            {
                foreach (var variant in new[] { "expired", "bad-signature", "wrong-audience", "wrong-issuer", "alg-none", "no-exp", "not-yet-valid", "garbage", "empty-sub" })
                {
                    data.Add(operation, variant);
                }
            }

            return data;
        }
    }

    [Theory]
    [MemberData(nameof(AllOperations))]
    public async Task Without_a_token_every_api_operation_is_401_problem_with_bearer_challenge(string operation)
    {
        var response = await EndpointCatalog.All[operation].SendAsync(api.CreateAnonymousClient());

        await response.ShouldBeProblemAsync(HttpStatusCode.Unauthorized);
        Assert.Contains(response.Headers.WwwAuthenticate, h => h.Scheme == "Bearer");
    }

    [Theory]
    [MemberData(nameof(AllOperationsWithInvalidTokens))]
    public async Task Invalid_tokens_are_401_on_every_api_operation(string operation, string variant)
    {
        var user = TestUser.Alice();
        var token = variant switch
        {
            "expired" => TestTokens.Create(user, t => t.Expired()),
            "bad-signature" => TestTokens.Create(user, t => t.WithBadSignature()),
            "wrong-audience" => TestTokens.Create(user, t => t.WithWrongAudience()),
            "wrong-issuer" => TestTokens.Create(user, t => t.WithWrongIssuer()),
            "alg-none" => TestTokens.CreateUnsigned(TestTokens.For(user)),
            "no-exp" => TestTokens.Create(user, t => t.WithoutExpiry()),
            "not-yet-valid" => TestTokens.Create(user, t => t with
            {
                ExtraClaims = new Dictionary<string, object> { ["nbf"] = DateTimeOffset.UtcNow.AddMinutes(30).ToUnixTimeSeconds() },
            }),
            "garbage" => "not-a-jwt",
            "empty-sub" => TestTokens.Create(user, t => t with { Subject = "" }),
            _ => throw new ArgumentOutOfRangeException(nameof(variant)),
        };

        var response = await EndpointCatalog.All[operation].SendAsync(api.CreateClientWithToken(token));

        await response.ShouldBeProblemAsync(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Invalid_tokens_never_reach_the_data()
    {
        // A registered user whose token is then tampered with: no read, no write, no account deletion.
        var user = TestUser.Alice();
        var client = await api.CreateRegisteredClientAsync(user);
        await (await client.PutJsonAsync("/api/weights/2026-10-14", Bodies.Weight())).ReadJsonAsync();
        var before = await api.CountRowsAsync(user.Uid);

        var forged = api.CreateClientWithToken(TestTokens.Create(user, t => t.WithBadSignature()));
        await (await forged.DeleteAsync("/api/me")).ShouldBeProblemAsync(HttpStatusCode.Unauthorized);
        await (await forged.DeleteAsync("/api/weights/2026-10-14")).ShouldBeProblemAsync(HttpStatusCode.Unauthorized);

        Assert.Equal(before, await api.CountRowsAsync(user.Uid));
        Assert.DoesNotContain(user.Uid, api.FirebaseUsers.DeletedUids);
    }

    [Theory]
    [MemberData(nameof(InvitationOperations))]
    public async Task Unverified_email_is_403_email_not_verified_even_with_a_profile(string operation)
    {
        var user = TestUser.Alice();
        await api.CreateRegisteredClientAsync(user);
        var unverified = api.CreateClientFor(user, t => t.WithUnverifiedEmail());

        var response = await EndpointCatalog.InvitationRequired[operation].SendAsync(unverified);

        await response.ShouldBeProblemAsync(HttpStatusCode.Forbidden, "email_not_verified");
    }

    [Fact]
    public async Task Missing_email_verified_claim_counts_as_unverified()
    {
        var client = api.CreateClientFor(TestUser.Alice(), t => t with { EmailVerified = null });

        await (await client.GetAsync("/api/cardio/machines")).ShouldBeProblemAsync(HttpStatusCode.Forbidden, "email_not_verified");
        await (await client.GetAsync("/api/me")).ShouldBeProblemAsync(HttpStatusCode.Forbidden, "email_not_verified");
    }

    [Theory]
    [MemberData(nameof(InvitationOperations))]
    public async Task Email_not_in_the_allowlist_is_403_not_invited(string operation)
    {
        var response = await EndpointCatalog.InvitationRequired[operation].SendAsync(api.CreateClientFor(TestUser.NotInvited()));

        await response.ShouldBeProblemAsync(HttpStatusCode.Forbidden, "not_invited");
    }

    [Theory]
    [MemberData(nameof(InvitationOperations))]
    public async Task Removing_the_invitation_blocks_a_registered_user(string operation)
    {
        // Registered while invited; the same Firebase account now carries an email that is no longer listed.
        var user = TestUser.Alice();
        await api.CreateRegisteredClientAsync(user);
        var uninvited = api.CreateClientFor(user, t => t with { Email = TestUser.NotInvitedEmail });

        var response = await EndpointCatalog.InvitationRequired[operation].SendAsync(uninvited);

        await response.ShouldBeProblemAsync(HttpStatusCode.Forbidden, "not_invited");
    }

    [Fact]
    public async Task Email_verification_is_checked_before_the_invitation()
    {
        var client = api.CreateClientFor(TestUser.NotInvited(), t => t.WithUnverifiedEmail());

        await (await client.GetAsync("/api/weights?from=2026-10-01&to=2026-10-14"))
            .ShouldBeProblemAsync(HttpStatusCode.Forbidden, "email_not_verified");
    }

    [Fact]
    public async Task Invitation_is_checked_before_the_profile()
    {
        var client = api.CreateClientFor(TestUser.NotInvited());

        await (await client.GetAsync("/api/days/2026-10-14")).ShouldBeProblemAsync(HttpStatusCode.Forbidden, "not_invited");
    }

    [Theory]
    [InlineData("alice@flw.test")]
    [InlineData("ALICE@FLW.TEST")]
    [InlineData("Bob@Flw.Test")]
    [InlineData("carol@FLW.test")]
    public async Task Allowlist_match_ignores_case(string email)
    {
        var client = api.CreateClientFor(TestUser.WithEmail(email));

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/cardio/machines")).StatusCode);
        await (await client.GetAsync("/api/me")).ShouldBeProblemAsync(HttpStatusCode.NotFound, "profile_not_found");
    }

    [Theory]
    [InlineData("xalice@flw.test")]
    [InlineData("alice@flw.test.evil.example")]
    [InlineData("alice@flw")]
    [InlineData("")]
    public async Task Emails_that_only_resemble_an_invited_one_are_not_invited(string email)
    {
        var client = api.CreateClientFor(TestUser.WithEmail(email));

        await (await client.GetAsync("/api/cardio/machines")).ShouldBeProblemAsync(HttpStatusCode.Forbidden, "not_invited");
    }

    [Fact]
    public async Task Token_without_email_is_not_invited()
    {
        var client = api.CreateClientFor(TestUser.WithEmail(null));

        await (await client.GetAsync("/api/cardio/machines")).ShouldBeProblemAsync(HttpStatusCode.Forbidden, "not_invited");
    }

    [Theory]
    [MemberData(nameof(DataOperations))]
    public async Task Data_endpoints_without_profile_are_403_profile_required(string operation)
    {
        var response = await EndpointCatalog.Data[operation].SendAsync(api.CreateClientFor(TestUser.Bob()));

        await response.ShouldBeProblemAsync(HttpStatusCode.Forbidden, "profile_required");
    }

    [Fact]
    public async Task Invited_user_without_profile_can_use_the_sign_up_endpoints()
    {
        var client = api.CreateClientFor(TestUser.Carol());

        await (await client.GetAsync("/api/me")).ShouldBeProblemAsync(HttpStatusCode.NotFound, "profile_not_found");
        var machines = await client.GetOkAsync<List<MachineDto>>("/api/cardio/machines");
        Assert.NotEmpty(machines);
        await (await client.PutJsonAsync("/api/me", Bodies.Profile())).ReadJsonAsync(HttpStatusCode.Created);

        // Once registered, the data endpoints open up.
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/days/2026-10-14")).StatusCode);
    }

    [Fact]
    public async Task Machine_catalog_also_works_with_a_profile()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/cardio/machines")).StatusCode);
    }

    [Theory]
    [InlineData("not-invited")]
    [InlineData("unverified")]
    [InlineData("no-email")]
    public async Task Gdpr_endpoints_only_need_a_valid_token(string variant)
    {
        var client = variant switch
        {
            "not-invited" => api.CreateClientFor(TestUser.NotInvited()),
            "unverified" => api.CreateClientFor(TestUser.Alice(), t => t.WithUnverifiedEmail()),
            "no-email" => api.CreateClientFor(TestUser.WithEmail(null), t => t with { EmailVerified = null }),
            _ => throw new ArgumentOutOfRangeException(nameof(variant)),
        };

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/me/export")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync("/api/me")).StatusCode);
    }

    [Fact]
    public async Task Health_is_public_and_ignores_bad_tokens()
    {
        Assert.Equal(HttpStatusCode.OK, (await api.CreateAnonymousClient().GetAsync("/health")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await api.CreateClientWithToken("not-a-jwt").GetAsync("/health")).StatusCode);
    }
}
