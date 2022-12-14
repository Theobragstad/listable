const express = require('express');
const app = express();
const pgp = require('pg-promise')();

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






  
app.use(cookieSession({
    name: 'google-auth-session',
    keys: ['key1', 'key2']
}));
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
  
// Success 
app.get('/auth/callback/success' , (req , res) => {
    if(!req.user) {
        res.redirect('/auth/callback/failure');
    }
    else {
        db.any(`INSERT INTO users (userId) SELECT '${req.user.id}' WHERE NOT EXISTS (SELECT 1 FROM users WHERE userId = '${req.user.id}');`)
            .then(() => {
                return res.render('pages/lists', {user: req.user, hostUrl: req.headers.host});

            })
            .catch((error) => {
                console.log(error);
                return res.render('pages/lists', {user: req.user, hostUrl: req.headers.host, error: true, message: 'unable to register'});
            });
    }
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

  
// failure
app.get('/auth/callback/failure' , (req , res) => {
    res.send("Error");
})


// app.get('/auth/signout', function (req, res) {
//     req.logout();
//     res.render('pages/home', {message: 'signed out'})
// })

app.get('/logout', function (req, res) {
    req.logout();
    res.render('pages/home', {message: 'signed out'})
})


app.use((req, res, next) => {
    res.status(404).send('404');
})
  
app.listen(3000);
console.log('Server is listening on port 3000');





