$ErrorActionPreference = 'Stop'
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$geometryDir = Join-Path $PSScriptRoot 'geometry'
$referenceDir = Join-Path $PSScriptRoot 'references'
$exampleDir = Join-Path $PSScriptRoot 'examples'
foreach ($directory in @($geometryDir, $referenceDir, $exampleDir)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
}
function Write-JsonFile($filePath, $value) {
    [System.IO.File]::WriteAllText($filePath, (($value | ConvertTo-Json -Depth 15) + "`n"))
}

# Geometry is derived from the renderer, including descriptive camera angles.
$geometryCode = @'
import fs from 'node:fs';
import { projectedHex, MAP_CAMERA, MAP_CAMERA_TRANSFORM } from './game/src/ui/map-projection.ts';
const {width,height} = JSON.parse(fs.readFileSync('art-reference/map/geometry/terrain-hex.json','utf8'));
const h = projectedHex(1);
const elevation = Math.asin(Math.hypot(MAP_CAMERA.b, MAP_CAMERA.d)) * 180 / Math.PI;
const yaw = Math.atan2(-MAP_CAMERA.c, MAP_CAMERA.a) * 180 / Math.PI;
const round = n => Math.round(n * 1e8) / 1e8;
console.log(JSON.stringify({
  source: 'game/src/ui/map-projection.ts',
  camera: { projection: 'orthographic / parallel', elevationDegrees: round(elevation), fromVerticalDegrees: round(90-elevation), boardYawDegrees: round(yaw), matrix: MAP_CAMERA_TRANSFORM },
  canvas: { width, height, center: [width/2,height/2], note: 'Integer raster reference; exact projected aspect is stored separately.' },
  projectedAspect: h.width/h.height,
  vertices: h.points.map(p=>[(p.x-h.x)/h.width*width,(p.y-h.y)/h.height*height]),
  vertexOrder: 'Upper-right first, clockwise in screen coordinates with Y downward.',
  placement: 'Complete hex canvas maps to projected ground bounds; no alpha crop or second camera rotation. Measured irregular artwork needs registration metadata.'
}));
'@
Push-Location $repoRoot
try {
    $specText = & node --experimental-strip-types --disable-warning=ExperimentalWarning --input-type=module -e $geometryCode
    if ($LASTEXITCODE -ne 0) { throw 'Could not derive geometry from the renderer.' }
} finally { Pop-Location }
$spec = $specText | ConvertFrom-Json
Write-JsonFile (Join-Path $geometryDir 'hex-spec.json') $spec
$invariant = [System.Globalization.CultureInfo]::InvariantCulture
$points = ($spec.vertices | ForEach-Object { ([double]$_[0]).ToString('R', $invariant) + ',' + ([double]$_[1]).ToString('R', $invariant) }) -join ' '
$width = [int]$spec.canvas.width
$height = [int]$spec.canvas.height
$svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + $width + '" height="' + $height + '" viewBox="0 0 ' + $width + ' ' + $height + '"><polygon points="' + $points + '" fill="#6e8749"/></svg>'
[System.IO.File]::WriteAllText((Join-Path $geometryDir 'hex-mask.svg'), $svg + "`n")

# Rasterize only the geometric reference; generated artwork is copied unmodified.
Add-Type -AssemblyName System.Drawing
$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 110, 135, 73))
try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $vertices = [System.Drawing.PointF[]]@($spec.vertices | ForEach-Object { New-Object System.Drawing.PointF([single]$_[0], [single]$_[1]) })
    $graphics.FillPolygon($brush, $vertices)
    $bitmap.Save((Join-Path $geometryDir 'hex-mask.png'), [System.Drawing.Imaging.ImageFormat]::Png)
} finally { $brush.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }

$labels = for ($i = 0; $i -lt 6; $i++) {
    $x = ([double]$spec.vertices[$i][0]).ToString('R', $invariant)
    $y = ([double]$spec.vertices[$i][1]).ToString('R', $invariant)
    '<g transform="translate(' + $x + ' ' + $y + ')"><circle r="15" fill="#17232b" stroke="#ffcb65"/><text text-anchor="middle" dy="5" fill="white">' + ($i + 1) + '</text></g>'
}
$guideWidth = $width + 128
$guideHeight = $height + 128
$cx = ([double]$spec.canvas.center[0]).ToString('R', $invariant)
$cy = ([double]$spec.canvas.center[1]).ToString('R', $invariant)
$guide = '<svg xmlns="http://www.w3.org/2000/svg" width="' + $guideWidth + '" height="' + $guideHeight + '" viewBox="0 0 ' + $guideWidth + ' ' + $guideHeight + '" font-family="sans-serif" font-size="15"><rect width="100%" height="100%" fill="#10171c"/><text x="24" y="25" fill="white">GEOMETRY GUIDE ONLY - do not reproduce labels in artwork</text><g transform="translate(64 64)"><polygon points="' + $points + '" fill="#6e8749" stroke="#64e4db" stroke-width="2"/><g transform="translate(' + $cx + ' ' + $cy + ')"><path d="M-20 0H20M0-20V20" stroke="#ffcb65" stroke-width="2"/><text x="23" y="-5" fill="white">centre (' + $cx + ', ' + $cy + ')</text></g>' + ($labels -join '') + '</g></svg>'
[System.IO.File]::WriteAllText((Join-Path $geometryDir 'hex-guide.svg'), $guide + "`n")

$references = @(
    @{ source = 'game/public/map/terrain/forest-relief.png'; file = 'forest-original-style.png'; role = 'Painterly style and palette ONLY. Freeform tall scenery; unsuitable as a full-hex shape reference.' },
    @{ source = 'game/public/map/terrain/forest-relief-1.png'; file = 'forest-relief-1.png'; role = 'Composition and style example. Raw generated footprint is approximate; renderer registration is required. Not a certified camera reference.' },
    @{ source = 'game/public/map/terrain/mountain-relief-1.png'; file = 'mountain-relief-1.png'; role = 'User-approved mountain composition and scale in the actual map. Raw footprint requires registration. Not a certified 3D camera reference.' }
)
$sourcePaths = @('game/src/ui/map-projection.ts', 'art-reference/map/geometry/terrain-hex.json', 'tools/map.ts', 'game/src/ui/map-terrain.ts', 'game/src/ui/map-terrain-footprints.json', 'art-reference/map/source-assets.json', 'docs/map-art.md')
foreach ($reference in $references) {
    $source = Join-Path $repoRoot $reference.source
    Copy-Item -LiteralPath $source -Destination (Join-Path $referenceDir $reference.file) -Force
    $reference.sha256 = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
    $sourcePaths += $reference.source
}
Write-JsonFile (Join-Path $referenceDir 'index.json') $references

$warnings = [System.Collections.Generic.List[string]]::new()
$current = Get-Content -LiteralPath (Join-Path $repoRoot 'game/src/ui/map-terrain-footprints.json') -Raw | ConvertFrom-Json
foreach ($entry in $current.PSObject.Properties) {
    if (-not $entry.Value.groundFill) { $warnings.Add("Current footprint metadata for $($entry.Name) has no groundFill; the current generator requires it. Check integration before rebuilding. This kit does not change runtime metadata.") }
}
$sample = @{}
$exampleAsset = '/map/terrain/forest-relief-1.png'
if ($current.PSObject.Properties[$exampleAsset]) { $sample[$exampleAsset] = $current.PSObject.Properties[$exampleAsset].Value }
# Example is sourced from the recorded measurement, never synthesized for another image.
$measurementPath = Join-Path $repoRoot 'art-reference/map-calibration/registration.json'
if (Test-Path -LiteralPath $measurementPath) {
    $recorded = Get-Content -LiteralPath $measurementPath -Raw | ConvertFrom-Json
    if ($recorded.asset -eq '/map/terrain/forest-relief-1.png' -and $recorded.source.groundFill) {
        $sample = @{ $recorded.asset = $recorded.source }
        $sourcePaths += 'art-reference/map-calibration/registration.json'
    }
}
Write-JsonFile (Join-Path $exampleDir 'footprint-format.json') $sample
$sources = foreach ($relative in $sourcePaths) {
    @{ path = $relative; sha256 = (Get-FileHash -LiteralPath (Join-Path $repoRoot $relative) -Algorithm SHA256).Hash.ToLowerInvariant() }
}
Write-JsonFile (Join-Path $PSScriptRoot 'manifest.json') @{
    generatedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
    purpose = 'Portable reference snapshots, not model training and not asset approval.'
    sources = @($sources)
    integrationWarnings = @($warnings.ToArray())
}
Write-Output "Refreshed map art reference kit: $PSScriptRoot"
foreach ($warning in $warnings) { Write-Warning $warning }
& node (Join-Path $PSScriptRoot 'inventory.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Could not refresh terrain coverage inventory.' }
