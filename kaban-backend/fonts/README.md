# fonts/msfonts

Real Microsoft font files, copied from a licensed Windows install, used by the
backend's Docker image so LibreOffice's docx→pdf conversion matches Word's
line-wrap/pagination exactly (see `Dockerfile`, `src/modules/files/files.service.ts`).

**These files are never committed** (`.gitignore` excludes everything in this
folder except this README and `.gitkeep`) — Microsoft's font EULA doesn't permit
redistribution. Anyone rebuilding the backend image needs to populate this
folder locally first, from a machine they hold a valid Windows/Office license for.

## Required files

Copy these from `C:\Windows\Fonts` into `kaban-backend/fonts/msfonts/`:

```
calibri.ttf, calibrib.ttf, calibrii.ttf, calibriz.ttf, calibril.ttf, calibrili.ttf
cambria.ttc, cambriab.ttf, cambriai.ttf, cambriaz.ttf
arial.ttf, arialbd.ttf, ariali.ttf, arialbi.ttf, ariblk.ttf
times.ttf, timesbd.ttf, timesi.ttf, timesbi.ttf
cour.ttf, courbd.ttf, couri.ttf, courbi.ttf
AGENCYB.TTF, AGENCYR.TTF
BOOKOS.TTF, BOOKOSB.TTF, BOOKOSI.TTF, BOOKOSBI.TTF
LCALLIG.TTF
```

## PowerShell one-liner (run on Windows, from the repo root)

```powershell
$dest = "kaban-backend\fonts\msfonts"
$files = @(
  'calibri.ttf','calibrib.ttf','calibrii.ttf','calibriz.ttf','calibril.ttf','calibrili.ttf',
  'cambria.ttc','cambriab.ttf','cambriai.ttf','cambriaz.ttf',
  'arial.ttf','arialbd.ttf','ariali.ttf','arialbi.ttf','ariblk.ttf',
  'times.ttf','timesbd.ttf','timesi.ttf','timesbi.ttf',
  'cour.ttf','courbd.ttf','couri.ttf','courbi.ttf',
  'AGENCYB.TTF','AGENCYR.TTF',
  'BOOKOS.TTF','BOOKOSB.TTF','BOOKOSI.TTF','BOOKOSBI.TTF',
  'LCALLIG.TTF'
)
foreach ($f in $files) { Copy-Item "C:\Windows\Fonts\$f" -Destination $dest -Force }
```

If you need a different font family, look up its exact installed filename first
(names aren't always guessable) via:

```powershell
Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts' |
  Select-Object -ExpandProperty PSObject |
  ForEach-Object { $_.Properties } | Where-Object Name -like '*YourFontName*'
```

## After copying

Rebuild the backend image so `Dockerfile`'s `COPY fonts/msfonts /usr/share/fonts/msfonts`
step picks them up:

```
docker compose build backend
docker compose up -d backend
```
