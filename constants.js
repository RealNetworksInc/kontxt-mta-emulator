//
// constants to set for service operation
//

module.exports = Object.freeze({

    SKIPKONTXTSCAN:  false, // setting this to true will skip KONTXT processing and relay to next MTA immediately.
    LOGLEVEL:       'info',
    LISTENPORT:     '10025',
    DROPCODE:       659,
    RELAYDOWNCODE:  512, // thrown in case remote MTA relay is down, should force incoming relay to retry
    HASHCHECKCODE:  554,
    MAXCLIENTS:     100, // we certified at 80, but we can handle greater in SVR prod
    MAXSIZE:        20 * 1024 * 1024, //20 MB

    // Local dev service settings, this MTA is useless without the KONTXT API setup to receive the SMTP/MMS pacakge
    KONTXTFEATURE:  'inflight_local',
    KONTXTAPI:      'http://192.168.65.2:7777/text/analyze',
    DESTIP:         '192.168.65.2',
    DESTPORT:       10025,

});
