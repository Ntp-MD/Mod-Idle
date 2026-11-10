param(
    [Parameter(Mandatory = $true)][string]$Image,
    [Parameter(Mandatory = $true)][string]$Output
)
$ErrorActionPreference = 'Stop'
$imagePath = (Resolve-Path -LiteralPath $Image).Path
$outputPath = [System.IO.Path]::GetFullPath($Output)
if (Test-Path -LiteralPath $outputPath) { throw "Measurement already exists: $outputPath" }
Add-Type -AssemblyName System.Drawing
$bitmap = [System.Drawing.Bitmap]::FromFile($imagePath)
try {
    $width = $bitmap.Width; $height = $bitmap.Height
    $format = $bitmap.PixelFormat.ToString()
    $rect = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
    $bits = $bitmap.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
        $bytes = New-Object byte[] ($bits.Stride * $height)
        [System.Runtime.InteropServices.Marshal]::Copy($bits.Scan0, $bytes, 0, $bytes.Length)
        $contour = [System.Collections.Generic.List[object]]::new()
        $red = 0.0; $green = 0.0; $blue = 0.0; $samples = 0
        for ($y = 0; $y -lt $height; $y++) {
            $left = -1; $right = -1
            for ($x = 0; $x -lt $width; $x++) {
                if ($bytes[$y * $bits.Stride + $x * 4 + 3] -ge 128) { $left = $x; break }
            }
            if ($left -lt 0) { continue }
            for ($x = $width - 1; $x -ge $left; $x--) {
                if ($bytes[$y * $bits.Stride + $x * 4 + 3] -ge 128) { $right = $x; break }
            }
            $contour.Add(@($left, $y)); $contour.Add(@($right, $y))
            if ($y -gt $height * 0.2 -and $y -lt $height * 0.8 -and $right - $left -gt 16) {
                foreach ($sampleX in @(($left + 8), ($right - 8))) {
                    $at = $y * $bits.Stride + $sampleX * 4
                    if ($bytes[$at + 3] -ge 250) {
                        $blue += $bytes[$at]; $green += $bytes[$at + 1]; $red += $bytes[$at + 2]; $samples++
                    }
                }
            }
        }
        if ($contour.Count -lt 6 -or $samples -eq 0) { throw 'No measurable opaque ground silhouette.' }
        $corners = @($bytes[3], $bytes[($width - 1) * 4 + 3], $bytes[($height - 1) * $bits.Stride + 3], $bytes[($height - 1) * $bits.Stride + ($width - 1) * 4 + 3])
        $groundFill = '#{0:x2}{1:x2}{2:x2}' -f [int]($red / $samples), [int]($green / $samples), [int]($blue / $samples)
        $inputData = @{ width = $width; height = $height; format = $format; cornerAlpha = $corners; groundFill = $groundFill; contour = $contour; template = (Join-Path $PSScriptRoot 'geometry/hex-spec.json') }
    } finally { $bitmap.UnlockBits($bits) }
} finally { $bitmap.Dispose() }
$code = @'
import fs from 'node:fs';
const r=JSON.parse(fs.readFileSync(0,'utf8'));
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const points=r.contour.sort((a,b)=>a[0]-b[0]||a[1]-b[1]),lower=[],upper=[];
for(const p of points){while(lower.length>=2&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
for(const p of points.toReversed()){while(upper.length>=2&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
const hull=[...lower.slice(0,-1),...upper.slice(0,-1)];
if(hull.length<6)throw Error('Silhouette has fewer than six convex vertices. Review manually.');
while(hull.length>6){let at=0,min=Infinity;hull.forEach((p,i)=>{const area=Math.abs(cross(hull[(i+hull.length-1)%hull.length],p,hull[(i+1)%hull.length]));if(area<min){min=area;at=i;}});hull.splice(at,1);}
const t=JSON.parse(fs.readFileSync(r.template,'utf8'));
let best=null,error=Infinity;
for(let shift=0;shift<6;shift++){const candidate=hull.map((_,i)=>hull[(i+shift)%6]);const e=candidate.reduce((s,[x,y],i)=>s+(x/r.width-t.vertices[i][0]/t.canvas.width)**2+(y/r.height-t.vertices[i][1]/t.canvas.height)**2,0);if(e<error){error=e;best=candidate;}}
console.log(JSON.stringify({method:'Alpha >=128 row extrema, convex hull simplified to six vertices; cyclic order matched to current template. Requires visual review; not a camera-angle certificate.',width:r.width,height:r.height,pixelFormat:r.format,cornerAlpha:r.cornerAlpha,groundFill:r.groundFill,vertices:best},null,2));
'@
$result = ($inputData | ConvertTo-Json -Depth 6 -Compress) | & node --input-type=module -e $code
if ($LASTEXITCODE -ne 0) { throw 'Footprint measurement failed.' }
[System.IO.File]::WriteAllText($outputPath, (($result -join "`n") + "`n"))
Write-Output ($result -join "`n")
