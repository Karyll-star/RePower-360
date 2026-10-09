# 从 index.html 抽取每页 data-title 与演讲者备注（.notes），生成逐字稿 notes.html
# 用法：powershell -ExecutionPolicy Bypass -File build-notes.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
$src  = Join-Path $root 'index.html'
$out  = Join-Path $root 'notes.html'

$html = Get-Content -Path $src -Raw -Encoding UTF8
$rx = [regex]'(?s)<section class="slide[^"]*"\s+data-title="([^"]*)"(.*?)</section>'
$slides = $rx.Matches($html)
if ($slides.Count -eq 0) { throw '未匹配到任何 slide，请检查 index.html 的 section 结构' }

$total = $slides.Count
$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine('<!DOCTYPE html>')
[void]$sb.AppendLine('<html lang="zh-CN">')
[void]$sb.AppendLine('<head>')
[void]$sb.AppendLine('<meta charset="utf-8">')
[void]$sb.AppendLine('<title>智储重生 RePower-360 · 演讲者逐字稿</title>')
[void]$sb.AppendLine('<style>')
[void]$sb.AppendLine('@page{size:A4 portrait;margin:15mm 16mm 14mm}')
[void]$sb.AppendLine('*{box-sizing:border-box}')
[void]$sb.AppendLine('body{margin:0;font-family:"Microsoft YaHei","PingFang SC","Noto Sans SC",-apple-system,sans-serif;')
[void]$sb.AppendLine('  font-size:11.5pt;line-height:1.85;color:#14171b;background:#fff;')
[void]$sb.AppendLine('  -webkit-print-color-adjust:exact;print-color-adjust:exact}')
[void]$sb.AppendLine('.doc-head{page-break-after:always;break-after:page;padding-top:60mm;text-align:center}')
[void]$sb.AppendLine('.doc-head .k{font-size:11pt;letter-spacing:.22em;color:#b06a00;text-transform:uppercase}')
[void]$sb.AppendLine('.doc-head h1{font-size:26pt;margin:10px 0 6px;letter-spacing:-.02em}')
[void]$sb.AppendLine('.doc-head .s{font-size:12pt;color:#555;margin:0 0 26px}')
[void]$sb.AppendLine('.doc-head .m{display:inline-block;text-align:left;font-size:10.5pt;color:#333;')
[void]$sb.AppendLine('  border:1px solid #d5d9de;border-radius:8px;padding:14px 18px;line-height:1.9}')
[void]$sb.AppendLine('.npage{page-break-after:always;break-after:page}')
[void]$sb.AppendLine('.npage:last-child{page-break-after:auto;break-after:auto}')
[void]$sb.AppendLine('.nhead{display:flex;align-items:baseline;gap:10px;border-bottom:2px solid #14171b;')
[void]$sb.AppendLine('  padding-bottom:7px;margin-bottom:14px}')
[void]$sb.AppendLine('.nno{font-size:15pt;font-weight:700;color:#b06a00;min-width:38px}')
[void]$sb.AppendLine('.nti{font-size:13.5pt;font-weight:700}')
[void]$sb.AppendLine('.npg{margin-left:auto;font-size:10pt;color:#777}')
[void]$sb.AppendLine('.nbody p{margin:0 0 .78em}')
[void]$sb.AppendLine('.nbody strong{color:#a8410a}')
[void]$sb.AppendLine('.nbody em{font-style:normal;color:#2b6cb0}')
[void]$sb.AppendLine('.nbody code{font-family:Consolas,Menlo,monospace;font-size:10.5pt;')
[void]$sb.AppendLine('  background:#f2f3f5;border-radius:3px;padding:1px 5px}')
[void]$sb.AppendLine('.empty{color:#999}')
[void]$sb.AppendLine('.nfoot{margin-top:18px;padding-top:8px;border-top:1px dashed #ccc;font-size:9.5pt;color:#888}')
[void]$sb.AppendLine('</style>')
[void]$sb.AppendLine('</head>')
[void]$sb.AppendLine('<body>')

[void]$sb.AppendLine('<section class="doc-head">')
[void]$sb.AppendLine('  <p class="k">RE-ENERGY · Speaker Script</p>')
[void]$sb.AppendLine('  <h1>智储重生 RePower-360 · 演讲者逐字稿</h1>')
[void]$sb.AppendLine('  <p class="s">工商业储能柜后市场方案全景（共 ' + $total + ' 页）</p>')
[void]$sb.AppendLine('  <div class="m">')
[void]$sb.AppendLine('    本稿与主 PDF <b>页码一一对应</b>，可直接照着讲。<br>')
[void]$sb.AppendLine('    每页备注分三段：<b>要点</b> → <b>强调</b> → <b>过渡</b>。<br>')
[void]$sb.AppendLine('    建议总时长 12–15 分钟；时间不足时压缩 PART 1。')
[void]$sb.AppendLine('  </div>')
[void]$sb.AppendLine('</section>')

for ($i = 0; $i -lt $total; $i++) {
  $m = $slides[$i]
  $title = $m.Groups[1].Value
  $block = $m.Groups[2].Value
  $nm = [regex]::Match($block, '(?s)<div class="notes">(.*?)</div>')
  $notes = if ($nm.Success) { $nm.Groups[1].Value.Trim() } else { '<p class="empty">（本页暂无逐字稿）</p>' }

  $no = ('{0:D2}' -f ($i + 1))
  [void]$sb.AppendLine('<section class="npage">')
  [void]$sb.AppendLine(('  <div class="nhead"><span class="nno">' + $no + '</span><span class="nti">' + $title + '</span><span class="npg">P.' + $no + ' / ' + $total + '</span></div>'))
  [void]$sb.AppendLine('  <div class="nbody">')
  [void]$sb.AppendLine($notes)
  [void]$sb.AppendLine('  </div>')
  [void]$sb.AppendLine('</section>')
}

[void]$sb.AppendLine('</body>')
[void]$sb.AppendLine('</html>')

[System.IO.File]::WriteAllText($out, $sb.ToString(), (New-Object System.Text.UTF8Encoding $false))
Write-Host ('notes.html 生成完成：' + $total + ' 页')
