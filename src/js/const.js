const PRODUCTION = false;
module.exports = {
    PRODUCTION,
    dbName: 'xare',
    dbUrl: PRODUCTION ? 'mongodb://localhost' : 'mongodb://localhost',
    liveUrl: PRODUCTION ? 'http://me.karthisgk.be:4040/' : 'http://me.karthisgk.be:4040/',
    defaultIconName: 'default.png'
}