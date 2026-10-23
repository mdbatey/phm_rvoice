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

The **Add clips** page's **Make upload** button builds these files for you.

**Save groups** on the board saves only what changed, as a dated change file in this folder
(`changes-20261023-193000.json`):

```json
{
  "made": "2026-10-23T19:30:00.000Z",
  "groups": ["Rocky", "Grace"],
  "clips": [{ "file": "OhNo.mp3", "groups": ["Grace", "Eva"] }],
  "order": { "Eva": ["Applause.mp3", "KnockKnock.mp3"] }
}
```

Every key but `made` is optional: `groups` is the full group list when groups were added, renamed or
deleted, `clips` gives the new groups of clips that moved, and `order` gives the new clip order of
groups that were reordered (`clips.json` can hold `order` too). Change files apply oldest first on top
of `clips.json`, and only when newer than its `updated` time, so a full rewrite of `clips.json` with a
new `updated` time replaces them.
