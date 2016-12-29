var mongo = require("mongodb");
var MongoClient = mongo.MongoClient;
var redis = require("redis").createClient();

var url = "mongodb://localhost:27017/cs261db" + process.env.NODE_ENV;

function getClient(req,res){
  var outObj = {};
  var sesh = (req.body._session || req.query._session);
  var tok  = (req.body._token   || req.query._token);
  redis.lrange(sesh, 0, -1, function(err, results){
    if(results.length > 0 && tok == results[1])
    {
      MongoClient.connect(url, function(err, db){
        if(err) return res.send(err);
        db.collection("clients").findOne({clientName:"Asteroids"}, function(err, obj){
          if(err) return res.send(err);
          outObj.status = "success";
          outObj.url=obj.url;
          outObj.hash = obj.hash;
          outObj.version = obj.version;
          outObj.lastUpdated = obj.lastUpdated;
          return res.send(outObj);
        });
    
      });
    }
    else
    {
      return res.send({status:"fail"});
    }
  });
  
}

function update(req,res)
{
 // return res.send("GRWG");
  var sesh = (req.body._session || req.query._session);
  var tok  = (req.body._token   || req.query._token);
  var newurl = (req.body.url    || req.query.url);
  var hash   = (req.body.hash   || req.query.hash);
  var version = (req.body.version || req.query.version);
  var clientName = (req.body.clientName || req.query.clientName);
  //return res.send("GRWRG");
  redis.lrange(sesh, 0, -1, function(err, results){
    //return res.send({tok:tok, token:results[1]});
    if(results.length>0 && tok==results[1] && results[0]=="admen"){
      //return res.send("RWONHRW");
      var toReplace = {};
      toReplace.url = newurl;
      toReplace.hash = hash;
      toReplace.version = version;
      toReplace.clientName = clientName;
      toReplace.lastUpdated = new Date().toISOString();
      MongoClient.connect(url, function(err, db){
        db.collection("clients").replaceOne({clientName:toReplace.clientName}, toReplace, {upsert:true}, function(err, rep){
          return res.send("UPDATED");
        });
      });
    }
    else{
      return res.send("You aren't allowed");
    }
  });
  
}


module.exports.register = function(app, root){
  app.get(root+"get", getClient);
  app.post(root+"update", update);
}





































