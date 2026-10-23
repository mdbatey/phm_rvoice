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

The tester's **Make upload** button writes this file for you, merged with what is already here.
