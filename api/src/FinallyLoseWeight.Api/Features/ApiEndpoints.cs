using FinallyLoseWeight.Api.Features.Cardio;
using FinallyLoseWeight.Api.Features.Meals;
using FinallyLoseWeight.Api.Features.Profile;
using FinallyLoseWeight.Api.Features.Steps;
using FinallyLoseWeight.Api.Features.Summary;
using FinallyLoseWeight.Api.Features.Weights;

namespace FinallyLoseWeight.Api.Features;

public static class ApiEndpoints
{
    /// <summary>
    /// Maps every <c>/api</c> endpoint of docs/API.md. Each feature declares its own access policy
    /// (see <see cref="Auth.AccessPolicies"/>); the fallback policy still demands a token for anything else.
    /// </summary>
    public static IEndpointRouteBuilder MapApiEndpoints(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api");

        api.MapProfileEndpoints();
        api.MapAccountEndpoints();
        api.MapWeightEndpoints();
        api.MapMealEndpoints();
        api.MapStepsEndpoints();
        api.MapCardioEndpoints();
        api.MapSummaryEndpoints();

        return app;
    }
}
