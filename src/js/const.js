const PRODUCTION = false;
module.exports = {
    PRODUCTION,
    dbName: 'xare',
    dbUrl: PRODUCTION ? 'mongodb://localhost' : 'mongodb://me.karthisgk.be',
    liveUrl: PRODUCTION ? 'http://me.karthisgk.be:4040/' : 'http://192.168.43.97:4040/',
    defaultIconName: 'default.png'
}