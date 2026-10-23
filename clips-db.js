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

  function newId(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  return {
    open: open,
    newId: newId,
    prettyName: prettyName,
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
