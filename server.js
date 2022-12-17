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
    res.render("pages/home");
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

                return res.redirect('/lists');
            })
            .catch((error) => {
                console.log(error);
                return res.redirect('/lists?register=failure');
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
    db.any(`SELECT * FROM lists WHERE listId IN(SELECT listId FROM listsToUsers WHERE userId = '${req.session.user.id}');`)
    .then((lists) => {
        if(req.query.add) {
            var message = (req.query.add == 'success') ? 'added new list' : 'unable to add new list';
            var error = (req.query.add == 'success') ? false : true;
            return res.render('pages/lists', {error, lists, givenName: req.session.user.givenName, message});
        }
        else if(req.query.delete) {
            var message = (req.query.delete == 'success') ? 'deleted list' : 'unable to delete list';
            var error = (req.query.delete == 'success') ? false : true;
            return res.render('pages/lists', {error, lists, givenName: req.session.user.givenName, message});
        }
        else {
            return res.render('pages/lists', {lists, givenName: req.session.user.givenName});
        }
    })
    .catch((error) => {
        console.log(error);
        return res.render('pages/lists', {error: true, lists: [], message: 'error getting lists', givenName: req.session.user.givenName});
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
    db.any(`SELECT * FROM lists WHERE title LIKE ${q} OR list LIKE ${q};`)
        .then((lists) => {
            return res.render('', {lists});

        })
        .catch((error) => {
            console.log(error);
            return res.render('', {lists: [], error: true, message: 'search error'});
        });
});


app.post('/addList', function(req, res) {
    db.any(`INSERT INTO lists (title, list) VALUES ('${req.body.title}', '${req.body.list}') RETURNING listId;`)
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

app.post('/deleteList', function(req, res) {
    db.any(`DELETE FROM listsToUsers WHERE listId = ${req.body.listId};DELETE FROM lists WHERE listId = ${req.body.listId};`)
        .then(() => {
            return res.redirect('/lists?delete=success');
        })
        .catch((error) => {
            console.log(error);
            return res.redirect('/lists?delete=failure');
        });
    
    
});




app.use((req, res, next) => {
    res.status(404).send('404');
})
  
app.listen(3000);
console.log('Server is listening on port 3000');





