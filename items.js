var mongo = require("mongodb");
var MongoClient = mongo.MongoClient;
var redis = require("redis").createClient();
var crypto = require("crypto");
var async = require("async");

var urllibrary = require("url");
var qs = require("qs");

var url = "mongodb://localhost:27017/cs261db" + process.env.NODE_ENV;

function createItem(req,res)
{
  //return res.send("HERE");
  var sesh = (req.body._session||req.query._session);
  var tok  = (req.body._token  ||req.query._token);
  
  redis.lrange(sesh, 0, -1, function(err, results){
    if(results.length > 0 && tok === results[1])
    {
      var shortname = (req.query.shortname || req.body.shortname);
      MongoClient.connect(url, function(err, db){
        if(err) return res.send(err);
        var collection = db.collection("items");
        collection.findOne({shortname:shortname}, function(err, item){
          if(item) return res.send({status:"fail", reason:{shortname:"Already taken"}});
          
          var obj = {};
          obj.shortname = shortname;
          obj.name = "";
          obj.description = "";
          obj.isStackable = false;
          obj.attributes = {};
          
          collection.insert(obj, function(err, result){
            if(err) return res.send(err);
            var outObj = {status:"success", data:{id:result.ops[0]._id, shortname:shortname}};
            return res.send(outObj);
            db.close();
          });
        });
      });
    }
    else
    {
      res.send("YOU AINT AUTHD");
    }
  });  
  
}

function getItem(req,res)
{
  var id = new mongo.ObjectID(req.params.id);
 
  MongoClient.connect(url, function(err, db){
    if(err) return res.send(err);
    var collection = db.collection("items");
    collection.findOne({_id:id}, function(err, item){
      if(err) return res.send(err);
      if(item)
      {
        var outObj = {status:"success", data:{id:id, shortname:item.shortname,name:item.name,description:item.description, isStackable:item.isStackable,
                      attributes:item.attributes}};
        return res.send(outObj); 
      }
      else
      {
        return res.send({status:"fail", reason:{id:"Invalid"}});
      }
    });
  });
}


function findItem(req,res)
{
  var query = qs.parse(urllibrary.parse(req.url).query);
  
  MongoClient.connect(url, function(err, db){
    if(err) return res.send(err);
    var collection = db.collection("items");
    //return res.send(query.items);
    collection.find( {$or: query.items}).toArray( function(err, item){
      if(err) return res.send(err);
      if(item)
      {
        var outObj = {status:"success", data:{item}};
        return res.send(outObj); 
      }
      else
      {
        return res.send({status:"fail", reason:{id:"Invalid"}});
      }
    });
  });
}

function listItems(req,res)
{
  MongoClient.connect(url, function(err, db){
    if(err) return res.send(err);
    var collection = db.collection("items");
    
    collection.find().toArray( function(err, item){
      
      if(err) return res.send(err);
      if(item)
      {
        var outObj = {status:"success", data:{item}};
        return res.send(outObj); 
      }
      else
      {
        return res.send({status:"fail", reason:{id:"Invalid"}});
      }
    });
  }); 
}

function updateItem(req,res)
{
  var id          = req.params.id;
  var sesh        = (req.body._session    || req.query._session);
  var tok         = (req.body._token      || req.query._token);
  var name        = (req.body.name        || req.query.name);
  var description = (req.body.description || req.query.description);
  var isStackable = (req.body.isStackable || req.query.isStackable);
  var attributes  = (req.body.attributes  || req.query.attributes);
  
  var myID = new mongo.ObjectID(id);
      // return res.send(JSON.stringify(id) + "\n" + JSON.stringify(myID));
  redis.lrange(sesh, 0,-1, function(err, results){
    if(tok === results[1])
    {
      
      MongoClient.connect(url, function(err, db){
        var userCollection = db.collection("users");
        userCollection.findOne({username:results[0]}, function(err, adm){
          if(err) return res.send(err);
          
          if(adm.isAdmin)
          {
            
            var itemCollection = db.collection("items");
            itemCollection.findOne({_id:myID }, function(err, item){
              if(err) return res.send(err);
              
              var outObj = {status:"success", data:{id:id}};
              if(name)
              {
              
                item.name = name;
               // return res.send("A");
                outObj.data.name = name;
              }
             // return res.send("A");
              if(description)
              {
                item.description = description;
                outObj.data.description = description;
              }
              if(isStackable === "false" || isStackable)
              {
                item.isStackable = isStackable;
                outObj.isStackable = isStackable;
              }
              if(attributes)
              {
                item.attributes = attributes;
                outObj.data.attributes = attributes;
              }
              itemCollection.replaceOne({_id:myID}, item, function(err, re){
                if(err) return res.send(err);
                return res.send(outObj);
              });
            });
          }
          else
          {
            return res.send({status:"fail",reason:"Forbidden"});
          }
        });
      });
    }
  });
}

module.exports.register = function(app, root){
  app.post(root + "create", createItem);
  app.get(root + ":id/get", getItem);
  app.post(root + ":id/get", getItem);
  app.get(root + "find", findItem);
  app.post(root + "find", findItem);
  app.get(root + "list", listItems);
  app.post(root + "list", listItems);
  app.post(root + ":id/update", updateItem);
};
