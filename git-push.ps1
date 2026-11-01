$git = "C:\Program Files\Git\cmd\git.exe"
$repo = "c:\Users\Stiven Ferreira\Desktop\web - invitacion Santi"

Set-Location $repo

# Remove temp scripts
Remove-Item "find-node.ps1" -ErrorAction SilentlyContinue
Remove-Item "find-node2.ps1" -ErrorAction SilentlyContinue
Remove-Item "find-node.log" -ErrorAction SilentlyContinue
Remove-Item "find-node2.log" -ErrorAction SilentlyContinue
Remove-Item "git-setup.ps1" -ErrorAction SilentlyContinue
Remove-Item "git-setup.log" -ErrorAction SilentlyContinue
Remove-Item "npm-install.log" -ErrorAction SilentlyContinue

# Configure git user (needed for commit)
& $git config user.email "vielmaMR@users.noreply.github.com" 2>&1
& $git config user.name "vielmaMR" 2>&1

# Add all files (gitignore will exclude node_modules and xlsx/csv)
$addResult = & $git add -A 2>&1
Write-Output "git add: $addResult"

# Show what will be committed
$diff = & $git diff --cached --name-only 2>&1
Write-Output "Files to commit: $diff"

# Commit
$commitResult = & $git commit -m "Initial commit: invitacion Santiago y Dahiana" 2>&1
Write-Output "Commit: $commitResult"

# Rename branch to main
$branchResult = & $git branch -M main 2>&1
Write-Output "Branch rename: $branchResult"

# Push
Write-Output "Pushing to origin main..."
$pushResult = & $git push -u origin main 2>&1
Write-Output "Push result: $pushResult"

Write-Output "DONE"
