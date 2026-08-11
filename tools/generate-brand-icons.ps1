param(
  [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$background = [System.Drawing.ColorTranslator]::FromHtml('#0a0d0c')
$mint = [System.Drawing.ColorTranslator]::FromHtml('#65d38e')
$supersampling = 4

function Get-ScaledPoint {
  param([float]$X, [float]$Y, [int]$CanvasSize)
  [System.Drawing.PointF]::new($X * $CanvasSize, $Y * $CanvasSize)
}

function Add-Circle {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Brush]$Brush,
    [System.Drawing.PointF]$Center,
    [float]$Radius
  )
  $Graphics.FillEllipse($Brush, $Center.X - $Radius, $Center.Y - $Radius, $Radius * 2, $Radius * 2)
}

function New-BrandIcon {
  param([string]$OutputPath, [int]$PixelSize, [bool]$Maskable)

  $canvasSize = $PixelSize * $supersampling
  $canvas = [System.Drawing.Bitmap]::new($canvasSize, $canvasSize, [System.Drawing.Imaging.PixelFormat]::Format32bppPArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)

  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::GammaCorrected
    $graphics.Clear($background)

    # Regular launcher/touch icons use more of the canvas so the mark remains
    # legible at 32 px. The maskable variant keeps the unscaled master geometry,
    # whose verified bounds stay inside the central 66% safe zone.
    if (-not $Maskable) {
      $graphics.TranslateTransform($canvasSize / 2, $canvasSize / 2)
      $graphics.ScaleTransform(1.18, 1.18)
      $graphics.TranslateTransform(-$canvasSize / 2, -$canvasSize / 2)
    }

    $start = Get-ScaledPoint 0.240 0.310 $canvasSize
    $middle = Get-ScaledPoint 0.475 0.445 $canvasSize
    $finish = Get-ScaledPoint 0.715 0.650 $canvasSize

    $trendPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
    try {
      $trendPath.StartFigure()
      $trendPath.AddBezier(
        $start,
        (Get-ScaledPoint 0.320 0.305 $canvasSize),
        (Get-ScaledPoint 0.380 0.420 $canvasSize),
        $middle
      )
      $trendPath.AddBezier(
        $middle,
        (Get-ScaledPoint 0.565 0.475 $canvasSize),
        (Get-ScaledPoint 0.615 0.625 $canvasSize),
        $finish
      )

      $glowPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(45, $mint), 0.118 * $canvasSize)
      $linePen = [System.Drawing.Pen]::new($mint, 0.052 * $canvasSize)
      try {
        foreach ($pen in @($glowPen, $linePen)) {
          $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
          $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
          $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
          $graphics.DrawPath($pen, $trendPath)
        }
      } finally {
        $glowPen.Dispose()
        $linePen.Dispose()
      }
    } finally {
      $trendPath.Dispose()
    }

    $nodeGlow = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(48, $mint))
    $mintBrush = [System.Drawing.SolidBrush]::new($mint)
    $backgroundBrush = [System.Drawing.SolidBrush]::new($background)
    try {
      Add-Circle $graphics $nodeGlow $start (0.070 * $canvasSize)
      Add-Circle $graphics $nodeGlow $middle (0.070 * $canvasSize)
      Add-Circle $graphics $nodeGlow $finish (0.088 * $canvasSize)

      foreach ($node in @($start, $middle)) {
        Add-Circle $graphics $mintBrush $node (0.048 * $canvasSize)
        Add-Circle $graphics $backgroundBrush $node (0.021 * $canvasSize)
      }
      Add-Circle $graphics $mintBrush $finish (0.067 * $canvasSize)

      $checkPen = [System.Drawing.Pen]::new($background, 0.022 * $canvasSize)
      try {
        $checkPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $checkPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
        $checkPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
        $checkPoints = [System.Drawing.PointF[]]@(
          (Get-ScaledPoint 0.684 0.651 $canvasSize),
          (Get-ScaledPoint 0.706 0.674 $canvasSize),
          (Get-ScaledPoint 0.752 0.620 $canvasSize)
        )
        $graphics.DrawLines($checkPen, $checkPoints)
      } finally {
        $checkPen.Dispose()
      }
    } finally {
      $nodeGlow.Dispose()
      $mintBrush.Dispose()
      $backgroundBrush.Dispose()
    }

    $output = [System.Drawing.Bitmap]::new($PixelSize, $PixelSize, [System.Drawing.Imaging.PixelFormat]::Format32bppPArgb)
    $outputGraphics = [System.Drawing.Graphics]::FromImage($output)
    try {
      # Bicubic sampling reaches half a pixel beyond the source at the outer
      # edge. Compositing over the required opaque background keeps all four
      # corners exact and leaves platform masking—not image transparency—in
      # charge of the installed icon shape.
      $outputGraphics.Clear($background)
      $outputGraphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
      $outputGraphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $outputGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $outputGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $outputGraphics.DrawImage($canvas, [System.Drawing.Rectangle]::new(0, 0, $PixelSize, $PixelSize))
      $edgeBrush = [System.Drawing.SolidBrush]::new($background)
      try {
        $outputGraphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $outputGraphics.FillRectangle($edgeBrush, 0, 0, $PixelSize, 1)
        $outputGraphics.FillRectangle($edgeBrush, 0, $PixelSize - 1, $PixelSize, 1)
        $outputGraphics.FillRectangle($edgeBrush, 0, 0, 1, $PixelSize)
        $outputGraphics.FillRectangle($edgeBrush, $PixelSize - 1, 0, 1, $PixelSize)
      } finally {
        $edgeBrush.Dispose()
      }
      $output.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $outputGraphics.Dispose()
      $output.Dispose()
    }
  } finally {
    $graphics.Dispose()
    $canvas.Dispose()
  }
}

function Test-BrandIcon {
  param([string]$Path, [int]$ExpectedSize, [bool]$Maskable)

  $bitmap = [System.Drawing.Bitmap]::FromFile($Path)
  try {
    if ($bitmap.Width -ne $ExpectedSize -or $bitmap.Height -ne $ExpectedSize) {
      throw "$Path has size $($bitmap.Width)x$($bitmap.Height); expected ${ExpectedSize}x${ExpectedSize}."
    }

    $corners = @(
      $bitmap.GetPixel(0, 0),
      $bitmap.GetPixel($ExpectedSize - 1, 0),
      $bitmap.GetPixel(0, $ExpectedSize - 1),
      $bitmap.GetPixel($ExpectedSize - 1, $ExpectedSize - 1)
    )
    if ($corners.Where({ $_.ToArgb() -ne $background.ToArgb() }).Count -gt 0) {
      throw "$Path does not keep the required #0a0d0c background in every corner."
    }

    $mintPixels = 0
    $brightNeutralPixels = 0
    $transparentPixels = 0
    $minX = $ExpectedSize
    $minY = $ExpectedSize
    $maxX = -1
    $maxY = -1
    for ($y = 0; $y -lt $ExpectedSize; $y++) {
      for ($x = 0; $x -lt $ExpectedSize; $x++) {
        $pixel = $bitmap.GetPixel($x, $y)
        if ($pixel.A -ne 255) { $transparentPixels++ }
        if ($pixel.R -gt 225 -and $pixel.G -gt 225 -and $pixel.B -gt 225) { $brightNeutralPixels++ }
        if ($pixel.G -gt 120 -and $pixel.G -gt ($pixel.R + 30) -and $pixel.G -gt ($pixel.B + 18)) {
          $mintPixels++
          if ($x -lt $minX) { $minX = $x }
          if ($x -gt $maxX) { $maxX = $x }
          if ($y -lt $minY) { $minY = $y }
          if ($y -gt $maxY) { $maxY = $y }
        }
      }
    }

    if ($transparentPixels -gt 0) { throw "$Path contains transparent pixels; platform masking must own the crop." }
    if ($brightNeutralPixels -gt 0) { throw "$Path contains near-white pixels; the icon must not contain numeric or text-like white artwork." }
    if ($mintPixels -lt [Math]::Floor($ExpectedSize * $ExpectedSize * 0.012)) { throw "$Path does not contain enough mint trend artwork." }

    if ($Maskable) {
      $safeMin = [Math]::Floor($ExpectedSize * 0.17)
      $safeMax = [Math]::Ceiling($ExpectedSize * 0.83) - 1
      if ($minX -lt $safeMin -or $minY -lt $safeMin -or $maxX -gt $safeMax -or $maxY -gt $safeMax) {
        throw "$Path artwork bounds [$minX,$minY]-[$maxX,$maxY] exceed the central 66% maskable safe zone [$safeMin,$safeMin]-[$safeMax,$safeMax]."
      }
    }

    [pscustomobject]@{
      File = [System.IO.Path]::GetFileName($Path)
      Size = "${ExpectedSize}x${ExpectedSize}"
      MintPixels = $mintPixels
      ArtworkBounds = "[$minX,$minY]-[$maxX,$maxY]"
      MaskableSafe = if ($Maskable) { 'central 66% verified' } else { 'not applicable' }
    }
  } finally {
    $bitmap.Dispose()
  }
}

$targets = @(
  @{ Name = 'apple-touch-icon.png'; Size = 180; Maskable = $false },
  @{ Name = 'pwa-192x192.png'; Size = 192; Maskable = $false },
  @{ Name = 'pwa-512x512.png'; Size = 512; Maskable = $false },
  @{ Name = 'maskable-512x512.png'; Size = 512; Maskable = $true },
  # Versioned URLs force installed desktop PWAs and browser shortcut caches to
  # fetch the neutral journal mark instead of keeping an older launcher icon.
  @{ Name = 'app-icon-v2-192x192.png'; Size = 192; Maskable = $false },
  @{ Name = 'app-icon-v2-512x512.png'; Size = 512; Maskable = $false },
  @{ Name = 'app-icon-v2-maskable-512x512.png'; Size = 512; Maskable = $true }
)

$publicDirectory = Join-Path $RepositoryRoot 'public'
foreach ($target in $targets) {
  $outputPath = Join-Path $publicDirectory $target.Name
  New-BrandIcon -OutputPath $outputPath -PixelSize $target.Size -Maskable $target.Maskable
}

$results = foreach ($target in $targets) {
  Test-BrandIcon -Path (Join-Path $publicDirectory $target.Name) -ExpectedSize $target.Size -Maskable $target.Maskable
}
$results | Format-Table -AutoSize
Get-FileHash ($targets | ForEach-Object { Join-Path $publicDirectory $_.Name }) -Algorithm SHA256 | Select-Object Path, Hash
