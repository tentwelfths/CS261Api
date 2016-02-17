module.exports = function(options) {

    // options not needed

    return function(req, res, next) {
        res.contentType('application/json');
        next();
    }
}
