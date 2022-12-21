const express = require('express');
const app = express();
const pgp = require('pg-promise')();
const session = require('express-session');



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
        db.any(`INSERT INTO users (userId) SELECT '${req.user.id}' WHERE NOT EXISTS (SELECT 1 FROM users WHERE userId = '${req.user.id}');`)
            .then(() => {
                req.session.user = {id: req.user.id, givenName: req.user.name.givenName};
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
    db.any(`SELECT * FROM lists WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}') AND trash = FALSE AND archive = FALSE ORDER BY listId DESC;`)
    .then((lists) => {
        const successMessages = ['added new list', 'updated list', 'changed list color', 'deleted list',
                                'deleted selected lists', 'recovered list', 'recovered selected lists', 'recovered all lists',
                                 'copied list', 'archived list', 'unarchived list', 'created unarchived copy'];
        
        const errorMessages = ['error adding new list', 'error updating list', 'error changing list color', 'error deleting list', 'error deleting selected lists',
                            'error recovering list', 'error recovering selected lists', 'error recovering all lists', 'error copying list', 'error archiving list', 'error unarchiving list',
                                    'error copying archived list'];
        var error = 0;
        var message = '';



        if(req.query.add) {
            // message, error = (req.query.add == 'success') ? [successMessages[0], 0] : [errorMessages[0], 1];
            message = (req.query.add == 'success') ? successMessages[0] : errorMessages[0];
            error = (req.query.add == 'success') ? 0 : 1;

            // error = (req.query.add == 'success') ? false : true;
            // return res.render('pages/lists', {search: false, error, lists, givenName: req.session.user.givenName, message});
        }
        else if(req.query.update) {
            message = (req.query.update == 'success') ? successMessages[1] : errorMessages[1];
            error = (req.query.update == 'success') ? 0 : 1;
            // var message = (req.query.update == 'success') ? 'updated list' : 'error updating list';
            // var error = (req.query.update == 'success') ? false : true;
        }
        else if(req.query.changeColor) {
            message = (req.query.changeColor == 'success') ? successMessages[2] : errorMessages[2];
            error = (req.query.changeColor == 'success') ? 0 : 1;
            // var message = (req.query.changeColor == 'success') ? 'changed list color' : 'error changing list color';
            // var error = (req.query.changeColor == 'success') ? false : true;
        }
        else if(req.query.delete) {
            message = (req.query.delete == 'success') ? successMessages[3] : errorMessages[3];
            error = (req.query.delete == 'success') ? 0 : 1;
            // var message = (req.query.delete == 'success') ? 'deleted list' : 'error deleting list';
            // var error = (req.query.delete == 'success') ? false : true;
            // return res.render('pages/lists', {search: false, error, lists, givenName: req.session.user.givenName, message});
        }
        else if(req.query.deleteSelected) {
            message = (req.query.deleteSelected == 'success') ? successMessages[4] : errorMessages[4];
            error = (req.query.deleteSelected == 'success') ? 0 : 1;

            if(req.query.count) {
                message = (req.query.count == '1') ? 'deleted ' + req.query.count + ' selected list' : 'deleted ' + req.query.count + ' selected lists';
            }
            
            // var message = (req.query.deleteSelected == 'success') ? 'deleted selected lists' : 'error deleting selected lists';
            // var error = (req.query.deleteSelected == 'success') ? false : true;
        }
        
        else if(req.query.restore) {
            message = (req.query.restore == 'success') ? successMessages[5] : errorMessages[5];
            error = (req.query.restore == 'success') ? 0 : 1;
            // var message = (req.query.restore == 'success') ? 'restored list' : 'error restoring list';
            // var error = (req.query.restore == 'success') ? false : true;
        }
        else if(req.query.restoreSelected) {
            message = (req.query.restoreSelected == 'success') ? successMessages[6] : errorMessages[6];
            error = (req.query.restoreSelected == 'success') ? 0 : 1;

            if(req.query.count) {
                message = (req.query.count == '1') ? 'recovered ' + req.query.count + ' selected list' : 'recovered ' + req.query.count + ' selected lists';
            }
            // var message = (req.query.restoreSelected == 'success') ? 'restored selected lists' : 'error restoring selected lists';
            // var error = (req.query.restoreSelected == 'success') ? false : true;
        }
        else if(req.query.restoreAll) {
            message = (req.query.restoreAll == 'success') ? successMessages[7] : errorMessages[7];
            error = (req.query.restoreAll == 'success') ? 0 : 1;
            // var message = (req.query.restoreAll == 'success') ? 'restored all lists' : 'error restoring all lists';
            // var error = (req.query.restoreAll == 'success') ? false : true;
        }
        
       
        else if(req.query.copy) {
            message = (req.query.copy == 'success') ? successMessages[8] : errorMessages[8];
            error = (req.query.copy == 'success') ? 0 : 1;

            // var message = (req.query.copy == 'success') ? 'copied list' : 'error copying list';
            // var error = (req.query.copy == 'success') ? false : true;
        }
        else if(req.query.archive) {
            message = (req.query.archive == 'success') ? successMessages[9] : errorMessages[9];
            error = (req.query.archive == 'success') ? 0 : 1;
            // var message = (req.query.copy == 'success') ? 'copied list' : 'error copying list';
            // var error = (req.query.copy == 'success') ? false : true;
        }
        else if(req.query.unarchive) {
            message = (req.query.unarchive == 'success') ? successMessages[10] : errorMessages[10];
            error = (req.query.unarchive == 'success') ? 0 : 1;
            // var message = (req.query.copy == 'success') ? 'copied list' : 'error copying list';
            // var error = (req.query.copy == 'success') ? false : true;
        }
        else if(req.query.copyArchived) {
            message = (req.query.copyArchived == 'success') ? successMessages[11] : errorMessages[11];
            error = (req.query.copyArchived == 'success') ? 0 : 1;

            // var message = (req.query.copy == 'success') ? 'copied list' : 'error copying list';
            // var error = (req.query.copy == 'success') ? false : true;
        }
        // else {
        //     message = '';
        //     error = 0;
        //     // return res.render('pages/lists', {search: false, lists, givenName: req.session.user.givenName});
        // }

        return res.render('pages/lists', {lists, error, message, search: false, givenName: req.session.user.givenName});

        // return res.render('pages/lists', {error, message, search: false, lists, givenName: req.session.user.givenName});

    })
    .catch((error) => {
        console.log(error);
        return res.render('pages/lists', {lists: [], error: true, message: 'error getting lists', search: false, givenName: req.session.user.givenName});
    });
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
    var q = req.body.q;


    var searchQuery = `SELECT * FROM lists WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}') AND trash = FALSE AND (title LIKE '%${q}%' OR LOWER(title) LIKE '%${q}%' OR list LIKE '%${q}%' OR LOWER(list) LIKE '%${q}%');`;
    var renderPage = 'lists';

    if(req.query.archive && req.query.archive == 'true') {
        searchQuery = `SELECT * FROM lists WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}') AND trash = FALSE AND archive = TRUE AND (title LIKE '%${q}%' OR LOWER(title) LIKE '%${q}%' OR list LIKE '%${q}%' OR LOWER(list) LIKE '%${q}%');`;
        renderPage = 'archive';
    }
    else if(req.query.trash && req.query.trash == 'true') {
        searchQuery = `SELECT * FROM lists WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}') AND trash = TRUE AND archive = FALSE AND (title LIKE '%${q}%' OR LOWER(title) LIKE '%${q}%' OR list LIKE '%${q}%' OR LOWER(list) LIKE '%${q}%');`;
        renderPage = 'trash';
    }

           

    db.any(searchQuery)
        .then((lists) => {
            return res.render('pages/' + renderPage, {search: true, lists, givenName: req.session.user.givenName, message: `results for '` + q + `'`});

        })
        .catch((error) => {
            console.log(error);
            return res.render('pages/lists', {search: true, error: true, lists: [], givenName: req.session.user.givenName, message: 'search error'});
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


app.post('/emptyTrash', function(req, res) {
    db.any(`DELETE FROM listsToUsers WHERE userId = '${req.session.user.id}' AND listId IN(SELECT listId FROM lists WHERE trash = TRUE) RETURNING listId;`)
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

    // var nowFormatted = getNowFormatted();



    db.any(`INSERT INTO lists (title, list, color, trash, archive, editDateTime, createDateTime) VALUES ('${title.replace(/'/g, "''")}', '${req.body.list.replace(/'/g, "''")}', 'ffffff', FALSE, FALSE, '${req.body.now}', '${req.body.now}') RETURNING listId;`)
        .then((listId) => {
            db.any(`INSERT INTO listsToUsers (listId, userId) VALUES (${listId[0].listid}, '${req.session.user.id}');`)
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
return res.render('pages/horizontal');


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
    console.log(req.body.listIds);
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
    db.any(`SELECT * FROM lists WHERE trash = TRUE AND listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}');`)
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

            return res.render('pages/trash', {lists, error, message, search: false, givenName: req.session.user.givenName});
        })
        .catch((error) => {
            console.log(error);
            return res.render('pages/trash', {lists: [], error: true, message: 'error loading trash', search: false, givenName: req.session.user.givenName});
        });
    
    
});



app.post('/restoreList', function(req, res) {
    db.any(`UPDATE lists SET trash = FALSE WHERE listId = ${req.body.listId};`)
        .then((lists) => {
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
        db.any(`INSERT INTO listsToUsers (listId, userId) VALUES (${listId[0].listid}, '${req.session.user.id}');`)
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

    
    db.any(`SELECT * FROM lists WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}') AND archive = TRUE AND trash = FALSE;`)
        .then((lists) => {
            const successMessages = ['changed list color', 'updated list', 'deleted list'];
            const errorMessages = ['error changing list color', 'error updating list', 'error deleting list'];
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

            return res.render('pages/archive', {lists, error, message, search: false, givenName: req.session.user.givenName});
        })
        .catch((error) => {
            console.log(error);
            return res.render('pages/archive', {lists: [], error: true, message: 'error loading archive', search: false, givenName: req.session.user.givenName});
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


app.use((req, res, next) => {
    res.status(404).send("404 <br> <img src='/img/lost.png' style='width:100px'>");
})
  
app.listen(3000);
console.log('Server is listening on port 3000');





