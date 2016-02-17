var redis = require('redis'); 

var redisClient = redis.createClient(); 

function getRoot(req, res)  {
	redisClient.incr('redis3:hits', function(err, hits) {
		res.send('Hello Borld! You are caller number ' + hits);
	});
}

module.exports.register = function(app) {
    app.get('/', getRoot);
}
