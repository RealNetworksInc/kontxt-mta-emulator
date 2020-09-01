/* eslint no-console: 0 */

'use strict';

// mms.js
const {SMTPServer} = require('smtp-server');
const SMTPConnection = require('nodemailer/lib/smtp-connection');
const log4js = require('log4js');
const axios = require('axios');

const listenPort     = '10025';
const dropCode       = 659;
const maxClients     = 75;
const maxSize        = 20 * 1024 * 1024; // 20 MB
const kontxtFeature  = 'inflight';

// Production settings
const kontxtApi      = 'http://172.17.0.1:7777/text/analyze'; // Local container for analysis 172.17.0.1
const destIp         = '172.17.0.1';  // Relay for successful message, non blocked from inflight
const destPort       = 25;

// Local host development
//const kontxtApi      = 'http://192.168.65.2:7777/text/analyze'; // Local container for analysis
//const destIp = '192.168.65.2';  // ping host.docker.internal from inside the docker container to get host IP
//const destPort = 11025;

let kontxtResult = '';
let kontxtContent = '';
let concatStream = '';

log4js.configure({
    appenders: {
        everything: { type: 'file', filename: 'log/all-the-logs.log', maxLogSize: 209715200, backups: 10, compress: false }
    },
    categories: {
        default: { appenders: [ 'everything' ], level: 'info'}
    }
});
const logger = log4js.getLogger();
logger.level = "info";

const server = new SMTPServer({
    // disable STARTTLS to allow authentication in clear text mode
    banner: 'Welcome to the KONTXT SMTP MTA Emulator',
    disabledCommands: ['STARTTLS', 'AUTH'],
    logger: false,
    size: maxSize,
    maxClients: maxClients,
    onData (stream, session, callback ){

        stream.pipe(process.stdout); // print message to console

        stream.on( 'data', (chunk) => {
            concatStream += chunk.toString();
        });

        stream.on('end', () => {

            logger.debug( 'Payload features: ' + kontxtFeature );
            logger.debug( 'Payload rawSmtp: ' + concatStream );

            axios.post( kontxtApi, {

                features: kontxtFeature,
                rawSmtp: concatStream

            } )
                .then((res) => {

                    if( undefined !== res.data.data[0]  ) {

                        const inflightResults = res.data.data[0]['inflight_results'];

                        kontxtResult = inflightResults.spam;

                        logger.debug( 'Raw block result from payload: ' + kontxtResult );

                    }

                    if (kontxtResult === true ) {

                        logger.info( 'Message blocked by Inflight. Response: ' + kontxtResult );
                        concatStream = '';

                        let err = new Error( 'Message blocked. Inflight Response: ' + kontxtResult );
                        err.responseCode = dropCode;
                        return callback( err );

                    }

                    let connection = new SMTPConnection( {
                        port: destPort,
                        host: destIp,
                        secure: false,
                        ignoreTLS: true,
                        connectionTimeout: 5000,
                        debug: false,
                        name: 'mms.relay.kontxt.cloud'
                    });

                    // keep process running on any exception, especially remote MTA relay! -mjb
                    connection.on( 'error', function ( err ) {
                        logger.error( 'SMTP POST ERROR CAUGHT. Message: ' + err );
                        concatStream = '';
                        callback( null, "Message OK but MTA likely down." );
                    });

                    connection.connect(() => {

                        logger.info( 'CONNECTION ESTABLISHED TO REMOTE MTA' );

                        connection.send({
                            from: session.envelope.mailFrom,
                            to: session.envelope.rcptTo
                        }, concatStream, function (err, info) {

                            logger.info( 'Message not blocked, relayed to remote MTA. Response: ' + kontxtResult );

                            connection.quit();
                            concatStream = '';
                            return callback( null, "Message OK. Inflight Response: " + kontxtResult );

                        });
                    });
                })
                .catch((error) => {
                    logger.error( 'ObanMicro API SMTP POST ERROR CAUGHT. Message: ' + error.message );
                    concatStream = '';
                    callback(null, "Message OK. Inflight Response: None (Could not connect to ObanMicro API)");
                });
        });
    },
});

server.on('error', error => {
    logger.error( 'ERROR CAUGHT. Message: ' + error.message );
});

server.listen( listenPort );