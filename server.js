const express = require('express');
const app = express();
const pgp = require('pg-promise')();
const session = require('express-session');
const nodemailer = require('nodemailer');




const bodyParser = require('body-parser');


const passport = require('passport');
const cookieSession = require('cookie-session');
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


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
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






  
// app.use(cookieSession({
//     name: 'google-auth-session',
//     keys: ['key1', 'key2']
// }));
app.use(passport.initialize());
app.use(passport.session());
    
  
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

// failure
app.get('/auth/callback/failure' , (req , res) => {
    res.send("Error");
})
  
// Success 
app.get('/auth/callback/success' , (req , res) => {
    if(!req.user) {
        res.redirect('/auth/callback/failure');
    }
    else {
        // console.log(req.user.name.givenName);
        // console.log(req.user.name.familyName);
        // var name = req.user.name.givenName + ' ' + req.user.name.familyName;
        // console.log(fullname);
    
    
        db.any(`INSERT INTO users (userId, email, fullname, profilePhotoUrl) SELECT '${req.user.id}', '${req.user.email}', '${req.user.displayName}', '${req.user.photos[0].value}' WHERE NOT EXISTS (SELECT 1 FROM users WHERE userId = '${req.user.id}');`)
            .then(() => {
                // console.log(req.user.email);

                
                console.log(req.user);

                req.session.user = {id: req.user.id, givenName: req.user.name.givenName, email: req.user.email, profilePhoto: req.user.photos[0].value};
                req.session.save();

                return res.redirect('/lists?login=success');
            })
            .catch((error) => {
                console.log(error);
                return res.redirect('/home?login=failure');
            });
    }
});

const auth = (req, res, next) => {
    if (!req.session.user) {
      // Default to register page.
      return res.redirect('/');
    }
    next();
  };
  
  // Authentication Required
  app.use(auth);

  










app.get('/lists', function(req, res) {
    const successMessages = ['added new list', 'updated list', 'changed list color', 'deleted list',
                            'deleted selected lists', 'recovered list', 'recovered selected lists', 'recovered all lists',
                            'copied list', 'archived list', 'unarchived list', 'created unarchived copy'];
    
    const errorMessages = ['error adding new list', 'error updating list', 'error changing list color', 'error deleting list', 'error deleting selected lists',
                        'error recovering list', 'error recovering selected lists', 'error recovering all lists', 'error copying list', 'error archiving list', 
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
        const lists = db.any(`SELECT * FROM lists WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}') AND trash = FALSE AND archive = FALSE ORDER BY editDateTime DESC;`);
        const collaborators = db.any(`SELECT users.email, users.profilePhotoUrl, users.fullname, users.userId, listsToUsers.listId, listsToUsers.owner FROM listsToUsers INNER JOIN users ON listsToUsers.userId = users.userId;`);
        const labels = db.any(`CREATE OR REPLACE VIEW labelsJoinlabelsToLists AS (SELECT labels.labelId, labels.label, labelsToLists.listId FROM labelsToLists INNER JOIN labels ON labelsToLists.labelId = labels.labelId);SELECT * FROM labelsJoinlabelsToLists WHERE labelId IN(SELECT labelId from labelsToUsers where userId = '${req.session.user.id}');`);

        return t.batch([lists, collaborators, labels]); 
    })
        .then((data) => {
            return res.render("pages/lists", {lists: data[0], collaborators: data[1], labels: data[2], user: req.session.user, search: false, error, message});
        })
        .catch((error) => {
            console.log(error);
            return res.render("pages/lists", {lists: [], collaborators: [], labels: [], user: req.session.user, search: false, error: true, message: 'error loading lists'});
        });



























































    // db.any(`SELECT * FROM lists WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}') AND trash = FALSE AND archive = FALSE ORDER BY editDateTime DESC;`)
    // .then((lists) => {
        // const successMessages = ['added new list', 'updated list', 'changed list color', 'deleted list',
        //                         'deleted selected lists', 'recovered list', 'recovered selected lists', 'recovered all lists',
        //                          'copied list', 'archived list', 'unarchived list', 'created unarchived copy'];
        
        // const errorMessages = ['error adding new list', 'error updating list', 'error changing list color', 'error deleting list', 'error deleting selected lists',
        //                     'error recovering list', 'error recovering selected lists', 'error recovering all lists', 'error copying list', 'error archiving list', 'error unarchiving list',
        //                             'error copying archived list'];
        // var error = 0;
        // var message = '';

        // if(req.query.add) {
        //     message = (req.query.add == 'success') ? successMessages[0] : errorMessages[0];
        //     error = (req.query.add == 'success') ? 0 : 1;
        // }
        // else if(req.query.update) {
        //     message = (req.query.update == 'success') ? successMessages[1] : errorMessages[1];
        //     error = (req.query.update == 'success') ? 0 : 1;
        // }
        // else if(req.query.changeColor) {
        //     message = (req.query.changeColor == 'success') ? successMessages[2] : errorMessages[2];
        //     error = (req.query.changeColor == 'success') ? 0 : 1;
        // }
        // else if(req.query.delete) {
        //     message = (req.query.delete == 'success') ? successMessages[3] : errorMessages[3];
        //     error = (req.query.delete == 'success') ? 0 : 1;
        // }
        // else if(req.query.deleteSelected) {
        //     message = (req.query.deleteSelected == 'success') ? successMessages[4] : errorMessages[4];
        //     error = (req.query.deleteSelected == 'success') ? 0 : 1;

        //     if(req.query.count) {
        //         message = (req.query.count == '1') ? 'deleted ' + req.query.count + ' selected list' : 'deleted ' + req.query.count + ' selected lists';
        //     }
        // }
        // else if(req.query.restore) {
        //     message = (req.query.restore == 'success') ? successMessages[5] : errorMessages[5];
        //     error = (req.query.restore == 'success') ? 0 : 1;

        //     if(req.query.archived && req.query.archived == 'true') {
        //         return res.redirect('/archive?restore=success&archived=true');
        //     }
        // }
        // else if(req.query.restoreSelected) {
        //     message = (req.query.restoreSelected == 'success') ? successMessages[6] : errorMessages[6];
        //     error = (req.query.restoreSelected == 'success') ? 0 : 1;

        //     if(req.query.count) {
        //         message = (req.query.count == '1') ? 'recovered ' + req.query.count + ' selected list' : 'recovered ' + req.query.count + ' selected lists';
        //     }
        // }
        // else if(req.query.restoreAll) {
        //     message = (req.query.restoreAll == 'success') ? successMessages[7] : errorMessages[7];
        //     error = (req.query.restoreAll == 'success') ? 0 : 1;
        // }
        // else if(req.query.copy) {
        //     message = (req.query.copy == 'success') ? successMessages[8] : errorMessages[8];
        //     error = (req.query.copy == 'success') ? 0 : 1;
        // }
        // else if(req.query.archive) {
        //     message = (req.query.archive == 'success') ? successMessages[9] : errorMessages[9];
        //     error = (req.query.archive == 'success') ? 0 : 1;
        // }
        // else if(req.query.unarchive) {
        //     message = (req.query.unarchive == 'success') ? successMessages[10] : errorMessages[10];
        //     error = (req.query.unarchive == 'success') ? 0 : 1;
        // }
        // else if(req.query.copyArchived) {
        //     message = (req.query.copyArchived == 'success') ? successMessages[11] : errorMessages[11];
        //     error = (req.query.copyArchived == 'success') ? 0 : 1;
        // }

    //     var q = `SELECT users.email, users.profilePhotoUrl, users.fullname, users.userId, listsToUsers.listId, listsToUsers.owner FROM listsToUsers INNER JOIN users ON listsToUsers.userId = users.userId;`;

    //     db.any(q)
    //         .then((rows) => {
    //             return res.render('pages/lists', {lists, collaborators: rows, email: req.session.user.email, profilePhoto: req.session.user.profilePhoto, error, message, search: false, givenName: req.session.user.givenName, currentUserId: req.session.user.id});

    //         })
    //         .catch((error) => {
    //             console.log(error);
    //             return res.render('pages/lists', {lists, collaborators: [], email: req.session.user.email, profilePhoto: req.session.user.profilePhoto, error, message, search: false, givenName: req.session.user.givenName, currentUserId: req.session.user.id});

    //         });
    // })
    // .catch((error) => {
    //     console.log(error);
    //     return res.render('pages/lists', {lists: [], error: true, message: 'error getting lists', search: false, givenName: req.session.user.givenName});
    // });
});

// Testing
app.get('/users', (req , res) => {
    db.any(`SELECT * FROM users;`)
        .then((rows) => {
            return res.render('pages/users', {rows});

        })
        .catch((error) => {
            console.log(error);
            return res.render('pages/users', {rows: [], error: true, message: 'unable to get users'});
        });
});





app.get('/emailsAndListIds', (req , res) => {
    var q = `SELECT users.email, listsToUsers.listId FROM listsToUsers INNER JOIN users ON listsToUsers.userId = users.userId;`;

    db.any(q)
        .then((rows) => {
            return res.send(rows);
        })
        .catch((error) => {
            console.log(error);
            return res.send(error);
        });
});


app.get('/getListOwner', (req , res) => {
    var listId = 2;

    db.any(`SELECT * FROM listsToUsers WHERE listId = '${listId}' AND owner = TRUE;`)
        .then((rows) => {
            return res.send(rows);
        })
        .catch((error) => {
            console.log(error);
            return res.send(error);
        });
});












app.get('/listsToUsers', (req , res) => {
    db.any(`SELECT * FROM listsToUsers;`)
        .then((rows) => {
            return res.send(rows);

        })
        .catch((error) => {
            console.log(error);
            return res.send(error);
        });
});

app.get('/testlists', (req , res) => {
    db.any(`SELECT * FROM lists;`)
        .then((rows) => {
            return res.send(rows);

        })
        .catch((error) => {
            console.log(error);
            return res.send(error);
        });
});

  



// app.get('/auth/signout', function (req, res) {
//     req.logout();
//     res.render('pages/home', {message: 'signed out'})
// })

app.get('/logout', function (req, res, next) {
    // req.logout();
    // res.render('pages/home', {message: 'signed out'})
    req.logout(function(err) {
        if (err) { return next(err); }
        // res.redirect('/');
        req.session.destroy();

        res.render('pages/home', {message: 'signed out'});
      });
})


app.post('/search', function(req, res) {
    var q = req.body.q.toLowerCase().replace(/'/g, "''");

    // search by username and email for those users who have lists in common with the current user

    // SELECT email, fullname FROM users WHERE userId IN(SELECT userId FROM listsToUsers WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${CURRENTUSERID}'));
    
    // CREATE VIEW emails_and_names AS (SELECT LOWER(email), LOWER(fullname) FROM users WHERE userId IN(SELECT userId FROM listsToUsers WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${CURRENTUSERID}')));
    
    // '%${q}%' LIKE ANY(SELECT * FROM emails_and_names)
  
    
    // OR LIKE '%${q}%'

    var searchQuery = `SELECT * FROM lists WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}') AND trash = FALSE AND (LOWER(title) LIKE '%${q}%' OR LOWER(list) LIKE '%${q}%' OR listId IN(SELECT listId FROM listsToUsers WHERE userId IN(SELECT userId FROM emails_and_names WHERE LOWER(email) LIKE '%${q}%' OR LOWER(fullname) LIKE '%${q}%'))) ORDER BY editDateTime DESC;`;
    // var searchQuery = `SELECT * FROM lists WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}') AND trash = FALSE AND (title LIKE '%${q}%' OR LOWER(title) LIKE '%${q}%' OR list LIKE '%${q}%' OR LOWER(list) LIKE '%${q}%') ORDER BY editDateTime DESC;`;
    var renderPage = 'lists';

    if(req.query.archive && req.query.archive == 'true') {
        searchQuery = `SELECT * FROM lists WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}') AND trash = FALSE AND archive = TRUE AND (LOWER(title) LIKE '%${q}%' OR LOWER(list) LIKE '%${q}%' OR listId IN(SELECT listId FROM listsToUsers WHERE userId IN(SELECT userId FROM emails_and_names WHERE LOWER(email) LIKE '%${q}%' OR LOWER(fullname) LIKE '%${q}%'))) ORDER BY editDateTime DESC;`;
        renderPage = 'archive';
    }
    else if(req.query.trash && req.query.trash == 'true') {
        searchQuery = `SELECT * FROM lists WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}') AND trash = TRUE AND archive = FALSE AND (LOWER(title) LIKE '%${q}%' OR LOWER(list) LIKE '%${q}%' OR listId IN(SELECT listId FROM listsToUsers WHERE userId IN(SELECT userId FROM emails_and_names WHERE LOWER(email) LIKE '%${q}%' OR LOWER(fullname) LIKE '%${q}%'))) ORDER BY editDateTime DESC;`;
        renderPage = 'trash';
    }

           
    var viewQuery = `CREATE OR REPLACE VIEW emails_and_names AS (SELECT userId, email, fullname FROM users WHERE userId IN(SELECT userId FROM listsToUsers WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}')));`;
    db.any(viewQuery+searchQuery)
        .then((lists) => {
            db.any(`SELECT users.email, users.profilePhotoUrl, users.fullname, users.userId, listsToUsers.listId, listsToUsers.owner FROM listsToUsers INNER JOIN users ON listsToUsers.userId = users.userId;`)
                .then((rows) => {
                    
                    return res.render('pages/' + renderPage, {search: true, lists, labels: [], collaborators: rows, user: req.session.user, message: `results for '` + q + `'`});

                    // return res.render('pages/' + renderPage, {search: true, lists, collaborators: rows, email: req.session.user.email, profilePhoto: req.session.user.profilePhoto, givenName: req.session.user.givenName, currentUserId: req.session.user.id, message: `results for '` + q + `'`});

    
                })
                .catch((error) => {
                    console.log(error);
                    return res.render('pages/' + renderPage, {search: true, lists, collaborators: [], email: req.session.user.email, profilePhoto: req.session.user.profilePhoto, givenName: req.session.user.givenName, currentUserId: req.session.user.id, message: `results for '` + q + `'`});

    
                });


            // return res.render('pages/' + renderPage, {search: true, lists, email: req.session.user.email, profilePhoto: req.session.user.profilePhoto, givenName: req.session.user.givenName, message: `results for '` + q + `'`});

        })
        .catch((error) => {
            console.log(error);
            return res.render('pages/lists', {search: true, error: true, lists: [], email: req.session.user.email, profilePhoto: req.session.user.profilePhoto, givenName: req.session.user.givenName, currentUserId: req.session.user.id, message: 'search error'});
        });
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


// Testing
app.get('/allIdsAssocWithCurrentUserLists', (req , res) => {
    db.any(`SELECT userId FROM listsToUsers WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}');`)
        .then((rows) => {
            return res.send(rows);

        })
        .catch((error) => {
            console.log(error);
            return res.send(rows);
        });
});





app.get('/searchByEmailOrName', (req , res) => {
   
    // db.any(`CREATE OR REPLACE VIEW emails_and_names 
    //         AS (
    //             SELECT userId, email, fullname
    //             FROM users 
    //             WHERE userId 
    //             IN(
    //                 SELECT userId 
    //                 FROM listsToUsers 
    //                 WHERE listId 
    //                 IN(
    //                     SELECT listId 
    //                     FROM listsToUsers 
    //                     WHERE userId = '${req.session.user.id}')));
    //        SELECT * FROM lists WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId IN(SELECT userId FROM emails_and_names WHERE LOWER(email) LIKE '%${req.query.q}%' OR LOWER(fullname) LIKE '%${req.query.q}%'));`)
        
    var q = req.query.q.toLowerCase();
    db.any(`CREATE OR REPLACE VIEW emails_and_names AS ( SELECT userId, email, fullname FROM users WHERE userId IN( SELECT userId FROM listsToUsers WHERE listId IN( SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}'))); SELECT * FROM lists WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}') AND trash = FALSE AND (title LIKE '%${q}%' OR LOWER(title) LIKE '%${q}%' OR regexp_replace(list, E'<.*?>', '', 'g' ) LIKE '%${q}%' OR LOWER(regexp_replace(list, E'<.*?>', '', 'g' )) LIKE '%${q}%' OR listId IN(SELECT listId FROM listsToUsers WHERE userId IN(SELECT userId FROM emails_and_names WHERE LOWER(email) LIKE '%${q}%' OR LOWER(fullname) LIKE '%${q}%'))) ORDER BY editDateTime DESC;`)
    .then((rows) => {
            return res.send(rows);

        })
        .catch((error) => {
            console.log(error);
            return res.send(error);
        });


        // titele, list, 
        // must be one of my lists, not in trash

});



//SELECT * FROM lists WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}') AND trash = FALSE AND (title LIKE '%${q}%' OR LOWER(title) LIKE '%${q}%' OR list LIKE '%${q}%' OR LOWER(list) LIKE '%${q}%') ORDER BY editDateTime DESC;
 // search by username and email for those users who have lists in common with the current user

    // SELECT email, fullname FROM users WHERE userId IN(SELECT userId FROM listsToUsers WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${CURRENTUSERID}'));
    
    // CREATE VIEW emails_and_names AS (SELECT LOWER(email), LOWER(fullname) FROM users WHERE userId IN(SELECT userId FROM listsToUsers WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${CURRENTUSERID}')));
    
    // '%${q}%' LIKE ANY(SELECT * FROM emails_and_names)


app.post('/emptyTrash', function(req, res) {
    // get all ids assoc. with all lists for the current user.
    // `SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}';` // we have all listids assoc with this user
    // `SELECT userId FROM listsToUsers WHERE listId IN(^);` // collect all user ids that may also be assoc with any of these listids
    db.any(`DELETE FROM listsToUsers WHERE userId IN(SELECT userId FROM listsToUsers WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}')) AND listId IN(SELECT listId FROM lists WHERE trash = TRUE) RETURNING listId;`)

    // db.any(`DELETE FROM listsToUsers WHERE userId = '${req.session.user.id}' AND listId IN(SELECT listId FROM lists WHERE trash = TRUE) RETURNING listId;`)
        .then((ids) => {
            var array = [];
            for(var i = 0; i < ids.length; i++) {
                array.push(ids[i].listid);
            }

        


            db.any(`DELETE FROM lists WHERE trash = TRUE AND listId IN(${array});`)
                .then(() => {
                    return res.redirect('/trash?empty=success');
                    // return res.render('pages/trash', {lists: [], error: false, message: 'emptied trash', givenName: req.session.user.givenName})
                })
                .catch((error) => {
                    console.log(error);
                    return res.redirect('/trash?empty=failure');
                    // return res.render('pages/trash', {lists: [], error: true, message: 'unable to empty trash', givenName: req.session.user.givenName})
                });

        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/trash?empty=failure');
            // return res.render('pages/trash', {lists: [], error: true, message: 'unable to empty trash', givenName: req.session.user.givenName}) 
        });
});





app.post('/addList', function(req, res) {
    var title = (!req.body.title) ? '' : req.body.title;




    db.any(`INSERT INTO lists (title, list, color, trash, archive, editDateTime, createDateTime) VALUES ('${title.replace(/'/g, "''")}', '${req.body.list.replace(/'/g, "''")}', 'ffffff', FALSE, FALSE, '${req.body.now}', '${req.body.now}') RETURNING listId;`)
        .then((listId) => {
            db.any(`INSERT INTO listsToUsers (listId, userId, owner) VALUES (${listId[0].listid}, '${req.session.user.id}', TRUE);`)
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

app.get('/horiz', function(req, res) {
return res.render('pages/horizontal', {users: []});


});

app.post('/changeListColor', function(req, res) {
    db.any(`UPDATE lists SET color = '${req.body.color}' WHERE listId = ${req.body.listId};`)
        .then(() => {
            if(req.query.archived && req.query.archived == 'true') {
                return res.redirect('/archive?changeColor=success');
            }
            // return res.render('pages/horizontal', {color: req.body.color, id: req.body.listId});
            return res.redirect('/lists?changeColor=success');
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/lists?changeColor=failure');
        });
    
    
});



app.post('/deleteList', function(req, res) {
    // db.any(`DELETE FROM listsToUsers WHERE listId = ${req.body.listId};DELETE FROM lists WHERE listId = ${req.body.listId};`)
    db.any(`UPDATE lists SET trash = TRUE WHERE listId = ${req.body.listId};`)
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
    // db.any(`DELETE FROM listsToUsers WHERE listId = ${req.body.listId};DELETE FROM lists WHERE listId = ${req.body.listId};`)
    db.any(`UPDATE lists SET archive = FALSE WHERE listId = ${req.body.listId};`)
        .then(() => {
            return res.redirect('/lists?unarchive=success');
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/lists?unarchive=failure');
        });
    
    
});


app.post('/deleteSelectedLists', function(req, res) {
    // console.log(req.body.listIds);
    var array = req.body.listIds.split(',');
    // console.log(array);
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

    // return res.redirect('/lists');
    
    
});

app.post('/permanentlyDeleteSelected', function(req, res) {
    var array = req.body.listIds.split(',');
    // console.log(array);
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
    // var title = (!req.body.title) ? 'edited list' : req.body.title;
    // var nowFormatted = getNowFormatted();


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
    db.any(`SELECT * FROM lists WHERE trash = TRUE AND listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}') ORDER BY editDateTime DESC;`)
        .then((lists) => {
            const successMessages = ['permanently deleted list',
                                'emptied trash', 'permanently deleted selection'];
        
        const errorMessages = ['error permanently deleting list', 'error emptying trash', 'error permanently deleting selection'];
        var error = 0;
        var message = '';

            if(req.query.permanentlyDeleted) {
                message = (req.query.permanentlyDeleted == 'success') ? successMessages[0] : errorMessages[0];
                error = (req.query.permanentlyDeleted == 'success') ? 0 : 1;
            // var message = (req.query.permanentlyDeleted == 'success') ? 'permanently deleted list' : 'error permanently deleting list';
            // var error = (req.query.permanentlyDeleted == 'success') ? false : true;
            }
            else if(req.query.empty) {
                message = (req.query.empty == 'success') ? successMessages[1] : errorMessages[1];
                error = (req.query.empty == 'success') ? 0 : 1;
                // var message = (req.query.empty == 'success') ? 'emptied trash' : 'error emptying trash';
                // var error = (req.query.empty == 'success') ? false : true;
            }
            else if(req.query.permanentlyDeleteSelected) {
                message = (req.query.permanentlyDeleteSelected == 'success') ? successMessages[2] : errorMessages[2];
                error = (req.query.permanentlyDeleteSelected == 'success') ? 0 : 1;

                if(req.query.count) {
                    message = (req.query.count == '1') ? 'permanently deleted ' + req.query.count + ' list' : 'permanently deleted ' + req.query.count + ' lists';
                }
            }

            var q = `SELECT users.email, users.profilePhotoUrl, users.fullname, users.userId, listsToUsers.listId, listsToUsers.owner FROM listsToUsers INNER JOIN users ON listsToUsers.userId = users.userId;`;

            db.any(q)
                .then((rows) => {
                    return res.render('pages/trash', {lists, collaborators: rows, email: req.session.user.email, profilePhoto: req.session.user.profilePhoto, error, message, search: false, givenName: req.session.user.givenName, currentUserId: req.session.user.id, user: req.session.user});
                    // return res.render('pages/archive', {lists, collaborators: rows, email: req.session.user.email, profilePhoto: req.session.user.profilePhoto, error, message, search: false, givenName: req.session.user.givenName});

                })
                .catch((error) => {
                    console.log(error);
                    return res.render('pages/trash', {lists, collaborators: rows, email: req.session.user.email, profilePhoto: req.session.user.profilePhoto, error, message, search: false, givenName: req.session.user.givenName, currentUserId: req.session.user.id});
                    // return res.render('pages/archive', {lists, collaborators: rows, email: req.session.user.email, profilePhoto: req.session.user.profilePhoto, error, message, search: false, givenName: req.session.user.givenName});

                });

            // return res.render('pages/trash', {lists, profilePhoto: req.session.user.profilePhoto, error, message, search: false, givenName: req.session.user.givenName});
        })
        .catch((error) => {
            console.log(error);
            return res.render('pages/trash', {lists: [], profilePhoto: req.session.user.profilePhoto, error: true, message: 'error loading trash', search: false, givenName: req.session.user.givenName, currentUserId: req.session.user.id});
        });
    
    
});



app.post('/restoreList', function(req, res) {
    db.any(`UPDATE lists SET trash = FALSE WHERE listId = ${req.body.listId};`)
        .then((lists) => {
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
    // var nowFormatted = getNowFormatted();


    db.any(`INSERT INTO lists (title, list, color, trash, archive, editDateTime, createDateTime) VALUES ('${req.body.title.replace(/'/g, "''")}', '${req.body.list.replace(/'/g, "''")}', '${req.body.color}', FALSE, FALSE, '${req.body.now}', '${req.body.now}') RETURNING listId;`)
    .then((listId) => {
        db.any(`INSERT INTO listsToUsers (listId, userId, owner) VALUES (${listId[0].listid}, '${req.session.user.id}', TRUE);`)
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
});


app.post('/restoreSelectedLists', function(req, res) {
    var array = req.body.listIds.split(',');
    // console.log(array);
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
// app.post('/search', function(req, res) {
//     db.any(`SELECT * FROM lists WHERE title LIKE ${} OR list LIKE ${} AND listId IN(SELECT listId FROM listsToUsers WHERE);`)
//         .then(() => {
//             return res.redirect('/lists?update=success');
//         })
//         .catch((error) => {
//             console.log(error);
//             return res.redirect('/lists?update=failure');
//         });
    
    
// });


app.get('/archive', (req , res) => {

    db.any(`SELECT * FROM lists WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}') AND archive = TRUE AND trash = FALSE ORDER BY editDateTime DESC;`)
        .then((lists) => {
            const successMessages = ['changed list color', 'updated list', 'deleted list', 'restored archived list'];
            const errorMessages = ['error changing list color', 'error updating list', 'error deleting list', 'error restoring archived list'];
            var error = 0;
            var message = '';

            if(req.query.changeColor) {
                message = (req.query.changeColor == 'success') ? successMessages[0] : errorMessages[0];
                error = (req.query.changeColor == 'success') ? 0 : 1;
            // var message = (req.query.permanentlyDeleted == 'success') ? 'permanently deleted list' : 'error permanently deleting list';
            // var error = (req.query.permanentlyDeleted == 'success') ? false : true;
            }
            else if(req.query.update) {
                message = (req.query.update == 'success') ? successMessages[1] : errorMessages[1];
                error = (req.query.update == 'success') ? 0 : 1;
            // var message = (req.query.permanentlyDeleted == 'success') ? 'permanently deleted list' : 'error permanently deleting list';
            // var error = (req.query.permanentlyDeleted == 'success') ? false : true;
            }
            else if(req.query.delete) {
                message = (req.query.delete == 'success') ? successMessages[2] : errorMessages[2];
                error = (req.query.delete == 'success') ? 0 : 1;
            // var message = (req.query.permanentlyDeleted == 'success') ? 'permanently deleted list' : 'error permanently deleting list';
            // var error = (req.query.permanentlyDeleted == 'success') ? false : true;
            }
            else if(req.query.restore) {
                // message = (req.query.restore == 'success') ? successMessages[3] : errorMessages[3];
                error = (req.query.restore == 'success') ? 0 : 1;

                if(req.query.archived && req.query.archived == 'true') {
                    message = successMessages[3];
                }
                else {
                    message = errorMessages[3];
                }
            // var message = (req.query.permanentlyDeleted == 'success') ? 'permanently deleted list' : 'error permanently deleting list';
            // var error = (req.query.permanentlyDeleted == 'success') ? false : true;
            }
            var q = `SELECT users.email, users.profilePhotoUrl, users.fullname, users.userId, listsToUsers.listId, listsToUsers.owner FROM listsToUsers INNER JOIN users ON listsToUsers.userId = users.userId;`;

            db.any(q)
                .then((rows) => {
                    // return res.render('pages/lists', {lists, collaborators: rows, email: req.session.user.email, profilePhoto: req.session.user.profilePhoto, error, message, search: false, givenName: req.session.user.givenName});
                    return res.render('pages/archive', {lists, collaborators: rows, error, message, search: false, user: req.session.user});

                })
                .catch((error) => {
                    console.log(error);
                    // return res.render('pages/lists', {lists, collaborators: [], email: req.session.user.email, profilePhoto: req.session.user.profilePhoto, error, message, search: false, givenName: req.session.user.givenName});
                    return res.render('pages/archive', {lists, collaborators: rows, email: req.session.user.email, profilePhoto: req.session.user.profilePhoto, error, message, search: false, givenName: req.session.user.givenName, currentUserId: req.session.user.id});

                });
            // return res.render('pages/archive', {lists, error, message, search: false, givenName: req.session.user.givenName});
        })
        .catch((error) => {
            console.log(error);
            return res.render('pages/archive', {lists: [], error: true, message: 'error loading archive', search: false, givenName: req.session.user.givenName, currentUserId: req.session.user.id});
        });
});

app.post('/archiveList', function(req, res) {
    // var title = (!req.body.title) ? 'edited list' : req.body.title;

    db.any(`UPDATE lists SET archive = TRUE WHERE listId = ${req.body.listId};`)
        .then(() => {
            return res.redirect('/lists?archive=success');
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/lists?archive=failure');
        });
    
    
});

app.post('/removeCollaborator', function(req, res) {
    db.any(`DELETE FROM listsToUsers WHERE listId = '${req.body.listId}' AND userId = '${req.body.userId}';`)
        .then(() => {
            return res.redirect('/lists?removeCollaborator=success');
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/lists?removeCollaborator=failure');
        });
    
    
});


// function getNowFormatted(date) {
//     // var now = new Date();
//     var now = date;

//     console.log(now);

//     var nowYear = now.getFullYear();
//     var nowMonth = parseInt(now.getMonth()+1);
//     var nowDate = now.getDate();
//     var nowHours = now.getHours();
//     var nowMinutes = now.getMinutes();

//     var monthFormatted = (nowMonth < 10) ? '0' + nowMonth : nowMonth;
//     var dateFormatted = (nowDate < 10) ? '0' + nowDate : nowDate;
//     var hoursFormatted = (nowHours < 10) ? '0' + nowHours : nowHours;
//     var minutesFormatted = (nowMinutes < 10) ? '0' + nowMinutes : nowMinutes;

//     var nowFormatted = monthFormatted + '-' + dateFormatted + '-' + nowYear + ',' + hoursFormatted + ':' + minutesFormatted;
    
//     console.log(nowFormatted);

//     return nowFormatted;
// }



app.post('/searchUsers', function(req, res) {
    var q = req.body.q;

    // console.log(req.body.listIdToCollaborate);

    var searchQuery = `SELECT * FROM users WHERE userId != '${req.session.user.id}' AND userID NOT IN(SELECT userID FROM listsToUsers WHERE listId = '${req.body.listIdToCollaborate}') AND (email LIKE '%${q}%' OR LOWER(email) LIKE '%${q}%' OR fullname LIKE '%${q}%' OR LOWER(fullname) LIKE '%${q}%');`;

    db.any(searchQuery)
        .then((users) => {
            // return res.render('pages/horizontal', {users});
            console.log(users);
            return res.render('pages/addCollaborator', {users, listid: req.body.listIdToCollaborate, error: false, message: 'results for ' + q});


        })
        .catch((error) => {
            console.log(error);
            // return res.render('pages/horizontal', {users: []});
            return res.render('pages/addCollaborator', {users: [], listid: req.body.listIdToCollaborate, error: true, message: 'error searching users'});

        });
});


app.get('/labelsModal', function(req, res) {

    db.any(`SELECT * FROM labels WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userID = '${req.session.user.id}');`)
        .then((labels) => {
            // return res.render('pages/horizontal', {users});
            // console.log(labels);
            return res.render('pages/labelsModal', {labels, listid: req.query.listId});


        })
        .catch((error) => {
            console.log(error);
            // return res.render('pages/horizontal', {users: []});
            return res.render('pages/labelsModal', {error: true, labels: [], listid: req.query.listId});
        });
});






app.post('/createNewLabel', function(req, res) {
    if(req.body.label.match(/^ *$/) !== null) {
        return res.redirect('/labelsModal?createNewLabel=failure');
    }
    db.any(`INSERT INTO labels (label) VALUES ('${req.body.label}');INSERT INTO labelsToUsers (labelId, userId) VALUES ((SELECT MAX(labelId) FROM labels), '${req.session.user.id}');`)
        .then(() => {
            // return res.render('pages/horizontal', {users});
            return res.redirect('/labelsModal?createNewLabel=success&listId=' + req.body.listId);
        })
        .catch((error) => {
            console.log(error);
            // return res.render('pages/horizontal', {users: []});
            return res.redirect('/labelsModal?createNewLabel=failure');
        });
});



app.post('/deleteAllLabels', function(req, res) {
    db.any(`DELETE FROM labelsToLists WHERE labelId IN(SELECT labelId FROM labelsToUsers WHERE userId = '${req.session.user.id}'); DELETE FROM labelsToUsers WHERE userId = '${req.session.user.id}' RETURNING labelId;`)
        .then((labelIds) => {
            var array = [];
            for(var i = 0; i < labelIds.length; i++) {
                array.push(labelIds[i].labelid);
            }

            // console.log(labelIds);
            // console.log(array);

            db.any(`DELETE FROM labels WHERE labelId IN(${array});`)
                .then(() => {
                    return res.redirect('/labelsModal?deleteAllLabels=success&listId=' + req.body.listId);
                })
                .catch((error) => {
                    console.log(error);
                    return res.redirect('/labelsModal?deleteAllLabels=failure');
                });
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/labelsModal?deleteAllLabels=failure');
        });
});


app.post('/assignLabelToList', function(req, res) {
    
    db.any(`INSERT INTO labelsToLists (labelId, listId) VALUES ('${req.body.labelId}', '${req.body.listId}');`)
        .then(() => {
            // return res.render('pages/horizontal', {users});
            return res.redirect('/lists?assignLabel=success');
        })
        .catch((error) => {
            console.log(error);
            // return res.render('pages/horizontal', {users: []});
            return res.redirect('/lists?assignLabel=failure');
        });
});


app.post('/removeLabelFromList', function(req, res) {
    
    db.any(`DELETE FROM labelsToLists WHERE labelId = '${req.body.labelId}' AND listId = '${req.body.listId}';`)
        .then(() => {
            // return res.render('pages/horizontal', {users});
            return res.redirect('/lists?removeLabelFromList=success');
        })
        .catch((error) => {
            console.log(error);
            // return res.render('pages/horizontal', {users: []});
            return res.redirect('/lists?removeLabelFromList=failure');
        });
});



app.post('/addCollaborator', function(req, res) {
    // console.log(req.body.listId);
    // console.log(req.body.collaboratorUserId);
    // INSERT INTO listsToUsers (listId, userId) VALUES ('${req.body.listId}', '${req.body.collaboratorUserId}');
    db.any(`INSERT INTO listsToUsers (listId, userId, owner) SELECT '${req.body.listId}', '${req.body.collaboratorUserId}', FALSE WHERE NOT EXISTS (SELECT 1 FROM listsToUsers WHERE listId = '${req.body.listId}' AND userId = '${req.body.collaboratorUserId}');`)
        .then(() => {
            sendCollaborationEmail(req.body.email);
            return res.redirect('/lists?addCollaborator=success');
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/lists?addCollaborator=failure');
        });
});



function sendCollaborationEmail(email) {
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
        to: email,
        subject: 'A lists user shared their list with you',
        text: 'Hello! A lists user has shared a list with you. Log in to your account to collaborate on it with them.'
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
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





