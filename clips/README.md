# Saved clips

Audio files in this folder show up as pads on the board for everyone who opens the site.
`clips.json` lists them and the groups they belong to:

```json
{
  "groups": ["Person 1"],
  "clips": [
    { "file": "amaze.mp3", "name": "Amaze", "groups": ["Person 1"] }
  ]
}
```

- `file` is the file name in this folder.
- `name` is the label on the pad.
- `groups` are group names. A clip can be in more than one.

A clip can also be added on its own, without touching `clips.json`: upload the audio file plus a
details file named after it with `.json` added (`Song.mp3` and `Song.mp3.json`), holding one entry:

```json
{ "file": "Song.mp3", "name": "Song", "groups": ["Music"] }
```

The board finds these through GitHub's file list. An audio file with no entry anywhere still shows,
with no group. If a clip is in both, `clips.json` wins.

The **Add clips** page's **Make upload** button builds these files for you. **Save groups**
on the board writes one complete `clips.json` that includes clips added on their own, plus each
group's clip order under `"order"` (group name to a list of files).
