var dateStart = new Date().toISOString();

function getMotd(req, res) {
    var response = {
        status: "success",
        data: {
            lastModified: dateStart,
            motd: "Did Users. Did iTems and inventory. Tried SSL."
        }
    }

    res.send(JSON.stringify(response));
}

module.exports.register = function(app, root) {
    app.get(root + "get", getMotd);
    app.post(root + "get", getMotd);
}
