const PRODUCTION = false;
const port = 4040;
const IP = 'server.phoenixmarketing.in';
module.exports = {
    port,
    PRODUCTION,
    dbName: 'xare',
    dbUrl: PRODUCTION ? 'mongodb://localhost' : 'mongodb://localhost',
    liveUrl: PRODUCTION ? 'http://me.karthisgk.be:4040/' : 'http://'+IP+':'+port+'/',
    defaultIconName: 'default.png'
}