$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$OutDir = Join-Path $PSScriptRoot 'qa-step42_2h-final-visual'
$SheetDir = Join-Path $OutDir 'contact-sheets'
if (!(Test-Path $OutDir)) { throw "Missing QA output: $OutDir" }
if (Test-Path $SheetDir) { Remove-Item $SheetDir -Recurse -Force }
New-Item -ItemType Directory -Path $SheetDir | Out-Null

function New-ContactSheet {
    param(
        [System.IO.FileInfo[]]$Files,
        [string]$Name,
        [int]$Width
    )
    if (!$Files -or $Files.Count -eq 0) { return 0 }

    $cols = 4
    $thumbW = 300
    $thumbH = 198
    $labelH = 34
    $gap = 10
    $headerH = 44
    $rows = [Math]::Ceiling($Files.Count / [double]$cols)
    $sheetW = ($cols * $thumbW) + (($cols + 1) * $gap)
    $sheetH = $headerH + ($rows * ($thumbH + $labelH)) + (($rows + 1) * $gap)

    $sheet = New-Object System.Drawing.Bitmap $sheetW, $sheetH
    $g = [System.Drawing.Graphics]::FromImage($sheet)
    $g.Clear([System.Drawing.Color]::White)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $font = New-Object System.Drawing.Font('Segoe UI', 9)
    $headerFont = New-Object System.Drawing.Font('Segoe UI Semibold', 16)
    $g.DrawString("Step 42.2H - $Name ($Width px)", $headerFont, [System.Drawing.Brushes]::Black, $gap, 8)

    for ($i = 0; $i -lt $Files.Count; $i++) {
        $row = [Math]::Floor($i / $cols)
        $col = $i % $cols
        $x = $gap + ($col * ($thumbW + $gap))
        $y = $headerH + $gap + ($row * ($thumbH + $labelH + $gap))

        $img = [System.Drawing.Image]::FromFile($Files[$i].FullName)
        try {
            $scale = [Math]::Min($thumbW / [double]$img.Width, $thumbH / [double]$img.Height)
            $drawW = [Math]::Max(1, [int]($img.Width * $scale))
            $drawH = [Math]::Max(1, [int]($img.Height * $scale))
            $dx = $x + [int](($thumbW - $drawW) / 2)
            $dy = $y + [int](($thumbH - $drawH) / 2)
            $g.FillRectangle([System.Drawing.Brushes]::Gainsboro, $x, $y, $thumbW, $thumbH)
            $g.DrawImage($img, $dx, $dy, $drawW, $drawH)
        }
        finally {
            $img.Dispose()
        }

        $label = $Files[$i].BaseName -replace ('^' + $Width + '__'), ''
        if ($label.Length -gt 48) { $label = $label.Substring(0,45) + '...' }
        $g.DrawString($label, $font, [System.Drawing.Brushes]::Black, $x, ($y + $thumbH + 4))
    }

    $target = Join-Path $SheetDir ($Name + '.png')
    $sheet.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
    $font.Dispose()
    $headerFont.Dispose()
    $g.Dispose()
    $sheet.Dispose()
    return $Files.Count
}

$summary = @()
foreach ($width in @(1366, 1024, 768)) {
    $filter = $width.ToString() + '__*.png'
    $all = @(Get-ChildItem $OutDir -Filter $filter | Sort-Object Name)
    $top = @($all | Where-Object { $_.BaseName -notmatch '__bottom$' -and $_.BaseName -notmatch '__context-open$' })
    $bottom = @($all | Where-Object { $_.BaseName -match '__bottom$' })
    $topCount = New-ContactSheet -Files $top -Name ($width.ToString() + '-top') -Width $width
    $bottomCount = New-ContactSheet -Files $bottom -Name ($width.ToString() + '-bottom') -Width $width
    $summary += [pscustomobject]@{ width=$width; top=$topCount; bottom=$bottomCount }
}
$summary | Format-Table -AutoSize
Write-Output ("contact_sheets=" + (Get-ChildItem $SheetDir -Filter '*.png').Count)
