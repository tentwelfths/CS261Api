var express = require("express");

var app = express();

var home = require("./redishello");
var test = require("./test");
var items = require("./items");
var user = require("./users");
var inventory = require("./inventory");
var clients = require("./clients");
var motd = require("./motd");
var headerMiddleware = require("./header");
var bodyParse = require("body-parser");



var apiRoot = "/";


home.register(app);

app.use(headerMiddleware());

app.use(bodyParse.json());


test.register(app, apiRoot+"test/");

user.register(app, apiRoot+"users/");

inventory.register(app, apiRoot+"");

motd.register(app, apiRoot+"motd/");

items.register(app, apiRoot+"items/");

clients.register(app, apiRoot+"clients/");

app.listen(7000);
