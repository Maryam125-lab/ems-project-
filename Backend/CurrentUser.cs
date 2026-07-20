using System.Security.Claims;

namespace EMS.Web.Backend;

public sealed record CurrentUser(Guid UserId, string EmployeeId, Guid? RoleId, bool MustChangePassword)
{
    public static CurrentUser? FromPrincipal(ClaimsPrincipal principal)
    {
        var userIdValue = principal.FindFirstValue("user_id");
        if (!Guid.TryParse(userIdValue, out var userId)) return null;

        Guid? roleId = null;
        if (Guid.TryParse(principal.FindFirstValue("role_id"), out var parsedRoleId))
        {
            roleId = parsedRoleId;
        }

        var mustChangePassword = bool.TryParse(principal.FindFirstValue("must_change_password"), out var mustChange) && mustChange;
        return new CurrentUser(userId, principal.FindFirstValue("employee_id") ?? string.Empty, roleId, mustChangePassword);
    }
}
