# Perbarui-Media.ps1
#
# Scans media\audio and media\images and rewrites media\manifest.js so the app
# knows about your own recordings and pictures. Double-click Perbarui-Media.bat
# instead of running this directly.
#
# ASCII only on purpose: Windows PowerShell 5.1 reads a BOM-less script as the
# system code page, which would garble anything else.
#
# Keep in step with scripts/media-manifest.mjs (same extensions, same output).

param([string]$Root = $PSScriptRoot)

$ErrorActionPreference = 'Stop'

$audioExt = @('.mp3', '.wav', '.ogg', '.m4a', '.webm', '.aac')
$imageExt = @('.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.avif')

$media = Join-Path $Root 'media'
if (-not (Test-Path -LiteralPath $media)) {
    Write-Host ''
    Write-Host "Folder 'media' tidak ditemukan di: $Root" -ForegroundColor Red
    Write-Host 'Pastikan Perbarui-Media.bat berada satu folder dengan index.html.'
    exit 1
}

function Get-MediaFiles([string]$Folder, [string[]]$Extensions) {
    $found = New-Object System.Collections.Generic.List[string]
    $ignored = New-Object System.Collections.Generic.List[string]

    if (Test-Path -LiteralPath $Folder) {
        $base = (Resolve-Path -LiteralPath $Folder).Path.TrimEnd('\')
        foreach ($file in Get-ChildItem -LiteralPath $Folder -Recurse -File) {
            $rel = $file.FullName.Substring($base.Length + 1).Replace('\', '/')
            if ($Extensions -contains $file.Extension.ToLower()) {
                $found.Add($rel)
            }
            elseif ($file.Name -notmatch '\.(txt|md|js|json|html|url)$' -and $file.Name -notmatch '^[._]') {
                $ignored.Add($rel)
            }
        }
    }

    return @{ Found = @($found | Sort-Object); Ignored = @($ignored) }
}

function ConvertTo-JsList([string[]]$Items) {
    if ($Items.Count -eq 0) { return '' }
    $lines = $Items | ForEach-Object { '    "' + $_.Replace('\', '\\').Replace('"', '\"') + '"' }
    return ($lines -join ",`r`n") + "`r`n"
}

$audio = Get-MediaFiles (Join-Path $media 'audio') $audioExt
$images = Get-MediaFiles (Join-Path $media 'images') $imageExt

$nl = "`r`n"
$text = '// Dibuat otomatis oleh Perbarui-Media.bat. Boleh diedit tangan:' + $nl +
    '// cukup tulis jalur berkas relatif terhadap media/audio/ dan media/images/.' + $nl +
    'window.BELAJAR_MEDIA = {' + $nl +
    '  audio: [' + $nl + (ConvertTo-JsList $audio.Found) + '  ],' + $nl +
    '  images: [' + $nl + (ConvertTo-JsList $images.Found) + '  ]' + $nl +
    '};' + $nl

# No BOM: a byte-order mark at the top of a script file is needless risk.
[System.IO.File]::WriteAllText((Join-Path $media 'manifest.js'), $text, (New-Object System.Text.UTF8Encoding($false)))

Write-Host ''
Write-Host 'Selesai. Daftar media diperbarui.' -ForegroundColor Green
Write-Host ("  Suara  : {0} berkas" -f $audio.Found.Count)
Write-Host ("  Gambar : {0} berkas" -f $images.Found.Count)

$ignored = @($audio.Ignored) + @($images.Ignored)
if ($ignored.Count -gt 0) {
    Write-Host ''
    Write-Host 'Berkas ini DIABAIKAN karena formatnya tidak didukung:' -ForegroundColor Yellow
    foreach ($item in $ignored) { Write-Host "  $item" }
    Write-Host '  Suara : mp3, wav, ogg, m4a, webm, aac'
    Write-Host '  Gambar: png, jpg, jpeg, webp, svg, gif, avif'
}

Write-Host ''
Write-Host 'Langkah berikutnya: buka index.html lalu tambahkan  #media  di ujung alamat'
Write-Host 'untuk memeriksa mana yang sudah terpakai dan mana yang salah nama.'
