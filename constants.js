//
// constants to set for service operation
//

module.exports = Object.freeze({

    SKIPOBANSCAN:    false, // setting this to true will skip Oban and relay to SVR immediately.
    LOGLEVEL:       'info',
    LISTENPORT:     '10025',
    DROPCODE:       659,
    RELAYDOWNCODE:  512, // thrown in case SVR remote MTA relay is down, should force incoming relay to retry
    HASHCHECKCODE:  554,
    MAXCLIENTS:     300,
    MAXSIZE:        20 * 1024 * 1024, //20 MB

    // Production service settings -- these could be improved for simplicity in deployment.
    KONTXTFEATURE:  'inflight',
    KONTXTAPI:      'http://172.17.0.1:7777/text/analyze',
    DESTIP:         '172.17.0.1',
    DESTPORT:       25,

    // Local dev service settings
    //KONTXTFEATURE:  'inflight_local',
    //KONTXTAPI:      'http://192.168.65.2:7777/text/analyze',
    //DESTIP:         '192.168.65.2',
    //DESTPORT:       10025,

});
