const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth2').Strategy;
  
passport.serializeUser((user , done) => {
    done(null , user);
})
passport.deserializeUser(function(user, done) {
    done(null, user);
});
  
passport.use(new GoogleStrategy({
    clientID:"384765299778-apqsq1t7g8e30rcau4b9gg25e9qciar7.apps.googleusercontent.com",
    clientSecret:"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",
    callbackURL:"http://localhost:3000/auth/callback",
    passReqToCallback: true
  },
  function(request, accessToken, refreshToken, profile, done) {
    return done(null, profile);
  }
));