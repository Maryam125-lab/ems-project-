using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace EMS.Web.Backend;

public sealed class JwtTokenService
{
    private readonly IConfiguration _configuration;

    public JwtTokenService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public string Sign(AuthUser user)
    {
        var secret = _configuration["Jwt:Secret"] ?? throw new InvalidOperationException("JWT secret is not configured.");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiresHours = int.TryParse(_configuration["Jwt:ExpiresHours"], out var hours) ? hours : 8;

        var claims = new List<Claim>
        {
            new("user_id", user.UserId.ToString()),
            new("employee_id", user.EmployeeId ?? string.Empty),
            new("must_change_password", user.MustChangePassword ? "true" : "false"),
        };

        if (!string.IsNullOrWhiteSpace(user.RoleName))
        {
            claims.Add(new Claim("role_name", user.RoleName));
        }

        if (user.RoleId.HasValue)
        {
            claims.Add(new Claim("role_id", user.RoleId.Value.ToString()));
        }

        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddHours(expiresHours),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public sealed record AuthUser(
    Guid UserId,
    string? EmployeeId,
    Guid? RoleId,
    string? RoleName,
    bool MustChangePassword,
    string Email,
    string? EmployeeName
);
