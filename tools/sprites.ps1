param(
  [ValidateSet('open','prepare','export','sync','ai','status','capture','apply-all','open-character','sync-character')][string]$Action='open',
  [string]$Sprite='p1.walk', [string]$Instruction='', [string]$Plan='', [string]$Project='',
  [string]$SourceSheet='', [int]$Columns=4, [int]$Rows=3, [switch]$DryRun, [switch]$UseAi
)
$ErrorActionPreference='Stop'
$spriteRoot=Split-Path $PSScriptRoot -Parent
$spritePython=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
$pixelExe=Join-Path $env:LOCALAPPDATA 'Programs/Pixelorama/Pixelorama-Windows-64bit/Pixelorama.exe'
$spriteTool=Join-Path $PSScriptRoot 'sprite_workflow.py'
if(-not(Test-Path -LiteralPath $spritePython)){throw 'Python with Pillow is required. See tools/SPRITES.md.'}
if(-not(Test-Path -LiteralPath $pixelExe)){throw 'Pixelorama is not installed.'}
function Invoke-SpriteTool([string[]]$ToolArgs){
  & $spritePython $spriteTool @ToolArgs
  if($LASTEXITCODE -ne 0){throw 'Sprite command failed; existing game data was not replaced.'}
}
$spriteWork=Join-Path $spriteRoot ('art-src/pixelorama/'+$Sprite)
if($Action -eq 'ai'){
  if(-not $Instruction){throw 'Supply -Instruction with the desired frame changes.'}
  if($Sprite -eq 'all'){Invoke-SpriteTool -ToolArgs @('ai-all','all','--instruction',$Instruction);return}
  if($DryRun){Write-Output 'AI connection: existing Codex login; read-only analysis -> validated JSON -> ai-candidate.pxo';return}
  Invoke-SpriteTool -ToolArgs @('prepare',$Sprite)
  $captureArgs=@('capture',$Sprite)
  if($Project){$captureArgs+=@('--project',$Project)}
  Invoke-SpriteTool -ToolArgs $captureArgs
  $spriteSource=Join-Path $spriteWork 'source.json'
  $spriteImage=Join-Path $spriteWork 'source.png'
  $spriteResponse=Join-Path $spriteWork 'ai-plan.json'
  $spriteSchema=Join-Path $PSScriptRoot 'sprite-plan.schema.json'
  $spriteContext=Get-Content -LiteralPath $spriteSource -Raw
  $spritePrompt=@"
Analyze the attached numbered full-body animation frames for sprite $Sprite.
User request: $Instruction
Source metadata: $spriteContext
Return ONLY the JSON required by the schema. Frame source indexes are ZERO based.
Preserve each complete raster character. You may reorder/repeat/omit existing source frames,
change duration_ms, and translate WHOLE frames by integer dx/dy. Never split or rig the body,
stretch limbs, fabricate missing poses, execute tools, edit files, or generate images.
Use needs_redraw for source indexes whose anatomy or missing leg phase cannot be repaired
by sequencing/alignment. Explain this honestly in reason. Do not claim drawing repairs.
For loop actions choose a coherent final-to-first transition. For one-shot actions preserve anticipation, impact, recovery and the final hold; never force deaths, jumps or attacks into a loop. Preserve the original total duration and keep attack impact near40-62percent.
"@
  $codexArgs=@('exec','--sandbox','read-only','--skip-git-repo-check','--ephemeral','--cd',$spriteRoot,
    '--output-schema',$spriteSchema,'--output-last-message',$spriteResponse,'--image',$spriteImage,'--','-')
  if(-not(Get-Command codex -ErrorAction SilentlyContinue)){throw 'Codex CLI is required for -Action ai.'}
  $spritePrompt | & codex @codexArgs
  if($LASTEXITCODE -ne 0){throw 'AI analysis failed. Original projects and game frames are unchanged.'}
  Invoke-SpriteTool -ToolArgs @('prepare',$Sprite,'--plan',$spriteResponse)
  $Project=Join-Path $spriteWork 'ai-candidate.pxo'
  Start-Process -FilePath $pixelExe -ArgumentList @(('"'+$Project+'"')) -WindowStyle Normal
}elseif($Action -eq 'open-character'){
  $bundleArgs=@('bundle',$Sprite)
  if($UseAi){$bundleArgs+=@('--use-ai')}
  Invoke-SpriteTool -ToolArgs $bundleArgs
  if($Sprite -eq 'all'){return}
  $Project=Join-Path $spriteRoot ('art-src/pixelorama/characters/'+$Sprite+'.pxo')
  Start-Process -FilePath $pixelExe -ArgumentList @(('"'+$Project+'"')) -WindowStyle Normal
}elseif($Action -eq 'sync-character'){
  $bundleArgs=@('unbundle',$Sprite)
  if($Project){$bundleArgs+=@('--project',$Project)}
  Invoke-SpriteTool -ToolArgs $bundleArgs
}elseif($Action -eq 'apply-all'){
  $batchArgs=@('batch','all')
  if($Instruction){$batchArgs+=@('--instruction',$Instruction)}
  Invoke-SpriteTool -ToolArgs $batchArgs
}elseif($Action -eq 'open'){
  if(-not $Project){Invoke-SpriteTool -ToolArgs @('prepare',$Sprite);$Project=Join-Path $spriteWork 'project.pxo'}
  Start-Process -FilePath $pixelExe -ArgumentList @(('"'+$Project+'"')) -WindowStyle Normal
}else{
  $spriteArgs=@($Action,$Sprite)
  if($UseAi){$spriteArgs+=@('--use-ai')}
  if($Plan){$spriteArgs+=@('--plan',$Plan)}
  if($Project){$spriteArgs+=@('--project',$Project)}
  if($SourceSheet){$spriteArgs+=@('--sheet',$SourceSheet,'--columns',"$Columns",'--rows',"$Rows")}
  Invoke-SpriteTool $spriteArgs
}
