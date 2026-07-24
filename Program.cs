using System.Text;
using EMS.Web.Backend;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

var platformPort = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(platformPort))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{platformPort}");
}

builder.Services.AddControllersWithViews();
builder.Services.AddSingleton<Db>();
builder.Services.AddSingleton<JwtTokenService>();
builder.Services.AddAuthorization();
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services.ConfigureApplicationCookie(options =>
{
    options.LoginPath = "/";
});

builder.Services.AddSingleton(builder.Configuration);

var jwtSecret = builder.Configuration["Jwt:Secret"] ?? throw new InvalidOperationException("JWT secret is not configured.");
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ClockSkew = TimeSpan.FromMinutes(1)
        };

        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var authHeader = context.Request.Headers.Authorization.ToString();
                if (authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                {
                    context.Token = authHeader["Bearer ".Length..].Trim();
                }
                else if (context.Request.Cookies.TryGetValue("ems_jwt", out var cookieToken))
                {
                    context.Token = cookieToken;
                }

                return Task.CompletedTask;
            },
            OnChallenge = context =>
            {
                if (!context.Request.Path.StartsWithSegments("/api"))
                {
                    context.HandleResponse();
                    context.Response.Redirect("/");
                }

                return Task.CompletedTask;
            }
        };
    });

var app = builder.Build();

app.UseForwardedHeaders();
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

if (string.IsNullOrWhiteSpace(platformPort))
{
    app.UseHttpsRedirection();
}

app.Use(async (context, next) =>
{
    var path = context.Request.Path.Value ?? string.Empty;
    var blockedExtensions = new[] { ".dll", ".pdb", ".deps.json", ".runtimeconfig.json", ".csproj", ".sln", ".json" };
    if (blockedExtensions.Any(extension => path.EndsWith(extension, StringComparison.OrdinalIgnoreCase))
        && !path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase))
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        return;
    }

    await next();
});

app.UseStaticFiles();
app.UseRouting();
app.UseAuthentication();

app.Use(async (context, next) =>
{
    var path = context.Request.Path;
    var isApi = path.StartsWithSegments("/api");
    var isLogin = path == "/" || path.StartsWithSegments("/Home") || path.StartsWithSegments("/Account");
    var isStatic = path.StartsWithSegments("/css")
        || path.StartsWithSegments("/js")
        || path.StartsWithSegments("/lib")
        || path.StartsWithSegments("/images")
        || path.StartsWithSegments("/favicon.ico");

    if (!isApi && !isLogin && !isStatic && context.Request.Cookies.ContainsKey("ems_jwt") && !context.Request.Cookies.ContainsKey("ems_login_session"))
    {
        context.Response.Cookies.Delete("ems_jwt", new CookieOptions { Path = "/" });
        context.Response.Redirect("/");
        return;
    }

    await next();
});

app.Use(async (context, next) =>
{
    if (context.User.Identity?.IsAuthenticated == true)
    {
        var roleName = (context.User.FindFirst("role_name")?.Value ?? string.Empty).Trim().ToLowerInvariant().Replace(" ", "_");
        var isSuperAdmin = roleName is "super_admin" or "superadmin";
        var path = context.Request.Path;
        var method = context.Request.Method;
        var isApi = path.StartsWithSegments("/api");
        var isStatic = path.StartsWithSegments("/css")
            || path.StartsWithSegments("/js")
            || path.StartsWithSegments("/lib")
            || path.StartsWithSegments("/images")
            || path.StartsWithSegments("/favicon.ico");

        if (!isSuperAdmin && (
            path.StartsWithSegments("/Inventory")
            || path.StartsWithSegments("/Projects")
            || path.StartsWithSegments("/api/inventory")
            || path.StartsWithSegments("/api/projects")))
        {
            if (isApi)
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(ApiResponse<object>.Fail("FORBIDDEN", "Inventory and project modules are available to Super Admin only."));
                return;
            }

            context.Response.Redirect(roleName == "employee" ? "/MyPortal/Dashboard" : "/Dashboard");
            return;
        }

        if (roleName == "employee")
        {
            var allowedEmployeeApi = path.StartsWithSegments("/api/auth")
                || path.StartsWithSegments("/api/erp/modules")
                || path.StartsWithSegments("/api/notifications")
                || (path.StartsWithSegments("/api/dashboard/me") && HttpMethods.IsGet(method))
                || (path.StartsWithSegments("/api/attendance/mine") && HttpMethods.IsGet(method))
                || (path.StartsWithSegments("/api/announcements") && HttpMethods.IsGet(method))
                || (path.StartsWithSegments("/api/employees") && HttpMethods.IsGet(method))
                || (path.StartsWithSegments("/api/leave-requests") && (
                    path.StartsWithSegments("/api/leave-requests/mine")
                    || path.StartsWithSegments("/api/leave-requests/balances/mine")
                    || (path == "/api/leave-requests" && HttpMethods.IsPost(method))))
                || (path.StartsWithSegments("/api/penalties/mine") && HttpMethods.IsGet(method))
                || (path.StartsWithSegments("/api/payroll/mine") && HttpMethods.IsGet(method))
                || (path.StartsWithSegments("/api/payroll") && path.Value?.EndsWith("/payslip", StringComparison.OrdinalIgnoreCase) == true && HttpMethods.IsGet(method));

            if (isApi && !allowedEmployeeApi)
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(ApiResponse<object>.Fail("FORBIDDEN", "Employee accounts can only access the employee portal."));
                return;
            }

            if (!isApi && !isStatic && !path.StartsWithSegments("/MyPortal") && path != "/")
            {
                context.Response.Redirect("/MyPortal/Dashboard");
                return;
            }
        }
    }

    await next();
});

app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
