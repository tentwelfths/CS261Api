var mongo = require("mongodb");
var MongoClient = mongo.MongoClient;
var redis = require("redis").createClient();

var urlLibrary = require("url");
var qs = require("qs");

var url = "mongodb://localhost:27017/cs261db" + process.env.NODE_ENV;

function createInventory(req,res)
{
  var sesh = (req.body._session || req.query._session);
  var tok  = (req.body._token   || req.query._token);
  var tempuserID = req.params.userid;
  var userID = new mongo.ObjectID(tempuserID);
  var query = qs.parse(urlLibrary.parse(req.url).query);
  var items = (req.body.items || query.items);
  var itemIDs = new Array();
  if(!sesh) return res.send({status:"fail", reason:"Not Authenticated"});
  for(var i = 0; i < items.length; ++i)
  {
    itemIDs[i] = {};
    if(items[i].itemid)
    {
      itemIDs[i].itemid = new mongo.ObjectID(items[i].itemid);
    }
    if(items[i].shortname)
    {
      //return res.send(items[i]);
      itemIDs[i].shortname = items[i].shortname;
    }
    if(!itemIDs[i])
    {
      return res.send({status:"fail", reason:{"item[index]":"No ID"}});
    }
  }
  
  redis.lrange(sesh, 0, -1, function(err, results){
    if(err)return res.send(res);
    
    MongoClient.connect(url, function(err, db){
      //return res.send("GROGROW");
      if(err)return res.send(err);
      db.collection("users").findOne({username:results[0]}, function(err, adm){
        
        if(err) return res.send(err);
        for(var i = 0; i < items.length; ++i)
          if(!items[i].shortname && !items[i].itemid) return res.send({status:"fail", reason:{"items[index]":"No ID"}});
        
        db.collection("items").find({$or: itemIDs}).toArray( function(err, itemArray){
          
          for(var i = 0; i < itemArray.length; ++i)
          {
            for(var j = 0; j < itemIDs.length; ++j)
            {
              if(itemArray[i].shortname == itemIDs[j].shortname || itemArray[i].itemid == itemIDs[j].itemid)
              {
                if(itemIDs[j].shortname && itemIDs[j].itemid)
                {
                  if(!(itemArray[i].shortname == itemIDs[j].shortname && itemArray[i].itemid == itemIDs[j].itemid))
                  {
                    return res.send({status:"fail", reason:{"items[index]":"Conflicting ID"}});
                  }
                }
                itemIDs[j].shortname = itemArray[i].shortname;
                itemIDs[j].itemid    = itemArray[i]._id;
                itemIDs[j].userid    = userID;
                itemIDs[j].mongoItem = itemArray[i];
                itemIDs[j].quantity  = items[j].quantity;
              }
            }
          }
          
          for(var i = 0; i < itemIDs.length; ++i)
          {
            if(!itemIDs[i].mongoItem) return res.send({status:"fail", reason:{"items[index]":"Not found"}});
            if(itemIDs[i].mongoItem.isStackable && itemIDs[i].quantity && itemIDs[i].quantity > 0)
            {
              
            }
            else if(!itemIDs[i].mongoItem.isStackable && (!itemIDs[i].quantity || itemIDs[i].quantity == 1))
            {
              
            }
            else return res.send({status:"fail", reason:{"items[index]":"Invalid Quantity"}});
          }
          
          for(var i = 0; i < itemIDs.length; ++i)
          {
            itemIDs[i].actualQuantity = itemIDs[i].quantity;
            for(var j = 0; j < itemIDs.length; ++j)
            {
              if(itemIDs[i].shortname == itemIDs[j].shortname && itemIDs[i].mongoItem.isStackable && i !== j)
              {
                itemIDs[i].actualQuantity += itemIDs[j].quantity;
              }
            }
          }
          var insertionArray = new Array();
          var outArray = new Array();
          var counter = 0;
          
          for(var i = 0; i < itemIDs.length; ++i)
          {
            
            outArray[i] = {};
            
            outArray[i].itemid = itemIDs[i].itemid;
           
            outArray[i].shortname = itemIDs[i].shortname;
            
            outArray[i].quantity  = itemIDs[i].actualQuantity;
            
            if(itemIDs[i].mongoItem.isStackable)
            {
              var found = false;
              for(var j = 0; j < insertionArray.length; ++j)
              {
                if(insertionArray[j].shortname == itemIDs[i].shortname)
                {
                  found = true;
                  break;
                }
              }
              if(!found)
              {
                insertionArray[counter] = {};
                insertionArray[counter].itemid = itemIDs[i].itemid;
                insertionArray[counter].userid = itemIDs[i].userid;
                insertionArray[counter].shortname = itemIDs[i].shortname;
                insertionArray[counter].quantity = itemIDs[i].actualQuantity;
                ++counter;
              }
            }
            else
            {
              insertionArray[counter] = {};
              insertionArray[counter].itemid = itemIDs[i].itemid;
              insertionArray[counter].userid = itemIDs[i].userid;
              insertionArray[counter].shortname = itemIDs[i].shortname;
              insertionArray[counter].quantity = 1;
              ++counter;
            }
            
          }
         
          db.collection("inventory").insert(insertionArray, function(err, inserted){
            //return res.send("OWNIRGOIWN");
            if(err) return res.send(err);
            var outObj = {status:"success", data:{}};
            for(var i = 0; i < inserted.ops.length; ++i)
            {
              for(var j = 0; j < outArray.length; ++j)
              {
                if(outArray[j].shortname === inserted.ops[i].shortname)
                  outArray[j].id = inserted.ops[i]._id;
              }
            }
            outObj.data.inventory = outArray;
            return res.send(outObj);
          });
        });
      });
    });
  });
}

function updateInventory(req,res)
{
  var sesh = (req.body._session || req.query._session);
  var tok  = (req.body._token   || req.query._token);
  if(!sesh) return res.send({status:"fail", reason:"Not Authenticated"});
  var quantity = 0;
  quantity = (req.body.quantity || req.query.quantity);
  var id = req.params.id;
  var myID = new mongo.ObjectID(id);
  redis.lrange(sesh, 0, -1, function(err, results){
    if(tok === results[1])
    {
      
      MongoClient.connect(url, function(err, db){
        if(err)return res.send(err);
        var userCollection = db.collections("users");
        usersCollection.findOne({username:results[0]}, function(err, adm){
          if(err)return res.send(err);
          if(!adm.isAdmin) return res.send({status:"fail", reason:{id:"Forbidden"}});
          var collection = db.collections("usersInventory");
          collection.findOne({_id:myID}, function(err, inv){
            if(err)return res.send(err);
            if(inv)
            {
              if(inv.isStackable)
              {
                if(quantity >= 0)
                {
                  inv.quanity = quantity;
                }
                else
                {
                  return res.send({status:"fail", reason:{quantity:"Invalid"}});
                }
              }
              else
              {
                if(quantity >=0 && quantity <= 1)
                {
                  inv.quantity = quantity;
                } 
                else
                {
                  return res.send({status:"fail", reason:{quantity:"Invalid"}});
                }
              }
              collection.replaceOne({_id:myID}, inv, function(err, result){
                if(err)return res.send(err);
                return res.send({id:myID, data:{quantity:quantity}});
              });
            }
            else
            {
              return res.send({status:"fail", reason:{id:"invalid"}});
            }
      
          });
        });
      });
    }
    else
    {
      return res.send("NOT AUTHD");  
    }
  });
}

function listInventory(req,res)
{
  var sesh = req.query._session;
  var tok = req.query._token;
  if(!sesh) return res.send({status:"fail", reason:"Not Authenticated"});
  if(req.body)
  {
    if(req.body._session) sesh = req.body._session;
    if(req.body._token) tok = req.body._token;
  }
  var id = req.params.userid;
  var userid = new mongo.ObjectID(id);
  redis.lrange(sesh, 0, -1, function(err, results){
    if(err)return res.send(err);
    if(tok != results[1]) return res.send({status:"fail", reason:"not authd"});
    MongoClient.connect(url, function(err, db){
      if(err) return res.send(err);
      db.collection("users").findOne({_id:userid}, function(err, usr){
        if(err)return res.send(err);
        if(usr.username == results[0] || usr.isAdmin)
        {
          db.collection("inventory").find({userid:userid}).toArray(function(err, inventories){
            if(err)return res.send(err);
            var outObj = {status:"success", data:{}};
            outObj.data.inventory = new Array();
            for(var i = 0; i < inventories.length; ++i)
            {
              return res.send(inventories);
              outObj.data.inventory[i].id = inventories[i]._id;
              outObj.data.inventory[i].itemid = inventories[i].itemid;
              outObj.data.inventory[i].shortname = inventories[i].shortname;
              outObj.data.inventory[i].quantity = inventories[i].quantity;
            }
            return res.send(outObj);
          });
        }
        else
        {
          return res.send({status:"fail", reason:{userid:"forbidden"}});
        }
      });
    });
  });
}

module.exports.register=function(app, root){
  app.post(root + ":userid/inventory/create", createInventory);
  app.post(root + "inventory/:id",            updateInventory);
  app.get(root  + ":userid/inventory/list",   listInventory);
  app.post(root + ":userid/inventory/list",   listInventory);
}
