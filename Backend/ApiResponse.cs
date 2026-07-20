namespace EMS.Web.Backend;

public sealed record ApiResponse<T>(bool Success, T? Data = default, ApiError? Error = null)
{
    public static ApiResponse<T> Ok(T? data) => new(true, data, null);
    public static ApiResponse<T> Fail(string code, string message) => new(false, default, new ApiError(code, message));
}

public sealed record ApiError(string Code, string Message);
