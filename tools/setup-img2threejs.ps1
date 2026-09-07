$ErrorActionPreference = "Stop"

$checkout = Join-Path $HOME ".slu-tools\img2threejs"
$codexRoot = Join-Path $HOME ".codex\skills"
$claudeRoot = Join-Path $HOME ".claude\skills"
$codexLink = Join-Path $codexRoot "img2threejs"
$claudeLink = Join-Path $claudeRoot "img2threejs"

function Ensure-Parent([string]$path) {
  if (-not (Test-Path $path)) { New-Item -ItemType Directory -Path $path -Force | Out-Null }
}

function Ensure-Checkout {
  $parent = Split-Path $checkout -Parent
  Ensure-Parent $parent
  if (Test-Path (Join-Path $checkout ".git")) {
    Write-Host "Updating shared img2threejs checkout..."
    git -C $checkout pull --ff-only
  } elseif (Test-Path $checkout) {
    throw "Expected $checkout to be a git checkout. Move/remove it and rerun."
  } else {
    Write-Host "Cloning img2threejs..."
    git clone https://github.com/img2threejs/img2threejs.git $checkout
  }
}

function Ensure-Junction([string]$linkPath) {
  Ensure-Parent (Split-Path $linkPath -Parent)
  if (Test-Path $linkPath) {
    $item = Get-Item $linkPath -Force
    if ($item.LinkType -eq "Junction" -and $item.Target -contains $checkout) {
      Write-Host "Already linked: $linkPath"
      return
    }
    throw "Path already exists and is not the expected junction: $linkPath"
  }
  New-Item -ItemType Junction -Path $linkPath -Target $checkout | Out-Null
  Write-Host "Linked $linkPath -> $checkout"
}

Ensure-Checkout
Ensure-Junction $codexLink
Ensure-Junction $claudeLink

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { $python = Get-Command python3 -ErrorAction SilentlyContinue }
if (-not $python) { throw "Python 3.10+ is required by img2threejs." }

Write-Host ""
Write-Host "img2threejs is ready for Codex and Claude."
Write-Host "Shared checkout: $checkout"
Write-Host "Codex skill:      $codexLink"
Write-Host "Claude skill:     $claudeLink"
Write-Host ""
Write-Host "Next: open Traversal FPS in Codex, attach the approved rifle image, and ask Astra to use the img2threejs skill and follow AGENTS.md."
