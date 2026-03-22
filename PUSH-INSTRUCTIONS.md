# How to Push to GitHub

## Easiest Fix: Double-Click the Batch File

**Cursor locks the `.git` folder**, causing `fatal: unable to write new index file`.

1. Open **File Explorer** → go to `E:\My project\singapore\singapore_food`
2. **Double-click `Push to GitHub.bat`**
3. A console window will open and push your code (runs outside Cursor, so no lock)

You can keep Cursor open—the batch file runs in a separate process.

---

## Alternative: External Terminal

1. Close Cursor completely
2. Open **File Explorer** → go to `E:\My project\singapore\singapore_food`
3. In the address bar, type `powershell` and press **Enter**
4. Run: `.\git-full-push.ps1 "Your commit message"`

### 4. If prompted for credentials

- **Username**: `tkcsg2026`
- **Password**: Use a [GitHub Personal Access Token](https://github.com/settings/tokens), not your GitHub password

---

## Manual Commands (alternative)

If you prefer not to use the script:

```powershell
git add .
git commit -m "Your message"
git branch -M main
git push -u origin main
```

---

## When Using Git Inside Cursor

If you must run `git add` while Cursor is open, use the workaround:

```powershell
.\git-add-fix.ps1 .
```

Then close Cursor and run `git commit` and `git push` from an external terminal.

---

## Repository

https://github.com/tkcsg2026/singapore_food
