# Personal Drag Macro (native Windows build)

This is a separate native Windows desktop utility in the `batmaniscool` repository. It does not use Electron and has no online features.

## Use

1. Open `build/PersonalDragMacro.exe`.
2. Press **Record hotkey**, press a combination such as `Ctrl + Shift + D`, then choose **Save hotkey**.
3. Press the hotkey once to hold the selected mouse button; press it again to release it.
4. `F8` is an emergency release key if Windows makes it available.

Use it for ordinary desktop tasks or local tests such as Microsoft Paint. Do not run it alongside Fortnite or another service that disallows macro or automation tools.

## Build from source

```powershell
dotnet publish .\PersonalDragMacro.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o .\build
```
