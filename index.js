var express = require("express");

var app = express();

var home = require("./redishello");
var test = require("./test");
var items = require("./items");
var user = require("./users");
var inventory = require("./inventory");
var motd = require("./motd");
var headerMiddleware = require("./header");
var bodyParse = require("body-parser");



var apiRoot = "/";


home.register(app);

app.use(headerMiddleware());

app.use(bodyParse.json());


test.register(app, apiRoot+"test/");

user.register(app, apiRoot+"users/");

inventory.register(app, apiRoot+"users/");

motd.register(app, apiRoot+"motd/");

items.register(app, apiRoot+"items/");

app.listen(7000);
