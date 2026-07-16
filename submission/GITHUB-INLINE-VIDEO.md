# Optional: upgrade the README to a TRUE inline GitHub video player

The README currently shows a clickable poster that streams the film from
`https://www.evolvedmcp.cloud/demo.mp4` — this works today (click → plays).

GitHub will **only** render an *inline* `<video>` player for files uploaded
through its own web UI (which mints a `https://github.com/user-attachments/...`
URL). That upload requires a real drag-and-drop or file-picker action, so it
can't be automated from this environment — it's a 20-second manual step for you:

1. Open <https://github.com/kr8tiv-ai/evolved/edit/main/README.md> (signed in).
2. Drag **`submission/evolved-demo-web.mp4`** (8.2 MB — under GitHub's video
   attachment limit) straight into the editor text area, on its own line where
   the poster block is. GitHub uploads it and inserts a
   `https://github.com/user-attachments/assets/…` URL.
3. That URL renders as a native inline player. You can delete the old
   `[![Watch…]](…/demo.mp4)` poster line, or keep it as a fallback.
4. Commit the change.

That's the whole process. Everything else about the video already works:
- **Website:** the `#film` section on www.evolvedmcp.cloud plays the cut inline
  on click (poster → HTML5 player; `/demo.mp4` serves `video/mp4` with byte
  ranges — verified live, HTTP 206).
- **HackQuest:** the demo-video field points at the hosted cut and the project
  page embeds a working player.
- **README:** clickable poster → streams the hosted cut; lighter and
  full-quality files are both committed in `submission/`.
