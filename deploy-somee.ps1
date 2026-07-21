param(
    [string]$Source = "C:\Users\HP\EMS.Web (4)\publish-somee-ready",
    [string]$FtpBaseUri = "ftp://track360erp.somee.com/www.track360erp.somee.com",
    [string]$Username = "maryamsheikh"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $Source)) {
    throw "Publish folder not found: $Source"
}

$securePassword = Read-Host "Enter Somee FTP/control-panel password" -AsSecureString
$credential = [System.Net.NetworkCredential]::new($Username, $securePassword)

function Join-FtpPath {
    param(
        [string]$BaseUri,
        [string]$RelativePath
    )

    $cleanBase = $BaseUri.TrimEnd("/")
    if ([string]::IsNullOrWhiteSpace($RelativePath)) {
        return $cleanBase
    }

    $segments = $RelativePath -replace "\\", "/" -split "/" | Where-Object { $_ }
    $encoded = $segments | ForEach-Object { [System.Uri]::EscapeDataString($_) }
    return "$cleanBase/$($encoded -join "/")"
}

function Invoke-Ftp {
    param(
        [string]$Uri,
        [string]$Method,
        [string]$FilePath = $null
    )

    $request = [System.Net.FtpWebRequest]::Create($Uri)
    $request.Method = $Method
    $request.Credentials = $credential
    $request.UseBinary = $true
    $request.UsePassive = $true
    $request.KeepAlive = $false

    if ($FilePath) {
        $bytes = [System.IO.File]::ReadAllBytes($FilePath)
        $request.ContentLength = $bytes.Length
        $stream = $request.GetRequestStream()
        try {
            $stream.Write($bytes, 0, $bytes.Length)
        }
        finally {
            $stream.Dispose()
        }
    }

    $response = $request.GetResponse()
    try {
        return $response.StatusDescription
    }
    finally {
        $response.Dispose()
    }
}

function Try-Ftp {
    param(
        [string]$Uri,
        [string]$Method
    )

    try {
        [void](Invoke-Ftp -Uri $Uri -Method $Method)
        return $true
    }
    catch {
        return $false
    }
}

function Get-RelativePathCompat {
    param(
        [string]$BasePath,
        [string]$ChildPath
    )

    $baseFullPath = [System.IO.Path]::GetFullPath($BasePath).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
    $childFullPath = [System.IO.Path]::GetFullPath($ChildPath)
    $baseUri = [System.Uri]::new($baseFullPath + [System.IO.Path]::DirectorySeparatorChar)
    $childUri = [System.Uri]::new($childFullPath)
    return [System.Uri]::UnescapeDataString($baseUri.MakeRelativeUri($childUri).ToString()).Replace("/", [System.IO.Path]::DirectorySeparatorChar)
}

Write-Host "Deploying TRACK360 ERP to Somee..." -ForegroundColor Cyan
Write-Host "Source: $Source"
Write-Host "Target: $FtpBaseUri"

[void](Try-Ftp -Uri (Join-FtpPath $FtpBaseUri "default.asp") -Method ([System.Net.WebRequestMethods+Ftp]::DeleteFile))

$directories = Get-ChildItem -LiteralPath $Source -Directory -Recurse | Sort-Object FullName
foreach ($directory in $directories) {
    $relativeDir = Get-RelativePathCompat -BasePath $Source -ChildPath $directory.FullName
    $parts = $relativeDir -replace "\\", "/" -split "/" | Where-Object { $_ }
    $current = ""
    foreach ($part in $parts) {
        $current = if ($current) { "$current/$part" } else { $part }
        [void](Try-Ftp -Uri (Join-FtpPath $FtpBaseUri $current) -Method ([System.Net.WebRequestMethods+Ftp]::MakeDirectory))
    }
}

$files = Get-ChildItem -LiteralPath $Source -File -Recurse
$index = 0
foreach ($file in $files) {
    $index++
    $relativeFile = Get-RelativePathCompat -BasePath $Source -ChildPath $file.FullName
    $targetUri = Join-FtpPath $FtpBaseUri $relativeFile
    Write-Progress -Activity "Uploading TRACK360 ERP" -Status $relativeFile -PercentComplete (($index / $files.Count) * 100)
    [void](Invoke-Ftp -Uri $targetUri -Method ([System.Net.WebRequestMethods+Ftp]::UploadFile) -FilePath $file.FullName)
}

Write-Progress -Activity "Uploading TRACK360 ERP" -Completed
Write-Host "Upload complete. Testing public URL..." -ForegroundColor Green

try {
    $response = Invoke-WebRequest -Uri "http://track360erp.somee.com" -UseBasicParsing -TimeoutSec 30
    Write-Host "Public site responded with HTTP $($response.StatusCode)." -ForegroundColor Green
}
catch {
    Write-Warning "Upload finished, but public test failed: $($_.Exception.Message)"
    Write-Warning "Somee DNS/IIS can take a few minutes. Retry: http://track360erp.somee.com"
}
