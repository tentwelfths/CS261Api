function getTest(req, res) {
    res.send("THIS IS A TEST");
}

module.exports.register = function(app, root) {
    app.get(root + 'get', getTest);
}
