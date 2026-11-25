## Which file do I download?

| Your computer | Download |
|---------------|----------|
| Windows on an Intel or AMD PC | `FreeKards-<version>-win-x64.exe` |
| Windows on ARM (Surface Pro 9 5G, Surface Pro 11, Snapdragon laptops) | `FreeKards-<version>-win-arm64.exe` |
| Linux Mint, Ubuntu, Debian (x64) | `FreeKards-<version>-linux-amd64.deb` |
| Linux on ARM64 (Debian-based) | `FreeKards-<version>-linux-arm64.deb` |
| Any other Linux | the `.AppImage` for your processor (mark it executable, then run it) |

Not sure about Windows? Open **Settings → System → About** and look at **System type**: "x64-based" or "ARM-based".

### Windows says "Windows protected your PC"
The FreeKards installer is not code-signed yet, so Windows SmartScreen warns about it the first
time. Click **More info**, then **Run anyway**. If your browser warns while downloading, choose
**Keep**. FreeKards is open source, and every installer on this page was built by GitHub Actions
from the code in this repository.

The `sbom/` files list every component and asset in the app, with its license.

---
