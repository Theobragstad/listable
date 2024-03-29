const express = require("express");
const app = express();
const pgp = require("pg-promise")();
const session = require("express-session");
const nodemailer = require("nodemailer");
const passport = require("passport");
const cookieSession = require("cookie-session");
const bodyParser = require("body-parser");

require("./passport");

const dbConfig = {
  host: "db",
  port: 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
};

const db = pgp(dbConfig);

db.connect()
  .then((obj) => {
    console.log("Database connection successful");
    obj.done();
  })
  .catch((error) => {
    console.log("ERROR:", error.message || error);
  });

app.set("view engine", "ejs");

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

app.use(express.static("resources"));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false,
    cookie: { maxAge: 3600000 },
    rolling: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Begin routing

app.get("/", (req, res) => {
  if (req.session.user) {
    return res.redirect("/lists");
  }

  return res.render("pages/home");
});

app.get("/home", (req, res) => {
  return res.redirect("/");
});

// Auth
app.get(
  "/auth",
  passport.authenticate("google", { scope: ["email", "profile"] })
);

// Auth callback
app.get(
  "/auth/callback",
  passport.authenticate("google", {
    successRedirect: "/auth/callback/success",
    failureRedirect: "/auth/callback/failure",
  })
);

// Auth failure
app.get("/auth/callback/failure", (req, res) => {
  res.send("Error");
});

// Auth success
app.get("/auth/callback/success", (req, res) => {
  if (!req.user) {
    res.redirect("/auth/callback/failure");
  } else {
    db.any(
      `INSERT INTO users (userId, email, fullname, profilePhotoUrl, listViewType, listPassword)
                VALUES ('${req.user.id}', '${req.user.email}', '${req.user.displayName}', '${req.user.photos[0].value}', 'column', NULL)
                ON CONFLICT (userId) DO UPDATE 
                SET email = excluded.email, 
                    fullname = excluded.fullname,
                    profilePhotoUrl = excluded.profilePhotoUrl;`
    )
      .then(() => {
        req.session.user = {
          id: req.user.id,
          givenName: req.user.name.givenName,
          email: req.user.email,
          profilePhoto: req.user.photos[0].value,
          displayName: req.user.displayName,
        };
        req.session.save();

        return res.redirect("/lists?login=success");
      })
      .catch((error) => {
        console.log(error);
        return res.redirect("/home?login=error");
      });
  }
});

const auth = (req, res, next) => {
  if (!req.session.user) {
    // Default to home page
    return res.redirect("/");
  }
  next();
};

// Require authentication
app.use(auth);

app.get("/lists", function (req, res) {
  const successMessages = [
    "added new list",
    "updated list",
    "changed list color",
    "deleted list",
    "deleted selected lists",
    "recovered list",
    "recovered selected lists",
    "recovered all lists",
    "copied list",
    "archived list",
    "unarchived list",
    "created unarchived copy",
  ];

  const errorMessages = [
    "error adding new list",
    "error updating list",
    "error changing list color",
    "error deleting list",
    "error deleting selected lists",
    "error recovering list",
    "error recovering selected lists",
    "error recovering all lists",
    "error copying list",
    "error archiving list",
    "error unarchiving list",
    "error copying archived list",
  ];

  var error = 0;
  var message = "";

  if (req.query.add) {
    message =
      req.query.add == "success" ? successMessages[0] : errorMessages[0];
    error = req.query.add == "success" ? 0 : 1;
  } else if (req.query.update) {
    message =
      req.query.update == "success" ? successMessages[1] : errorMessages[1];
    error = req.query.update == "success" ? 0 : 1;
  } else if (req.query.changeColor) {
    message =
      req.query.changeColor == "success"
        ? successMessages[2]
        : errorMessages[2];
    error = req.query.changeColor == "success" ? 0 : 1;
  } else if (req.query.delete) {
    message =
      req.query.delete == "success" ? successMessages[3] : errorMessages[3];
    error = req.query.delete == "success" ? 0 : 1;
  } else if (req.query.deleteSelected) {
    message =
      req.query.deleteSelected == "success"
        ? successMessages[4]
        : errorMessages[4];
    error = req.query.deleteSelected == "success" ? 0 : 1;

    if (req.query.count) {
      message =
        req.query.count == "1"
          ? "deleted " + req.query.count + " selected list"
          : "deleted " + req.query.count + " selected lists";
    }
  } else if (req.query.restore) {
    message =
      req.query.restore == "success" ? successMessages[5] : errorMessages[5];
    error = req.query.restore == "success" ? 0 : 1;

    if (req.query.archived && req.query.archived == "true") {
      return res.redirect("/archive?restore=success&archived=true");
    }
  } else if (req.query.restoreSelected) {
    message =
      req.query.restoreSelected == "success"
        ? successMessages[6]
        : errorMessages[6];
    error = req.query.restoreSelected == "success" ? 0 : 1;

    if (req.query.count) {
      message =
        req.query.count == "1"
          ? "recovered " + req.query.count + " selected list"
          : "recovered " + req.query.count + " selected lists";
    }
  } else if (req.query.restoreAll) {
    message =
      req.query.restoreAll == "success" ? successMessages[7] : errorMessages[7];
    error = req.query.restoreAll == "success" ? 0 : 1;
  } else if (req.query.copy) {
    message =
      req.query.copy == "success" ? successMessages[8] : errorMessages[8];
    error = req.query.copy == "success" ? 0 : 1;
  } else if (req.query.archive) {
    message =
      req.query.archive == "success" ? successMessages[9] : errorMessages[9];
    error = req.query.archive == "success" ? 0 : 1;
  } else if (req.query.unarchive) {
    message =
      req.query.unarchive == "success"
        ? successMessages[10]
        : errorMessages[10];
    error = req.query.unarchive == "success" ? 0 : 1;
  } else if (req.query.copyArchived) {
    message =
      req.query.copyArchived == "success"
        ? successMessages[11]
        : errorMessages[11];
    error = req.query.copyArchived == "success" ? 0 : 1;
  }

  db.tx((t) => {
    const lists = db.any(
      `SELECT lists.* FROM lists JOIN listsToUsers ON listsToUsers.listId = lists.listId WHERE listsToUsers.userId = '${req.session.user.id}' AND listsToUsers.archive = FALSE AND lists.trash = FALSE ORDER BY listsToUsers.pinned DESC, lists.editDateTime DESC;`
    );
    // const collaborators = db.any(`SELECT users.email, users.profilePhotoUrl, users.fullname, users.userId, listsToUsers.listId, listsToUsers.owner FROM listsToUsers INNER JOIN users ON listsToUsers.userId = users.userId ORDER BY owner DESC;`);
    const collaborators = db.any(
      `SELECT users.email, users.profilePhotoUrl, users.fullname, users.userId, listsToUsers.listId, listsToUsers.owner, listsToUsers.editable, listsToUsers.locked FROM listsToUsers INNER JOIN users ON listsToUsers.userId = users.userId ORDER BY owner DESC;`
    );

    const labels = db.any(
      `CREATE OR REPLACE VIEW labelsJoinlabelsToLists AS (SELECT labels.labelId, labels.label, labelsToLists.listId FROM labelsToLists INNER JOIN labels ON labelsToLists.labelId = labels.labelId);SELECT * FROM labelsJoinlabelsToLists WHERE labelId IN(SELECT labelId from labelsToUsers where userId = '${req.session.user.id}');`
    );
    const allLabels = db.any(
      `SELECT * FROM labels WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userID = '${req.session.user.id}') AND labelID IN(SELECT labels.labelId AS "numberOfLists" FROM labels LEFT JOIN labelsToLists ON labels.labelId = labelsToLists.labelId GROUP BY labels.labelId ORDER BY COUNT(labelsToLists.labelId) DESC, label ASC);`
    );
    const archivedLists = db.any(
      `SELECT listId FROM listsToUsers WHERE archive = TRUE AND userId = '${req.session.user.id}';`
    );
    const listViewType = db.any(
      `SELECT listViewType FROM users WHERE userId = '${req.session.user.id}';`
    );
    const pinnedLists = db.any(
      `SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}' AND pinned = TRUE;`
    );

    return t.batch([
      lists,
      collaborators,
      labels,
      allLabels,
      archivedLists,
      listViewType,
      pinnedLists,
    ]);
  })
    .then((data) => {
      var archivedListIds = [];
      var archivedListIdsRaw = data[4];
      for (var i = 0; i < archivedListIdsRaw.length; i++) {
        archivedListIds.push(archivedListIdsRaw[i].listid);
      }

      var pinnedListIds = [];
      var pinnedListIdsRaw = data[6];
      for (var i = 0; i < pinnedListIdsRaw.length; i++) {
        pinnedListIds.push(pinnedListIdsRaw[i].listid);
      }

      return res.render("pages/lists", {
        lists: data[0],
        collaborators: data[1],
        labels: data[2],
        allLabels: data[3],
        archivedListIds,
        listViewType: data[5][0].listviewtype,
        pinnedListIds,
        user: req.session.user,
        search: false,
        error,
        message,
        filterByLabel: false,
        label: null,
        labelid: null,
        searchInLabel: false,
      });
    })
    .catch((error) => {
      console.log(error);
      return res.render("pages/lists", {
        lists: [],
        collaborators: [],
        labels: [],
        archivedListIds: [],
        listViewType: null,
        pinnedListIds: [],
        user: req.session.user,
        search: false,
        error: true,
        message: "error loading lists",
        filterByLabel: false,
        label: null,
        labelid: null,
        searchInLabel: false,
      });
    });
});

app.get("/logout", function (req, res, next) {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    req.session.destroy();

    res.render("pages/home", { message: "signed out" });
  });
});

app.post("/search", function (req, res) {
  var q;

  if (req.body.q) {
    q = req.body.q.toLowerCase().replace(/'/g, "''");

    // Process color search
    var colorCodeToMatch1 = null;
    var colorCodeToMatch2 = null;
    switch (q) {
      case "white":
        colorCodeToMatch1 = "ffffff";
        break;
      case "gray":
        colorCodeToMatch1 = "eeeeee";
        break;
      case "yellow":
        colorCodeToMatch1 = "fdf5c1";
        break;
      case "orange":
        colorCodeToMatch1 = "f7cdc2";
        break;
      case "blue":
        colorCodeToMatch1 = "bae6fc";
        colorCodeToMatch2 = "b4c9fa";
        break;
      case "green":
        colorCodeToMatch1 = "bdf6d9";
        colorCodeToMatch2 = "cafbc8";
        break;
      case "pink":
        colorCodeToMatch1 = "f4c3fb";
        break;
      case "purple":
        colorCodeToMatch1 = "d0adfa";
    }
  } else if (
    !(req.query.filterByLabel && req.query.filterByLabel == "true") &&
    !(req.query.searchInLabel && req.query.searchInLabel == "true")
  ) {
    return res.redirect("/lists");
  }

  var searchQuery = `SELECT lists.* FROM lists JOIN listsToUsers ON listsToUsers.listId = lists.listId WHERE listsToUsers.userId = '${req.session.user.id}' AND lists.trash = FALSE AND (LOWER(lists.color) LIKE '%${colorCodeToMatch1}%' OR LOWER(lists.color) LIKE '%${colorCodeToMatch2}%' OR LOWER(lists.title) LIKE '%${q}%' OR LOWER(lists.list) LIKE '%${q}%' OR lists.listId IN(SELECT listId FROM labelsToLists WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userId = '${req.session.user.id}' AND labelId IN(SELECT labelId FROM labels WHERE LOWER(label) LIKE '%${q}%'))) OR lists.listId IN(SELECT listId FROM listsToUsers WHERE userId IN(SELECT userId FROM emails_and_names WHERE LOWER(email) LIKE '%${q}%' OR LOWER(fullname) LIKE '%${q}%'))) ORDER BY listsToUsers.pinned DESC, lists.editDateTime DESC;`;

  var renderPage = "lists";

  if (req.query.searchInLabel && req.query.searchInLabel == "true") {
    searchQuery = `SELECT lists.* FROM lists JOIN listsToUsers ON listsToUsers.listId = lists.listId WHERE lists.listId IN(SELECT listId FROM labelsToLists WHERE labelId = '${req.query.labelId}') AND listsToUsers.userId = '${req.session.user.id}' AND lists.trash = FALSE AND (LOWER(lists.color) LIKE '%${colorCodeToMatch1}%' OR LOWER(lists.color) LIKE '%${colorCodeToMatch2}%' OR LOWER(lists.title) LIKE '%${q}%' OR LOWER(lists.list) LIKE '%${q}%' OR lists.listId IN(SELECT listId FROM listsToUsers WHERE userId IN(SELECT userId FROM emails_and_names WHERE LOWER(email) LIKE '%${q}%' OR LOWER(fullname) LIKE '%${q}%'))) ORDER BY listsToUsers.pinned DESC, lists.editDateTime DESC;`;
  } else if (req.query.filterByLabel && req.query.filterByLabel == "true") {
    searchQuery = `SELECT lists.* FROM lists JOIN listsToUsers ON listsToUsers.listId = lists.listId WHERE lists.listId IN(SELECT listId FROM labelsToLists WHERE labelId = '${req.query.labelId}') AND listsToUsers.userId = '${req.session.user.id}' AND lists.trash = FALSE ORDER BY listsToUsers.pinned DESC, lists.editDateTime DESC;`;
  } else if (req.query.archive && req.query.archive == "true") {
    searchQuery = `SELECT lists.* FROM lists JOIN listsToUsers ON listsToUsers.listId = lists.listId WHERE listsToUsers.userId = '${req.session.user.id}' AND lists.trash = FALSE AND listsToUsers.archive = TRUE AND (LOWER(lists.color) LIKE '%${colorCodeToMatch1}%' OR LOWER(lists.color) LIKE '%${colorCodeToMatch2}%' OR LOWER(lists.title) LIKE '%${q}%' OR LOWER(lists.list) LIKE '%${q}%' OR lists.listId IN(SELECT listId FROM labelsToLists WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userId = '${req.session.user.id}' AND labelId IN(SELECT labelId FROM labels WHERE LOWER(label) LIKE '%${q}%'))) OR lists.listId IN(SELECT listId FROM listsToUsers WHERE userId IN(SELECT userId FROM emails_and_names WHERE LOWER(email) LIKE '%${q}%' OR LOWER(fullname) LIKE '%${q}%'))) ORDER BY listsToUsers.pinned DESC, lists.editDateTime DESC;`;
    renderPage = "archive";
  } else if (req.query.trash && req.query.trash == "true") {
    searchQuery = `SELECT lists.* FROM lists JOIN listsToUsers ON listsToUsers.listId = lists.listId WHERE listsToUsers.userId = '${req.session.user.id}' AND lists.trash = TRUE AND listsToUsers.archive = FALSE AND (LOWER(lists.color) LIKE '%${colorCodeToMatch1}%' OR LOWER(lists.color) LIKE '%${colorCodeToMatch2}%' OR LOWER(lists.title) LIKE '%${q}%' OR LOWER(lists.list) LIKE '%${q}%' OR lists.listId IN(SELECT listId FROM labelsToLists WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userId = '${req.session.user.id}' AND labelId IN(SELECT labelId FROM labels WHERE LOWER(label) LIKE '%${q}%')))) ORDER BY listsToUsers.pinned DESC, lists.editDateTime DESC;`;
    renderPage = "trash";
  }

  var viewQuery = `CREATE OR REPLACE VIEW emails_and_names AS (SELECT userId, email, fullname FROM users WHERE userId IN(SELECT userId FROM listsToUsers WHERE userId != '${req.session.user.id}' AND listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}')));`;

  db.tx((t) => {
    const lists = db.any(viewQuery + searchQuery);
    const collaborators = db.any(
      `SELECT users.email, users.profilePhotoUrl, users.fullname, users.userId, listsToUsers.listId, listsToUsers.owner FROM listsToUsers INNER JOIN users ON listsToUsers.userId = users.userId ORDER BY owner DESC;`
    );
    const labels = db.any(
      `CREATE OR REPLACE VIEW labelsJoinlabelsToLists AS (SELECT labels.labelId, labels.label, labelsToLists.listId FROM labelsToLists INNER JOIN labels ON labelsToLists.labelId = labels.labelId);SELECT * FROM labelsJoinlabelsToLists WHERE labelId IN(SELECT labelId from labelsToUsers where userId = '${req.session.user.id}');`
    );
    const allLabels = db.any(
      `SELECT * FROM labels WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userID = '${req.session.user.id}') AND labelID IN(SELECT labels.labelId AS "numberOfLists" FROM labels LEFT JOIN labelsToLists ON labels.labelId = labelsToLists.labelId GROUP BY labels.labelId ORDER BY COUNT(labelsToLists.labelId) DESC, label ASC);`
    );
    const archivedLists = db.any(
      `SELECT listId FROM listsToUsers WHERE archive = TRUE AND userId = '${req.session.user.id}';`
    );
    const listViewType = db.any(
      `SELECT listViewType FROM users WHERE userId = '${req.session.user.id}';`
    );
    const pinnedLists = db.any(
      `SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}' AND pinned = TRUE;`
    );

    return t.batch([
      lists,
      collaborators,
      labels,
      allLabels,
      archivedLists,
      listViewType,
      pinnedLists,
    ]);
  })
    .then((data) => {
      var archivedListIds = [];
      var archivedListIdsRaw = data[4];
      for (var i = 0; i < archivedListIdsRaw.length; i++) {
        archivedListIds.push(archivedListIdsRaw[i].listid);
      }

      var pinnedListIds = [];
      var pinnedListIdsRaw = data[6];
      for (var i = 0; i < pinnedListIdsRaw.length; i++) {
        pinnedListIds.push(pinnedListIdsRaw[i].listid);
      }

      if (req.query.searchInLabel && req.query.searchInLabel == "true") {
        return res.render("pages/" + renderPage, {
          lists: data[0],
          collaborators: data[1],
          labels: data[2],
          allLabels: data[3],
          archivedListIds,
          listViewType: data[5][0].listviewtype,
          pinnedListIds,
          user: req.session.user,
          search: false,
          message:
            `results for '` + q + `' within label '` + req.body.label + `'`,
          filterByLabel: true,
          label: req.body.label,
          labelid: req.query.labelId,
          searchInLabel: true,
        });
      } else if (req.query.filterByLabel && req.query.filterByLabel == "true") {
        return res.render("pages/" + renderPage, {
          lists: data[0],
          collaborators: data[1],
          labels: data[2],
          allLabels: data[3],
          archivedListIds,
          listViewType: data[5][0].listviewtype,
          pinnedListIds,
          user: req.session.user,
          search: false,
          message: `filtering by label '` + req.body.label + `'`,
          filterByLabel: true,
          label: req.body.label,
          labelid: req.query.labelId,
          searchInLabel: false,
        });
      }

      return res.render("pages/" + renderPage, {
        lists: data[0],
        collaborators: data[1],
        labels: data[2],
        allLabels: data[3],
        archivedListIds,
        listViewType: data[5][0].listviewtype,
        pinnedListIds,
        user: req.session.user,
        search: true,
        message: `results for '` + q + `'`,
        filterByLabel: false,
        label: null,
        labelid: null,
        searchInLabel: false,
      });
    })
    .catch((error) => {
      console.log(error);
      return res.render("pages/" + renderPage, {
        lists: [],
        collaborators: [],
        labels: [],
        allLabels: [],
        archivedListIds: [],
        listViewType: null,
        pinnedListIds: [],
        user: req.session.user,
        search: true,
        error: true,
        message: "search error",
        filterByLabel: false,
        label: null,
        labelid: null,
        searchInLabel: false,
      });
    });
});

app.post("/permanentlyDeleteList", function (req, res) {
  db.any(
    `DELETE FROM listsToUsers WHERE listId = ${req.body.listId};  DELETE FROM labelsToLists WHERE listId IN(${req.body.listId}); DELETE FROM lists WHERE listId = ${req.body.listId};`
  )
    .then(() => {
      return res.redirect("/trash?permanentlyDeleted=success");
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/trash?permanentlyDeleted=error");
    });
});

app.post("/addListWithThisLabel", function (req, res) {
  var title = !req.body.title ? "" : req.body.title;
  var labelId = req.body.labelId;

  db.any(
    `INSERT INTO lists (title, list, color, trash, editDateTime, createDateTime, lastModifiedByEmail) VALUES ('${title.replace(
      /'/g,
      "''"
    )}', '${req.body.list.replace(/'/g, "''")}', 'ffffff', FALSE, '${
      req.body.now
    }', '${req.body.now}', '${req.session.user.email}') RETURNING listId;`
  )
    .then((listId) => {
      db.any(
        `INSERT INTO listsToUsers (listId, userId, owner, archive, pinned, editable, locked) VALUES (${listId[0].listid}, '${req.session.user.id}', TRUE, FALSE, FALSE, TRUE, FALSE); INSERT INTO labelsToLists (labelId, listId) VALUES (${labelId}, ${listId[0].listid});`
      )
        .then(() => {
          return res.redirect(
            "/search?filterByLabel=true&labelId=" + labelId + "&add=success"
          );
        })
        .catch((error) => {
          console.log(error);
          return res.redirect(
            "/search?filterByLabel=true&labelId=" + labelId + "&add=error"
          );
        });
    })
    .catch((error) => {
      console.log(error);
      return res.redirect(
        "/search?filterByLabel=true&labelId=" + labelId + "&add=error"
      );
    });
});

// Specialized GET version of /search only to be routed from /addListWithThisLabel
app.get("/search", function (req, res) {
  db.tx((t) => {
    const lists = db.any(
      `SELECT lists.* FROM lists JOIN listsToUsers ON listsToUsers.listId = lists.listId WHERE listsToUsers.userId = '${req.session.user.id}' AND lists.trash = FALSE AND lists.listId IN(SELECT listId FROM labelsToLists WHERE labelId = '${req.query.labelId}') ORDER BY listsToUsers.pinned DESC, lists.editDateTime DESC;`
    );
    const collaborators = db.any(
      `SELECT users.email, users.profilePhotoUrl, users.fullname, users.userId, listsToUsers.listId, listsToUsers.owner FROM listsToUsers INNER JOIN users ON listsToUsers.userId = users.userId ORDER BY owner DESC;`
    );
    const labels = db.any(
      `CREATE OR REPLACE VIEW labelsJoinlabelsToLists AS (SELECT labels.labelId, labels.label, labelsToLists.listId FROM labelsToLists INNER JOIN labels ON labelsToLists.labelId = labels.labelId);SELECT * FROM labelsJoinlabelsToLists WHERE labelId IN(SELECT labelId from labelsToUsers where userId = '${req.session.user.id}');`
    );
    const allLabels = db.any(
      `SELECT * FROM labels WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userID = '${req.session.user.id}') AND labelID IN(SELECT labels.labelId AS "numberOfLists" FROM labels LEFT JOIN labelsToLists ON labels.labelId = labelsToLists.labelId GROUP BY labels.labelId ORDER BY COUNT(labelsToLists.labelId) DESC, label ASC);`
    );
    const label = db.any(
      `SELECT label FROM labels WHERE labelId = '${req.query.labelId}' LIMIT 1;`
    );
    const archivedLists = db.any(
      `SELECT listId FROM listsToUsers WHERE archive = TRUE AND userId = '${req.session.user.id}';`
    );
    const listViewType = db.any(
      `SELECT listViewType FROM users WHERE userId = '${req.session.user.id}';`
    );

    return t.batch([
      lists,
      collaborators,
      labels,
      allLabels,
      label,
      archivedLists,
      listViewType,
      pinnedLists,
    ]);
  })
    .then((data) => {
      var archivedListIds = [];
      var archivedListIdsRaw = data[5];
      for (var i = 0; i < archivedListIdsRaw.length; i++) {
        archivedListIds.push(archivedListIdsRaw[i].listid);
      }

      var pinnedListIds = [];
      var pinnedListIdsRaw = data[7];
      for (var i = 0; i < pinnedListIdsRaw.length; i++) {
        pinnedListIds.push(pinnedListIdsRaw[i].listid);
      }

      if (req.query.filterByLabel && req.query.filterByLabel == "true") {
        return res.render("pages/lists", {
          lists: data[0],
          collaborators: data[1],
          labels: data[2],
          allLabels: data[3],
          archivedListIds,
          listViewType: data[6][0].listviewtype,
          pinnedListIds,
          user: req.session.user,
          search: false,
          searchInLabel: false,
          message: `filtering by label '` + data[4][0].label + `'`,
          filterByLabel: true,
          label: data[4][0].label,
          labelid: req.query.labelId,
          searchInLabel: false,
        });
      }

      return res.redirect("/lists");
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/lists");
    });
});

app.get("/a", function (req, res) {
  return res.render("pages/animation");
});

app.post("/emptyTrash", function (req, res) {
  db.any(
    `DELETE FROM labelsToLists WHERE listId IN(SELECT listId FROM lists WHERE trash = TRUE AND listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}')); DELETE FROM listsToUsers WHERE userId = '${req.session.user.id}' AND listId IN(SELECT listId FROM lists WHERE trash = TRUE) RETURNING listId;`
  )
    .then((ids) => {
      var array = [];
      for (var i = 0; i < ids.length; i++) {
        array.push(ids[i].listid);
      }

      db.any(`DELETE FROM lists WHERE listId IN(${array});`)
        .then(() => {
          return res.redirect("/trash?empty=success");
        })
        .catch((error) => {
          console.log(error);
          return res.redirect("/trash?empty=error");
        });
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/trash?empty=error");
    });
});

app.post("/addList", function (req, res) {
  var title = !req.body.title ? "" : req.body.title;

  db.any(
    `INSERT INTO lists (title, list, color, trash, editDateTime, createDateTime, lastModifiedByEmail) VALUES ('${title.replace(
      /'/g,
      "''"
    )}', '${req.body.list.replace(/'/g, "''")}', 'ffffff', FALSE, '${
      req.body.now
    }', '${req.body.now}', '${req.session.user.email}') RETURNING listId;`
  )
    .then((listId) => {
      db.any(
        `INSERT INTO listsToUsers (listId, userId, owner, archive, pinned, editable, locked) VALUES (${listId[0].listid}, '${req.session.user.id}', TRUE, FALSE, FALSE, TRUE, FALSE);`
      )
        .then(() => {
          return res.redirect("/lists?add=success");
        })
        .catch((error) => {
          console.log(error);
          return res.redirect("/lists?add=error");
        });
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/lists?add=error");
    });
});

app.post("/changeListColor", function (req, res) {
  db.any(
    `UPDATE lists SET color = '${req.body.color}', editDateTime = '${req.body.now}', lastModifiedByEmail = '${req.session.user.email}' WHERE listId = ${req.body.listId};`
  )
    .then(() => {
      if (req.query.archived && req.query.archived == "true") {
        return res.redirect("/archive?changeColor=success");
      }

      return res.redirect("/lists?changeColor=success");
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/lists?changeColor=error");
    });
});

app.post("/changePermissions", function (req, res) {
  db.any(
    `SELECT editable FROM listsToUsers WHERE listId = '${req.body.listId}' AND userId = '${req.body.userId}';`
  )
    .then((editable) => {
      console.log(editable);

      var changePermissions = `UPDATE listsToUsers SET editable = TRUE WHERE listId = '${req.body.listId}' AND userId = '${req.body.userId}';`;
      if (editable[0].editable) {
        changePermissions = `UPDATE listsToUsers SET editable = FALSE WHERE listId = '${req.body.listId}' AND userId = '${req.body.userId}';`;
      }

      db.any(changePermissions)
        .then(() => {
          return res.redirect("/lists?changepermissions=success");
        })
        .catch((error) => {
          console.log(error);
          return res.redirect("/lists?changepermissions=error");
        });
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/lists?changepermissions=error");
    });
});

app.post("/setColorSelected", function (req, res) {
  var array = req.body.listIds.split(",");
  var result = array.map(function (x) {
    return parseInt(x, 10);
  });

  db.any(`SELECT * FROM listsToUsers WHERE listId IN(${result});`)
    .then((listsToUsers) => {
      var listIds = [];

      for (let i = 0; i < listsToUsers.length; i++) {
        if (
          listsToUsers[i].editable &&
          listsToUsers[i].userid == req.session.user.id
        ) {
          listIds.push(listsToUsers[i].listid);
        }
      }

      console.log(listIds);
      if (listIds.length == result.length) {
        db.any(
          `UPDATE lists SET color = '${req.body.color}', editDateTime = '${req.body.now}', lastModifiedByEmail = '${req.session.user.email}' WHERE listId IN(${listIds});`
        )
          .then(() => {
            return res.redirect("/lists?setcolorselected=success");
          })
          .catch((error) => {
            console.log(error);
            return res.redirect("/lists?setcolorselected=error");
          });
      } else if (listIds.length > 0 && listIds.length < result.length) {
        db.any(
          `UPDATE lists SET color = '${req.body.color}', editDateTime = '${req.body.now}', lastModifiedByEmail = '${req.session.user.email}' WHERE listId IN(${listIds});`
        )
          .then(() => {
            return res.redirect("/lists?setcolorselected=someuneditable");
          })
          .catch((error) => {
            console.log(error);
            return res.redirect("/lists?setcolorselected=error");
          });
      } else {
        return res.redirect("/lists?setcolorselected=noneeditable");
      }
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/lists?setcolorselected=error");
    });

  // db.any(`UPDATE lists SET color = '${req.body.color}', editDateTime = '${req.body.now}' WHERE listId IN(${result});`)
  //     .then(() => {
  //         return res.redirect('/lists?setColorSelected=success');
  //     })
  //     .catch((error) => {
  //         console.log(error);
  //         return res.redirect('/lists?setColorSelected=error');
  //     });
});

app.post("/unpinList", function (req, res) {
  db.any(
    `UPDATE listsToUsers SET pinned = FALSE WHERE listId = '${req.body.listId}' AND userId = '${req.session.user.id}';`
  )
    .then(() => {
      return res.redirect("/lists?unpin=success");
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/lists?unpin=error");
    });
});

app.post("/pinList", function (req, res) {
  db.any(
    `UPDATE listsToUsers SET pinned = TRUE WHERE listId = '${req.body.listId}' AND userId = '${req.session.user.id}';`
  )
    .then(() => {
      return res.redirect(`/${req.body.sourcePage}?pin=success`);
    })
    .catch((error) => {
      console.log(error);
      return res.redirect(`/${req.body.sourcePage}?pin=error`);
    });
});

app.get("/pinorder", function (req, res) {
  db.any(
    `SELECT lists.* FROM lists JOIN listsToUsers ON listsToUsers.listId = lists.listId ORDER BY listsToUsers.pinned DESC, lists.editDateTime DESC;`
  )
    .then((rows) => {
      return res.send(rows);
    })
    .catch((error) => {
      console.log(error);
      return res.send(error);
    });
});

app.post("/deleteList", function (req, res) {
  console.log(req.body.now);
  db.any(
    `UPDATE lists SET trash = TRUE WHERE listId = ${req.body.listId}; DELETE FROM listsToUsers WHERE userId != '${req.session.user.id}' AND listId = ${req.body.listId}; UPDATE lists SET editDateTime = '${req.body.now}', lastModifiedByEmail = '${req.session.user.email}' WHERE listId = ${req.body.listId};`
  )
    .then(() => {
      if (req.query.archived && req.query.archived == "true") {
        return res.redirect("/archive?delete=success");
      }

      return res.redirect("/lists?delete=success");
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/lists?delete=error");
    });
});

app.post("/unarchiveList", function (req, res) {
  db.any(
    `UPDATE listsToUsers SET archive = FALSE WHERE listId = ${req.body.listId} AND userId = '${req.session.user.id}';`
  )
    .then(() => {
      return res.redirect("/lists?unarchive=success");
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/lists?unarchive=error");
    });
});

app.post("/deleteSelectedLists", function (req, res) {
  var returnPage = "lists";
  if (false) {
    returnPage = "archive";
  }

  if (
    req.query.continue &&
    req.query.continue == "true" &&
    req.query.notOwner &&
    req.query.notOwner == "true"
  ) {
    var listIdsToRemoveRaw = req.body.listIdsToRemove.split(",");
    var listIdsToRemove = listIdsToRemoveRaw.map(function (x) {
      return parseInt(x, 10);
    });

    var listIdsToDelete = [];

    if (req.body.listIdsToDelete) {
      var listIdsToDeleteRaw = req.body.listIdsToDelete.split(",");
      listIdsToDelete = listIdsToDeleteRaw.map(function (x) {
        return parseInt(x, 10);
      });
    }

    console.log(listIdsToRemove.length);
    console.log(listIdsToRemove);

    console.log(listIdsToDelete.length);
    console.log(listIdsToDelete);

    ///

    db.any(
      `DELETE FROM listsToUsers WHERE listId IN(${listIdsToRemove}) AND userId = '${req.session.user.id}'; UPDATE lists SET editDateTime = '${req.body.now}', lastModifiedByEmail = '${req.session.user.email}' WHERE listId IN(${listIdsToRemove});`
    )
      .then(() => {
        db.any(
          `SELECT listId FROM listsToUsers WHERE listId IN(${listIdsToDelete}) GROUP BY listId HAVING COUNT(*) > 1;`
        )
          .then((sharedListIdsRaw) => {
            if (sharedListIdsRaw.length > 0) {
              return res.render("pages/deleteSelectedOwnShared", {
                sharedListIdsRaw,
                returnPage,
                listIds: listIdsToDelete,
              });
            } else {
              db.any(
                `UPDATE lists SET trash = TRUE WHERE listId IN(${listIdsToDelete}); DELETE FROM listsToUsers WHERE userId != '${req.session.user.id}' AND listId IN (${listIdsToDelete}); UPDATE lists SET editDateTime = '${req.body.now}', lastModifiedByEmail = '${req.session.user.email}' WHERE listId IN(${listIdsToDelete});`
              )
                .then(() => {
                  return res.redirect(
                    "/lists?deleteSelected=success&count=" +
                      (listIdsToRemove.length + listIdsToDelete.length)
                  );
                })
                .catch((error) => {
                  console.log(error);
                  return res.redirect("/lists?deleteSelected=error");
                });
            }
          })
          .catch((error) => {
            console.log(error);
            return res.redirect("/lists?deleteSelected=error");
          });
      })
      .catch((error) => {
        console.log(error);
        return res.redirect("/lists?deleteSelected=error");
      });

    // var deletionQuery = `DELETE FROM listsToUsers WHERE listId IN(${listIdsToRemove}) AND userId = '${req.session.user.id}'; UPDATE lists SET editDateTime = '${req.body.now}' WHERE listId IN(${listIdsToRemove});`;
    // if(listIdsToDelete.length > 0) {
    //     deletionQuery += `UPDATE lists SET trash = TRUE WHERE listId IN(${listIdsToDelete}); DELETE FROM listsToUsers WHERE userId != '${req.session.user.id}' AND listId IN (${listIdsToDelete}); UPDATE lists SET editDateTime = '${req.body.now}' WHERE listId IN(${listIdsToDelete});`;
    // }

    // db.any(deletionQuery)
    //     .then(() => {
    //         return res.redirect('/lists?deleteSelected=success&count=' + (listIdsToRemove.length + listIdsToDelete.length));
    //     })
    //     .catch((error) => {
    //         console.log(error);
    //         return res.redirect('/lists?deleteSelected=error');
    //     });
  } else if (
    req.query.continue &&
    req.query.continue == "true" &&
    req.query.ownShared &&
    req.query.ownShared == "true"
  ) {
    let listIds = [];

    if (req.body.listIds) {
      let listIdsRaw = req.body.listIds.split(",");
      listIds = listIdsRaw.map(function (x) {
        return parseInt(x, 10);
      });
    }

    db.any(
      `UPDATE lists SET trash = TRUE WHERE listId IN(${listIds}); DELETE FROM listsToUsers WHERE userId != '${req.session.user.id}' AND listId IN (${listIds}); UPDATE lists SET editDateTime = '${req.body.now}', lastModifiedByEmail = '${req.session.user.email}' WHERE listId IN(${listIds});`
    )
      .then(() => {
        return res.redirect(
          "/lists?deleteSelected=success&count=" + listIds.length
        );
      })
      .catch((error) => {
        console.log(error);
        return res.redirect("/lists?deleteSelected=error");
      });
  } else {
    var listIdsRaw = req.body.listIds.split(",");
    var listIds = listIdsRaw.map(function (x) {
      return parseInt(x, 10);
    });

    db.any(
      `SELECT listId FROM listsToUsers WHERE listId IN(${listIds}) AND userId = '${req.session.user.id}' AND owner = FALSE;`
    )
      .then((unownedListIdsRaw) => {
        var unownedListIds = [];
        for (var i = 0; i < unownedListIdsRaw.length; i++) {
          unownedListIds.push(unownedListIdsRaw[i].listid);
        }

        var ownedListIds = [];
        for (var i = 0; i < listIds.length; i++) {
          if (!unownedListIds.includes(listIds[i])) {
            ownedListIds.push(listIds[i]);
          }
        }

        // console.log(unownedListIds);
        // console.log(ownedListIds);

        if (unownedListIds.length > 0) {
          return res.render("pages/deleteSelectedNotOwner", {
            unownedListIds,
            numberOfSelectedLists: listIds.length,
            returnPage,
            ownedListIds,
          });
        } else {
          db.any(
            `SELECT listId FROM listsToUsers WHERE listId IN(${listIds}) GROUP BY listId HAVING COUNT(*) > 1;`
          )
            .then((sharedListIdsRaw) => {
              if (sharedListIdsRaw.length > 0) {
                return res.render("pages/deleteSelectedOwnShared", {
                  sharedListIdsRaw,
                  returnPage,
                  listIds,
                });
              } else {
                db.any(
                  `UPDATE lists SET trash = TRUE WHERE listId IN(${listIds}); DELETE FROM listsToUsers WHERE userId != '${req.session.user.id}' AND listId IN (${listIds}); UPDATE lists SET editDateTime = '${req.body.now}', lastModifiedByEmail = '${req.session.user.email}' WHERE listId IN(${listIds});`
                )
                  .then(() => {
                    return res.redirect(
                      "/lists?deleteSelected=success&count=" + listIds.length
                    );
                  })
                  .catch((error) => {
                    console.log(error);
                    return res.redirect("/lists?deleteSelected=error");
                  });
              }
            })
            .catch((error) => {
              console.log(error);
              return res.redirect("/lists?deleteSelected=error");
            });
          // db.any(`UPDATE lists SET trash = TRUE WHERE listId IN(${listIds}); DELETE FROM listsToUsers WHERE userId != '${req.session.user.id}' AND listId IN (${listIdsToDelete});`)
          //     .then(() => {
          //         return res.redirect('/lists?deleteSelected=success&count=' + (listIds.length));
          //     })
          //     .catch((error) => {
          //         console.log(error);
          //         return res.redirect('/lists?deleteSelected=error');
          //     });
        }
      })
      .catch((error) => {
        console.log(error);
        return res.redirect("/lists?deleteSelected=error");
      });
  }
});

app.post("/copy", function (req, res) {
  db.any(
    `SELECT labelId FROM labelsToLists WHERE listId = '${req.body.listId}';`
  )
    .then((labelIdsRaw) => {
      var labelIdsPure = [];
      for (var i = 0; i < labelIdsRaw.length; i++) {
        labelIdsPure.push(labelIdsRaw[i].labelid);
      }

      db.any(
        `INSERT INTO lists (title, list, color, trash, editDateTime, createDateTime, lastModifiedByEmail) VALUES ('${req.body.title.replace(
          /'/g,
          "''"
        )}', '${req.body.list.replace(/'/g, "''")}', '${
          req.body.color
        }', FALSE, '${req.body.now}', '${req.body.now}', '${
          req.session.user.email
        }') RETURNING listId;`
      )
        .then((listId) => {
          var assignLabelsToListQuery = "";
          for (var i = 0; i < labelIdsPure.length; i++) {
            assignLabelsToListQuery += `INSERT INTO labelsToLists (labelId, listId) VALUES ('${labelIdsPure[i]}', '${listId[0].listid}');`;
          }

          db.any(
            assignLabelsToListQuery +
              `INSERT INTO listsToUsers (listId, userId, owner, archive, pinned, editable, locked) VALUES (${listId[0].listid}, '${req.session.user.id}', TRUE, FALSE, FALSE, TRUE, FALSE);`
          )
            .then(() => {
              if (req.query.archived && req.query.archived == "true") {
                return res.redirect("/lists?copyArchived=success");
              }

              return res.redirect("/lists?copy=success");
            })
            .catch((error) => {
              console.log(error);
              return res.redirect("/lists?copy=error");
            });
        })
        .catch((error) => {
          console.log(error);
          return res.redirect("/lists?copy=error");
        });
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/lists?copy=error");
    });
});

app.get("/idk", function (req, res) {
  // const collaborators = db.any(`SELECT users.email, users.profilePhotoUrl, users.fullname, users.userId, listsToUsers.listId, listsToUsers.owner FROM listsToUsers INNER JOIN users ON listsToUsers.userId = users.userId ORDER BY owner DESC;`);

  db.any(
    `SELECT * FROM labelsToLists JOIN labelsToUsers ON labelsToLists.labelId = labelsToUsers.labelId;`
  )
    .then((result) => {
      return res.send(result);
    })
    .catch((error) => {
      console.log(error);
      return res.send(error);
    });
});

app.post("/copySelected", function (req, res) {
  var listIdsRaw = req.body.listIds.split(",");
  var listIdsPure = listIdsRaw.map(function (x) {
    return parseInt(x, 10);
  });

  var now = req.body.now;
  var userId = req.session.user.id;

  db.tx((t) => {
    let lists = db.any(`SELECT * FROM lists WHERE listId IN(${listIdsPure});`);
    let listsToUsers = db.any(
      `SELECT * FROM listsToUsers WHERE listId IN(${listIdsPure});`
    );
    let latestListId = db.any(`SELECT MAX(listId) FROM lists;`);
    let labelIds = db.any(
      `SELECT * FROM labelsToLists JOIN labelsToUsers ON labelsToLists.labelId = labelsToUsers.labelId WHERE labelsToLists.listId IN(${listIdsPure});`
    );
    let userIdsAndEmails = db.any(`SELECT userId, email FROM users;`);

    return t.batch([
      lists,
      listsToUsers,
      latestListId,
      labelIds,
      userIdsAndEmails,
    ]);
  })
    .then((data) => {
      var lists = data[0];
      var listsToUsers = data[1];
      var latestListId = data[2][0].max;
      var labelIds = data[3];
      var userIdsAndEmails = data[4];

      var nextListId = latestListId + 1;

      var copyAll = "";

      for (let i = 0; i < lists.length; i++) {
        let listIdToMatch = lists[i].listid;

        var copyList = `INSERT INTO 
                                lists (title, list, color, trash, editDateTime, createDateTime, lastModifiedByEmail) 
                                VALUES 
                                ('${lists[i].title.replace(
                                  /'/g,
                                  "''"
                                )}', '${lists[i].list.replace(/'/g, "''")}', '${
          lists[i].color
        }', FALSE, '${now}', '${now}', '${req.session.user.email}');`;

        var owner = "false";

        for (let j = 0; j < listsToUsers.length; j++) {
          if (
            listsToUsers[j].listid == listIdToMatch &&
            listsToUsers[j].userid == userId &&
            listsToUsers[j].owner
          ) {
            owner = "true";
            break;
          }
        }

        let collabsToAdd = "";

        if (owner == "true") {
          for (let j = 0; j < listsToUsers.length; j++) {
            if (listsToUsers[j].listid == listIdToMatch) {
              collabsToAdd += `INSERT INTO 
                                            listsToUsers (listId, userId, owner, archive, pinned, editable, locked) 
                                            VALUES ('${nextListId}', '${listsToUsers[j].userid}', '${listsToUsers[j].owner}', '${listsToUsers[j].archive}', '${listsToUsers[j].pinned}', '${listsToUsers[j].editable}', '${listsToUsers[j].locked}');`;

              if (listsToUsers[j].userid != userId) {
                let recipientEmail = "";
                for (let k = 0; k < userIdsAndEmails.length; k++) {
                  if (userIdsAndEmails[k].userid == listsToUsers[j].userid) {
                    recipientEmail = userIdsAndEmails[k].email;
                    break;
                  }
                }
                sendCollaborationEmail(
                  recipientEmail,
                  req.session.user.email,
                  req.session.user.displayName,
                  lists[i].title,
                  lists[i].list,
                  "true"
                );
              }
            }
          }
        } else {
          console.log("not owner");
          console.log(userId);
          console.log(listIdToMatch);
          for (let j = 0; j < listsToUsers.length; j++) {
            console.log(listsToUsers[j]);

            if (
              listsToUsers[j].listid == listIdToMatch &&
              listsToUsers[j].userid == userId
            ) {
              collabsToAdd += `INSERT INTO 
                                            listsToUsers (listId, userId, owner, archive, pinned, editable, locked) 
                                            VALUES ('${nextListId}', '${listsToUsers[j].userid}', TRUE, '${listsToUsers[j].archive}', '${listsToUsers[j].pinned}', '${listsToUsers[j].editable}', '${listsToUsers[j].locked}');`;
              break;
            }
          }
        }

        let labelsToAdd = "";

        if (owner == "true") {
          for (let j = 0; j < labelIds.length; j++) {
            if (labelIds[j].listid == listIdToMatch) {
              labelsToAdd += `INSERT INTO labelsToLists (labelId, listId) VALUES ('${labelIds[j].labelid}', '${nextListId}');`;
            }
          }
        } else {
          for (let j = 0; j < labelIds.length; j++) {
            if (
              labelIds[j].listid == listIdToMatch &&
              labelIds[j].userid == userId
            ) {
              labelsToAdd += `INSERT INTO labelsToLists (labelId, listId) VALUES ('${labelIds[j].labelid}', '${nextListId}');`;
            }
          }
        }

        copyAll += copyList;
        copyAll += collabsToAdd;
        copyAll += labelsToAdd;
        nextListId++;
      }

      db.any(copyAll)
        .then(() => {
          return res.redirect("/lists?copyselected=success");
        })
        .catch((error) => {
          console.log(error);
          return res.redirect("/lists?copyselected=error");
        });
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/lists?copyselected=error");
    });
});

app.post("/permanentlyDeleteSelected", function (req, res) {
  var array = req.body.listIds.split(",");
  var result = array.map(function (x) {
    return parseInt(x, 10);
  });

  db.any(
    `DELETE FROM listsToUsers WHERE listId IN(${result}); DELETE FROM labelsToLists WHERE listId IN(${result}); DELETE FROM lists WHERE listId IN(${result});`
  )
    .then(() => {
      var count = encodeURIComponent(result.length);
      return res.redirect(
        "/trash?permanentlyDeleteSelected=success&count=" + count
      );
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/trash?permanentlyDeleteSelected=error");
    });
});

app.post("/updateList", function (req, res) {
  db.any(`SELECT * FROM lists WHERE listId = ${req.body.listId};`)
    .then((listInfo) => {
      if (
        listInfo[0].title == req.body.title &&
        listInfo[0].list == req.body.list
      ) {
        return res.redirect("/lists?edit=success");
      } else {
        db.any(
          `UPDATE lists SET title = '${req.body.title.replace(
            /'/g,
            "''"
          )}', list = '${req.body.list.replace(/'/g, "''")}', editDateTime = '${
            req.body.now
          }', lastModifiedByEmail = '${
            req.session.user.email
          }' WHERE listId = ${req.body.listId};`
        )
          .then(() => {
            if (req.query.archived && req.query.archived == "true") {
              return res.redirect("/archive?edit=success");
            }

            return res.redirect("/lists?edit=success");
          })
          .catch((error) => {
            console.log(error);
            return res.redirect("/lists?edit=error");
          });
      }
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/lists?edit=error");
    });

  // db.any(`UPDATE lists SET title = '${req.body.title.replace(/'/g, "''")}', list = '${req.body.list.replace(/'/g, "''")}', editDateTime = '${req.body.now}', lastModifiedByEmail = '${req.session.user.email}' WHERE listId = ${req.body.listId};`)
  //     .then(() => {
  //         if(req.query.archived && req.query.archived == 'true') {
  //             return res.redirect('/archive?update=success');
  //         }

  //         return res.redirect('/lists?update=success');
  //     })
  //     .catch((error) => {
  //         console.log(error);
  //         return res.redirect('/lists?update=error');
  //     });
});

app.get("/trash", function (req, res) {
  const successMessages = [
    "permanently deleted list",
    "emptied trash",
    "permanently deleted selection",
  ];
  const errorMessages = [
    "error permanently deleting list",
    "error emptying trash",
    "error permanently deleting selection",
  ];

  var error = 0;
  var message = "";

  if (req.query.permanentlyDeleted) {
    message =
      req.query.permanentlyDeleted == "success"
        ? successMessages[0]
        : errorMessages[0];
    error = req.query.permanentlyDeleted == "success" ? 0 : 1;
  } else if (req.query.empty) {
    message =
      req.query.empty == "success" ? successMessages[1] : errorMessages[1];
    error = req.query.empty == "success" ? 0 : 1;
  } else if (req.query.permanentlyDeleteSelected) {
    message =
      req.query.permanentlyDeleteSelected == "success"
        ? successMessages[2]
        : errorMessages[2];
    error = req.query.permanentlyDeleteSelected == "success" ? 0 : 1;

    if (req.query.count) {
      message =
        req.query.count == "1"
          ? "permanently deleted " + req.query.count + " list"
          : "permanently deleted " + req.query.count + " lists";
    }
  }

  db.tx((t) => {
    const lists = db.any(
      `SELECT lists.* FROM lists JOIN listsToUsers ON listsToUsers.listId = lists.listId WHERE listsToUsers.userId = '${req.session.user.id}' AND lists.trash = TRUE ORDER BY listsToUsers.pinned DESC, lists.editDateTime DESC;`
    );
    const collaborators = db.any(
      `SELECT users.email, users.profilePhotoUrl, users.fullname, users.userId, listsToUsers.listId, listsToUsers.owner FROM listsToUsers INNER JOIN users ON listsToUsers.userId = users.userId ORDER BY owner DESC;`
    );
    const labels = db.any(
      `CREATE OR REPLACE VIEW labelsJoinlabelsToLists AS (SELECT labels.labelId, labels.label, labelsToLists.listId FROM labelsToLists INNER JOIN labels ON labelsToLists.labelId = labels.labelId);SELECT * FROM labelsJoinlabelsToLists WHERE labelId IN(SELECT labelId from labelsToUsers where userId = '${req.session.user.id}');`
    );
    const allLabels = db.any(
      `SELECT * FROM labels WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userID = '${req.session.user.id}') AND labelID IN(SELECT labels.labelId AS "numberOfLists" FROM labels LEFT JOIN labelsToLists ON labels.labelId = labelsToLists.labelId GROUP BY labels.labelId ORDER BY COUNT(labelsToLists.labelId) DESC, label ASC);`
    );
    const listViewType = db.any(
      `SELECT listViewType FROM users WHERE userId = '${req.session.user.id}';`
    );
    const pinnedLists = db.any(
      `SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}' AND pinned = TRUE;`
    );

    return t.batch([
      lists,
      collaborators,
      labels,
      allLabels,
      listViewType,
      pinnedLists,
    ]);
  })
    .then((data) => {
      var pinnedListIds = [];
      var pinnedListIdsRaw = data[5];
      for (var i = 0; i < pinnedListIdsRaw.length; i++) {
        pinnedListIds.push(pinnedListIdsRaw[i].listid);
      }

      return res.render("pages/trash", {
        lists: data[0],
        collaborators: data[1],
        labels: data[2],
        allLabels: data[3],
        listViewType: data[4][0].listviewtype,
        pinnedListIds,
        user: req.session.user,
        search: false,
        searchInLabel: false,
        error,
        message,
      });
    })
    .catch((error) => {
      console.log(error);
      return res.render("pages/trash", {
        lists: [],
        collaborators: [],
        labels: [],
        allLabels: [],
        listViewType: null,
        pinnedListIds: [],
        user: req.session.user,
        search: false,
        searchInLabel: false,
        error: true,
        message: "error loading trash",
      });
    });
});

app.post("/restoreList", function (req, res) {
  db.any(`UPDATE lists SET trash = FALSE WHERE listId = ${req.body.listId};`)
    .then(() => {
      if (req.query.archived && req.query.archived == "true") {
        return res.redirect("/lists?restore=success&archived=true");
      }

      return res.redirect("/lists?restore=success");
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/lists?restore=error");
    });
});

app.post("/restoreAll", function (req, res) {
  db.any(
    `UPDATE lists SET trash = FALSE WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}') AND trash = TRUE;`
  )
    .then(() => {
      return res.redirect("/lists?restoreAll=success");
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/lists?restoreAll=error");
    });
});

app.post("/removeAllCollaborators", function (req, res) {
  db.any(
    `DELETE FROM listsToUsers WHERE listId = '${req.body.listId}' AND userId IN(SELECT userId FROM users WHERE userId != '${req.session.user.id}'); DELETE FROM labelsToLists WHERE listId = '${req.body.listId}' AND labelId IN(SELECT labelId FROM labelsToUsers WHERE userId != '${req.session.user.id}');`
  )
    .then(() => {
      // console.log(req.body.listId);
      // console.log(req.body.now);
      return res.redirect("/lists?removeallcollaborators=success");
    })
    .catch((error) => {
      console.log(error);
      // return res.send(error);
      return res.redirect("/lists?removeallcollaborators=error");
    });
});

app.post("/lockUnlockModal", function (req, res) {
  db.any(`SELECT * FROM users WHERE userId = '${req.session.user.id}';`)
    .then((user) => {
      var hasPassword = false;
      console.log(user);
      if (user[0].listpassword !== null) {
        hasPassword = true;
      }

      var locked = req.body.locked == "false" ? false : true;

      return res.render("pages/lockUnlock", {
        hasPassword,
        locked,
        listid: req.body.listId,
      });
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/lists?lockorunlock=error");
    });
});

app.post("/changeListPassword", function (req, res) {
  console.log(req.body.codeCorrect);
  console.log(req.body.code);
  if (req.body.code !== req.body.codeCorrect) {
    return res.redirect("/lists?changelistpassword=incorrectcode");
  } else {
    db.any(
      `UPDATE users SET listPassword = '${req.body.newPassword}' WHERE userId = '${req.session.user.id}';`
    )
      .then(() => {
        return res.redirect("/lists?changelistpassword=success");
      })
      .catch((error) => {
        console.log(error);
        return res.redirect("/lists?changelistpassword=error");
      });
  }
});

app.get("/forgotListPassword", function (req, res) {
  const resetCode = Math.floor(100000 + Math.random() * 900000);
  sendListPasswordResetEmail(req.session.user.email, resetCode);
  console.log(resetCode);
  return res.render("pages/forgotListPassword", { resetCode });
});

app.post("/lock", function (req, res) {
  if (req.body.firstPassword) {
    db.any(
      `UPDATE users SET listPassword = '${req.body.firstPassword}' WHERE userId = '${req.session.user.id}';`
    )
      .then(() => {
        db.any(
          `UPDATE listsToUsers SET locked = TRUE WHERE userId = '${req.session.user.id}' AND listId = '${req.body.listId}';`
        )
          .then(() => {
            return res.redirect("/lists?lock=success");
          })
          .catch((error) => {
            console.log(error);
            return res.redirect("/lists?lock=error");
          });
      })
      .catch((error) => {
        console.log(error);
        return res.redirect("/lists?lock=error");
      });
  } else if (req.body.password) {
    db.any(
      `SELECT listPassword FROM users WHERE userId = '${req.session.user.id}';`
    )
      .then((password) => {
        if (password[0].listpassword == req.body.password) {
          db.any(
            `UPDATE listsToUsers SET locked = TRUE WHERE userId = '${req.session.user.id}' AND listId = '${req.body.listId}';`
          )
            .then(() => {
              return res.redirect("/lists?lock=success");
            })
            .catch((error) => {
              console.log(error);
              return res.redirect("/lists?lock=error");
            });
        } else {
          return res.redirect("/lists?lock=incorrectpassword");
        }
      })
      .catch((error) => {
        console.log(error);
        return res.redirect("/lists?lock=error");
      });
  } else {
    return res.redirect("/lists?lock=nopasswordentered");
  }
});

app.post("/unlock", function (req, res) {
  if (req.body.firstPassword) {
    db.any(
      `UPDATE users SET listPassword = '${req.body.firstPassword}' WHERE userId = '${req.session.user.id}';`
    )
      .then(() => {
        db.any(
          `UPDATE listsToUsers SET locked = FALSE WHERE userId = '${req.session.user.id}' AND listId = '${req.body.listId}';`
        )
          .then(() => {
            return res.redirect("/lists?lock=success");
          })
          .catch((error) => {
            console.log(error);
            return res.redirect("/lists?lock=error");
          });
      })
      .catch((error) => {
        console.log(error);
        return res.redirect("/lists?lock=error");
      });
  } else if (req.body.password) {
    db.any(
      `SELECT listPassword FROM users WHERE userId = '${req.session.user.id}';`
    )
      .then((password) => {
        if (password[0].listpassword == req.body.password) {
          db.any(
            `UPDATE listsToUsers SET locked = FALSE WHERE userId = '${req.session.user.id}' AND listId = '${req.body.listId}';`
          )
            .then(() => {
              return res.redirect("/lists?lock=success");
            })
            .catch((error) => {
              console.log(error);
              return res.redirect("/lists?lock=error");
            });
        } else {
          return res.redirect("/lists?lock=incorrectpassword");
        }
      })
      .catch((error) => {
        console.log(error);
        return res.redirect("/lists?lock=error");
      });
  } else {
    return res.redirect("/lists?lock=nopasswordentered");
  }
});

app.post("/restoreSelectedLists", function (req, res) {
  var array = req.body.listIds.split(",");
  var result = array.map(function (x) {
    return parseInt(x, 10);
  });

  db.any(`UPDATE lists SET trash = FALSE WHERE listId IN(${result});`)
    .then(() => {
      var count = encodeURIComponent(result.length);
      return res.redirect("/lists?restoreSelected=success&count=" + count);
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/lists?restoreSelected=error");
    });
});

app.get("/archive", (req, res) => {
  const successMessages = [
    "changed list color",
    "updated list",
    "deleted list",
    "restored archived list",
  ];
  const errorMessages = [
    "error changing list color",
    "error updating list",
    "error deleting list",
    "error restoring archived list",
  ];
  var error = 0;
  var message = "";

  if (req.query.changeColor) {
    message =
      req.query.changeColor == "success"
        ? successMessages[0]
        : errorMessages[0];
    error = req.query.changeColor == "success" ? 0 : 1;
  } else if (req.query.update) {
    message =
      req.query.update == "success" ? successMessages[1] : errorMessages[1];
    error = req.query.update == "success" ? 0 : 1;
  } else if (req.query.delete) {
    message =
      req.query.delete == "success" ? successMessages[2] : errorMessages[2];
    error = req.query.delete == "success" ? 0 : 1;
  } else if (req.query.restore) {
    error = req.query.restore == "success" ? 0 : 1;
    if (req.query.archived && req.query.archived == "true") {
      message = successMessages[3];
    } else {
      message = errorMessages[3];
    }
  }

  db.tx((t) => {
    const lists = db.any(
      `SELECT lists.* FROM lists JOIN listsToUsers ON listsToUsers.listId = lists.listId WHERE listsToUsers.userId = '${req.session.user.id}' AND listsToUsers.archive = TRUE AND lists.trash = FALSE ORDER BY listsToUsers.pinned DESC, lists.editDateTime DESC;`
    );
    const collaborators = db.any(
      `SELECT users.email, users.profilePhotoUrl, users.fullname, users.userId, listsToUsers.listId, listsToUsers.owner FROM listsToUsers INNER JOIN users ON listsToUsers.userId = users.userId ORDER BY owner DESC;`
    );
    const labels = db.any(
      `CREATE OR REPLACE VIEW labelsJoinlabelsToLists AS (SELECT labels.labelId, labels.label, labelsToLists.listId FROM labelsToLists INNER JOIN labels ON labelsToLists.labelId = labels.labelId);SELECT * FROM labelsJoinlabelsToLists WHERE labelId IN(SELECT labelId from labelsToUsers where userId = '${req.session.user.id}');`
    );
    const allLabels = db.any(
      `SELECT * FROM labels WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userID = '${req.session.user.id}') AND labelID IN(SELECT labels.labelId AS "numberOfLists" FROM labels LEFT JOIN labelsToLists ON labels.labelId = labelsToLists.labelId GROUP BY labels.labelId ORDER BY COUNT(labelsToLists.labelId) DESC, label ASC);`
    );
    const listViewType = db.any(
      `SELECT listViewType FROM users WHERE userId = '${req.session.user.id}';`
    );
    const pinnedLists = db.any(
      `SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}' AND pinned = TRUE;`
    );

    return t.batch([
      lists,
      collaborators,
      labels,
      allLabels,
      listViewType,
      pinnedLists,
    ]);
  })
    .then((data) => {
      var pinnedListIds = [];
      var pinnedListIdsRaw = data[5];
      for (var i = 0; i < pinnedListIdsRaw.length; i++) {
        pinnedListIds.push(pinnedListIdsRaw[i].listid);
      }

      return res.render("pages/archive", {
        lists: data[0],
        collaborators: data[1],
        labels: data[2],
        allLabels: data[3],
        listViewType: data[4][0].listviewtype,
        pinnedListIds,
        user: req.session.user,
        search: false,
        searchInLabel: false,
        error,
        message,
      });
    })
    .catch((error) => {
      console.log(error);
      return res.render("pages/archive", {
        lists: [],
        collaborators: [],
        labels: [],
        allLabels: [],
        listViewType: null,
        pinnedListIds: [],
        user: req.session.user,
        search: false,
        searchInLabel: false,
        error: true,
        message: "error loading archive",
      });
    });
});

app.post("/archiveList", function (req, res) {
  db.any(
    `UPDATE listsToUsers SET archive = TRUE WHERE listId = ${req.body.listId} AND userId = '${req.session.user.id}';`
  )
    .then(() => {
      return res.redirect("/lists?archive=success");
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/lists?archive=error");
    });
});

app.post("/archiveSelected", function (req, res) {
  var array = req.body.listIds.split(",");
  var result = array.map(function (x) {
    return parseInt(x, 10);
  });

  db.any(
    `UPDATE listsToUsers SET archive = TRUE WHERE listId IN(${result}) AND userId = '${req.session.user.id}';`
  )
    .then(() => {
      return res.redirect("/lists?archiveSelected=success");
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/lists?archiveSelected=error");
    });
});

app.post("/pinSelected", function (req, res) {
  var array = req.body.listIds.split(",");
  var result = array.map(function (x) {
    return parseInt(x, 10);
  });

  db.any(
    `UPDATE listsToUsers SET pinned = TRUE WHERE listId IN(${result}) AND userId = '${req.session.user.id}';`
  )
    .then(() => {
      return res.redirect("/lists?pinSelected=success");
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/lists?pinSelected=error");
    });
});

app.post("/unpinSelected", function (req, res) {
  var array = req.body.listIds.split(",");
  var result = array.map(function (x) {
    return parseInt(x, 10);
  });

  db.any(
    `UPDATE listsToUsers SET pinned = FALSE WHERE listId IN(${result}) AND userId = '${req.session.user.id}';`
  )
    .then(() => {
      return res.redirect("/lists?unpinSelected=success");
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/lists?unpinSelected=error");
    });
});

app.post("/changeListView", function (req, res) {
  db.any(
    `SELECT listViewType FROM users WHERE userId = '${req.session.user.id}';`
  )
    .then((type) => {
      var newType = "column";

      if (type[0].listviewtype == "column") {
        newType = "row";
      } else if (type[0].listviewtype == "row") {
        newType = "column";
      }

      db.any(
        `UPDATE users SET listViewType = '${newType}' WHERE userId = '${req.session.user.id}';`
      )
        .then(() => {
          return res.redirect("/lists?changeView=success");
        })
        .catch((error) => {
          console.log(error);
          return res.redirect("/lists?changeView=error");
        });
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/lists?changeView=error");
    });
});

app.post("/removeCollaborator", function (req, res) {
  db.any(
    `DELETE FROM listsToUsers WHERE listId = '${req.body.listId}' AND userId = '${req.body.userId}'; UPDATE lists SET editDateTime = '${req.body.now}', lastModifiedByEmail = '${req.session.user.email}' WHERE listId = '${req.body.listId}';`
  )
    .then(() => {
      return res.redirect("/lists?removeCollaborator=success");
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/lists?removeCollaborator=error");
    });
});

app.get("/labels", function (req, res) {
  db.any(
    `SELECT * FROM labels WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userID = '${req.session.user.id}') AND labelID IN(SELECT labels.labelId AS "numberOfLists" FROM labels LEFT JOIN labelsToLists ON labels.labelId = labelsToLists.labelId GROUP BY labels.labelId ORDER BY COUNT(labelsToLists.labelId) DESC, label ASC);`
  )
    .then((allLabels) => {
      db.any(`SELECT labelId, COUNT(*) FROM labelsToLists GROUP BY labelId;`)
        .then((labelCounts) => {
          return res.render("pages/labels", {
            allLabels,
            labelCounts,
            user: req.session.user,
          });
        })
        .catch((error) => {
          console.log(error);
          return res.render("pages/labels", {
            allLabels,
            labelCounts: [],
            user: req.session.user,
          });
        });
    })
    .catch((error) => {
      console.log(error);
      return res.render("pages/labels", {
        allLabels: [],
        user: req.session.user,
      });
    });
});

app.get("/orderlabels", function (req, res) {
  db.any(
    `SELECT * FROM labels WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userID = '${req.session.user.id}') AND labelID IN(SELECT labels.labelId AS "numberOfLists" FROM labels LEFT JOIN labelsToLists ON labels.labelId = labelsToLists.labelId GROUP BY labels.labelId ORDER BY COUNT(labelsToLists.labelId) DESC, label ASC);`
  )
    .then((rows) => {
      return res.send(rows);
    })
    .catch((error) => {
      console.log(error);
      return res.send(error);
    });
});

app.post("/deleteLabel", function (req, res) {
  db.any(
    `DELETE FROM labelsToLists WHERE labelId = '${req.body.labelId}';DELETE FROM labelsToUsers WHERE labelId = '${req.body.labelId}'; DELETE FROM labels WHERE labelId = '${req.body.labelId}';`
  )
    .then(() => {
      return res.redirect("/labels?deleteLabel=success");
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/labels?deleteLabel=error");
    });
});

app.post("/sendCopy", function (req, res) {
  db.any(`SELECT * FROM lists WHERE listId = '${req.body.listId}';`)
    .then((list) => {
      db.any(
        `INSERT INTO lists (title, list, color, trash, editDateTime, createDateTime, lastModifiedByEmail) VALUES ('${list[0].title.replace(
          /'/g,
          "''"
        )}', '${list[0].list.replace(/'/g, "''")}', '${
          list[0].color
        }', FALSE, '${req.body.now}', '${req.body.now}', '${
          req.session.user.email
        }') RETURNING listId;`
      )
        .then((listId) => {
          db.any(
            `INSERT INTO listsToUsers (listId, userId, owner, archive, pinned, editable, locked) VALUES (${listId[0].listid}, '${req.body.recipientId}', TRUE, FALSE, FALSE, TRUE, FALSE);`
          )
            .then(() => {
              sendCopyEmail(
                req.body.email,
                req.session.user.email,
                req.session.user.displayName,
                list[0].title,
                list[0].list
              );
              return res.redirect("/lists?sendcopy=success");
            })
            .catch((error) => {
              console.log(error);
              return res.redirect("/lists?sendcopy=error");
            });
        })
        .catch((error) => {
          console.log(error);
          return res.redirect("/lists?sendcopy=error");
        });
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/lists?sendcopy=error");
    });
});

app.post("/deleteAllLabels", function (req, res) {
  const labelIdsQuery = `SELECT labelId FROM labels WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userID = '${req.session.user.id}')`;

  db.any(
    `DELETE FROM labelsToLists WHERE labelId IN(${labelIdsQuery});DELETE FROM labelsToUsers WHERE labelId IN(${labelIdsQuery});DELETE FROM labels WHERE labelId IN(${labelIdsQuery});`
  )
    .then(() => {
      return res.redirect("/labels?deleteAll=success");
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/labels?deleteAll=error");
    });
});

app.post("/updateLabel", function (req, res) {
  db.any(
    `UPDATE labels SET label = '${req.body.updatedLabel}' WHERE labelId = ${req.body.labelId} AND NOT EXISTS(SELECT 1 FROM labelsToUsers WHERE userId = '${req.session.user.id}' AND labelId IN(SELECT labelId FROM labels WHERE label = '${req.body.updatedLabel}'));`
  )
    .then(() => {
      return res.redirect("/labels?updateLabel=success");
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/labels?updateLabel=error");
    });
});

app.post("/searchUsers", function (req, res) {
  var q = req.body.q;
  var searchQuery = `SELECT * FROM users WHERE userId != '${req.session.user.id}' AND userID NOT IN(SELECT userID FROM listsToUsers WHERE listId = '${req.body.listIdToCollaborate}') AND (email LIKE '%${q}%' OR LOWER(email) LIKE '%${q}%' OR fullname LIKE '%${q}%' OR LOWER(fullname) LIKE '%${q}%');`;

  db.any(searchQuery)
    .then((users) => {
      return res.render("pages/addCollaborator", {
        users,
        listid: req.body.listIdToCollaborate,
        error: false,
        message: "results for " + q,
      });
    })
    .catch((error) => {
      console.log(error);
      return res.render("pages/addCollaborator", {
        users: [],
        listid: req.body.listIdToCollaborate,
        error: true,
        message: "error searching users",
      });
    });

  if (req.query.shareSelection && req.query.shareSelection == "true") {
    var listIdsToCollaborateRaw = req.body.listIdsToCollaborate.split(",");
    var listIdsToCollaborateClean = listIdsToCollaborateRaw.map(function (x) {
      return parseInt(x, 10);
    });

    searchQuery = `SELECT * FROM users WHERE userId != '${req.session.user.id}' AND userID NOT IN(SELECT userID FROM listsToUsers WHERE listId IN (${listIdsToCollaborateClean})) AND (email LIKE '%${q}%' OR LOWER(email) LIKE '%${q}%' OR fullname LIKE '%${q}%' OR LOWER(fullname) LIKE '%${q}%');`;

    db.any(searchQuery)
      .then((users) => {
        return res.render("pages/addCollaborator", {
          users,
          listid: listIdsToCollaborateClean,
          error: false,
          message: "results for " + q,
        });
      })
      .catch((error) => {
        console.log(error);
        return res.render("pages/addCollaborator", {
          users: [],
          listid: listIdsToCollaborateClean,
          error: true,
          message: "error searching users",
        });
      });
  }
});

app.post("/shareSelectionSearch", function (req, res) {
  var q = req.body.q;

  var listIdsToCollaborateRaw = req.body.listIdsToCollaborate.split(",");
  var listIdsToCollaborateClean = listIdsToCollaborateRaw.map(function (x) {
    return parseInt(x, 10);
  });

  console.log(listIdsToCollaborateClean);
  var searchQuery = `SELECT * FROM users WHERE userId != '${req.session.user.id}' AND userID NOT IN(SELECT userID FROM listsToUsers WHERE listId IN (${listIdsToCollaborateClean})) AND (email LIKE '%${q}%' OR LOWER(email) LIKE '%${q}%' OR fullname LIKE '%${q}%' OR LOWER(fullname) LIKE '%${q}%');`;

  db.any(searchQuery)
    .then((users) => {
      return res.render("pages/shareSelection", {
        users,
        listids: listIdsToCollaborateClean,
        error: false,
        message: "results for " + q,
      });
    })
    .catch((error) => {
      console.log(error);
      return res.render("pages/shareSelection", {
        users: [],
        listids: listIdsToCollaborateClean,
        error: true,
        message: "error searching users",
      });
    });
});

app.get("/labelsModal", function (req, res) {
  db.any(
    `SELECT * FROM labels WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userID = '${req.session.user.id}') AND labelID IN(SELECT labels.labelId AS "numberOfLists" FROM labels LEFT JOIN labelsToLists ON labels.labelId = labelsToLists.labelId GROUP BY labels.labelId ORDER BY COUNT(labelsToLists.labelId) DESC, label ASC);`
  )
    .then((labels) => {
      db.any(
        `SELECT labelId FROM labels WHERE labelID IN(SELECT labelId FROM labelsToLists WHERE listId = '${req.query.listId}');`
      )
        .then((labelIdsForThisList) => {
          var arr = [];
          for (var i = 0; i < labelIdsForThisList.length; i++) {
            arr.push(labelIdsForThisList[i].labelid);
          }

          return res.render("pages/labelsModal", {
            labels,
            labelIdsForThisList: arr,
            listid: req.query.listId,
          });
        })
        .catch((error) => {
          console.log(error);
          return res.render("pages/labelsModal", {
            labels: [],
            labelsForThisList: [],
            listid: req.query.listId,
          });
        });
    })
    .catch((error) => {
      console.log(error);
      return res.render("pages/labelsModal", {
        labels: [],
        labelsForThisList: [],
        listid: req.query.listId,
      });
    });
});

app.post("/createNewLabel", function (req, res) {
  const label = req.body.label.replace(/'/g, "''");
  const listId = req.body.listId;

  if (label.match(/^ *$/) !== null) {
    return res.redirect("/labelsModal?createNewLabel=error&listId=" + listId);
  }

  db.any(
    `SELECT * FROM labelsToUsers WHERE userId = '${req.session.user.id}' AND labelId IN(SELECT labelId FROM labels WHERE label = '${label}');`
  )
    .then((rows) => {
      if (rows.length > 0) {
        if (req.query.redirect && req.query.redirect == "labels") {
          return res.redirect("/labels?createNewLabel=error");
        }

        return res.redirect(
          "/labelsModal?createNewLabel=error&listId=" + listId
        );
      } else {
        db.any(
          `INSERT INTO labels (label) VALUES ('${label}');INSERT INTO labelsToUsers (labelId, userId) VALUES ((SELECT MAX(labelId) FROM labels), '${req.session.user.id}');`
        )
          .then(() => {
            if (req.query.redirect && req.query.redirect == "labels") {
              return res.redirect("/labels?createNewLabel=success");
            }

            return res.redirect(
              "/labelsModal?createNewLabel=success&listId=" + listId
            );
          })
          .catch((error) => {
            console.log(error);
            return res.redirect(
              "/labelsModal?createNewLabel=error&listId=" + listId
            );
          });
      }
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/labelsModal?createNewLabel=error&listId=" + listId);
    });
});

app.get("/countLabelsPerList", function (req, res) {
  db.any(
    `SELECT listId, COUNT(listId) FROM labelsToLists WHERE listId = 2 GROUP BY listId;`
  )
    .then((rows) => {
      return res.send(rows[0].count);
    })
    .catch((error) => {
      console.log(error);
      return res.send(error);
    });
});

app.get("/countCollabsForAList", function (req, res) {
  var countQuery = `SELECT listId, COUNT(userId) FROM listsToUsers WHERE listId = 1 GROUP BY listId;`;

  db.any(countQuery)
    .then((rows) => {
      return res.send(rows[0].count);
    })
    .catch((error) => {
      console.log(error);
      return res.send(error);
    });
});

app.post("/assignLabelToList", function (req, res) {
  var countQuery = `SELECT listId, COUNT(listId) FROM labelsToLists WHERE listId = '${req.body.listId}' GROUP BY listId;`;
  if (req.query.listId) {
    countQuery = `SELECT listId, COUNT(listId) FROM labelsToLists WHERE listId = '${req.query.listId}' GROUP BY listId;`;
  }

  var q = `INSERT INTO labelsToLists (labelId, listId) SELECT '${req.body.labelId}', '${req.body.listId}' WHERE NOT EXISTS (SELECT 1 FROM labelsToLists WHERE labelId = '${req.body.labelId}' AND listId = '${req.body.listId}');`;
  if (req.query.listId) {
    q = `INSERT INTO labelsToLists (labelId, listId) SELECT '${req.body.labelId}', '${req.query.listId}' WHERE NOT EXISTS (SELECT 1 FROM labelsToLists WHERE labelId = '${req.body.labelId}' AND listId = '${req.query.listId}');`;
  }

  db.any(countQuery)
    .then((rows) => {
      if (rows.length > 0 && rows[0].count >= 10) {
        return res.redirect("/lists?assignLabel=error&maxlabels=true");
      } else {
        db.any(q)
          .then(() => {
            return res.redirect("/lists?assignLabel=success");
          })
          .catch((error) => {
            console.log(error);
            return res.redirect("/lists?assignLabel=error");
          });
      }
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/lists?assignLabel=error");
    });
});

app.post("/removeLabelFromList", function (req, res) {
  db.any(
    `DELETE FROM labelsToLists WHERE labelId = '${req.body.labelId}' AND listId = '${req.body.listId}';`
  )
    .then(() => {
      return res.redirect("/lists?removeLabelFromList=success");
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/lists?removeLabelFromList=error");
    });
});

app.post("/addCollaborator", function (req, res) {
  var countQuery = `SELECT listId, COUNT(userId) FROM listsToUsers WHERE listId = '${req.body.listId}' GROUP BY listId;`;

  db.any(countQuery)
    .then((rows) => {
      if (rows.length > 0 && rows[0].count >= 10) {
        return res.redirect("/lists?addCollaborator=error&max=true");
      } else {
        db.any(
          `INSERT INTO listsToUsers (listId, userId, owner, archive, pinned, editable, locked) SELECT '${req.body.listId}', '${req.body.collaboratorUserId}', FALSE, FALSE, FALSE, TRUE, FALSE WHERE NOT EXISTS (SELECT 1 FROM listsToUsers WHERE listId = '${req.body.listId}' AND userId = '${req.body.collaboratorUserId}'); UPDATE lists SET editDateTime = '${req.body.now}', lastModifiedByEmail = '${req.session.user.email}' WHERE listId = '${req.body.listId}';`
        )
          .then(() => {
            db.any(
              `SELECT title, list FROM lists WHERE listId = '${req.body.listId}';`
            )
              .then((list) => {
                sendCollaborationEmail(
                  req.body.email,
                  req.session.user.email,
                  req.session.user.displayName,
                  list[0].title,
                  list[0].list,
                  "false"
                );
                return res.redirect("/lists?addCollaborator=success");
              })
              .catch((error) => {
                console.log(error);
                return res.redirect("/lists?addCollaborator=error");
              });
          })
          .catch((error) => {
            console.log(error);
            return res.redirect("/lists?addCollaborator=error");
          });
      }
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/lists?addCollaborator=error");
    });
});

app.post("/sendFeedback", function (req, res) {
  let transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: "true",
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PWD_MAC,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  let mailOptions = {
    from: req.session.user.email,
    to: "lists.communications@gmail.com",
    subject: "Feedback from " + req.user.name.givenName,
    html:
      "<h5>From " + req.session.user.email + "</h5><br>" + req.body.feedback,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log(error);
    }

    console.log("Message sent: %s", info.messageId);
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    transporter.close();
  });

  return res.redirect("/lists?sendFeedback=success");
});

app.post("/shareSelection", function (req, res) {
  var listIdsToCollaborateRaw = req.body.listIds.split(",");
  var listIdsToCollaborateClean = listIdsToCollaborateRaw.map(function (x) {
    return parseInt(x, 10);
  });

  var listsToUserQuery = "";
  for (var i = 0; i < listIdsToCollaborateClean.length; i++) {
    listsToUserQuery += `INSERT INTO listsToUsers (listId, userId, owner, archive, pinned, editable, locked) SELECT '${listIdsToCollaborateClean[i]}', '${req.body.collaboratorUserId}', FALSE, FALSE, FALSE, TRUE, FALSE WHERE NOT EXISTS (SELECT 1 FROM listsToUsers WHERE listId = '${listIdsToCollaborateClean[i]}' AND userId = '${req.body.collaboratorUserId}'); UPDATE lists SET editDateTime = '${req.body.now}', lastModifiedByEmail = '${req.session.user.email}' WHERE listId = '${listIdsToCollaborateClean[i]}';`;
  }

  var countQuery = `SELECT listId, COUNT(userId) FROM listsToUsers WHERE listId IN (${listIdsToCollaborateClean}) GROUP BY listId;`;

  db.any(countQuery)
    .then((rows) => {
      if (rows.length > 0 && rows[0].count >= 10) {
        return res.redirect("/lists?shareSelection=error&max=true");
      } else {
        db.any(listsToUserQuery)
          .then(() => {
            db.any(
              `SELECT title, list FROM lists WHERE listId IN(${listIdsToCollaborateClean});`
            )
              .then((lists) => {
                for (var i = 0; i < lists.length; i++) {
                  sendCollaborationEmail(
                    req.body.email,
                    req.session.user.email,
                    req.session.user.displayName,
                    lists[i].title,
                    lists[i].list,
                    "false"
                  );
                }

                return res.redirect("/lists?shareSelection=success");
              })
              .catch((error) => {
                console.log(error);
                return res.redirect("/lists?shareSelection=error");
              });
          })
          .catch((error) => {
            console.log(error);
            return res.redirect("/lists?shareSelection=error");
          });
      }
    })
    .catch((error) => {
      console.log(error);
      return res.redirect("/lists?shareSelection=error");
    });
});

// End routing

// Functions

function sendCollaborationEmail(
  emailTo,
  emailFrom,
  nameFrom,
  title,
  list,
  copy
) {
  var listInfo = "";
  if (title) {
    listInfo = title.substring(0, 10);
    if (title.length > 10) {
      listInfo += "...";
    }
  } else if (list) {
    listInfo = list.replace(/<\/?[^>]+(>|$)/g, "").substring(0, 10);
    if (list.length > 10) {
      listInfo += "...";
    }
  }

  var subject = nameFrom + ' shared their list "' + listInfo + '" with you';
  var html =
    '<p style="text-align:center;margin-left:auto;margin-right:auto;width:300px">' +
    nameFrom +
    " (" +
    emailFrom +
    ")" +
    ' shared their list "' +
    listInfo +
    '" with you. Log in to collaborate on it.</p>';

  if (copy == "true") {
    subject = nameFrom + " copied a list you have access to";
    html =
      '<p style="text-align:center;margin-left:auto;margin-right:auto;width:300px">' +
      nameFrom +
      " (" +
      emailFrom +
      ")" +
      ' copied a list you have access to ("' +
      listInfo +
      '"). You now have access to the new copy as well, with your original labels preserved. Log in to collaborate on it.</p>';
  }

  let transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: "true",
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PWD_MAC,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  let mailOptions = {
    from: "lists.communications@gmail.com",
    to: emailTo,
    subject: subject,
    attachments: [
      {
        filename: "emailLogo.png",
        path: __dirname + "/resources/img/emailLogo.png",
        cid: "emailLogo",
      },
    ],
    html:
      html +
      `<br><br><br><p><img src = 'cid:emailLogo' style='display:block;margin-left:auto;margin-right:auto;width:125px'></img></p>`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log(error);
    }
    console.log("Message sent: %s", info.messageId);
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    transporter.close();
  });
}

function sendCopyEmail(emailTo, emailFrom, nameFrom, title, list) {
  var listInfo = "";
  if (title) {
    listInfo = title.substring(0, 10);
    if (title.length > 10) {
      listInfo += "...";
    }
  } else if (list) {
    listInfo = list.replace(/<\/?[^>]+(>|$)/g, "").substring(0, 10);
    if (list.length > 10) {
      listInfo += "...";
    }
  }

  var subject =
    nameFrom + ' sent a copy of their list "' + listInfo + '" to you';
  var html =
    '<p style="text-align:center;margin-left:auto;margin-right:auto;width:300px">' +
    nameFrom +
    " (" +
    emailFrom +
    ")" +
    ' sent you a copy of their list "' +
    listInfo +
    '". Log in to see.</p>';

  let transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: "true",
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PWD_MAC,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  let mailOptions = {
    from: "lists.communications@gmail.com",
    to: emailTo,
    subject: subject,
    attachments: [
      {
        filename: "emailLogo.png",
        path: __dirname + "/resources/img/emailLogo.png",
        cid: "emailLogo",
      },
    ],
    html:
      html +
      `<br><br><br><p><img src = 'cid:emailLogo' style='display:block;margin-left:auto;margin-right:auto;width:125px'></img></p>`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log(error);
    }
    console.log("Message sent: %s", info.messageId);
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    transporter.close();
  });
}

function sendListPasswordResetEmail(emailTo, code) {
  var subject = "Your list password reset code";
  var html =
    '<p style="text-align:center;margin-left:auto;margin-right:auto;width:300px">Use code ' +
    code +
    " to change your list password.<br>If you did not request this code, ignore this message.</p>";

  let transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: "true",
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PWD_MAC,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  let mailOptions = {
    from: "lists.communications@gmail.com",
    to: emailTo,
    subject: subject,
    attachments: [
      {
        filename: "emailLogo.png",
        path: __dirname + "/resources/img/emailLogo.png",
        cid: "emailLogo",
      },
    ],
    html:
      html +
      `<br><br><br><p><img src = 'cid:emailLogo' style='display:block;margin-left:auto;margin-right:auto;width:125px'></img></p>`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log(error);
    }
    console.log("Message sent: %s", info.messageId);
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    transporter.close();
  });
}

app.use((req, res, next) => {
  res.status(404).render("pages/404");
});

app.listen(3000);

console.log("Server is listening on port 3000");
