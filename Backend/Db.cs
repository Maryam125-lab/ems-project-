using Npgsql;

namespace EMS.Web.Backend;

public sealed class Db
{
    private readonly NpgsqlDataSource _dataSource;

    public Db(IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("DefaultConnection is not configured.");

        _dataSource = NpgsqlDataSource.Create(connectionString);
    }

    public ValueTask<NpgsqlConnection> OpenConnectionAsync(CancellationToken cancellationToken = default)
        => _dataSource.OpenConnectionAsync(cancellationToken);
}
