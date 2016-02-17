var mongo = require("mongodb");
var MongoClient = mongo.MongoClient;
var crypto = require("crypto");
var redis = require("redis").createClient();
var async = require("async")


var url = "mongodb://localhost:27017/cs261db" + process.env.NODE_ENV;

var singleton = null;




function createAccount(req, res)
{
//  res.send("Q#$J^");
//  return;
	var usern = (req.body.username || req.query.username);
	var pwd   = (req.body.password || req.query.password);
	var avtr  = (req.body.avatar   || req.query.avatar);
	if(usern && pwd)
  {
		MongoClient.connect(url, function(err, db){
			if(err)
			{
				return res.send(err);
			}
			else
			{
				var collection = db.collection("users");
				collection.findOne({username:usern}, function(err, obj) {
					if(err) return res.send(err);
					if(obj)
					{
						var outObj = {status:"fail", reason:{username:"Already taken"}};
						res.send(outObj);
					}
					else
					{
						var user = {username:usern, password:pwd, avatar:avtr, isAdmin:false};
						collection.insert(user, function(err, result){
							if (err) {
								return res.send(err);
							} 
							else 
							{
							  
							  var outObj = {status:"success", data:{id:result.ops[0]._id, username:usern}};
							  return res.send(outObj);
      				}
							db.close();
						});
  				}
				});
			}
			
		});
	}
	else
	{
		return res.send({status:"fail", reason:"Missing parameters"});
	}
}

function loginUser(req,res)
{
  var uname = "";
	var pwd = "";
	if(req.query.username)
	{	
		uname = req.query.username;
	}
	if(req.query.password)
	{
		pwd = req.query.password;
	}
	
	if(req.body)
	{
		if(req.body.username)
		{
			uname = req.body.username;
		}
		if(req.body.password)
		{
			pwd = req.body.password;
		}
	}
  
	if(uname)
	{
	  MongoClient.connect(url, function(err, db){
			if(err)
			{
				return res.send(err);
			}
			else
			{
				var collection = db.collection("users");
				collection.findOne({username:uname}, function(err, obj) {
					if(err) return res.send(err);
					if(obj)
					{//USER EXISTS
					  if(obj.password === pwd)
					  {
					    crypto.randomBytes(20, function(err, sesh){
					      var session = sesh.toString("hex");
					      crypto.randomBytes(20, function(err, tok){
					        var token = tok.toString("hex");
					        redis.rpush(session, uname, token);
					        redis.expire(session, 3600);
	  				  	  var outObj = {status:"success", data:{id:obj._id,session:session, token:token}};
  					  	  return res.send(outObj);
  					  	  db.close();
					  	  });
					  	});
						}
						else
						{
						  var outObj = {status:"fail", reason:"Username/password mismatch"};
					  	return res.send(outObj);
						}
					}
					else
					{ //USER DOESN'T EXIST
						var outObj = {status:"fail", reason:"Username/password mismatch"};
						return res.send(outObj);
					}
				});
			}
			
		});
	}
}

function getUser(req,res)//auth
{
  var myID = "";
  myID = new mongo.ObjectID(req.params.id);
  var sesh = (req.body._session ||req.query._session);
  var tok =  (req.body._token   ||req.query._token);
  redis.lrange(sesh, 0, -1, function(err, result){
    if(result.length > 0 && tok === result[1])
    {
	    if(myID)
	    {
	      MongoClient.connect(url, function(err, db){
	  		  if(err)
		  	  {
			    	return res.send(err);
			    }
  			  else
	  		  {
		  		  var collection = db.collection("users");
			  	  collection.findOne({_id:myID}, function(err, obj) {
				  	  if(err) return res.send(err);
				  	  if(obj)
					    {//USER EXISTS
  					  	var outObj = {status:"success", data:{id:obj._id,username:obj.username, avatar:obj.avatar}};
	  				  	return res.send(outObj);
		  			  }
			  		  else
  			  		{ //USER DOESN'T EXIST
	  			  		var outObj = {status:"fail",reason:{id:"invalid"}};
		  			  	return res.send(outObj);
  			  		}
	  			  	db.close()
  	  			});
	  	  	}  
	    	});
	  	}
  	}
  	else
  	{
  	  var outObj = {status:"fail", reason:"Not authenticated"};
  	  res.send(outObj);
  	}
	});
}

function findUser(req,res)//auth
{
  var uname = (req.params.username);
  
	if(uname)
	{
	  var sesh = (req.body._session || req.query._session);
    var tok  = (req.body._token   || req.query._token);
    
    redis.lrange(sesh, 0, -1, function(err, result){
      
      if(result.length > 0 && tok === result[1])
      {
	      MongoClient.connect(url, function(err, db){
		     	if(err)
		  	  {
    				return res.send(err);
	    		}
		    	else
			    {
             var collection = db.collection("users");
  	  			 collection.findOne({username:uname}, function(err, obj) {
	  	  		 	if(err) return res.send(err);
		  	  		if(obj)
			  	  	{//USER EXISTS
				  	  	var outObj = {status:"success", data:{id:obj._id,username:obj.username}};
					  	  return res.send(outObj);
    					}
	    				else
		    			{ //USER DOESN'T EXIST
			    			var outObj = {status:"fail",reason:{id:"invalid"}};
				    		return res.send(outObj);
					    }
  					  db.close()
  	  			});
	  		  }
			  
    		});
  	  }
  	  else
  	  {
  	    var outObj = {status:"fail", reason:"Not authenticated"};
  	    res.send(outObj);
  	  }
  	});
	}
}

function updateUser(req,res)
{
  var oldP =    (req.body.oldPassword || req.query.oldPassword);
  var newP =    (req.body.newPassword || req.query.newPassword);
  var avatar =  (req.body.avatar      || req.query.avatar);
  var isAdmin = (req.body.isAdmin     || req.query.isAdmin);
  var sesh =    (req.body._session    || req.query._session);
  var tok =     (req.body._token      || req.query._token);
  redis.lrange(sesh, 0, -1, function(err, result){
    if(err)return res.send(err);
    if(result.length > 0 && tok === result[1])
    {
        
      var myID = "";
      var temp = req.params.id;
      myID = new mongo.ObjectID(req.params.id);
  
    	if(myID)
    	{
   
	      MongoClient.connect(url, function(err, db){
		    	if(err)
			    {
    				return res.send(err);
	    		}
		    	else
			    {
			      
				    var collection = db.collection("users");
  				  collection.find({$or: [{_id:myID},{username:result[0]}]}).toArray(function(err, obj) {
  				    
  	  				if(err) return res.send(err);  	  				
  	  			
	  	  			if(obj.length === 1 && obj[0].username === result[0]) //this user is updating himself
		  	  		{//USER EXISTS
		  	  		
			  	  		var successObj = {status:"Success", data:{}};
			  	  		var usr = obj[0];
			  	  		//res.send(usr);
				  	  	if(usr.password === oldP && newP)
					  	  {
					  	    usr.password = newP;
					  	    successObj.data.password = newP;
						      //return res.send("QEG");
  						    //update
  	  					}
	  	  				else if(newP)
		  	  			{
			  	  		  var outObj= {status:"fail", reason:{oldPassword:"Forbidden"}};
				  	  	  return res.send(outObj);
					  	  }
					  	  
					  	  if(avatar)
					  	  {
  					  	  successObj.data.avatar = avatar;
					  	    usr.avatar = avatar;
					  	  }
					  	  
					  	  collection.replaceOne({_id:myID}, usr, function(err, result){
  					  	  return res.send(successObj);
  					  	});
  		  			}
  		  			else if(obj.length === 2) //Someone else is trying to update this user
  		  			{//user exists
  		  			    
  		  			  	var adm;
  		  			  	var usr;
  		  			  	if(temp == obj[0]._id)
  		  			  	{
  		  			  	  usr = obj[0];
  		  			  	  adm = obj[1];
  		  			  	}
  		  			  	else
  		  			  	{
  		  			  	  usr = obj[1];
  		  			  	  adm = obj[0];
  		  			  	}
  		  			  	//return res.send(myID + "\n" + obj[0]._id);
  		  			  	//return res.send(JSON.stringify(obj[0]) + "\n" + JSON.stringify(obj[1]) + "\n\n" +JSON.stringify(usr) + "\n" + JSON.stringify(adm));
  		  			    if(adm.isAdmin)
  		  			    {
  		  			  
  		  			      var successObj = {status:"success", data:{}};
  		  			      if(newP)
  		  			      {
  		  			        usr.password = newP;
  		  			        successObj.data.password=newP;
  		  			      }
  		  			      if(isAdmin == "false" || isAdmin == "true")
  		  			      {
  		  			        usr.isAdmin = isAdmin;
  		  			        successObj.data.isAdmin = isAdmin;
  		  			      }
  		  			      if(avatar)
  		  			      {
  		  			        usr.avatar = avatar;
  		  			        successObj.data.avatar = avatar;
  		  			      }
  		  			          
  		  			      collection.replaceOne({_id:myID}, usr, function(err, result){
  		  			          //return res.send("trheqw");
  		  			        return res.send(successObj);
  		  			      });
  		  			    }
  		  			    else
  		  			    {
  		  			      var failObj = {status:"fail", reason:{isAdmin:"Forbidden"}};
  		  			      return res.send(failObj);
  		  			    }
  		  			 
  		  			}
	  		  		else
		  		  	{ //USER DOESN'T EXIST
			  		  	var failObj = {status:"fail",reason:{id:"invalid"}};
  			  			return res.send(outObj);
	  			  	}
		  			  db.close()
  			  	});
	  	  	} 
		  	
		    });
		  }
	  }
	  else
	  {
	    res.send("GET AUTHD");
	  }
  });
}

module.exports.register = function(app, root) {
    app.post(root + "create", createAccount);
    app.get(root + "login", loginUser);
    app.post(root + "login", loginUser);
    app.get(root + ":id/get", getUser);
    app.post(root + ":id/get", getUser);
    app.get(root + "find/:username", findUser);
    app.post(root + "find/:username", findUser);
    app.post(root + ":id/update", updateUser);
}
