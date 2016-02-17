var http = require('http'); var hits = 1; var server = http.createServer(function(request, response) {
	if (request.url === '/')
	{
		response.end("Hello world! You are caller number " + hits);
		hits = hits + 1;
	}
	else
	{
		response.end();
	}
});
server.listen(7000); console.log("Listening!");
