/*
Copyright 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
    http://aws.amazon.com/apache2.0/
or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

// Define our dependencies
var express        = require('express');
var session        = require('express-session');
var passport       = require('passport');
var OAuth2Strategy = require('passport-oauth').OAuth2Strategy;
var request        = require('request');
var handlebars     = require('handlebars');

// Define our constants
const TWITCH_CLIENT_ID = 'ajppaljrnqzxcmw130391s1o867sy9';
const TWITCH_SECRET    = '0mbpnclplhp8e0tp0z5d1wa91dalrb';
const SESSION_SECRET   = 'skolopendromorf';
const CALLBACK_URL     = 'https://webdevlearn-dawidmrozik.c9users.io/auth/twitch/callback';  // You can run locally with - http://localhost:3000/auth/twitch/callback

// Initialize Express and middlewares
var app = express();
app.use(session({secret: SESSION_SECRET, resave: false, saveUninitialized: false}));
app.use(express.static(__dirname + "/public"));
app.use(passport.initialize());
app.use(passport.session());
app.set("view engine", "ejs");

// Override passport profile function to get user profile from Twitch API
OAuth2Strategy.prototype.userProfile = function(accessToken, done) {
  var options = {
    url: 'https://api.twitch.tv/kraken/user',
    method: 'GET',
    headers: {
      'Client-ID': TWITCH_CLIENT_ID,
      'Accept': 'application/vnd.twitchtv.v5+json',
      'Authorization': 'OAuth ' + accessToken
    }
  };

  request(options, function (error, response, body) {
    if (response && response.statusCode == 200) {
      done(null, JSON.parse(body));
    } else {
      done(JSON.parse(body));
    }
  });
};

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});

passport.use('twitch', new OAuth2Strategy({
    authorizationURL: 'https://api.twitch.tv/kraken/oauth2/authorize',
    tokenURL: 'https://api.twitch.tv/kraken/oauth2/token',
    clientID: TWITCH_CLIENT_ID,
    clientSecret: TWITCH_SECRET,
    callbackURL: CALLBACK_URL,
    state: true
  },
  function(accessToken, refreshToken, profile, done) {
    profile.accessToken = accessToken;
    profile.refreshToken = refreshToken;

    // Securely store user profile in your DB
    //User.findOrCreate(..., function(err, user) {
    //  done(err, user);
    //});

    done(null, profile);
  }
));

// Set route to start OAuth link, this is where you define scopes to request
app.get('/auth/twitch', passport.authenticate('twitch', { scope: 'user_read' }));

// Set route for OAuth redirect
app.get('/auth/twitch/callback', passport.authenticate('twitch', { successRedirect: '/', failureRedirect: '/' }));

// Define a simple template to safely generate HTML with values from user's profile
var template = handlebars.compile(`
<html><head><title>Twitch Auth Sample</title></head>
<table>
    <tr><th>Access Token</th><td>{{accessToken}}</td></tr>
    <tr><th>Refresh Token</th><td>{{refreshToken}}</td></tr>
    <tr><th>Display Name</th><td>{{display_name}}</td></tr>
    <tr><th>Bio</th><td>{{bio}}</td></tr>
    <tr><th>Image</th><td>{{logo}}</td></tr>
</table></html>`);

// If user has an authenticated session, display it, otherwise display link to authenticate
app.get('/', function (req, res) {
  if(req.session && req.session.passport && req.session.passport.user) {
    res.render("home" , {currentUser: req.session.passport.user});
    console.log(req.session.passport.user);
  } else {
    res.render("login");
  }
});

//Logout route
app.get("/logout", function(req, res){
    req.logout();
    res.redirect("/");
});

// TO DZIAŁA
// app.get('/followers', function (req, res) {
//   //REQUEST TO TWITCH API FOR FOLLOWERS
//   var options = {
//         url : "https://api.twitch.tv/helix/users/follows?from_id=23161357",
//         headers: {
//             'Client-ID': 'ajppaljrnqzxcmw130391s1o867sy9'
//         }
//     };
  
//     request(options, function(error, response, body){
//         if(!error && response.statusCode === 200){
//             var followersID = JSON.parse(body);
//             res.render("followers", {data: followersID});
//         }
//     });
// });

app.get('/followers', function (req, res) {
  //REQUEST TO TWITCH API FOR FOLLOWERS
  if(req.session && req.session.passport && req.session.passport.user) {
  var options = {
        url : "https://api.twitch.tv/helix/users/follows?from_id=" + req.session.passport.user._id + "&first=100",
        headers: {
            'Client-ID': 'ajppaljrnqzxcmw130391s1o867sy9'
        }
  };
  
    request(options, function(error, response, body){
        if(!error && response.statusCode === 200){
            var followersIdsInJson = JSON.parse(body)["data"];
            var followersIds = [];
            var streams = [];
            //console.log(followersIdsInJson);
            //Zrzuć ID z Json do zwykłej tablicy
            var i = 0;
            followersIdsInJson.forEach(function(id){
              if(i == 0) {
                followersIds[i] = "?id=" + id.to_id;
                streams[i] = "?user_id=" + id.to_id;
              } else {
              followersIds[i] = "&id=" + id.to_id;
              streams[i] = "&user_id=" + id.to_id;
              }
              
              i++;
            });
            
            var optionsForDisplayNames = {
                url : "https://api.twitch.tv/helix/users" + followersIds.join("") + "&first=100",
                headers: {
                    'Client-ID': 'ajppaljrnqzxcmw130391s1o867sy9'
              }
            };
            
            request(optionsForDisplayNames, function(error, response, body){
              if(!error && response.statusCode === 200){
                var displayNames = JSON.parse(body);
                //Jeśli się uda to zapytaj o streamy
                var optionsForStreams = {
                url : "https://api.twitch.tv/helix/streams" + streams.join("") + "&first=100&type=live",
                headers: {
                    'Client-ID': 'ajppaljrnqzxcmw130391s1o867sy9'
                }
                };
            
                request(optionsForStreams, function(error, response, body){
                  if(!error && response.statusCode === 200){
                  var streams = JSON.parse(body);
                  if(streams["data"][0] === undefined) {
                    res.send("There is no one online now :(");
                  } else {
                  res.render("followers", {streams: streams, displayNames: displayNames});
                  }
                  }
                  });
                  }
                });
            
            //console.log(displayNames);
            
        }
    });
  } else {
      res.redirect("/");
  }
});

app.listen(process.env.PORT, process.env.IP, function () {
  console.log('Twitch has started! :)');
});