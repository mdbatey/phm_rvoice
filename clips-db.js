// Shared browser storage for the board and the tester. Everything stays in this
// browser's IndexedDB; nothing is uploaded. Every call resolves (never rejects)
// so the pages still work where storage is blocked.
//   clips:  { id, name, blob, groups: [groupId] }
//   groups: { id, name }
window.RockyDB = (function () {
  var dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (res) {
      try {
        var req = indexedDB.open("rocky-board", 2);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains("clips")) db.createObjectStore("clips", { keyPath: "id" });
          if (!db.objectStoreNames.contains("groups")) db.createObjectStore("groups", { keyPath: "id" });
        };
        req.onsuccess = function () {
          var db = req.result;
          db.onversionchange = function () { db.close(); };
          res(db);
        };
        req.onerror = function () { res(null); };
        req.onblocked = function () { res(null); };
      } catch (e) { res(null); }
    });
    return dbp;
  }

  function all(store) {
    return open().then(function (db) {
      return new Promise(function (res) {
        if (!db) return res([]);
        try {
          var r = db.transaction(store).objectStore(store).getAll();
          r.onsuccess = function () { res(r.result || []); };
          r.onerror = function () { res([]); };
        } catch (e) { res([]); }
      });
    });
  }

  // ops: [["put", value] | ["delete", key] | ["clear"]]
  function write(store, ops) {
    return open().then(function (db) {
      return new Promise(function (res) {
        if (!db) return res(false);
        try {
          var tx = db.transaction(store, "readwrite");
          var s = tx.objectStore(store);
          ops.forEach(function (op) {
            if (op[0] === "put") s.put(op[1]);
            else if (op[0] === "delete") s.delete(op[1]);
            else if (op[0] === "clear") s.clear();
          });
          tx.oncomplete = function () { res(true); };
          tx.onerror = tx.onabort = function () { res(false); };
        } catch (e) { res(false); }
      });
    });
  }

  // "I_mGladYouDidn_tDie_louder.mp3" -> "I'm Glad You Didn't Die (louder)"
  function prettyName(path) {
    var n = String(path).replace(/^.*\//, "").replace(/\.[^.]+$/, "");
    var tags = [], m;
    while ((m = n.match(/_(DeletedScene|louder)$/i))) {
      tags.unshift(m[1].toLowerCase() === "deletedscene" ? "deleted scene" : "louder");
      n = n.slice(0, -m[0].length);
    }
    n = n.replace(/([A-Za-z])_(m|t|s|re|ll|ve|d)(?![a-z])/g, "$1'$2")
      .replace(/[_-]+/g, " ")
      .replace(/([a-z'])([A-Z])/g, "$1 $2")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
      .replace(/([A-Za-z])(\d)/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim();
    return n + tags.map(function (t) { return " (" + t + ")"; }).join("");
  }

  // Names that differ only in spacing, case or punctuation are the same clip:
  // "I mGladYouDidn tDie" and "I'm Glad You Didn't Die" both become "imgladyoudidntdie".
  function sameKey(name) { return String(name).toLowerCase().replace(/[^a-z0-9]+/g, ""); }

  // Group changes to clips saved in the repo are remembered in this browser only, along with the
  // repo's groups for that clip at the time. Once the repo's groups for the clip change (someone saved
  // groups to GitHub), the repo wins and the browser's change is dropped.
  var OVERRIDE_KEY = "rocky-saved-clip-groups";
  function baseKey(repoGroups) { return JSON.stringify((repoGroups || []).slice().sort()); }
  function overrides() { try { return JSON.parse(localStorage.getItem(OVERRIDE_KEY) || "{}"); } catch (e) { return {}; } }
  function setOverride(id, groups, repoGroups) {
    var over = overrides();
    over[id] = { groups: groups, base: baseKey(repoGroups) };
    try { localStorage.setItem(OVERRIDE_KEY, JSON.stringify(over)); } catch (e) {}
  }
  // Group ids for a saved clip: this browser's change if it still applies, else the repo's group names
  // mapped through toId.
  function savedGroups(id, repoGroups, toId) {
    var o = overrides()[id];
    if (o && !Array.isArray(o) && o.base === baseKey(repoGroups)) return o.groups.slice();
    return (repoGroups || []).map(toId);
  }

  // The GitHub repo behind the site: owner.github.io/repo, or this one when viewed elsewhere.
  var REPO = "mdbatey/phm_rvoice";
  var ghHost = location.hostname.match(/^([^.]+)\.github\.io$/), ghPath = location.pathname.split("/")[1];
  if (ghHost && ghPath) REPO = ghHost[1] + "/" + ghPath;
  var AUDIO_RE = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|webm)$/i;

  function getJson(url) {
    return fetch(url, { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  // Every clip saved in the repo. clips/clips.json is the main list. A clip uploaded on its own comes
  // with a details file next to it ("Song.mp3" + "Song.mp3.json", holding one clips.json entry), and an
  // audio file with neither still shows, with no group. The folder listing comes from GitHub's API;
  // without it (offline, rate limited, or inside the Claude viewer) only clips.json is used.
  // clips.json wins over a details file for the same audio. Resolves null when there is nothing.
  function saved() {
    return Promise.all([
      getJson("clips/clips.json"),
      getJson("https://api.github.com/repos/" + REPO + "/contents/clips")
    ]).then(function (r) {
      var base = r[0] && Array.isArray(r[0].clips) ? r[0] : null;
      var m = { groups: base && Array.isArray(base.groups) ? base.groups.slice() : [], clips: base ? base.clips.slice() : [] };
      var have = {};
      m.clips.forEach(function (c) { if (c && c.file) have[c.file] = true; });
      var names = Array.isArray(r[1]) ? r[1].map(function (f) { return f && f.name; }).filter(Boolean) : [];
      var audio = {};
      names.forEach(function (n) { if (AUDIO_RE.test(n)) audio[n] = true; });
      var details = names.filter(function (n) {
        return /\.json$/i.test(n) && n !== "clips.json" && audio[n.slice(0, -5)] && !have[n.slice(0, -5)];
      });
      return Promise.all(details.map(function (n) { return getJson("clips/" + encodeURIComponent(n)); })).then(function (entries) {
        entries.forEach(function (e) {
          [].concat(e || []).forEach(function (c) {
            if (!c || !c.file || have[c.file] || !audio[c.file]) return;
            var groups = Array.isArray(c.groups) ? c.groups : [];
            m.clips.push({ file: c.file, name: c.name || prettyName(c.file), groups: groups });
            have[c.file] = true;
            groups.forEach(function (g) { if (m.groups.indexOf(g) === -1) m.groups.push(g); });
          });
        });
        Object.keys(audio).forEach(function (f) {
          if (!have[f]) { m.clips.push({ file: f, name: prettyName(f), groups: [] }); have[f] = true; }
        });
        return base || m.clips.length ? m : null;
      });
    });
  }

  function newId(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  return {
    open: open,
    newId: newId,
    prettyName: prettyName,
    sameKey: sameKey,
    overrides: overrides,
    setOverride: setOverride,
    savedGroups: savedGroups,
    saved: saved,
    deleteClips: function (ids) { return write("clips", ids.map(function (id) { return ["delete", id]; })); },
    clips: function () {
      return all("clips").then(function (list) {
        list.forEach(function (c) { if (!c.groups) c.groups = []; });
        return list.sort(function (a, b) { return a.id < b.id ? -1 : 1; });
      });
    },
    groups: function () {
      return all("groups").then(function (list) {
        return list.sort(function (a, b) { return a.id < b.id ? -1 : 1; });
      });
    },
    putClips: function (list) { return write("clips", list.map(function (c) { return ["put", c]; })); },
    clearClips: function () { return write("clips", [["clear"]]); },
    putGroup: function (g) { return write("groups", [["put", g]]); },
    // Removes the group and takes it off every clip; the clips themselves stay.
    deleteGroup: function (id) {
      return write("groups", [["delete", id]]).then(function () {
        return all("clips");
      }).then(function (list) {
        var changed = list.filter(function (c) { return c.groups && c.groups.indexOf(id) !== -1; });
        changed.forEach(function (c) { c.groups = c.groups.filter(function (g) { return g !== id; }); });
        return write("clips", changed.map(function (c) { return ["put", c]; }));
      });
    }
  };
})();
