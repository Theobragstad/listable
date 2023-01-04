const express = require('express');
const app = express();
const pgp = require('pg-promise')();
const session = require('express-session');
const nodemailer = require('nodemailer');
const passport = require('passport');
const cookieSession = require('cookie-session');
const bodyParser = require('body-parser');

require('./passport');

const dbConfig = {
    host: 'db',
    port: 5432,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
};
  
const db = pgp(dbConfig);
  
db.connect()
    .then(obj => {
        console.log('Database connection successful'); 
        obj.done(); 
    })
    .catch(error => {
        console.log('ERROR:', error.message || error);
    });

app.set('view engine', 'ejs');

app.use(express.json({limit: '25mb'}));
app.use(express.urlencoded({limit: '25mb', extended: true}));

app.use(express.static('resources'));

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        saveUninitialized: false,
        resave: false,
        cookie: { maxAge: 3600000 }, 
        rolling: false
    })
);

app.use(passport.initialize());
app.use(passport.session());
    

// Routing
app.get('/', (req, res) => {

    if(req.session.user) {
        return res.redirect('/lists');  
    }
    return res.render("pages/home");
});

app.get('/home', (req, res) => {
    return res.redirect('/');
});
  
// Auth 
app.get('/auth' , passport.authenticate('google', { scope:
    [ 'email', 'profile' ]
}));
  
// Auth Callback
app.get( '/auth/callback',
    passport.authenticate( 'google', {
        successRedirect: '/auth/callback/success',
        failureRedirect: '/auth/callback/failure'
}));

// Failure
app.get('/auth/callback/failure' , (req , res) => {
    res.send("Error");
})
  
// Success 
app.get('/auth/callback/success' , (req , res) => {
    if(!req.user) {
        res.redirect('/auth/callback/failure');
    }
    else {
        db.any(`INSERT INTO users (userId, email, fullname, profilePhotoUrl, listViewType) SELECT '${req.user.id}', '${req.user.email}', '${req.user.displayName}', '${req.user.photos[0].value}', 'column' WHERE NOT EXISTS (SELECT 1 FROM users WHERE userId = '${req.user.id}' AND email = '${req.user.email}' AND fullname = '${req.user.displayName}' AND profilePhotoUrl = '${req.user.photos[0].value}');`)
            .then(() => {
                req.session.user = {id: req.user.id, givenName: req.user.name.givenName, email: req.user.email, profilePhoto: req.user.photos[0].value, displayName: req.user.displayName};
                req.session.save();

                return res.redirect('/lists?login=success');
            })
            .catch((error) => {
                console.log(error);
                return res.redirect('/home?login=error');
            });
    }
});

const auth = (req, res, next) => {
    if (!req.session.user) {
        // Default to home page
        return res.redirect('/');
    }
    next();
};
  
// Authentication required
app.use(auth);


app.get('/lists', function(req, res) {
    const successMessages = ['added new list', 'updated list', 'changed list color', 'deleted list',
                             'deleted selected lists', 'recovered list', 'recovered selected lists', 'recovered all lists',
                             'copied list', 'archived list', 'unarchived list', 'created unarchived copy'];
    
    const errorMessages = ['error adding new list', 'error updating list', 'error changing list color', 'error deleting list',
                           'error deleting selected lists', 'error recovering list', 'error recovering selected lists', 
                           'error recovering all lists', 'error copying list', 'error archiving list', 
                           'error unarchiving list', 'error copying archived list'];
    
    var error = 0;
    var message = '';

    if(req.query.add) {
        message = (req.query.add == 'success') ? successMessages[0] : errorMessages[0];
        error = (req.query.add == 'success') ? 0 : 1;
    }
    else if(req.query.update) {
        message = (req.query.update == 'success') ? successMessages[1] : errorMessages[1];
        error = (req.query.update == 'success') ? 0 : 1;
    }
    else if(req.query.changeColor) {
        message = (req.query.changeColor == 'success') ? successMessages[2] : errorMessages[2];
        error = (req.query.changeColor == 'success') ? 0 : 1;
    }
    else if(req.query.delete) {
        message = (req.query.delete == 'success') ? successMessages[3] : errorMessages[3];
        error = (req.query.delete == 'success') ? 0 : 1;
    }
    else if(req.query.deleteSelected) {
        message = (req.query.deleteSelected == 'success') ? successMessages[4] : errorMessages[4];
        error = (req.query.deleteSelected == 'success') ? 0 : 1;

        if(req.query.count) {
            message = (req.query.count == '1') ? 'deleted ' + req.query.count + ' selected list' : 'deleted ' + req.query.count + ' selected lists';
        }
    }
    else if(req.query.restore) {
        message = (req.query.restore == 'success') ? successMessages[5] : errorMessages[5];
        error = (req.query.restore == 'success') ? 0 : 1;

        if(req.query.archived && req.query.archived == 'true') {
            return res.redirect('/archive?restore=success&archived=true');
        }
    }
    else if(req.query.restoreSelected) {
        message = (req.query.restoreSelected == 'success') ? successMessages[6] : errorMessages[6];
        error = (req.query.restoreSelected == 'success') ? 0 : 1;

        if(req.query.count) {
            message = (req.query.count == '1') ? 'recovered ' + req.query.count + ' selected list' : 'recovered ' + req.query.count + ' selected lists';
        }
    }
    else if(req.query.restoreAll) {
        message = (req.query.restoreAll == 'success') ? successMessages[7] : errorMessages[7];
        error = (req.query.restoreAll == 'success') ? 0 : 1;
    }
    else if(req.query.copy) {
        message = (req.query.copy == 'success') ? successMessages[8] : errorMessages[8];
        error = (req.query.copy == 'success') ? 0 : 1;
    }
    else if(req.query.archive) {
        message = (req.query.archive == 'success') ? successMessages[9] : errorMessages[9];
        error = (req.query.archive == 'success') ? 0 : 1;
    }
    else if(req.query.unarchive) {
        message = (req.query.unarchive == 'success') ? successMessages[10] : errorMessages[10];
        error = (req.query.unarchive == 'success') ? 0 : 1;
    }
    else if(req.query.copyArchived) {
        message = (req.query.copyArchived == 'success') ? successMessages[11] : errorMessages[11];
        error = (req.query.copyArchived == 'success') ? 0 : 1;
    }

    db.tx(t => {
        const lists = db.any(`SELECT lists.* FROM lists JOIN listsToUsers ON listsToUsers.listId = lists.listId WHERE listsToUsers.userId = '${req.session.user.id}' AND listsToUsers.archive = FALSE AND lists.trash = FALSE ORDER BY listsToUsers.pinned DESC, lists.editDateTime DESC;`);
//OWNER IS OLDEST ENTRY FOR THAT LISTID
        // const lists = db.any(`SELECT * FROM lists WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}' AND archive = FALSE) AND trash = FALSE ORDER BY editDateTime DESC;`);
        // const collaborators = db.any(`SELECT users.email, users.profilePhotoUrl, users.fullname, users.userId, listsToUsers.listId, listsToUsers.owner FROM listsToUsers INNER JOIN users ON listsToUsers.userId = users.userId;`);
        
        const collaborators = db.any(`SELECT users.email, users.profilePhotoUrl, users.fullname, users.userId, listsToUsers.listId, listsToUsers.owner FROM listsToUsers INNER JOIN users ON listsToUsers.userId = users.userId ORDER BY owner DESC;`);

        
        
        
        const labels = db.any(`CREATE OR REPLACE VIEW labelsJoinlabelsToLists AS (SELECT labels.labelId, labels.label, labelsToLists.listId FROM labelsToLists INNER JOIN labels ON labelsToLists.labelId = labels.labelId);SELECT * FROM labelsJoinlabelsToLists WHERE labelId IN(SELECT labelId from labelsToUsers where userId = '${req.session.user.id}');`);
        // const allLabels = db.any(`SELECT * FROM labels WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userID = '${req.session.user.id}') ORDER BY label ASC;`);
        const allLabels = db.any(`SELECT * FROM labels WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userID = '${req.session.user.id}') AND labelID IN(SELECT labels.labelId AS "numberOfLists" FROM labels LEFT JOIN labelsToLists ON labels.labelId = labelsToLists.labelId GROUP BY labels.labelId ORDER BY COUNT(labelsToLists.labelId) DESC, label ASC);`)

        const archivedLists = db.any(`SELECT listId FROM listsToUsers WHERE archive = TRUE AND userId = '${req.session.user.id}';`);

        const listViewType = db.any(`SELECT listViewType FROM users WHERE userId = '${req.session.user.id}';`);

        const pinnedLists = db.any(`SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}' AND pinned = TRUE;`);

        return t.batch([lists, collaborators, labels, allLabels, archivedLists, listViewType, pinnedLists]); 
    })
        .then((data) => {
            // console.log(data[0]);
            // console.log('______________________');
            // console.log(data[1]);
            var archivedListIds = [];
            var archivedListIdsRaw = data[4];
            for(var i = 0; i < archivedListIdsRaw.length; i++) {
                archivedListIds.push(archivedListIdsRaw[i].listid)
            }

            var pinnedListIds = [];
            var pinnedListIdsRaw = data[6];
            for(var i = 0; i < pinnedListIdsRaw.length; i++) {
                pinnedListIds.push(pinnedListIdsRaw[i].listid)
            }

            return res.render("pages/lists", {lists: data[0], collaborators: data[1], labels: data[2], allLabels: data[3], archivedListIds, listViewType: data[5][0].listviewtype, pinnedListIds, user: req.session.user, search: false, error, message, filterByLabel: false, label: null, labelid: null, searchInLabel: false});
        })
        .catch((error) => {
            console.log(error);
            return res.render("pages/lists", {lists: [], collaborators: [], labels: [], archivedListIds: [], listViewType: null, pinnedListIds: [], user: req.session.user, search: false, error: true, message: 'error loading lists', filterByLabel: false, label: null, labelid: null, searchInLabel: false});
        });
});

app.get('/logout', function (req, res, next) {
    req.logout(function(err) {
        if (err) { 
            return next(err); 
        }
        req.session.destroy();

        res.render('pages/home', {message: 'signed out'});
      });
})


app.post('/search', function(req, res) {
    var q;
    
    // console.log(req.body.label);
    if(req.body.q) {
        q = req.body.q.toLowerCase().replace(/'/g, "''");

        // Handle color search
        var colorCodeToMatch1 = null;
        var colorCodeToMatch2 = null;
        switch(q) {
            case 'white':
                colorCodeToMatch1 = 'ffffff';
                break;
            case 'gray':
                colorCodeToMatch1 = 'eeeeee';
                break;
            case 'yellow':
                colorCodeToMatch1 = 'fdf5c1';
                break;
            case 'orange':
                colorCodeToMatch1 = 'f7cdc2';
                break;
            case 'blue':
                colorCodeToMatch1 = 'bae6fc';
                colorCodeToMatch2 = 'b4c9fa';
                break;
            case 'green':
                colorCodeToMatch1 = 'bdf6d9';
                colorCodeToMatch2 = 'cafbc8';
                break;
            case 'pink':
                colorCodeToMatch1 = 'f4c3fb';
                break;
            case 'purple':
                colorCodeToMatch1 = 'd0adfa';
         }

    }
    else if(!(req.query.filterByLabel && req.query.filterByLabel == 'true') && !(req.query.searchInLabel && req.query.searchInLabel == 'true')){
        return res.redirect('/lists');
    }

    var searchQuery = `SELECT * FROM lists WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}') AND trash = FALSE AND (LOWER(color) LIKE '%${colorCodeToMatch1}%' OR LOWER(color) LIKE '%${colorCodeToMatch2}%' OR LOWER(title) LIKE '%${q}%' OR LOWER(list) LIKE '%${q}%' OR listId IN(SELECT listId FROM listsToUsers WHERE userId IN(SELECT userId FROM emails_and_names WHERE LOWER(email) LIKE '%${q}%' OR LOWER(fullname) LIKE '%${q}%')) OR listId IN(SELECT listId FROM labelsToLists WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userId = '${req.session.user.id}' AND labelId IN(SELECT labelID FROM labels WHERE LOWER(label) LIKE '%${q}%')))) ORDER BY editDateTime DESC;`;

    // var searchQuery = `SELECT * FROM lists WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}') AND trash = FALSE AND (LOWER(title) LIKE '%${q}%' OR LOWER(list) LIKE '%${q}%' OR listId IN(SELECT listId FROM listsToUsers WHERE userId IN(SELECT userId FROM emails_and_names WHERE LOWER(email) LIKE '%${q}%' OR LOWER(fullname) LIKE '%${q}%')) OR listId IN(SELECT listId FROM labelsToLists WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userId = '${req.session.user.id}' AND labelId IN(SELECT labelID FROM labels WHERE LOWER(label) LIKE '%${q}%')))) ORDER BY editDateTime DESC;`;
    var renderPage = 'lists';

    if(req.query.searchInLabel && req.query.searchInLabel == 'true') {
        searchQuery = `SELECT * FROM lists WHERE listId IN(SELECT listId FROM labelsToLists WHERE labelId = '${req.query.labelId}') AND trash = FALSE AND (LOWER(title) LIKE '%${q}%' OR LOWER(list) LIKE '%${q}%' OR listId IN(SELECT listId FROM listsToUsers WHERE userId IN(SELECT userId FROM emails_and_names WHERE LOWER(email) LIKE '%${q}%' OR LOWER(fullname) LIKE '%${q}%'))) ORDER BY editDateTime DESC;`;
    }
    else if(req.query.filterByLabel && req.query.filterByLabel == 'true') {
        searchQuery = `SELECT * FROM lists WHERE trash = FALSE AND listId IN(SELECT listId FROM labelsToLists WHERE labelId = '${req.query.labelId}') ORDER BY editDateTime DESC;`;
    }
    else if(req.query.archive && req.query.archive == 'true') {
        searchQuery = `SELECT * FROM lists WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}' AND archive = TRUE) AND trash = FALSE AND (LOWER(title) LIKE '%${q}%' OR LOWER(list) LIKE '%${q}%' OR listId IN(SELECT listId FROM listsToUsers WHERE userId IN(SELECT userId FROM emails_and_names WHERE LOWER(email) LIKE '%${q}%' OR LOWER(fullname) LIKE '%${q}%')) OR listId IN(SELECT listId FROM labelsToLists WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userId = '${req.session.user.id}' AND labelId IN(SELECT labelID FROM labels WHERE LOWER(label) LIKE '%${q}%')))) ORDER BY editDateTime DESC;`;
        renderPage = 'archive';
    }
    else if(req.query.trash && req.query.trash == 'true') {
        searchQuery = `SELECT * FROM lists WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}' AND archive = FALSE) AND trash = TRUE AND (LOWER(title) LIKE '%${q}%' OR LOWER(list) LIKE '%${q}%' OR listId IN(SELECT listId FROM listsToUsers WHERE userId IN(SELECT userId FROM emails_and_names WHERE LOWER(email) LIKE '%${q}%' OR LOWER(fullname) LIKE '%${q}%')) OR listId IN(SELECT listId FROM labelsToLists WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userId = '${req.session.user.id}' AND labelId IN(SELECT labelID FROM labels WHERE LOWER(label) LIKE '%${q}%')))) ORDER BY editDateTime DESC;`;
        renderPage = 'trash';
    }

    var viewQuery = `CREATE OR REPLACE VIEW emails_and_names AS (SELECT userId, email, fullname FROM users WHERE userId IN(SELECT userId FROM listsToUsers WHERE userId != '${req.session.user.id}' AND listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}')));`;
    
    db.tx(t => {
        const lists = db.any(viewQuery + searchQuery);
        const collaborators = db.any(`SELECT users.email, users.profilePhotoUrl, users.fullname, users.userId, listsToUsers.listId, listsToUsers.owner FROM listsToUsers INNER JOIN users ON listsToUsers.userId = users.userId;`);
        const labels = db.any(`CREATE OR REPLACE VIEW labelsJoinlabelsToLists AS (SELECT labels.labelId, labels.label, labelsToLists.listId FROM labelsToLists INNER JOIN labels ON labelsToLists.labelId = labels.labelId);SELECT * FROM labelsJoinlabelsToLists WHERE labelId IN(SELECT labelId from labelsToUsers where userId = '${req.session.user.id}');`);
        // const allLabels = db.any(`SELECT * FROM labels WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userID = '${req.session.user.id}') ORDER BY label ASC;`);
        const allLabels = db.any(`SELECT * FROM labels WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userID = '${req.session.user.id}') AND labelID IN(SELECT labels.labelId AS "numberOfLists" FROM labels LEFT JOIN labelsToLists ON labels.labelId = labelsToLists.labelId GROUP BY labels.labelId ORDER BY COUNT(labelsToLists.labelId) DESC, label ASC);`)

        const archivedLists = db.any(`SELECT listId FROM listsToUsers WHERE archive = TRUE AND userId = '${req.session.user.id}';`);

        const listViewType = db.any(`SELECT listViewType FROM users WHERE userId = '${req.session.user.id}';`);

        return t.batch([lists, collaborators, labels, allLabels, archivedLists, listViewType]); 
    })
        .then((data) => {
            var archivedListIds = [];
            var archivedListIdsRaw = data[4];
            for(var i = 0; i < archivedListIdsRaw.length; i++) {
                archivedListIds.push(archivedListIdsRaw[i].listid)
            }

            if(req.query.searchInLabel && req.query.searchInLabel == 'true') {
                return res.render('pages/' + renderPage, {lists: data[0], collaborators: data[1], labels: data[2], allLabels: data[3], archivedListIds, listViewType: data[5][0].listviewtype, user: req.session.user, search: false, message: `results for '` + q + `' within label '` + req.body.label + `'`, filterByLabel: true, label: req.body.label, labelid: req.query.labelId, searchInLabel: true});
            }
            else if(req.query.filterByLabel && req.query.filterByLabel == 'true') {
                return res.render('pages/' + renderPage, {lists: data[0], collaborators: data[1], labels: data[2], allLabels: data[3], archivedListIds, listViewType: data[5][0].listviewtype, user: req.session.user, search: false, message: `filtering by label '` + req.body.label + `'`, filterByLabel: true, label: req.body.label, labelid: req.query.labelId, searchInLabel: false});
            }
            return res.render('pages/' + renderPage, {lists: data[0], collaborators: data[1], labels: data[2], allLabels: data[3],  archivedListIds, listViewType: data[5][0].listviewtype, user: req.session.user, search: true, message: `results for '` + q + `'`, filterByLabel: false, label: null, labelid: null, searchInLabel: false});
        })
        .catch((error) => {
            console.log(error);
            return res.render('pages/' + renderPage, {lists: [], collaborators: [], labels: [], allLabels: [], archivedListIds: [], listViewType: null, user: req.session.user, search: true, error: true, message: 'search error', filterByLabel: false, label: null, labelid: null, searchInLabel: false});
        });
    // db.any(viewQuery + searchQuery)
    //     .then((lists) => {
    //         db.any(`SELECT users.email, users.profilePhotoUrl, users.fullname, users.userId, listsToUsers.listId, listsToUsers.owner FROM listsToUsers INNER JOIN users ON listsToUsers.userId = users.userId;`)
    //             .then((rows) => {
    //                 return res.render('pages/' + renderPage, {search: true, lists, labels: [], collaborators: rows, user: req.session.user, message: `results for '` + q + `'`});
    //             })
    //             .catch((error) => {
    //                 console.log(error);
    //                 return res.render('pages/' + renderPage, {search: true, lists, collaborators: [],user: req.session.user, email: req.session.user.email, profilePhoto: req.session.user.profilePhoto, givenName: req.session.user.givenName, currentUserId: req.session.user.id, message: `results for '` + q + `'`});
    //             });
    //     })
    //     .catch((error) => {
    //         console.log(error);
    //         return res.render('pages/lists', {search: true, error: true, lists: [], user: req.session.user,email: req.session.user.email, profilePhoto: req.session.user.profilePhoto, givenName: req.session.user.givenName, currentUserId: req.session.user.id, message: 'search error'});
    //     });
});

app.post('/permanentlyDeleteList', function(req, res) {
    db.any(`DELETE FROM listsToUsers WHERE listId = ${req.body.listId}; DELETE FROM lists WHERE listId = ${req.body.listId};`)
        .then(() => {
            return res.redirect('/trash?permanentlyDeleted=success');

        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/trash?permanentlyDeleted=failure');
        });
});




app.post('/addListWithThisLabel', function(req, res) {
    var title = (!req.body.title) ? '' : req.body.title;
    var labelId = req.body.labelId;

    db.any(`INSERT INTO lists (title, list, color, trash, editDateTime, createDateTime) VALUES ('${title.replace(/'/g, "''")}', '${req.body.list.replace(/'/g, "''")}', 'ffffff', FALSE, '${req.body.now}', '${req.body.now}') RETURNING listId;`)
        .then((listId) => {
            db.any(`INSERT INTO listsToUsers (listId, userId, owner, archive, pinned) VALUES (${listId[0].listid}, '${req.session.user.id}', TRUE, FALSE, FALSE); INSERT INTO labelsToLists (labelId, listId) VALUES (${labelId}, ${listId[0].listid});`)

            // THIS IS GOOD db.any(`INSERT INTO listsToUsers (listId, userId, owner, archive) VALUES (${listId[0].listid}, '${req.session.user.id}', TRUE, FALSE); INSERT INTO labelsToLists (labelId, listId) VALUES (${labelId}, ${listId[0].listid});`)
                .then(() => {
                    return res.redirect('/search?filterByLabel=true&labelId='+ labelId +'&add=success');
                })
                .catch((error) => {
                    console.log(error);
                    return res.redirect('/search?filterByLabel=true&labelId='+ labelId +'&add=failure');
                });
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/search?filterByLabel=true&labelId='+ labelId +'&add=failure');
        });
});

// This special GET version of /search is only to be used in very specific cases such as from /addListWithThisLabel
app.get('/search', function(req, res) {
    var searchQuery = `SELECT * FROM lists WHERE trash = FALSE AND listId IN(SELECT listId FROM labelsToLists WHERE labelId = '${req.query.labelId}') ORDER BY editDateTime DESC;`;
    var viewQuery = `CREATE OR REPLACE VIEW emails_and_names AS (SELECT userId, email, fullname FROM users WHERE userId IN(SELECT userId FROM listsToUsers WHERE userId != '${req.session.user.id}' AND listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}')));`;
    
    db.tx(t => {
        // const lists = db.any(viewQuery + searchQuery);
        const lists = db.any(`SELECT lists.* FROM lists JOIN listsToUsers ON listsToUsers.listId = lists.listId WHERE listsToUsers.userId = '${req.session.user.id}' AND listsToUsers.archive = FALSE AND lists.trash = FALSE AND lists.listId IN(SELECT listId FROM labelsToLists WHERE labelId = '${req.query.labelId}') ORDER BY listsToUsers.pinned DESC, lists.editDateTime DESC;`);

        const collaborators = db.any(`SELECT users.email, users.profilePhotoUrl, users.fullname, users.userId, listsToUsers.listId, listsToUsers.owner FROM listsToUsers INNER JOIN users ON listsToUsers.userId = users.userId ORDER BY owner DESC;`);

        // const collaborators = db.any(`SELECT users.email, users.profilePhotoUrl, users.fullname, users.userId, listsToUsers.listId, listsToUsers.owner FROM listsToUsers INNER JOIN users ON listsToUsers.userId = users.userId;`);
        const labels = db.any(`CREATE OR REPLACE VIEW labelsJoinlabelsToLists AS (SELECT labels.labelId, labels.label, labelsToLists.listId FROM labelsToLists INNER JOIN labels ON labelsToLists.labelId = labels.labelId);SELECT * FROM labelsJoinlabelsToLists WHERE labelId IN(SELECT labelId from labelsToUsers where userId = '${req.session.user.id}');`);
        // const allLabels = db.any(`SELECT * FROM labels WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userID = '${req.session.user.id}') ORDER BY label ASC;`);
        const allLabels = db.any(`SELECT * FROM labels WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userID = '${req.session.user.id}') AND labelID IN(SELECT labels.labelId AS "numberOfLists" FROM labels LEFT JOIN labelsToLists ON labels.labelId = labelsToLists.labelId GROUP BY labels.labelId ORDER BY COUNT(labelsToLists.labelId) DESC, label ASC);`)

        const label = db.any(`SELECT label FROM labels WHERE labelId = '${req.query.labelId}' LIMIT 1;`);
        const archivedLists = db.any(`SELECT listId FROM listsToUsers WHERE archive = TRUE AND userId = '${req.session.user.id}';`);
        
        const listViewType = db.any(`SELECT listViewType FROM users WHERE userId = '${req.session.user.id}';`);

        return t.batch([lists, collaborators, labels, allLabels, label, archivedLists, listViewType, pinnedLists]); 
    })
        .then((data) => {
            var archivedListIds = [];
            var archivedListIdsRaw = data[5];
            for(var i = 0; i < archivedListIdsRaw.length; i++) {
                archivedListIds.push(archivedListIdsRaw[i].listid)
            }

            var pinnedListIds = [];
            var pinnedListIdsRaw = data[7];
            for(var i = 0; i < pinnedListIdsRaw.length; i++) {
                pinnedListIds.push(pinnedListIdsRaw[i].listid)
            }

            if(req.query.filterByLabel && req.query.filterByLabel == 'true') {
                return res.render('pages/lists', {lists: data[0], collaborators: data[1], labels: data[2], allLabels: data[3], archivedListIds, listViewType: data[6][0].listviewtype, pinnedListIds, user: req.session.user, search: false, searchInLabel: false, message: `filtering by label '` + data[4][0].label + `'`, filterByLabel: true, label: data[4][0].label, labelid: req.query.labelId, searchInLabel: false});
            }
            return res.redirect('/lists');
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/lists');
        });
});

app.post('/emptyTrash', function(req, res) {
    db.any(`DELETE FROM labelsToLists WHERE listId IN(SELECT listId FROM lists WHERE trash = TRUE AND listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}')); 
            DELETE FROM listsToUsers WHERE userId = '${req.session.user.id}' AND listId IN(SELECT listId FROM lists WHERE trash = TRUE) RETURNING listId;`)
        .then((ids) => {
            var array = [];

            for(var i = 0; i < ids.length; i++) {
                array.push(ids[i].listid);
            }

            db.any(`DELETE FROM lists WHERE listId IN(${array});`)
                .then(() => {
                    return res.redirect('/trash?empty=success');
                })
                .catch((error) => {
                    console.log(error);
                    return res.redirect('/trash?empty=failure');
                });
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/trash?empty=failure');
        });
});

app.post('/addList', function(req, res) {
    var title = (!req.body.title) ? '' : req.body.title;

    db.any(`INSERT INTO lists (title, list, color, trash, editDateTime, createDateTime) VALUES ('${title.replace(/'/g, "''")}', '${req.body.list.replace(/'/g, "''")}', 'ffffff', FALSE, '${req.body.now}', '${req.body.now}') RETURNING listId;`)
        .then((listId) => {
            db.any(`INSERT INTO listsToUsers (listId, userId, owner, archive, pinned) VALUES (${listId[0].listid}, '${req.session.user.id}', TRUE, FALSE, FALSE);`)

            // THIS IS GOOD db.any(`INSERT INTO listsToUsers (listId, userId, owner, archive) VALUES (${listId[0].listid}, '${req.session.user.id}', TRUE, FALSE);`)
                .then(() => {
                    return res.redirect('/lists?add=success');
                })
                .catch((error) => {
                    console.log(error);
                    return res.redirect('/lists?add=failure');
                });
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/lists?add=failure');
        });
});


app.post('/changeListColor', function(req, res) {
    db.any(`UPDATE lists SET color = '${req.body.color}', editDateTime = '${req.body.now}' WHERE listId = ${req.body.listId};`)
        .then(() => {
            if(req.query.archived && req.query.archived == 'true') {
                return res.redirect('/archive?changeColor=success');
            }
            return res.redirect('/lists?changeColor=success');
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/lists?changeColor=failure');
        });
});



app.post('/setColorSelected', function(req, res) {
    var array = req.body.listIds.split(',');
    var result = array.map(function (x) { 
        return parseInt(x, 10); 
    });

    db.any(`UPDATE lists SET color = '${req.body.color}', editDateTime = '${req.body.now}' WHERE listId IN(${result});`)
        .then(() => {
            return res.redirect('/lists?setColorSelected=success');
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/lists?setColorSelected=error');
        });
});


app.post('/unpinList', function(req, res) {
    db.any(`UPDATE listsToUsers SET pinned = FALSE WHERE listId = '${req.body.listId}' AND userId = '${req.session.user.id}';`)
        .then(() => {
            return res.redirect('/lists?unpin=success');
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/lists?unpin=error');
        });
});

app.post('/pinList', function(req, res) {
    db.any(`UPDATE listsToUsers SET pinned = TRUE WHERE listId = '${req.body.listId}' AND userId = '${req.session.user.id}';`)
        .then(() => {
            return res.redirect('/lists?pin=success');
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/lists?pin=error');
        });
});

app.get('/pinorder', function(req, res) {
db.any(`SELECT lists.* FROM lists JOIN listsToUsers ON listsToUsers.listId = lists.listId ORDER BY listsToUsers.pinned DESC, lists.editDateTime DESC;`)
// db.any(`SELECT * FROM lists WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}' AND archive = FALSE) AND trash = FALSE ORDER BY editDateTime DESC;`)
    .then((rows) => {
            return res.send(rows);
        })
        .catch((error) => {
            console.log(error);
            return res.send(error);
        });
});





app.post('/deleteList', function(req, res) {
    db.any(`UPDATE lists SET trash = TRUE WHERE listId = ${req.body.listId};DELETE FROM listsToUsers WHERE userId != '${req.session.user.id}' AND listId = ${req.body.listId};`)
        .then(() => {
            if(req.query.archived && req.query.archived == 'true') {
                return res.redirect('/archive?delete=success');
            }
            return res.redirect('/lists?delete=success');
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/lists?delete=failure');
        });  
});

app.post('/unarchiveList', function(req, res) {
    db.any(`UPDATE listsToUsers SET archive = FALSE WHERE listId = ${req.body.listId} AND userId = '${req.session.user.id}';`)
        .then(() => {
            return res.redirect('/lists?unarchive=success');
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/lists?unarchive=failure');
        });  
});

app.post('/deleteSelectedLists', function(req, res) {
    var array = req.body.listIds.split(',');
    var result = array.map(function (x) { 
        return parseInt(x, 10); 
    });

    db.any(`UPDATE lists SET trash = TRUE WHERE listId IN(${result});`)
        .then(() => {
            var count = encodeURIComponent(result.length);
            return res.redirect('/lists?deleteSelected=success&count=' + count);
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/lists?deleteSelected=failure');
        }); 
});

app.post('/copySelected', function(req, res) {
    var array = req.body.listIds.split(',');
    var result = array.map(function (x) { 
        return parseInt(x, 10); 
    });


    db.any(`SELECT * FROM lists WHERE listId IN(${result});`)
        .then((listsToCopy) => {
            // return res.send(listsToCopy);
            var insertListsQuery = '';
            for(var i = 0; i < listsToCopy.length; i++) {
                insertListsQuery += `INSERT INTO lists (title, list, color, trash, editDateTime, createDateTime) VALUES ('${listsToCopy[i].title.replace(/'/g, "''")}', '${listsToCopy[i].list.replace(/'/g, "''")}', '${listsToCopy[i].color}', FALSE, '${req.body.now}', '${req.body.now}');`;
            }

            // return res.send(insertQuery);
            // console.log(result.length);
            
            db.any(insertListsQuery)
                .then(() => {
                    db.any(`SELECT listId FROM lists ORDER BY listId DESC LIMIT ${result.length};`)
                        .then((listIdsRaw) => {
                            var listIdsPure = [];
                            for(var i = 0; i < listIdsRaw.length; i++) {
                                listIdsPure.push(listIdsRaw[i].listid);
                            }

                            var insertListsToUsersQuery = '';
                            for(var i = 0; i < listIdsPure.length; i++) {
                                insertListsToUsersQuery += `INSERT INTO listsToUsers (listId, userId, owner, archive, pinned) VALUES (${listIdsPure[i]}, '${req.session.user.id}', TRUE, FALSE, FALSE);`;

                                // insertListsToUsersQuery += `INSERT INTO listsToUsers (listId, userId, owner, archive) VALUES (${listIdsPure[i]}, '${req.session.user.id}', TRUE, FALSE);`;
                            }

                            db.any(insertListsToUsersQuery)
                                .then(() => {
                                    return res.redirect('/lists?copySelected=success');
                                })
                                .catch((error) => {
                                    console.log(error);
                                    return res.redirect('/lists?copySelected=error');
                                }); 
                        })
                        .catch((error) => {
                            console.log(error);
                            return res.redirect('/lists?copySelected=error');
                        });
                })
                .catch((error) => {
                    console.log(error);
                    return res.redirect('/lists?copySelected=error');
                });
        })
        .catch((error) => {
            console.log(error);
            // return res.send(error);
            return res.redirect('/lists?copySelected=error');
        });

    // db.any(`INSERT INTO lists (title, list, color, trash, editDateTime, createDateTime) VALUES ('${req.body.title.replace(/'/g, "''")}', '${req.body.list.replace(/'/g, "''")}', '${req.body.color}', FALSE, '${req.body.now}', '${req.body.now}') RETURNING listId;`)
    //     .then((listId) => {
    //         db.any(`INSERT INTO listsToUsers (listId, userId, owner, archive) VALUES (${listId[0].listid}, '${req.session.user.id}', TRUE, FALSE);`)
    //             .then(() => {
                
    //             })
    //             .catch((error) => {
    //                 console.log(error);

    //             });
    //     })
    //     .catch((error) => {
    //         console.log(error);

    //     });
});

app.post('/permanentlyDeleteSelected', function(req, res) {
    var array = req.body.listIds.split(',');
    var result = array.map(function (x) { 
        return parseInt(x, 10); 
    });

    db.any(`DELETE FROM listsToUsers WHERE listId IN(${result}); DELETE FROM lists WHERE listId IN(${result});`)
        .then(() => {
            var count = encodeURIComponent(result.length);
            return res.redirect('/trash?permanentlyDeleteSelected=success&count=' + count);

        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/trash?permanentlyDeleteSelected=failure');
        });
});

app.post('/updateList', function(req, res) {
    db.any(`UPDATE lists SET title = '${req.body.title.replace(/'/g, "''")}', list = '${req.body.list.replace(/'/g, "''")}', editDateTime = '${req.body.now}' WHERE listId = ${req.body.listId};`)
        .then(() => {
            if(req.query.archived && req.query.archived == 'true') {
                return res.redirect('/archive?update=success');
            }
            return res.redirect('/lists?update=success');
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/lists?update=failure');
        });  
});

app.get('/trash', function(req, res) {
    const successMessages = ['permanently deleted list', 'emptied trash', 'permanently deleted selection'];
    const errorMessages = ['error permanently deleting list', 'error emptying trash', 'error permanently deleting selection'];
    
    var error = 0;
    var message = '';

    if(req.query.permanentlyDeleted) {
        message = (req.query.permanentlyDeleted == 'success') ? successMessages[0] : errorMessages[0];
        error = (req.query.permanentlyDeleted == 'success') ? 0 : 1;
    }
    else if(req.query.empty) {
        message = (req.query.empty == 'success') ? successMessages[1] : errorMessages[1];
        error = (req.query.empty == 'success') ? 0 : 1;
    }
    else if(req.query.permanentlyDeleteSelected) {
        message = (req.query.permanentlyDeleteSelected == 'success') ? successMessages[2] : errorMessages[2];
        error = (req.query.permanentlyDeleteSelected == 'success') ? 0 : 1;

        if(req.query.count) {
            message = (req.query.count == '1') ? 'permanently deleted ' + req.query.count + ' list' : 'permanently deleted ' + req.query.count + ' lists';
        }
    }

    db.tx(t => {
        const lists = db.any(`SELECT * FROM lists WHERE trash = TRUE AND listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}') ORDER BY editDateTime DESC;`);
        const collaborators = db.any(`SELECT users.email, users.profilePhotoUrl, users.fullname, users.userId, listsToUsers.listId, listsToUsers.owner FROM listsToUsers INNER JOIN users ON listsToUsers.userId = users.userId;`);
        const labels = db.any(`CREATE OR REPLACE VIEW labelsJoinlabelsToLists AS (SELECT labels.labelId, labels.label, labelsToLists.listId FROM labelsToLists INNER JOIN labels ON labelsToLists.labelId = labels.labelId);SELECT * FROM labelsJoinlabelsToLists WHERE labelId IN(SELECT labelId from labelsToUsers where userId = '${req.session.user.id}');`);
        // const allLabels = db.any(`SELECT * FROM labels WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userID = '${req.session.user.id}') ORDER BY label ASC;`);
        const allLabels = db.any(`SELECT * FROM labels WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userID = '${req.session.user.id}') AND labelID IN(SELECT labels.labelId AS "numberOfLists" FROM labels LEFT JOIN labelsToLists ON labels.labelId = labelsToLists.labelId GROUP BY labels.labelId ORDER BY COUNT(labelsToLists.labelId) DESC, label ASC);`)

        return t.batch([lists, collaborators, labels, allLabels]); 
    })
        .then((data) => {
            return res.render("pages/trash", {lists: data[0], collaborators: data[1], labels: data[2], allLabels: data[3], user: req.session.user, search: false, searchInLabel: false, error, message});
        })
        .catch((error) => {
            console.log(error);
            return res.render("pages/trash", {lists: [], collaborators: [], labels: [], user: req.session.user, search: false, searchInLabel: false, error: true, message: 'error loading trash'});
        });
});

app.post('/restoreList', function(req, res) {
    db.any(`UPDATE lists SET trash = FALSE WHERE listId = ${req.body.listId};`)
        .then(() => {
            if(req.query.archived && req.query.archived == 'true') {
                return res.redirect('/lists?restore=success&archived=true');
            }
            return res.redirect('/lists?restore=success');
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/lists?restore=failure');
        });
});

app.post('/restoreAll', function(req, res) {
    db.any(`UPDATE lists SET trash = FALSE WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}') AND trash = TRUE;`)
        .then(() => {
            return res.redirect('/lists?restoreAll=success');
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/lists?restoreAll=failure');
        });
});

app.post('/copy', function(req, res) {
    db.any(`SELECT labelId FROM labelsToLists WHERE listId = '${req.body.listId}';`)
        .then((labelIdsRaw) => {
            var labelIdsPure = [];
            for(var i = 0; i < labelIdsRaw.length; i++) {
                labelIdsPure.push(labelIdsRaw[i].labelid);
            }

            db.any(`INSERT INTO lists (title, list, color, trash, editDateTime, createDateTime) VALUES ('${req.body.title.replace(/'/g, "''")}', '${req.body.list.replace(/'/g, "''")}', '${req.body.color}', FALSE, '${req.body.now}', '${req.body.now}') RETURNING listId;`)
                .then((listId) => {
                    var assignLabelsToListQuery = '';
                    for(var i = 0; i < labelIdsPure.length; i++) {
                        assignLabelsToListQuery += `INSERT INTO labelsToLists (labelId, listId) VALUES ('${labelIdsPure[i]}', '${listId[0].listid}');`;
                    }

                    db.any(assignLabelsToListQuery + `INSERT INTO listsToUsers (listId, userId, owner, archive, pinned) VALUES (${listId[0].listid}, '${req.session.user.id}', TRUE, FALSE, FALSE);`)

                    // db.any(assignLabelsToListQuery + `INSERT INTO listsToUsers (listId, userId, owner, archive) VALUES (${listId[0].listid}, '${req.session.user.id}', TRUE, FALSE);`)
                    .then(() => {
                        if(req.query.archived && req.query.archived == 'true') {
                        return res.redirect('/lists?copyArchived=success');
                        }

                        return res.redirect('/lists?copy=success');
                    })
                    .catch((error) => {
                        console.log(error);
                        return res.redirect('/lists?copy=failure');
                    });
                })
                .catch((error) => {
                    console.log(error);
                    return res.redirect('/lists?copy=failure');
                });  
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/lists?copy=failure');
        });

    

    // db.any(`INSERT INTO lists (title, list, color, trash, editDateTime, createDateTime) VALUES ('${req.body.title.replace(/'/g, "''")}', '${req.body.list.replace(/'/g, "''")}', '${req.body.color}', FALSE, '${req.body.now}', '${req.body.now}') RETURNING listId;`)
    // .then((listId) => {
    //     db.any(`INSERT INTO listsToUsers (listId, userId, owner, archive) VALUES (${listId[0].listid}, '${req.session.user.id}', TRUE, FALSE);`)
    //         .then(() => {
    //             if(req.query.archived && req.query.archived == 'true') {
    //                 return res.redirect('/lists?copyArchived=success');
    //             }

    //             return res.redirect('/lists?copy=success');
    //         })
    //         .catch((error) => {
    //             console.log(error);
    //             return res.redirect('/lists?copy=failure');
    //         });
    // })
    // .catch((error) => {
    //     console.log(error);
    //     return res.redirect('/lists?copy=failure');
    // });
});

app.post('/restoreSelectedLists', function(req, res) {
    var array = req.body.listIds.split(',');
    var result = array.map(function (x) { 
        return parseInt(x, 10); 
    });

    db.any(`UPDATE lists SET trash = FALSE WHERE listId IN(${result});`)
        .then(() => {
            var count = encodeURIComponent(result.length);
            return res.redirect('/lists?restoreSelected=success&count=' + count);
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/lists?restoreSelected=failure');
        });
});

app.get('/archive', (req , res) => {
    const successMessages = ['changed list color', 'updated list', 'deleted list', 'restored archived list'];
    const errorMessages = ['error changing list color', 'error updating list', 'error deleting list', 'error restoring archived list'];
    var error = 0;
    var message = '';

    if(req.query.changeColor) {
        message = (req.query.changeColor == 'success') ? successMessages[0] : errorMessages[0];
        error = (req.query.changeColor == 'success') ? 0 : 1;
    }
    else if(req.query.update) {
        message = (req.query.update == 'success') ? successMessages[1] : errorMessages[1];
        error = (req.query.update == 'success') ? 0 : 1;
    }
    else if(req.query.delete) {
        message = (req.query.delete == 'success') ? successMessages[2] : errorMessages[2];
        error = (req.query.delete == 'success') ? 0 : 1;
    }
    else if(req.query.restore) {
        error = (req.query.restore == 'success') ? 0 : 1;
        if(req.query.archived && req.query.archived == 'true') {
            message = successMessages[3];
        }
        else {
            message = errorMessages[3];
        }
    }

    db.tx(t => {
        const lists = db.any(`SELECT * FROM lists WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}' AND archive = TRUE) AND trash = FALSE ORDER BY editDateTime DESC;`);
        const collaborators = db.any(`SELECT users.email, users.profilePhotoUrl, users.fullname, users.userId, listsToUsers.listId, listsToUsers.owner FROM listsToUsers INNER JOIN users ON listsToUsers.userId = users.userId;`);
        const labels = db.any(`CREATE OR REPLACE VIEW labelsJoinlabelsToLists AS (SELECT labels.labelId, labels.label, labelsToLists.listId FROM labelsToLists INNER JOIN labels ON labelsToLists.labelId = labels.labelId);SELECT * FROM labelsJoinlabelsToLists WHERE labelId IN(SELECT labelId from labelsToUsers where userId = '${req.session.user.id}');`);
        // const allLabels = db.any(`SELECT * FROM labels WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userID = '${req.session.user.id}') ORDER BY label ASC;`);
        const allLabels = db.any(`SELECT * FROM labels WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userID = '${req.session.user.id}') AND labelID IN(SELECT labels.labelId AS "numberOfLists" FROM labels LEFT JOIN labelsToLists ON labels.labelId = labelsToLists.labelId GROUP BY labels.labelId ORDER BY COUNT(labelsToLists.labelId) DESC, label ASC);`)

        return t.batch([lists, collaborators, labels, allLabels]); 
    })
        .then((data) => {
            return res.render('pages/archive', {lists: data[0], collaborators: data[1], labels: data[2], allLabels: data[3], user: req.session.user, search: false, searchInLabel: false, error, message});
        })
        .catch((error) => {
            console.log(error);
            return res.render('pages/archive', {lists: [], collaborators: [], labels: [], user: req.session.user, search: false, searchInLabel: false, error: true, message: 'error loading archive'});
        });
});

app.post('/archiveList', function(req, res) {
    db.any(`UPDATE listsToUsers SET archive = TRUE WHERE listId = ${req.body.listId} AND userId = '${req.session.user.id}';`)
        .then(() => {
            return res.redirect('/lists?archive=success');
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/lists?archive=failure');
        }); 
});


app.post('/archiveSelected', function(req, res) {
    var array = req.body.listIds.split(',');
    var result = array.map(function (x) { 
        return parseInt(x, 10); 
    });

    db.any(`UPDATE listsToUsers SET archive = TRUE WHERE listId IN(${result}) AND userId = '${req.session.user.id}';`)
        .then(() => {
            return res.redirect('/lists?archiveSelected=success');
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/lists?archiveSelected=error');
        }); 
});

app.post('/changeListView', function(req, res) {
    db.any(`SELECT listViewType FROM users WHERE userId = '${req.session.user.id}';`)
        .then((type) => {
            var newType = 'column';

            if(type[0].listviewtype == 'column') {
                newType = 'row';
            }
            else if(type[0].listviewtype == 'row') {
                newType = 'column';
            }

            db.any(`UPDATE users SET listViewType = '${newType}' WHERE userId = '${req.session.user.id}';`)
                .then(() => {
                    return res.redirect('/lists?changeView=success');
                })
                .catch((error) => {
                    console.log(error);
                    return res.redirect('/lists?changeView=error');
                }); 
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/lists?changeView=error');
        }); 
});

app.post('/removeCollaborator', function(req, res) {
    db.any(`DELETE FROM listsToUsers WHERE listId = '${req.body.listId}' AND userId = '${req.body.userId}';UPDATE lists SET editDateTime = '${req.body.now}' WHERE listId = '${req.body.listId}';`)
        .then(() => {
            return res.redirect('/lists?removeCollaborator=success');
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/lists?removeCollaborator=failure');
        });
});

app.get('/labels', function(req, res) {
    db.any(`SELECT * FROM labels WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userID = '${req.session.user.id}') AND labelID IN(SELECT labels.labelId AS "numberOfLists" FROM labels LEFT JOIN labelsToLists ON labels.labelId = labelsToLists.labelId GROUP BY labels.labelId ORDER BY COUNT(labelsToLists.labelId) DESC, label ASC);`)

    // db.any(`SELECT * FROM labels WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userID = '${req.session.user.id}') ORDER BY label ASC;`)
        .then((allLabels) => {
            db.any(`SELECT labelId, COUNT(*) FROM labelsToLists GROUP BY labelId;`)
                .then((labelCounts) => {
                    return res.render('pages/labels', {allLabels, labelCounts, user: req.session.user});
                })
                .catch((error) => {
                    console.log(error);
                    return res.render('pages/labels', {allLabels, labelCounts: [], user: req.session.user});
                });
        })
        .catch((error) => {
            console.log(error);
            return res.render('pages/labels', {allLabels: [], user: req.session.user});
        });
})


app.get('/orderlabels', function(req, res) {


db.any(`SELECT * FROM labels WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userID = '${req.session.user.id}') AND labelID IN(SELECT labels.labelId AS "numberOfLists" FROM labels LEFT JOIN labelsToLists ON labels.labelId = labelsToLists.labelId GROUP BY labels.labelId ORDER BY COUNT(labelsToLists.labelId) DESC, label ASC);`)
.then((rows) => {
        return res.send(rows);
    })
    .catch((error) => {
        console.log(error);
        return res.send(error);
    });

})

app.post('/deleteLabel', function(req, res) {
    db.any(`DELETE FROM labelsToLists WHERE labelId = '${req.body.labelId}';DELETE FROM labelsToUsers WHERE labelId = '${req.body.labelId}';DELETE FROM labels WHERE labelId = '${req.body.labelId}';`)
        .then(() => {
            return res.redirect('/labels?deleteLabel=success');
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/labels?deleteLabel=failure');
        });
})

app.post('/deleteAllLabels', function(req, res) {
    const labelIdsQuery = `SELECT labelId FROM labels WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userID = '${req.session.user.id}')`;

    db.any(`DELETE FROM labelsToLists WHERE labelId IN(${labelIdsQuery});DELETE FROM labelsToUsers WHERE labelId IN(${labelIdsQuery});DELETE FROM labels WHERE labelId IN(${labelIdsQuery});`)
        .then(() => {
            return res.redirect('/labels?deleteAll=success');
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/labels?deleteAll=failure');
        });
})

app.post('/updateLabel', function(req, res) {
    db.any(`UPDATE labels SET label = '${req.body.updatedLabel}' WHERE labelId = ${req.body.labelId} AND NOT EXISTS(SELECT 1 FROM labelsToUsers WHERE userId = '${req.session.user.id}' AND labelId IN(SELECT labelId FROM labels WHERE label = '${req.body.updatedLabel}'));`)
        .then(() => {
            return res.redirect('/labels?updateLabel=success');
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/labels?updateLabel=failure');
        });
})

app.post('/searchUsers', function(req, res) {
    var q = req.body.q;

    var searchQuery = `SELECT * FROM users WHERE userId != '${req.session.user.id}' AND userID NOT IN(SELECT userID FROM listsToUsers WHERE listId = '${req.body.listIdToCollaborate}') AND (email LIKE '%${q}%' OR LOWER(email) LIKE '%${q}%' OR fullname LIKE '%${q}%' OR LOWER(fullname) LIKE '%${q}%');`;

    db.any(searchQuery)
        .then((users) => {
            return res.render('pages/addCollaborator', {users, listid: req.body.listIdToCollaborate, error: false, message: 'results for ' + q});
        })
        .catch((error) => {
            console.log(error);
            return res.render('pages/addCollaborator', {users: [], listid: req.body.listIdToCollaborate, error: true, message: 'error searching users'});
        });
});

app.get('/labelsModal', function(req, res) {
    db.any(`SELECT * FROM labels WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userID = '${req.session.user.id}') AND labelID IN(SELECT labels.labelId AS "numberOfLists" FROM labels LEFT JOIN labelsToLists ON labels.labelId = labelsToLists.labelId GROUP BY labels.labelId ORDER BY COUNT(labelsToLists.labelId) DESC, label ASC);`)

    // db.any(`SELECT * FROM labels WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userID = '${req.session.user.id}') ORDER BY label ASC;`)
        .then((labels) => {
            db.any(`SELECT labelId FROM labels WHERE labelID IN(SELECT labelId FROM labelsToLists WHERE listId = '${req.query.listId}');`)
                .then((labelIdsForThisList) => {
                    var arr = [];
                    for(var i = 0; i < labelIdsForThisList.length; i++) {
                        arr.push(labelIdsForThisList[i].labelid);
                    }

                    return res.render('pages/labelsModal', {labels, labelIdsForThisList: arr, listid: req.query.listId});
                })
                .catch((error) => {
                    console.log(error);
                    return res.render('pages/labelsModal', {labels: [], labelsForThisList: [], listid: req.query.listId});
                });
        })
        .catch((error) => {
            console.log(error);
            return res.render('pages/labelsModal', {labels: [], labelsForThisList: [], listid: req.query.listId});
        });
});

app.post('/createNewLabel', function(req, res) {
    const label = req.body.label.replace(/'/g, "''");
    const listId = req.body.listId;

    if(label.match(/^ *$/) !== null) {
        return res.redirect('/labelsModal?createNewLabel=failure&listId=' + listId);
    }

    db.any(`SELECT * FROM labelsToUsers WHERE userId = '${req.session.user.id}' AND labelId IN(SELECT labelId FROM labels WHERE label = '${label}');`)
        .then((rows) => {
            if(rows.length > 0) {
                if(req.query.redirect && req.query.redirect == 'labels') {
                    return res.redirect('/labels?createNewLabel=failure'); 
                }
                return res.redirect('/labelsModal?createNewLabel=failure&listId=' + listId); 
            }
            else {
                db.any(`INSERT INTO labels (label) VALUES ('${label}');INSERT INTO labelsToUsers (labelId, userId) VALUES ((SELECT MAX(labelId) FROM labels), '${req.session.user.id}');`)
                    .then(() => {
                        if(req.query.redirect && req.query.redirect == 'labels') {
                            return res.redirect('/labels?createNewLabel=success'); 
                        }
                        return res.redirect('/labelsModal?createNewLabel=success&listId=' + listId); 
                    })
                    .catch((error) => {
                        console.log(error);
                        return res.redirect('/labelsModal?createNewLabel=failure&listId=' + listId);
                    });
            }
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/labelsModal?createNewLabel=failure&listId=' + listId); 
        });
});

app.get('/countLabelsPerList', function(req, res) {
    db.any(`SELECT listId, COUNT(listId) FROM labelsToLists WHERE listId = 2 GROUP BY listId;`)
        .then((rows) => {
            return res.send(rows[0].count);
        })
        .catch((error) => {
            console.log(error);
            return res.send(error);
        });
});

app.get('/countCollabsForAList', function(req, res) {
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

app.post('/assignLabelToList', function(req, res) {
    var countQuery = `SELECT listId, COUNT(listId) FROM labelsToLists WHERE listId = '${req.body.listId}' GROUP BY listId;`;
    if(req.query.listId) {
        countQuery = `SELECT listId, COUNT(listId) FROM labelsToLists WHERE listId = '${req.query.listId}' GROUP BY listId;`;
    }

    var q = `INSERT INTO labelsToLists (labelId, listId) SELECT '${req.body.labelId}', '${req.body.listId}' WHERE NOT EXISTS (SELECT 1 FROM labelsToLists WHERE labelId = '${req.body.labelId}' AND listId = '${req.body.listId}');`;
    if(req.query.listId) {
        q = `INSERT INTO labelsToLists (labelId, listId) SELECT '${req.body.labelId}', '${req.query.listId}' WHERE NOT EXISTS (SELECT 1 FROM labelsToLists WHERE labelId = '${req.body.labelId}' AND listId = '${req.query.listId}');`;
    }


    db.any(countQuery)
        .then((rows) => {
            if(rows.length > 0 && rows[0].count >= 10) {
                return res.redirect('/lists?assignLabel=failure&maxlabels=true');
            } 
            else {
                db.any(q)
                    .then(() => {
                        return res.redirect('/lists?assignLabel=success');
                    })
                    .catch((error) => {
                        console.log(error);
                        return res.redirect('/lists?assignLabel=failure');
                    });
            }
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/lists?assignLabel=failure');
        });
});

app.post('/removeLabelFromList', function(req, res) {
    db.any(`DELETE FROM labelsToLists WHERE labelId = '${req.body.labelId}' AND listId = '${req.body.listId}';`)
        .then(() => {
            return res.redirect('/lists?removeLabelFromList=success');
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/lists?removeLabelFromList=failure');
        });
});

app.post('/addCollaborator', function(req, res) {
    var countQuery = `SELECT listId, COUNT(userId) FROM listsToUsers WHERE listId = '${req.body.listId}' GROUP BY listId;`;

    db.any(countQuery)
        .then((rows) => {
            if(rows.length > 0 && rows[0].count >= 10) {
                return res.redirect('/lists?addCollaborator=failure&max=true');
            }
            else {
                db.any(`INSERT INTO listsToUsers (listId, userId, owner, archive, pinned) SELECT '${req.body.listId}', '${req.body.collaboratorUserId}', FALSE, FALSE, FALSE WHERE NOT EXISTS (SELECT 1 FROM listsToUsers WHERE listId = '${req.body.listId}' AND userId = '${req.body.collaboratorUserId}');UPDATE lists SET editDateTime = '${req.body.now}' WHERE listId = '${req.body.listId}';`)

                // db.any(`INSERT INTO listsToUsers (listId, userId, owner, archive) SELECT '${req.body.listId}', '${req.body.collaboratorUserId}', FALSE, FALSE WHERE NOT EXISTS (SELECT 1 FROM listsToUsers WHERE listId = '${req.body.listId}' AND userId = '${req.body.collaboratorUserId}');UPDATE lists SET editDateTime = '${req.body.now}' WHERE listId = '${req.body.listId}';`)
                    .then(() => {
                        db.any(`SELECT title, list FROM lists WHERE listId = '${req.body.listId}';`)
                            .then((list) => {
                                sendCollaborationEmail(req.body.email, req.session.user.email, req.session.user.displayName, list[0].title, list[0].list);
                                return res.redirect('/lists?addCollaborator=success');
                            })
                            .catch((error) => {
                                console.log(error);
                                return res.redirect('/lists?addCollaborator=failure');
                            });
                        })
                    .catch((error) => {
                        console.log(error);
                        return res.redirect('/lists?addCollaborator=failure');
                    });
            }
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/lists?addCollaborator=failure');
        });
});


// Functions
function sendCollaborationEmail(emailTo, emailFrom, nameFrom, title, list) {
    var listInfo = '';
    if(title) {
        listInfo = title.substring(0,10);
        if(title.length > 10) {
            listInfo += '...';
        }
    }
    else if(list) {
        listInfo = list.replace(/<\/?[^>]+(>|$)/g, "").substring(0,10);
        if(list.length > 10) {
            listInfo += '...';
        }
    }

    let transporter = nodemailer.createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        port: 465,
        secure: 'true',
        auth: {
          user: process.env.EMAIL,
          pass: process.env.EMAIL_PWD_MAC
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      let mailOptions = {
        from: 'lists.communications@gmail.com',
        to: emailTo,
        subject: nameFrom + ' shared their list "' + listInfo + '" with you',
        html: 'Hello!<br><br><b>' + nameFrom + '</b> (' + emailFrom + ')' + ' has shared their list "<b>' + listInfo + '</b>" with you.<br><br>Log in to your lists account to collaborate on it with them!'
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if(error) {
          return console.log(error);
        }
        console.log('Message sent: %s', info.messageId);
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        transporter.close();
      });
}

app.use((req, res, next) => {
    res.status(404).send("404 <br> <img src='/img/lost.png' style='width:100px'>");
})

app.listen(3000);

console.log('Server is listening on port 3000');





// Testing
// app.get('/allIdsAssocWithCurrentUserLists', (req , res) => {
//     db.any(`SELECT userId FROM listsToUsers WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}');`)
//         .then((rows) => {
//             return res.send(rows);

//         })
//         .catch((error) => {
//             console.log(error);
//             return res.send(rows);
//         });
// });

// app.get('/menuTest', (req , res) => {
//     db.any(`SELECT * FROM labels;`)
//         .then((labels) => {
//             return res.render('pages/menuTest', {labels});

//         })
//         .catch((error) => {
//             console.log(error);
//             return res.render('pages/menuTest', {labels: []});
//         });
// });

// app.get('/horiz', function(req, res) {
//     return res.render('pages/horizontal', {users: []});
// });

// app.get('/labelCounts', function(req, res) {
//     db.any(`SELECT labelId, COUNT(*) FROM labelsToLists GROUP BY labelId;`)
//         .then((rows) => {
//             return res.send(rows);
//         })
//         .catch((error) => {
//             console.log(error);
//             return res.send(rows);
//         });
// })


// app.get('/emailsAndListIds', (req , res) => {
//     var q = `SELECT users.email, listsToUsers.listId FROM listsToUsers INNER JOIN users ON listsToUsers.userId = users.userId;`;

//     db.any(q)
//         .then((rows) => {
//             return res.send(rows);
//         })
//         .catch((error) => {
//             console.log(error);
//             return res.send(error);
//         });
// });

// app.get('/listsToUsers', (req , res) => {
//     db.any(`SELECT * FROM listsToUsers;`)
//         .then((rows) => {
//             return res.send(rows);

//         })
//         .catch((error) => {
//             console.log(error);
//             return res.send(error);
//         });
// });

// app.get('/testlists', (req , res) => {
//     db.any(`SELECT * FROM lists;`)
//         .then((rows) => {
//             return res.send(rows);

//         })
//         .catch((error) => {
//             console.log(error);
//             return res.send(error);
//         });
// });

// app.get('/auth/signout', function (req, res) {
//     req.logout();
//     res.render('pages/home', {message: 'signed out'})
// })

// app.get('/searchByEmailOrName', (req , res) => {
//     var q = req.query.q.toLowerCase();

//     db.any(`CREATE OR REPLACE VIEW emails_and_names AS ( SELECT userId, email, fullname FROM users WHERE userId IN( SELECT userId FROM listsToUsers WHERE listId IN( SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}'))); SELECT * FROM lists WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}') AND trash = FALSE AND (title LIKE '%${q}%' OR LOWER(title) LIKE '%${q}%' OR regexp_replace(list, E'<.*?>', '', 'g' ) LIKE '%${q}%' OR LOWER(regexp_replace(list, E'<.*?>', '', 'g' )) LIKE '%${q}%' OR listId IN(SELECT listId FROM listsToUsers WHERE userId IN(SELECT userId FROM emails_and_names WHERE LOWER(email) LIKE '%${q}%' OR LOWER(fullname) LIKE '%${q}%'))) ORDER BY editDateTime DESC;`)
//         .then((rows) => {
//             return res.send(rows);
//         })
//         .catch((error) => {
//             console.log(error);
//             return res.send(error);
//         });
// });