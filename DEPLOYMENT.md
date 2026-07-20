# TRACK360 ERP Deployment

This project is a .NET ERP application with Razor/MVC pages and same-origin .NET API endpoints. HR, Inventory, and Projects share one authentication/session layer and one PostgreSQL database connection.

## Required Environment Variables

Set these on the hosting platform:

```text
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://+:8080
ConnectionStrings__DefaultConnection=Host=...;Port=5432;Database=...;Username=...;Password=...
Jwt__Secret=<long-secure-secret>
Jwt__ExpiresHours=8
```

## Local Release Check

Stop any running local app first, then run:

```powershell
cd "C:\Users\HP\EMS.Web (4)"
Get-Process EMS.Web -ErrorAction SilentlyContinue | Stop-Process
dotnet publish -c Release -o ".\publish"
```

## Docker Deploy

```powershell
cd "C:\Users\HP\EMS.Web (4)"
docker build -t track360-erp .
docker run -p 8080:8080 `
  -e ASPNETCORE_ENVIRONMENT=Production `
  -e ConnectionStrings__DefaultConnection="Host=...;Port=5432;Database=...;Username=...;Password=..." `
  -e Jwt__Secret="<long-secure-secret>" `
  track360-erp
```

Open:

```text
http://localhost:8080
```

## Lead Demo Checklist

- Login page opens first.
- Login works with the demo/admin account.
- HR employee create/edit saves to database.
- Attendance/leave/payroll pages load from API.
- Inventory products, vendors, customers, purchase flow, sales flow, invoices, installations, complaints and replacements load from API.
- Inventory invoice numbers open the invoice preview.
- Invoice preview supports print and HTML download.
- Audit CSV export downloads correctly.

## Recommended Hosting

For the fastest lead demo, use a Docker-capable host such as Azure App Service for Containers, Render, or Railway. For office/internal production, IIS on Windows Server is also suitable.
