var mongo = require("mongodb");
var MongoClient = mongo.MongoClient;
var redis = require("redis").createClient();
var async = require("async");

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
  async.waterfall([
    function(next){//authentication
      
      redis.lrange(sesh, 0, -1, function(err, results){
        if(err) return next(err);
        if(results.length > 0 && tok==results[1]){
          next(null, results[0]);
        }
        else{
          next({status:"fail", reason:results}, null);
        }
     });
    },
    function(username, next){//connect to db
      
      MongoClient.connect(url, function(err,db){
        if(err) return next(err);
        next(null, db, username);
      });
    },
    function(db, username, next){//is admin?
      
      var users = db.collection("users");
      users.findOne({username:username}, function(err, admin){
        if(err) return next(err);
        if(admin.isAdmin)
        {
          next(null, db);
        }
        else
        {
          return next({status:"fail", reason:"Forbidden"});
        }
      });
    },
    function(db, next){
      
      var itemCollection = db.collection("items");
      
      itemCollection.find().toArray(function(err, itemArray){
        for(var j = 0; j < itemIDs.length; ++j)
        {
          //console.log(j);
          itemIDs[j].userid = tempuserID;
          for(var i = 0; i < itemArray.length; ++i)
          {
            //var tID = mongo.ObjectId(itemIDs[j].itemid);
            var stringID = itemArray[i]._id.toString();
            
            if(itemIDs[j].shortname == itemArray[i].shortname || itemIDs[j].itemid == stringID)
            {
              
              itemIDs[j].found = true;
              if(itemIDs[j].shortname && itemIDs[j].itemid)
              {
              
                if(itemIDs[j].shortname == itemArray[i].shortname && items[j].itemid == stringID)
                {
                 // return next("6");
                  itemIDs[j].found = true;
                  itemIDs[j].isStackable = itemArray[i].isStackable;
                }
                else
                {
                  return next({status:"fail", reason:{"items[index]":"Conflicting ID"}});
                }
              }
              else if(itemIDs[j].shortname)
              {
                itemIDs[j].itemid = stringID;
                itemIDs[j].isStackable = itemArray[i].isStackable;
              }
              else if(itemIDs[j].itemid)
              {
                itemIDs[j].shortname = itemArray[i].shortname;
                itemIDs[j].isStackable = itemArray[i].isStackable;
              }
              else
              {
                //return next("7");
                itemIDs[j].found = true;
                itemIDs[j].isStackable = itemArray[i].isStackable;
              }
            }
            
            if(itemIDs[j].found)
            {
             
              if(itemIDs[j].isStackable)
              {
                
                
                if(items[j].quantity && items[j].quantity > 0)
                {
                  itemIDs[j].quantity = 0;
                  //return next({hur:itemIDs[j].quantity});
                  itemIDs[j].quantity = items[j].quantity;
                  //return next("OKOK");
                }
                else
                {
                 // return next("9");
                  return next({status:"fail", reason:{"items[index]":"Invalid Quantity"}});
                }
              }
              else
              {
                
                if(items[j].quantity && items[j].quantity != 1)
                {
                 // return next("10");
                  return next({status:"fail", reason:{"items[index]":"Invalid Quantity"}});
                }
                else
                {
                 // return next("11");
                  itemIDs[j].quantity = 1;
                }
              }
            }
          }
        
          if(!itemIDs[j].found)
          {
           // return next("HROWIJ");
            var t = itemIDs[j].itemid;
            return next({status:"fail", reason:{"items[index]":"Not Found"}});   
          }
        }
        //combine all quantitys
       // return next("RHOWR");
        for(var i = 0; i < itemIDs.length; ++i)
        {
         // return next("OKHRO");
          if(itemIDs[i].done || !itemIDs[i].isStackable) continue;
          if(itemIDs[i].done)
          {
            itemIDs[i].quantity = itemIDs[itemIDs[i].doneIndex].quantity;
            continue;
          }
         // return next("GEWEG");
          for(var j = i + 1; j < itemIDs.length; ++j)
          {
            if(itemIDs[i].shortname == itemIDs[j].shortname)
            {
              itemIDs[j].done = true;
              itemIDs[j].doneIndex = i;
              itemIDs[i].quantity += itemIDs[j].quantity;
            }
          }
        }
        
        return next(null, db);
      });
    },
    function(db, next)
    {
      var inventory = db.collection("inventory");
      inventory.find().toArray(function(err, invArray){
        if(err) return next(err);
        for(var i = 0; i < itemIDs.length; ++i)
        {
          if(!itemIDs[i].isStackable){
            continue;
          }
          if(itemIDs[i].done)
          {
            itemIDs[i].quantity = itemIDs[itemIDs[i].doneIndex].quantity;
            continue;
          }
          for(var j = 0; j < invArray.length; ++j)
          {
            if(invArray[j].shortname == itemIDs[i].shortname)
            {
              itemIDs[i]._id = invArray[j]._id;
              itemIDs[i].quantity += invArray[j].quantity;
            }
          }
        }
        //return next(null, {status:"success", data:{items:itemIDs}});
        var toInsert = new Array();
        var toUpdate = new Array();
        for(var i = 0; i < itemIDs.length; ++i)
        {
          if(itemIDs[i].isStackable)
          {
            var index = toUpdate.length;
            toUpdate[index] = {};
            toUpdate[index].userid = itemIDs[i].userid;
            toUpdate[index].itemid = itemIDs[i].itemid.toString();
            toUpdate[index].quantity = itemIDs[i].quantity;
            toUpdate[index].shortname = itemIDs[i].shortname;
            toUpdate[index].isStackable = itemIDs[i].isStackable;
          }
          else
          {
            var index = toInsert.length;
            toInsert[index] = {};
            toInsert[index].userid = itemIDs[i].userid;
            toInsert[index].itemid = itemIDs[i].itemid;
            toInsert[index].quantity = itemIDs[i].quantity;
            toInsert[index].shortname = itemIDs[i].shortname;
            toInsert[index].isStackable = itemIDs[i].isStackable;
          }
        }
        return next(null, toUpdate, toInsert, db);
      });
    },
    function(toUpdate, toInsert, db, next){
      var inv = db.collection("inventory");
      var changes = new Array();
      inv.insert(toInsert, function(err, inserted){
        if(err)return next(err);
        
        for(var i = 0; i < inserted.ops.length; ++i)
        {
          changes[i]={};
          changes[i].userid = inserted.ops[i].userid;
          changes[i].itemid = inserted.ops[i].itemid;
          changes[i].id = inserted.ops[i]._id;
          changes[i].quantity = inserted.ops[i].quantity;
          changes[i].shortname = inserted.ops[i].shortname;
          
        }
        async.forEach(toUpdate, function(item, callback){
          
          inv.replaceOne({userid:item.userid, itemid:item.itemid}, item,{upsert:true},  function(err, obj){
            
            var i = changes.length;
            changes[i]={};
            changes[i] = item;
            changes[i].id = obj.upsertedId._id;
            callback();
          });
          
        }, function(err){
          var submit = new Array();
          for(var i = 0; i < itemIDs.length; ++i)
          {
            submit[i] = {};
            for(var j = 0; j < changes.length; ++j)
            {
              if(itemIDs[i].shortname == changes[j].shortname)
              {
                submit[i] = changes[j];
                break;
              }
            }
          }
          next(null, {status:"success", inventory:submit});
        });
      });
    }
  ],
  function(err, outObj){
    if(err) return res.send(err);
    return res.send(outObj);
  });
}

function updateInventory(req,res)
{
  var sesh = (req.body._session || req.query._session);
  var tok  = (req.body._token   || req.query._token);
  if(!sesh) return res.send({status:"fail", reason:"Not Authenticated"});
  var quantity = 0;
  quantity = (req.body.quantity || req.query.quantity);
  if(quantity == undefined) quantity = 0;
  var id = req.params.id;
  var myID = new mongo.ObjectID(id);
  
  redis.lrange(sesh, 0, -1, function(err, results){
    if(results.length > 0 && tok == results[1])
    {
      
      MongoClient.connect(url, function(err, db){
        if(err)return res.send(err);
        var userCollection = db.collection("users");
        
        userCollection.findOne({username:results[0]}, function(err, adm){
       
          if(err)return res.send(err);
          if(!adm.isAdmin) return res.send({status:"fail", reason:{id:"Forbidden"}});
          var collection = db.collection("inventory");
          collection.findOne({_id:myID}, function(err, inv){
          
            if(err)return res.send(err);
            if(inv)
            {
              
              if(inv.isStackable)
              {
                
                if(quantity >= 0)
                {
                  inv.quantity = quantity;
                  
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
                return res.send({status:"success", data:{id:myID, quantity:quantity}});
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
        db.collection("users").findOne({username:results[0]}, function(err, adm){
        if(usr.username == results[0] || adm.isAdmin)
        {
          db.collection("inventory").find({userid:id}).toArray(function(err, inventories){
            if(err)return res.send(err);
            var outObj = {status:"success", data:{}};
            outObj.data.inventory = new Array();
            var j = 0;
            for(var i = 0; i < inventories.length; ++i)
            {
              if(inventories[i].quantity == 0)
                continue;
              //if(inventories[i].quantity == 0) continue;
              //return res.send(inventories);
              outObj.data.inventory[j] = {};
              outObj.data.inventory[j].id = inventories[i]._id;
              outObj.data.inventory[j].itemid = inventories[i].itemid;
              outObj.data.inventory[j].shortname = inventories[i].shortname;
              outObj.data.inventory[j].quantity = inventories[i].quantity;
              ++j;
              //if(!outObj.data.inventory[i].quantity)
              //{
              //  outObj.data.inventory[i].quantity = 1;
              //}
              //outObj.data.inventory[i].userid = userid;
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
  });
}

module.exports.register=function(app, root){
  app.post(root + "users/:userid/inventory/create", createInventory);
  app.post(root +         "inventory/:id",    updateInventory);
  app.get(root  + "users/:userid/inventory/list",   listInventory);
  app.post(root + "users/:userid/inventory/list",   listInventory);
}











function createInverntory(req,res)
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
